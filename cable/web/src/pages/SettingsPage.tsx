import { useCallback, useEffect, useState } from 'react';
import { api, formatDateTime } from '../api';
import type { User } from '../types';
import { Banner, Loading } from '../components/ui';
import { IconDownload, IconTrash } from '../components/Icons';

type SettingsPayload = {
  user: User;
  preferences: Record<string, unknown>;
  counts: { exams: number; activities: number; activeSessions: number };
};

type SessionRow = {
  id: string;
  user_agent: string | null;
  ip: string | null;
  created_at: string;
  last_seen_at: string;
};

export function SettingsPage({
  user,
  onUserUpdated,
  onLogout,
}: {
  user: User;
  onUserUpdated: (user: User) => void;
  onLogout: () => Promise<void>;
}) {
  const [data, setData] = useState<SettingsPayload | null>(null);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [name, setName] = useState(user.name);
  const [locale, setLocale] = useState(user.locale);
  const [timezone, setTimezone] = useState(user.timezone);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmEmail, setConfirmEmail] = useState('');

  const load = useCallback(async () => {
    const [settings, sessionData] = await Promise.all([
      api.get<SettingsPayload>('/settings'),
      api.get<{ sessions: SessionRow[] }>('/auth/sessions'),
    ]);
    setData(settings);
    setSessions(sessionData.sessions);
  }, []);

  useEffect(() => {
    void load().catch(requestError =>
      setError(requestError instanceof Error ? requestError.message : 'Falha ao carregar configurações.')
    );
  }, [load]);

  async function save() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const result = await api.patch<{ user: User | null }>('/settings', { name, locale, timezone });
      if (result.user) onUserUpdated({ ...user, ...result.user });
      setMessage('Preferências salvas.');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Falha ao salvar.');
    } finally {
      setBusy(false);
    }
  }

  async function revoke(id: string) {
    try {
      await api.del(`/auth/sessions/${id}`);
      await load();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Falha ao encerrar sessão.');
    }
  }

  async function deleteAccount() {
    setBusy(true);
    setError(null);
    try {
      await api.del('/account', { confirmEmail });
      await onLogout();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Falha ao excluir a conta.');
      setBusy(false);
    }
  }

  if (!data) {
    return error ? <Banner kind="error">{error}</Banner> : <Loading rows={3} />;
  }

  return (
    <>
      {error ? <Banner kind="error">{error}</Banner> : null}
      {message ? <Banner kind="success">{message}</Banner> : null}

      <section className="split">
        <div className="col" style={{ gap: 16 }}>
          <div className="card">
            <div className="card-head">
              <h2>Perfil</h2>
            </div>
            <div className="card-body col" style={{ gap: 12 }}>
              <div className="field">
                <label className="label" htmlFor="settings-name">
                  Nome
                </label>
                <input
                  id="settings-name"
                  className="input"
                  value={name}
                  onChange={event => setName(event.target.value)}
                />
              </div>
              <div className="field">
                <label className="label" htmlFor="settings-email">
                  E-mail
                </label>
                <input id="settings-email" className="input" value={data.user.email} disabled />
                <span className="hint">
                  O e-mail identifica sua conta e não pode ser alterado por aqui.
                </span>
              </div>
              <div className="grid grid-2" style={{ gap: 12 }}>
                <div className="field">
                  <label className="label" htmlFor="settings-locale">
                    Idioma
                  </label>
                  <select
                    id="settings-locale"
                    className="select"
                    value={locale}
                    onChange={event => setLocale(event.target.value)}
                  >
                    <option value="pt-BR">Português (Brasil)</option>
                    <option value="en">English</option>
                    <option value="es">Español</option>
                  </select>
                </div>
                <div className="field">
                  <label className="label" htmlFor="settings-timezone">
                    Fuso horário
                  </label>
                  <input
                    id="settings-timezone"
                    className="input"
                    value={timezone}
                    onChange={event => setTimezone(event.target.value)}
                  />
                </div>
              </div>
              <div className="row" style={{ justifyContent: 'flex-end' }}>
                <button className="btn btn-primary" onClick={save} disabled={busy}>
                  {busy ? 'Salvando…' : 'Salvar preferências'}
                </button>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-head">
              <h2>Dispositivos conectados</h2>
              <span className="tiny muted">{sessions.length} sessão(ões)</span>
            </div>
            <div className="list">
              {sessions.map(session => (
                <div key={session.id} className="list-item">
                  <div className="list-item-main">
                    <span className="list-title" style={{ fontSize: 13 }}>
                      {(session.user_agent ?? 'Dispositivo desconhecido').slice(0, 60)}
                    </span>
                    <span className="list-sub">
                      último acesso {formatDateTime(session.last_seen_at)} · {session.ip ?? 'IP não registrado'}
                    </span>
                  </div>
                  <button className="btn btn-sm btn-ghost" onClick={() => void revoke(session.id)}>
                    Encerrar
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="col" style={{ gap: 16 }}>
          <div className="card">
            <div className="card-head">
              <h2>Seus dados</h2>
            </div>
            <div className="card-body col" style={{ gap: 10 }}>
              <p className="tiny muted">
                {data.counts.exams} concurso(s) · {data.counts.activities} atividade(s) registradas.
              </p>
              <a className="btn" href="/api/v1/export" download>
                <IconDownload size={15} />
                Exportar tudo (JSON)
              </a>
              <p className="tiny muted">
                A exportação inclui concursos, trilha, atividades, planos, eventos e registros de
                auditoria do seu workspace.
              </p>
            </div>
          </div>

          <div className="card">
            <div className="card-head">
              <h2>Privacidade e exclusão</h2>
            </div>
            <div className="card-body col" style={{ gap: 10 }}>
              <p className="tiny muted">
                Seus concursos e seu histórico são isolados por workspace. Nenhuma recomendação ou agente
                acessa dados de outra conta.
              </p>
              <div className="field">
                <label className="label" htmlFor="confirm-email">
                  Para excluir a conta, digite seu e-mail
                </label>
                <input
                  id="confirm-email"
                  className="input"
                  value={confirmEmail}
                  onChange={event => setConfirmEmail(event.target.value)}
                  placeholder={data.user.email}
                />
              </div>
              <button
                className="btn btn-danger"
                onClick={deleteAccount}
                disabled={busy || confirmEmail.toLowerCase() !== data.user.email.toLowerCase()}
              >
                <IconTrash size={15} />
                Excluir conta e dados
              </button>
              <span className="hint">A exclusão é imediata e definitiva.</span>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
