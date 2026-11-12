/**
 * ExtensaoNotificacoes — Sino de notificações do Impacto
 * Mostra alertas não lidos com badge de contagem
 */
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

interface Notification {
  id: string; title: string; message: string; category: string;
  source_type: string; source_id: string; action_url: string;
  read_by: string[]; dismissed_by: string[]; created_at: string;
}

const CATEGORY_STYLES: Record<string, { bg: string; border: string; icon: string }> = {
  critico: { bg: '#fef2f2', border: '#dc2626', icon: '🔴' },
  alerta: { bg: '#fffbeb', border: '#f59e0b', icon: '⚠️' },
  acao: { bg: '#eff6ff', border: '#3b82f6', icon: '📋' },
  sucesso: { bg: '#f0fdf4', border: '#22c55e', icon: '✅' },
  info: { bg: '#f9fafb', border: '#6b7280', icon: 'ℹ️' },
};

export default function ExtensaoNotificacoes({
  institutionId,
}: {
  institutionId: string;
}) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setUserId(user.id);

    const { data } = await supabase.from('vertice_extension_notifications')
      .select('*').eq('institution_id', institutionId)
      .order('created_at', { ascending: false })
      .limit(50);

    setNotifications((data || []).filter((n: any) =>
      !n.dismissed_by?.includes(user.id) &&
      (!n.expires_at || new Date(n.expires_at) > new Date())
    ));
  }, [institutionId]);

  useEffect(() => { load(); const interval = setInterval(load, 30000); return () => clearInterval(interval); }, [load]);

  const unread = notifications.filter(n => !n.read_by?.includes(userId || ''));
  const markRead = async (id: string) => {
    if (!userId) return;
    const n = notifications.find(x => x.id === id);
    if (!n || n.read_by?.includes(userId)) return;
    await supabase.from('vertice_extension_notifications')
      .update({ read_by: [...(n.read_by || []), userId] }).eq('id', id);
    load();
  };
  const dismiss = async (id: string) => {
    if (!userId) return;
    const n = notifications.find(x => x.id === id);
    if (!n) return;
    await supabase.from('vertice_extension_notifications')
      .update({ dismissed_by: [...(n.dismissed_by || []), userId] }).eq('id', id);
    load();
  };

  const fmtDate = (d: string) => {
    const diff = Date.now() - new Date(d).getTime();
    if (diff < 60000) return 'agora';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}min`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h`;
    return new Date(d).toLocaleDateString('pt-BR');
  };

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      {/* Bell button */}
      <button onClick={() => setOpen(!open)} style={{
        background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem',
        position: 'relative', padding: '.25rem',
      }}>
        🔔
        {unread.length > 0 && (
          <span style={{
            position: 'absolute', top: -2, right: -4, background: '#dc2626',
            color: '#fff', borderRadius: '50%', width: 18, height: 18, fontSize: '.65rem',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700,
          }}>{unread.length > 9 ? '9+' : unread.length}</span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div style={{
          position: 'absolute', top: '100%', right: 0, width: 340, maxHeight: 400,
          overflowY: 'auto', background: 'var(--bg, #fff)', border: '1px solid var(--border, #e5e7eb)',
          borderRadius: '8px', boxShadow: '0 4px 16px rgba(0,0,0,.12)', zIndex: 100,
        }}>
          <div style={{ padding: '.75rem 1rem', borderBottom: '1px solid var(--border, #e5e7eb)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <strong style={{ fontSize: '.9rem' }}>Notificações</strong>
            <span style={{ fontSize: '.75rem', color: '#6b7280' }}>{unread.length} não lida(s)</span>
          </div>

          {notifications.length === 0 ? (
            <div style={{ padding: '2rem 1rem', textAlign: 'center', color: '#9ca3af', fontSize: '.85rem' }}>
              Nenhuma notificação.
            </div>
          ) : (
            notifications.slice(0, 20).map(n => {
              const style = CATEGORY_STYLES[n.category] || CATEGORY_STYLES.info;
              const isUnread = !n.read_by?.includes(userId || '');
              return (
                <div key={n.id} onClick={() => markRead(n.id)} style={{
                  padding: '.6rem .75rem', borderBottom: '1px solid var(--border, #f3f4f6)',
                  borderLeft: `3px solid ${style.border}`, cursor: 'pointer',
                  background: isUnread ? style.bg : 'transparent',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '.8rem', fontWeight: isUnread ? 700 : 400 }}>
                        {style.icon} {n.title}
                      </div>
                      <div style={{ fontSize: '.75rem', color: '#4b5563', marginTop: '.15rem' }}>
                        {n.message.slice(0, 100)}{n.message.length > 100 ? '…' : ''}
                      </div>
                      <div style={{ fontSize: '.65rem', color: '#9ca3af', marginTop: '.15rem' }}>{fmtDate(n.created_at)}</div>
                    </div>
                    <button onClick={e => { e.stopPropagation(); dismiss(n.id); }} style={{
                      background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: '.7rem', padding: '2px',
                    }}>✕</button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
