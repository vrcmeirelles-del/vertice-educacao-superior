import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface NotifyRequest {
  channel: 'whatsapp' | 'email' | 'sms' | 'all';
  institution_id: string;
  template: string;
  recipients: { name: string; phone?: string; email?: string; student_id?: string }[];
  custom_message?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Missing authorization');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !user) throw new Error('Unauthorized');

    const body: NotifyRequest = await req.json();
    const { channel, institution_id, template, recipients, custom_message } = body;

    if (!recipients?.length) throw new Error('No recipients');

    const results: { name: string; whatsapp?: string; email?: string; sms?: string }[] = [];

    for (const r of recipients) {
      const result: any = { name: r.name };

      // ── WhatsApp via Meta Cloud API ──
      if ((channel === 'whatsapp' || channel === 'all') && r.phone) {
        try {
          const waToken = Deno.env.get('WHATSAPP_TOKEN');
          const waPhoneId = Deno.env.get('WHATSAPP_PHONE_ID');
          if (!waToken || !waPhoneId) throw new Error('WhatsApp not configured');

          const phone = r.phone.replace(/\D/g, '');
          const waPhone = phone.startsWith('55') ? phone : '55' + phone;

          const waBody: any = {
            messaging_product: 'whatsapp',
            to: waPhone,
            type: 'text',
            text: {
              body: custom_message || `Olá ${r.name.split(' ')[0]}, sua instituição enviou uma mensagem pela Vértice.`,
            },
          };

          // Se tem template aprovado no Meta, usar template
          if (template && template !== 'text' && template !== 'livre') {
            waBody.type = 'template';
            waBody.template = {
              name: template,
              language: { code: 'pt_BR' },
              components: [{
                type: 'body',
                parameters: [
                  { type: 'text', text: r.name.split(' ')[0] },
                  { type: 'text', text: custom_message || 'Você tem uma nova notificação.' },
                ],
              }],
            };
            delete waBody.text;
          }

          const waRes = await fetch(
            `https://graph.facebook.com/v21.0/${waPhoneId}/messages`,
            {
              method: 'POST',
              headers: { Authorization: `Bearer ${waToken}`, 'Content-Type': 'application/json' },
              body: JSON.stringify(waBody),
            }
          );
          const waData = await waRes.json();
          result.whatsapp = waRes.ok ? 'sent' : (waData.error?.message || 'failed');
        } catch (e) {
          result.whatsapp = (e as Error).message;
        }
      }

      // ── Email via Resend ──
      if ((channel === 'email' || channel === 'all') && r.email) {
        try {
          const resendKey = Deno.env.get('RESEND_API_KEY');
          if (!resendKey) throw new Error('Email not configured');

          const emailRes = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              from: 'Vértice <noreply@verticesuperior.com.br>',
              to: [r.email],
              subject: 'Notificação da sua instituição',
              html: `<div style="font-family:Inter,system-ui,sans-serif;max-width:500px;margin:0 auto;padding:24px">
                <p>Olá ${r.name.split(' ')[0]},</p>
                <p>${custom_message || 'Sua instituição enviou uma notificação importante.'}</p>
                <hr style="border:none;border-top:1px solid #e5e7eb;margin:16px 0">
                <p style="font-size:12px;color:#94a3b8">Plataforma Vértice · verticesuperior.com.br</p>
              </div>`,
            }),
          });
          result.email = emailRes.ok ? 'sent' : 'failed';
        } catch (e) {
          result.email = (e as Error).message;
        }
      }

      // ── SMS via Zenvia ──
      if ((channel === 'sms' || channel === 'all') && r.phone) {
        try {
          const zenviaToken = Deno.env.get('ZENVIA_API_TOKEN');
          const zenviaSender = Deno.env.get('ZENVIA_SENDER') || 'Vertice';
          if (!zenviaToken) throw new Error('SMS not configured');

          const phone = r.phone.replace(/\D/g, '');
          const smsPhone = phone.startsWith('55') ? phone : '55' + phone;

          const smsRes = await fetch('https://api.zenvia.com/v2/channels/sms/messages', {
            method: 'POST',
            headers: { 'X-API-TOKEN': zenviaToken, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              from: zenviaSender,
              to: smsPhone,
              contents: [{ type: 'text', text: custom_message || `Olá ${r.name.split(' ')[0]}, notificação da sua instituição. - Vértice` }],
            }),
          });
          result.sms = smsRes.ok ? 'sent' : 'failed';
        } catch (e) {
          result.sms = (e as Error).message;
        }
      }

      // Log no banco
      await supabase.from('vertice_notification_log').insert({
        institution_id,
        recipient_name: r.name,
        recipient_phone: r.phone,
        recipient_email: r.email,
        channel,
        template,
        custom_message,
        status: result,
        sent_by: user.id,
      });

      results.push(result);
    }

    return new Response(JSON.stringify({ ok: true, sent: results.length, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
