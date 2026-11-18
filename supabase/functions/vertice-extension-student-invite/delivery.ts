/** Categorias fechadas: nunca devolva ou registre o corpo bruto do provedor. */
export function classifyEmailFailure(status: number, body: unknown) {
  const data = body && typeof body === 'object' ? body as Record<string, unknown> : {};
  const name = typeof data.name === 'string' ? data.name : '';
  const message = typeof data.message === 'string' ? data.message.toLowerCase() : '';
  if (/quota/.test(name)) return { code: 'email_quota', error: 'Limite de envio de e-mails atingido no provedor. A administração deve conferir a cota antes de reenviar.' };
  if (status === 401 || /api.?key|permission/.test(name) || /api key/.test(message)) return { code: 'email_credentials', error: 'O provedor recusou a credencial de envio. A administração deve conferir a chave e as permissões de e-mail.' };
  if (status === 403 && /testing emails|domain.*not verified|verify.*domain/.test(message)) return { code: 'email_sender_domain', error: 'O provedor bloqueou o remetente ou o domínio de envio. A administração deve conferir a verificação do domínio e o endereço remetente.' };
  if (status === 429) return { code: 'email_rate_limit', error: 'O provedor limitou a frequência de envios. Aguarde antes de tentar novamente.' };
  if (status === 403) return { code: 'email_forbidden', error: 'Envio não autorizado pelo provedor. A administração deve conferir as permissões da chave, o remetente e a conta de envio.' };
  if (status === 400 || status === 422) return { code: 'email_invalid_request', error: 'O provedor recusou os dados do envio. Confira o e-mail cadastrado e a configuração do remetente.' };
  return { code: 'email_provider_unavailable', error: 'O serviço de e-mail não confirmou o envio. Não reenvie em sequência; a administração deve conferir os registros do provedor.' };
}
export async function deliverInvitation(input: { key: string; from: string; to: string; title: string; link: string }, deps: { fetch: typeof fetch; log: (data: Record<string, unknown>) => void }) {
  try {
    const response = await deps.fetch('https://api.resend.com/emails', {
      method: 'POST', headers: { Authorization: 'Bearer ' + input.key, 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(12000),
      body: JSON.stringify({ from: input.from, to: [input.to], subject: 'Convite individual para a Extensão 360°',
        text: `Você foi convidado(a) para contribuir com o projeto “${input.title}”.\n\nAcesse o Vértice pelo link individual abaixo e valide seus dados com o e-mail cadastrado. O link expira em 72 horas.\n\n${input.link}\n\nSe precisar de ajuda, procure o responsável pelo projeto.` }),
    });
    const body = await response.json().catch(() => null);
    if (!response.ok) {
      const failure = classifyEmailFailure(response.status, body);
      deps.log({ event: 'extension_email_failed', provider_status: response.status, code: failure.code });
      return { ok: false as const, ...failure };
    }
    if (!body || typeof body.id !== 'string' || !body.id.trim()) {
      deps.log({ event: 'extension_email_unconfirmed', provider_status: response.status, code: 'email_receipt_missing' });
      return { ok: false as const, code: 'email_receipt_missing', error: 'O provedor respondeu sem confirmar o registro do e-mail. Confira o painel de envios antes de reenviar.' };
    }
    deps.log({ event: 'extension_email_accepted', provider_status: response.status });
    return { ok: true as const };
  } catch {
    deps.log({ event: 'extension_email_unconfirmed', code: 'email_network_unconfirmed' });
    return { ok: false as const, code: 'email_network_unconfirmed', error: 'A conexão com o provedor terminou sem confirmação. O e-mail pode ter sido aceito. Confira os envios antes de reenviar.' };
  }
}
