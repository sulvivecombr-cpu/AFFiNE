import { useState } from 'react';
import { api } from '../api';
import type { User } from '../types';
import { Banner } from '../components/ui';

export function AuthPage({ onAuthenticated }: { onAuthenticated: () => Promise<void> }) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === 'register') {
        await api.post<{ user: User }>('/auth/register', { name, email, password });
      } else {
        await api.post<{ user: User }>('/auth/login', { email, password });
      }
      await onAuthenticated();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Não foi possível continuar.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth">
      <aside className="auth-aside">
        <div className="brand" style={{ padding: 0 }}>
          <span className="brand-mark" aria-hidden="true">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
              <path d="M5 7h14M5 12h9M5 17h14" stroke="#F2A33C" strokeWidth="2.2" strokeLinecap="round" />
            </svg>
          </span>
          <div>
            <div className="brand-name">CABLE</div>
            <div className="brand-sub">Concursos</div>
          </div>
        </div>

        <div style={{ marginTop: 32, maxWidth: 380 }}>
          <h1 style={{ color: '#fff', fontSize: 30, lineHeight: 1.2 }}>
            Sua preparação inteira em um só lugar.
          </h1>
          <p style={{ marginTop: 12, fontSize: 14.5, color: '#a9b8cd' }}>
            Cadastre o concurso, importe o edital e o Cable organiza disciplinas, assuntos, plano de
            estudos e revisões a partir dos seus resultados reais.
          </p>
        </div>

        <div className="auth-points">
          <div className="auth-point">
            <span className="auth-point-mark">1</span>
            <span>O edital vira uma trilha de estudos com a página de origem de cada assunto.</span>
          </div>
          <div className="auth-point">
            <span className="auth-point-mark">2</span>
            <span>Cada atividade registrada atualiza domínio estimado, histórico e próxima revisão.</span>
          </div>
          <div className="auth-point">
            <span className="auth-point-mark">3</span>
            <span>O plano é recalculado quando você falta, acerta menos ou a prova se aproxima.</span>
          </div>
        </div>
      </aside>

      <main className="auth-main">
        <div className="auth-card">
          <div>
            <h1 style={{ fontSize: 23 }}>{mode === 'login' ? 'Entrar no Cable' : 'Criar sua conta'}</h1>
            <p className="tiny muted" style={{ marginTop: 6 }}>
              {mode === 'login'
                ? 'Continue de onde parou na sua preparação.'
                : 'Sua preparação é privada e isolada: só você acessa seus concursos e seu histórico.'}
            </p>
          </div>

          <div className="auth-tabs" role="tablist">
            <button
              className={`auth-tab ${mode === 'login' ? 'active' : ''}`}
              onClick={() => {
                setMode('login');
                setError(null);
              }}
              role="tab"
              aria-selected={mode === 'login'}
            >
              Entrar
            </button>
            <button
              className={`auth-tab ${mode === 'register' ? 'active' : ''}`}
              onClick={() => {
                setMode('register');
                setError(null);
              }}
              role="tab"
              aria-selected={mode === 'register'}
            >
              Criar conta
            </button>
          </div>

          <form className="col" style={{ gap: 13 }} onSubmit={submit}>
            {error ? <Banner kind="error">{error}</Banner> : null}

            {mode === 'register' ? (
              <div className="field">
                <label className="label" htmlFor="auth-name">
                  Nome
                </label>
                <input
                  id="auth-name"
                  className="input"
                  value={name}
                  onChange={event => setName(event.target.value)}
                  autoComplete="name"
                  required
                />
              </div>
            ) : null}

            <div className="field">
              <label className="label" htmlFor="auth-email">
                E-mail
              </label>
              <input
                id="auth-email"
                className="input"
                type="email"
                value={email}
                onChange={event => setEmail(event.target.value)}
                autoComplete="email"
                required
              />
            </div>

            <div className="field">
              <label className="label" htmlFor="auth-password">
                Senha
              </label>
              <input
                id="auth-password"
                className="input"
                type="password"
                value={password}
                onChange={event => setPassword(event.target.value)}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                minLength={8}
                required
              />
              {mode === 'register' ? <span className="hint">Mínimo de 8 caracteres.</span> : null}
            </div>

            <button className="btn btn-primary btn-block" type="submit" disabled={busy}>
              {busy ? 'Aguarde…' : mode === 'login' ? 'Entrar' : 'Criar conta e começar'}
            </button>
          </form>

          <p className="tiny muted" style={{ textAlign: 'center' }}>
            Ao criar a conta você concorda com o uso dos seus dados exclusivamente para organizar sua
            preparação. Você pode exportar ou excluir tudo em Configurações.
          </p>
        </div>
      </main>
    </div>
  );
}
