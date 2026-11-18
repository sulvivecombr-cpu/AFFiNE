import { useCallback, useEffect, useState } from 'react';
import { ACTIVITY_LABELS, api, formatDate, formatDateTime, formatMinutes } from '../api';
import type { Dashboard } from '../types';
import { Banner, EmptyState, Loading, Stat } from '../components/ui';
import { IconBook, IconClock, IconTarget } from '../components/Icons';

export function DashboardPage({
  examId,
  hasExams,
  onOpenLog,
  onNavigate,
}: {
  examId: string | null;
  hasExams: boolean;
  onOpenLog: () => void;
  onNavigate: (path: string) => void;
  notify: (message: string) => void;
}) {
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setError(null);
    try {
      const result = await api.get<Dashboard>(`/dashboard${examId ? `?examId=${examId}` : ''}`);
      setData(result);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Falha ao carregar o painel.');
    } finally {
      setLoading(false);
    }
  }, [examId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const handler = () => void load();
    window.addEventListener('cable:data-changed', handler);
    return () => window.removeEventListener('cable:data-changed', handler);
  }, [load]);

  if (loading) return <Loading rows={5} />;

  if (error) {
    return (
      <Banner kind="error">
        {error}
        <button className="btn btn-sm btn-ghost" onClick={() => void load()}>
          Tentar novamente
        </button>
      </Banner>
    );
  }

  if (!data?.exam) {
    return (
      <div className="card">
        <EmptyState
          icon={<IconTarget size={20} />}
          title={hasExams ? 'Selecione um concurso' : 'Nenhum concurso cadastrado'}
          description="Cadastre o concurso que você vai prestar para o Cable montar seu painel, seu plano e suas revisões."
          action={
            <button className="btn btn-primary" onClick={() => onNavigate('/concursos')}>
              {hasExams ? 'Ver concursos' : 'Criar meu primeiro concurso'}
            </button>
          }
        />
      </div>
    );
  }

  const { exam } = data;
  const coverage = data.indicators.find(indicator => indicator.key === 'cobertura');

  return (
    <>
      <section className="card card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div className="row-between wrap" style={{ alignItems: 'flex-start' }}>
          <div className="col" style={{ gap: 6, minWidth: 0 }}>
            <div className="row wrap" style={{ gap: 8 }}>
              <span className="badge badge-brand">{exam.status.replace(/_/g, ' ')}</span>
              {exam.boardName ? <span className="badge badge-neutral">{exam.boardName}</span> : null}
              {exam.daysUntilExam !== null ? (
                <span className={`badge ${exam.daysUntilExam <= 30 ? 'badge-warn' : 'badge-info'}`}>
                  {exam.daysUntilExam >= 0
                    ? `${exam.daysUntilExam} dia(s) para a prova`
                    : 'prova realizada'}
                </span>
              ) : (
                <span className="badge badge-neutral">Data da prova não informada</span>
              )}
            </div>
            <h1 style={{ fontSize: 23 }}>{exam.title}</h1>
            <p className="tiny muted">
              {[exam.positionTitle, exam.organizationName, exam.examDate ? `prova em ${formatDate(exam.examDate)}` : null]
                .filter(Boolean)
                .join(' · ') || 'Complete os dados do concurso na visão geral'}
            </p>
          </div>
          <div className="row" style={{ gap: 8 }}>
            <button className="btn btn-accent" onClick={onOpenLog}>
              Registrar estudo
            </button>
            <button className="btn" onClick={() => onNavigate(`/concursos/${exam.id}`)}>
              Ver concurso
            </button>
          </div>
        </div>

        <div className="col" style={{ gap: 6 }}>
          <div className="row-between tiny muted">
            <span>Cobertura do edital</span>
            <span>
              {coverage && coverage.value !== null ? `${coverage.value}%` : 'sem assuntos cadastrados'}
            </span>
          </div>
          <div className="bar">
            <div className="bar-fill" style={{ width: `${coverage?.value ?? 0}%` }} />
          </div>
        </div>
      </section>

      {data.empty ? (
        <Banner kind="info">
          {data.empty.message}{' '}
          <button
            className="btn btn-sm btn-ghost"
            onClick={() => onNavigate(`/concursos/${exam.id}`)}
            style={{ marginLeft: 4 }}
          >
            Importar edital
          </button>
        </Banner>
      ) : null}

      <section className="grid grid-4">
        {data.indicators.map(indicator => (
          <Stat key={indicator.key} indicator={indicator} />
        ))}
      </section>

      <section className="split">
        <div className="card">
          <div className="card-head">
            <h2>O que estudar agora</h2>
            <span className="tiny muted">{data.engine.version}</span>
          </div>
          {data.priorities.length === 0 ? (
            <EmptyState
              icon={<IconBook size={18} />}
              title="Sem prioridades calculadas"
              description="Assim que houver disciplinas e assuntos na sua trilha, o Cable calcula o que estudar primeiro — com a justificativa de cada prioridade."
              action={
                <button className="btn btn-sm" onClick={() => onNavigate(`/concursos/${exam.id}`)}>
                  Importar edital
                </button>
              }
            />
          ) : (
            <div>
              {data.priorities.map(item => (
                <div key={item.topicId} className="priority-row">
                  <span className="priority-score">{Math.round(item.score)}</span>
                  <div className="list-item-main">
                    <span className="list-title">{item.topicTitle}</span>
                    <span className="list-sub">{item.subjectName}</span>
                    <div className="reason-list">
                      {item.reasons.slice(0, 3).map(reason => (
                        <span key={reason.factor} className="reason">
                          {reason.label}
                        </span>
                      ))}
                    </div>
                  </div>
                  <span className="badge badge-neutral">confiança {item.confidence}</span>
                </div>
              ))}
            </div>
          )}
          <div className="card-body" style={{ borderTop: '1px solid var(--line)', paddingTop: 12 }}>
            <button
              className="btn btn-sm"
              onClick={() => onNavigate(`/concursos/${exam.id}/ia`)}
            >
              Ver todas as recomendações
            </button>
          </div>
        </div>

        <div className="col" style={{ gap: 16 }}>
          <div className="card">
            <div className="card-head">
              <h2>Plano de hoje</h2>
              <span className="tiny muted">{formatDate(data.today)}</span>
            </div>
            {data.todayPlan.length === 0 ? (
              <div className="card-body">
                <p className="tiny muted">
                  Nenhum item de plano para hoje. Gere o plano a partir da sua disponibilidade.
                </p>
                <button
                  className="btn btn-sm"
                  style={{ marginTop: 10 }}
                  onClick={() => onNavigate(`/concursos/${exam.id}/plano`)}
                >
                  Abrir planejador
                </button>
              </div>
            ) : (
              <div className="list">
                {data.todayPlan.map(item => (
                  <div key={item.id} className="list-item">
                    <span className={`status-pill status-${item.status === 'concluido' ? 'dominado' : item.kind === 'revisao' ? 'revisao' : 'em_andamento'}`}>
                      {item.kind}
                    </span>
                    <div className="list-item-main">
                      <span className="list-title">
                        {item.topic_title ?? (item.kind === 'descanso' ? 'Descanso' : 'Bloco livre')}
                      </span>
                      <span className="list-sub">
                        {item.target_minutes > 0 ? formatMinutes(item.target_minutes) : '—'}
                        {item.reason ? ` · ${item.reason}` : ''}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="card">
            <div className="card-head">
              <h2>Revisões</h2>
              <span className="badge badge-warn">{data.dueReviews.length} devidas</span>
            </div>
            {data.dueReviews.length === 0 ? (
              <div className="card-body">
                <p className="tiny muted">
                  Nenhuma revisão vencida. O agendamento FSRS começa na primeira atividade registrada.
                </p>
              </div>
            ) : (
              <div className="list">
                {data.dueReviews.map(review => (
                  <div key={review.topicId} className="list-item">
                    <span className="badge badge-warn">{review.overdueDays}d</span>
                    <div className="list-item-main">
                      <span className="list-title">{review.topicTitle}</span>
                      <span className="list-sub">revisão atrasada</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="card">
        <div className="card-head">
          <h2>Últimas atividades</h2>
          <button className="btn btn-sm btn-ghost" onClick={() => onNavigate(`/concursos/${exam.id}/estudos`)}>
            Ver histórico
          </button>
        </div>
        {data.recentActivities.length === 0 ? (
          <div className="card-body">
            <p className="tiny muted">
              Nenhuma atividade registrada. Seus indicadores aparecem aqui assim que você registrar o
              primeiro estudo — nada é preenchido com números fictícios.
            </p>
          </div>
        ) : (
          <div className="list">
            {data.recentActivities.map(activity => (
              <div key={activity.id} className="list-item">
                <span className="list-item-main">
                  <span className="list-title">
                    {ACTIVITY_LABELS[activity.kind] ?? activity.kind}
                    {activity.topic_title ? ` · ${activity.topic_title}` : ''}
                  </span>
                  <span className="list-sub">
                    <IconClock size={12} /> {formatMinutes(activity.minutes)} ·{' '}
                    {formatDateTime(activity.occurred_at)}
                    {activity.questions_total
                      ? ` · ${activity.questions_correct ?? 0}/${activity.questions_total} questões`
                      : ''}
                  </span>
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
