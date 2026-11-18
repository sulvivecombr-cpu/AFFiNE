import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from './api';
import { match, navigate, usePath } from './router';
import type { Exam, User } from './types';
import {
  IconDashboard,
  IconExams,
  IconLogout,
  IconPlan,
  IconSettings,
  IconSpark,
  IconStudies,
} from './components/Icons';
import { Banner, Loading } from './components/ui';
import { QuickLog } from './components/QuickLog';
import { AuthPage } from './pages/AuthPage';
import { Onboarding } from './pages/Onboarding';
import { DashboardPage } from './pages/DashboardPage';
import { ExamsPage } from './pages/ExamsPage';
import { ExamPage } from './pages/ExamPage';
import { StudiesPage } from './pages/StudiesPage';
import { PlanPage } from './pages/PlanPage';
import { AiPage } from './pages/AiPage';
import { SettingsPage } from './pages/SettingsPage';

type NavItem = {
  key: string;
  label: string;
  icon: (props: { size?: number }) => JSX.Element;
  to: string;
  needsExam?: boolean;
};

const TITLES: Record<string, { eyebrow: string; title: string }> = {
  dashboard: { eyebrow: 'Preparação', title: 'Painel de estudos' },
  exams: { eyebrow: 'Concursos', title: 'Meus concursos' },
  exam: { eyebrow: 'Concurso', title: 'Visão geral e edital' },
  studies: { eyebrow: 'Estudos', title: 'Disciplinas e assuntos' },
  plan: { eyebrow: 'Planejamento', title: 'Seu plano de estudos' },
  ai: { eyebrow: 'Inteligência', title: 'Cable AI' },
  settings: { eyebrow: 'Conta', title: 'Configurações' },
};

