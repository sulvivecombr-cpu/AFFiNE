import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, formatDate, formatMinutes } from '../api';
import type { Plan, PlanItem } from '../types';
import { Banner, EmptyState, Loading } from '../components/ui';
import { StudyLogDialog, type TopicOption } from '../components/StudyLogDialog';
import { IconPlan } from '../components/Icons';

const KIND_LABELS: Record<PlanItem['kind'], string> = {
  estudo: 'Estudo',
  questoes: 'Questões',
  revisao: 'Revisão',
  simulado: 'Simulado',
  descanso: 'Descanso',
};

export function PlanPage({ examId, notify }: { examId: string; notify: (message: string) => void }) {
  const [plan, setPlan] = useState<Plan | null>(null);
  const [versions, setVersions] = useState<{ version: number; generated_at: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [logItem, setLogItem] = useState<PlanItem | null>(null);
  const [topics, setTopics] = useState<TopicOption[]>([]);

  const load = useCallback(async () => {
    setError(null);
    try {
      const data = await api.get<{ plan: Plan | null; versions: { version: number; generated_at: string }[] }>(
        `/exams/${examId}/plan`
      );
      setPlan(data.plan);
      setVersions(data.versions);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Falha ao carregar o plano.');
    } finally {
      setLoading(false);
    }
  }, [examId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    api
      .get<{ subjects: { name: string; topics: { id: string; title: string }[] }[] }>(
        `/exams/${examId}/subjects`
      )
      .then(data =>
        setTopics(
          data.subjects.flatMap(subject =>
            subject.topics.map(topic => ({
              id: topic.id,
              title: topic.title,
              subjectName: subject.name,
            }))
          )
        )
      )
      .catch(() => setTopics([]));
  }, [examId]);

  async function generate() {
    setBusy(true);
    setError(null);
    try {
      await api.post(`/exams/${examId}/plan/generate`);
      await load();
      notify('Plano recalculado com seus dados atuais.');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Falha ao gerar plano.');
    } finally {
      setBusy(false);
    }
  }

  async function updateItem(item: PlanItem, status: 'concluido' | 'pulado' | 'pendente') {
    try {
      await api.patch(`/plan-items/${item.id}`, { status });
      await load();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Falha ao atualizar item.');
    }
  }

  const days = useMemo(() => {
    if (!plan) return [];
    const map = new Map<string, PlanItem[]>();
    for (const item of plan.items) {
      const list = map.get(item.day) ?? [];
      list.push(item);
      map.set(item.day, list);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [plan]);

  if (loading) return <Loading rows={4} />;

  return (
    <>
      {error ? <Banner kind="error">{error}</Banner> : null}

      <div className="row-between wrap">
        <div>
          <h1>Plano de estudos</h1>
          <p className="tiny muted" style={{ marginTop: 4 }}>
            Recalculado a partir da sua disponibilidade, das prioridades e das revisões vencidas.
          </p>
        </div>
        <button className="btn btn-primary" onClick={generate} disabled={busy}>
          {busy ? 'Calculando…' : plan ? 'Recalcular plano' : 'Gerar plano'}
        </button>
      </div>

      {!plan ? (
        <div className="card">
          <EmptyState
            icon={<IconPlan size={20} />}
            title="Nenhum plano gerado"
            description="O plano distribui os assuntos prioritários e as revisões nos dias que você escolheu. Precisa de disciplinas e assuntos na trilha para ser calculado."
            action={
              <button className="btn btn-primary" onClick={generate} disabled={busy}>
                {busy ? 'Calculando…' : 'Gerar meu plano'}
              </button>
            }
          />
        </div>
      ) : (
        <>
          <section className="card card-pad">
            <div className="row-between wrap">
              <div className="col" style={{ gap: 3 }}>
                <span className="badge badge-brand">versão {plan.version}</span>
                <strong style={{ fontSize: 14 }}>
                  {formatDate(plan.horizon_start)} — {formatDate(plan.horizon_end)}
                </strong>
                <span className="tiny muted">
                  gerado em {formatDate(plan.generated_at)} · {plan.items.length} bloco(s)
                </span>
              </div>
              <div className="row wrap tiny muted" style={{ gap: 14 }}>
                {typeof plan.rationale.dailyMinutes === 'number' ? (
                  <span>{plan.rationale.dailyMinutes} min/dia</span>
                ) : null}
                {Array.isArray(plan.rationale.studyDays) ? (
                  <span>{plan.rationale.studyDays.length} dias/semana</span>
                ) : null}
                {typeof plan.rationale.topicsConsidered === 'number' ? (
                  <span>{plan.rationale.topicsConsidered} assuntos considerados</span>
                ) : null}
                {typeof plan.rationale.reviewsConsidered === 'number' ? (
                  <span>{plan.rationale.reviewsConsidered} revisões</span>
                ) : null}
              </div>
            </div>
          </section>

          <section className="col" style={{ gap: 14 }}>
            {days.map(([day, items]) => (
              <div key={day} className="card">
                <div className="card-head">
                  <h2>{formatDate(day)}</h2>
                  <span className="tiny muted">
                    {formatMinutes(
                      items.reduce((sum, item) => sum + item.target_minutes, 0)
                    )}
                  </span>
                </div>
                <div className="list">
                  {items.map(item => (
                    <div key={item.id} className="list-item">
                      <span
                        className={`status-pill status-${
                          item.status === 'concluido'
                            ? 'dominado'
                            : item.status === 'pulado'
                              ? 'nao_iniciado'
                              : item.kind === 'revisao'
                                ? 'revisao'
                                : 'em_andamento'
                        }`}
                      >
                        {KIND_LABELS[item.kind]}
                      </span>
                      <div className="list-item-main">
                        <span className="list-title">
                          {item.topic_title ?? (item.kind === 'descanso' ? 'Descanso' : 'Bloco livre')}
                        </span>
                        <span className="list-sub">
                          {item.subject_name ? `${item.subject_name} · ` : ''}
                          {item.target_minutes > 0 ? formatMinutes(item.target_minutes) : 'sem tempo alocado'}
                          {item.reason ? ` · ${item.reason}` : ''}
                        </span>
                      </div>
                      {item.status === 'pendente' && item.kind !== 'descanso' ? (
                        <div className="row" style={{ gap: 6 }}>
                          {item.topic_id ? (
                            <button className="btn btn-sm" onClick={() => setLogItem(item)}>
                              Registrar
                            </button>
                          ) : null}
                          <button className="btn btn-sm btn-ghost" onClick={() => void updateItem(item, 'concluido')}>
                            Concluir
                          </button>
                          <button className="btn btn-sm btn-ghost" onClick={() => void updateItem(item, 'pulado')}>
                            Pular
                          </button>
                        </div>
                      ) : (
                        <button
                          className="btn btn-sm btn-ghost"
                          onClick={() => void updateItem(item, 'pendente')}
                          disabled={item.kind === 'descanso'}
                        >
                          {item.status}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </section>

          <section className="card">
            <div className="card-head">
              <h2>Versões do plano</h2>
            </div>
            <div className="list">
              {versions.map(version => (
                <div key={version.version} className="list-item">
                  <span className={`badge ${version.version === plan.version ? 'badge-brand' : 'badge-neutral'}`}>
                    v{version.version}
                  </span>
                  <span className="list-item-main">
                    <span className="list-sub">gerado em {formatDate(version.generated_at)}</span>
                  </span>
                  {version.version === plan.version ? <span className="tiny muted">atual</span> : null}
                </div>
              ))}
            </div>
          </section>
        </>
      )}

      {logItem ? (
        <StudyLogDialog
          examId={examId}
          topics={topics}
          presetTopicId={logItem.topic_id}
          presetKind={logItem.kind === 'descanso' ? undefined : logItem.kind}
          planItemId={logItem.id}
          onClose={() => setLogItem(null)}
          onSaved={async message => {
            setLogItem(null);
            notify(message);
            await load();
          }}
        />
      ) : null}
    </>
  );
}