export default function App() {
  const path = usePath();
  const [user, setUser] = useState<User | null>(null);
  const [booting, setBooting] = useState(true);
  const [exams, setExams] = useState<Exam[]>([]);
  const [activeExamId, setActiveExamId] = useState<string | null>(
    () => window.localStorage.getItem('cable.activeExam')
  );
  const [quickLogOpen, setQuickLogOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);

  const loadSession = useCallback(async () => {
    try {
      const data = await api.get<{ user: User }>('/auth/me');
      setUser(data.user);
      return data.user;
    } catch {
      setUser(null);
      return null;
    }
  }, []);

  const loadExams = useCallback(async () => {
    const data = await api.get<{ exams: Exam[] }>('/exams');
    setExams(data.exams);
    setActiveExamId(current => {
      const next =
        current && data.exams.some(exam => exam.id === current) ? current : (data.exams[0]?.id ?? null);
      if (next) window.localStorage.setItem('cable.activeExam', next);
      return next;
    });
    return data.exams;
  }, []);

  useEffect(() => {
    (async () => {
      const current = await loadSession();
      if (current) {
        try {
          await loadExams();
        } catch (error) {
          setBanner(error instanceof Error ? error.message : 'Falha ao carregar concursos.');
        }
      }
      setBooting(false);
    })();
  }, [loadSession, loadExams]);

  const activeExam = useMemo(
    () => exams.find(exam => exam.id === activeExamId) ?? exams[0] ?? null,
    [exams, activeExamId]
  );

  const selectExam = (id: string) => {
    window.localStorage.setItem('cable.activeExam', id);
    setActiveExamId(id);
  };

  const notify = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(null), 3200);
  };

  const handleLogout = async () => {
    try {
      await api.post('/auth/logout');
    } finally {
      setUser(null);
      setExams([]);
      window.localStorage.removeItem('cable.activeExam');
      navigate('/');
    }
  };

  if (booting) {
    return (
      <div style={{ maxWidth: 720, margin: '12vh auto', padding: '0 24px' }}>
        <Loading rows={4} />
      </div>
    );
  }

  if (!user) {
    return (
      <AuthPage
        onAuthenticated={async () => {
          const current = await loadSession();
          if (current) await loadExams();
        }}
      />
    );
  }

  const nav: NavItem[] = [
    { key: 'dashboard', label: 'Painel', icon: IconDashboard, to: '/' },
    { key: 'exams', label: 'Concursos', icon: IconExams, to: '/concursos' },
    {
      key: 'studies',
      label: 'Estudos',
      icon: IconStudies,
      to: activeExam ? `/concursos/${activeExam.id}/estudos` : '/concursos',
      needsExam: true,
    },
    {
      key: 'plan',
      label: 'Plano',
      icon: IconPlan,
      to: activeExam ? `/concursos/${activeExam.id}/plano` : '/concursos',
      needsExam: true,
    },
    {
      key: 'ai',
      label: 'Cable AI',
      icon: IconSpark,
      to: activeExam ? `/concursos/${activeExam.id}/ia` : '/concursos',
      needsExam: true,
    },
  ];

  const activeKey = (() => {
    if (path === '/' || path === '') return 'dashboard';
    if (path === '/configuracoes') return 'settings';
    if (path === '/concursos') return 'exams';
    if (match(path, '/concursos/:id/estudos')) return 'studies';
    if (match(path, '/concursos/:id/plano')) return 'plan';
    if (match(path, '/concursos/:id/ia')) return 'ai';
    if (match(path, '/concursos/:id')) return 'exam';
    return 'dashboard';
  })();

  // Narrowed once here so the nested page renderer keeps the non-null type.
  const activeUser: User = user;

  const needsOnboarding = exams.length === 0 && path !== '/configuracoes';

  const titles =
    activeKey === 'exam' && activeExam
      ? { eyebrow: activeExam.organizationName ?? 'Concurso', title: activeExam.title }
      : TITLES[activeKey] ?? TITLES.dashboard;

  function renderPage() {
    if (needsOnboarding) {
      return (
        <Onboarding
          user={activeUser}
          onFinished={async () => {
            const list = await loadExams();
            if (list[0]) selectExam(list[0].id);
            navigate('/');
            notify('Preparação criada. Bem-vindo ao Cable.');
          }}
        />
      );
    }

    if (activeKey === 'settings') {
      return <SettingsPage user={activeUser} onUserUpdated={setUser} onLogout={handleLogout} />;
    }

    if (activeKey === 'exams') {
      return (
        <ExamsPage
          exams={exams}
          activeExamId={activeExam?.id ?? null}
          onSelect={id => {
            selectExam(id);
            navigate(`/concursos/${id}`);
          }}
          onChanged={async () => {
            await loadExams();
          }}
          notify={notify}
        />
      );
    }

    const studiesMatch = match(path, '/concursos/:id/estudos');
    const planMatch = match(path, '/concursos/:id/plano');
    const aiMatch = match(path, '/concursos/:id/ia');
    const examMatch = match(path, '/concursos/:id');

    if (studiesMatch) {
      return (
        <StudiesPage
          examId={studiesMatch.id}
          notify={notify}
          onOpenLog={() => setQuickLogOpen(true)}
        />
      );
    }
    if (planMatch) {
      return <PlanPage examId={planMatch.id} notify={notify} />;
    }
    if (aiMatch) {
      return <AiPage examId={aiMatch.id} />;
    }
    if (examMatch) {
      return (
        <ExamPage
          examId={examMatch.id}
          onChanged={loadExams}
          notify={notify}
          onGoStudies={() => navigate(`/concursos/${examMatch.id}/estudos`)}
        />
      );
    }

    return (
      <DashboardPage
        examId={activeExam?.id ?? null}
        hasExams={exams.length > 0}
        onOpenLog={() => setQuickLogOpen(true)}
        onNavigate={navigate}
        notify={notify}
      />
    );
  }

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
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

        {activeExam ? (
          <div className="exam-switcher">
            <label className="exam-switcher-label" htmlFor="exam-switch">
              Concurso ativo
            </label>
            <select
              id="exam-switch"
              value={activeExam.id}
              onChange={event => {
                selectExam(event.target.value);
                navigate(`/concursos/${event.target.value}`);
              }}
            >
              {exams.map(exam => (
                <option key={exam.id} value={exam.id}>
                  {exam.title}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        <nav className="nav" aria-label="Navegação principal">
          {nav.map(item => (
            <a
              key={item.key}
              href={item.to}
              className={`nav-link ${activeKey === item.key ? 'active' : ''}`}
              aria-current={activeKey === item.key ? 'page' : undefined}
              onClick={event => {
                event.preventDefault();
                navigate(item.to);
              }}
            >
              <span className="nav-icon">
                <item.icon size={17} />
              </span>
              <span className="nav-label">{item.label}</span>
            </a>
          ))}
        </nav>

        <div className="sidebar-footer">
          <a
            href="/configuracoes"
            className={`nav-link ${activeKey === 'settings' ? 'active' : ''}`}
            onClick={event => {
              event.preventDefault();
              navigate('/configuracoes');
            }}
          >
            <span className="nav-icon">
              <IconSettings size={17} />
            </span>
            <span className="nav-label">Configurações</span>
          </a>
          <button className="user-chip" onClick={handleLogout} title="Sair da conta">
            <span className="avatar">{user.name.slice(0, 2).toUpperCase()}</span>
            <span className="user-meta">
              <span className="user-name">{user.name}</span>
              <span className="user-mail">{user.email}</span>
            </span>
            <IconLogout size={15} />
          </button>
        </div>
      </aside>

      <div className="main">
        <div className="mobile-bar">
          <span className="brand-mark" aria-hidden="true">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M5 7h14M5 12h9M5 17h14" stroke="#F2A33C" strokeWidth="2.2" strokeLinecap="round" />
            </svg>
          </span>
          <span className="brand-name">CABLE</span>
          {exams.length > 0 ? (
            <select
              className="mobile-exam"
              value={activeExam?.id ?? ''}
              onChange={event => {
                selectExam(event.target.value);
                navigate(`/concursos/${event.target.value}`);
              }}
              aria-label="Concurso ativo"
            >
              {exams.map(exam => (
                <option key={exam.id} value={exam.id}>
                  {exam.title}
                </option>
              ))}
            </select>
          ) : null}
        </div>

        <header className="topbar">
          <div className="topbar-titles">
            <div className="topbar-eyebrow">{titles.eyebrow}</div>
            <div className="topbar-title">{titles.title}</div>
          </div>
          <div className="topbar-actions">
            {activeExam && ['dashboard', 'studies', 'plan'].includes(activeKey) ? (
              <button className="btn btn-accent" onClick={() => setQuickLogOpen(true)}>
                Registrar estudo
              </button>
            ) : null}
          </div>
        </header>

        <main className="page" id="main">
          {banner ? (
            <Banner kind="error">
              {banner}
              <button className="btn btn-ghost btn-sm" onClick={() => setBanner(null)}>
                Fechar
              </button>
            </Banner>
          ) : null}
          {renderPage()}
        </main>

        <nav className="bottom-nav" aria-label="Navegação">
          {nav.map(item => (
            <button
              key={item.key}
              className={`bottom-link ${activeKey === item.key ? 'active' : ''}`}
              onClick={() => navigate(item.to)}
            >
              <item.icon size={19} />
              {item.label}
            </button>
          ))}
        </nav>
      </div>

      {quickLogOpen && activeExam ? (
        <QuickLog
          examId={activeExam.id}
          onClose={() => setQuickLogOpen(false)}
          onSaved={message => {
            setQuickLogOpen(false);
            notify(message);
            window.dispatchEvent(new CustomEvent('cable:data-changed'));
          }}
        />
      ) : null}

      {toast ? (
        <div className="toast" role="status">
          {toast}
        </div>
      ) : null}
    </div>
  );
}
