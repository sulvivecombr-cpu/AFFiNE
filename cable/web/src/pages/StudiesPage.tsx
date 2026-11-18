import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ACTIVITY_LABELS,
  STATUS_LABELS,
  api,
  formatDateTime,
  formatMinutes,
} from '../api';
import type { Activity, ReviewRow, SubjectWithTopics, Topic } from '../types';
import { Banner, EmptyState, Loading } from '../components/ui';
import { StudyLogDialog, type TopicOption } from '../components/StudyLogDialog';
import { IconBook, IconChevron, IconPlus } from '../components/Icons';

export function StudiesPage({
  examId,
  notify,
}: {
  examId: string;
  notify: (message: string) => void;
  onOpenLog: () => void;
}) {
  const [subjects, setSubjects] = useState<SubjectWithTopics[] | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [reviews, setReviews] = useState<ReviewRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [newSubject, setNewSubject] = useState('');
  const [addingTopicTo, setAddingTopicTo] = useState<string | null>(null);
  const [newTopic, setNewTopic] = useState('');
  const [logTopic, setLogTopic] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [subjectData, activityData, reviewData] = await Promise.all([
        api.get<{ subjects: SubjectWithTopics[] }>(`/exams/${examId}/subjects`),
        api.get<{ activities: Activity[] }>(`/exams/${examId}/activities?limit=40`),
        api.get<{ reviews: ReviewRow[] }>(`/exams/${examId}/reviews`),
      ]);
      setSubjects(subjectData.subjects);
      setActivities(activityData.activities);
      setReviews(reviewData.reviews);
      setOpen(current => {
        const next = { ...current };
        for (const subject of subjectData.subjects) {
          if (next[subject.id] === undefined) next[subject.id] = true;
        }
        return next;
      });
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Falha ao carregar estudos.');
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

  const topicOptions: TopicOption[] = useMemo(
    () =>
      (subjects ?? []).flatMap(subject =>
        subject.topics.map(topic => ({ id: topic.id, title: topic.title, subjectName: subject.name }))
      ),
    [subjects]
  );

  const reviewByTopic = useMemo(() => {
    const map = new Map<string, ReviewRow>();
    for (const review of reviews) map.set(review.topic_id, review);
    return map;
  }, [reviews]);

  async function addSubject() {
    if (newSubject.trim().length < 2) return;
    try {
      await api.post(`/exams/${examId}/subjects`, { name: newSubject.trim() });
      setNewSubject('');
      await load();
      notify('Disciplina criada.');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Falha ao criar disciplina.');
    }
  }

  async function addTopic(subjectId: string) {
    if (newTopic.trim().length < 2) return;
    try {
      await api.post(`/subjects/${subjectId}/topics`, { title: newTopic.trim() });
      setNewTopic('');
      setAddingTopicTo(null);
      await load();
      notify('Assunto criado.');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Falha ao criar assunto.');
    }
  }

  async function setTopicStatus(topic: Topic, status: Topic['status']) {
    try {
      await api.patch(`/topics/${topic.id}`, { status });
      await load();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Falha ao atualizar assunto.');
    }
  }

  if (!subjects) {
    return error ? <Banner kind="error">{error}</Banner> : <Loading rows={4} />;
  }

  const totalTopics = subjects.reduce((sum, subject) => sum + subject.topics.length, 0);
  const dueCount = reviews.filter(review => new Date(review.due_at).getTime() <= Date.now()).length;

  return (
    <>
      {error ? <Banner kind="error">{error}</Banner> : null}

      <div className="row-between wrap">
        <div>
          <h1>Disciplinas e assuntos</h1>
          <p className="tiny muted" style={{ marginTop: 4 }}>
            {subjects.length} disciplina(s) · {totalTopics} assunto(s) · {dueCount} revisão(ões) devida(s)
          </p>
        </div>
        <div className="row" style={{ gap: 8 }}>
          <input
            className="input"
            style={{ maxWidth: 220 }}
            placeholder="Nova disciplina"
            value={newSubject}
            onChange={event => setNewSubject(event.target.value)}
            onKeyDown={event => {
              if (event.key === 'Enter') void addSubject();
            }}
            aria-label="Nome da nova disciplina"
          />
          <button className="btn" onClick={addSubject} disabled={newSubject.trim().length < 2}>
            <IconPlus size={15} />
            Disciplina
          </button>
        </div>
      </div>

      {subjects.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={<IconBook size={20} />}
            title="Sua trilha está vazia"
            description="Importe o edital para criar disciplinas e assuntos automaticamente, ou crie uma disciplina manualmente acima."
          />
        </div>
      ) : (
        <section className="card tree">
          {subjects.map(subject => {
            const isOpen = open[subject.id] ?? true;
            const accuracy =
              subject.questions_total > 0
                ? Math.round((subject.questions_correct / subject.questions_total) * 100)
                : null;
            return (
              <div key={subject.id} className="tree-subject">
                <button
                  className="tree-subject-head"
                  onClick={() => setOpen(current => ({ ...current, [subject.id]: !isOpen }))}
                  aria-expanded={isOpen}
                >
                  <IconChevron size={15} className={`tree-caret ${isOpen ? 'open' : ''}`} />
                  <span className="list-title" style={{ fontSize: 14.5 }}>
                    {subject.name}
                  </span>
                  <span className="tree-meta">
                    <span>
                      {subject.topics_started}/{subject.topics_total} iniciados
                    </span>
                    <span>{formatMinutes(subject.minutes_studied)}</span>
                    {accuracy !== null ? <span>{accuracy}% acerto</span> : null}
                    {subject.weight ? <span>peso {subject.weight}</span> : null}
                  </span>
                </button>

                {isOpen ? (
                  <div>
                    {subject.topics.length === 0 ? (
                      <p className="tiny muted" style={{ padding: '4px 20px 12px 46px' }}>
                        Nenhum assunto nesta disciplina.
                      </p>
                    ) : null}
                    {subject.topics.map(topic => {
                      const review = reviewByTopic.get(topic.id);
                      const topicAccuracy =
                        topic.questions_total > 0
                          ? Math.round((topic.questions_correct / topic.questions_total) * 100)
                          : null;
                      const due =
                        review && new Date(review.due_at).getTime() <= Date.now() ? true : false;
                      return (
                        <div key={topic.id} className="topic-row">
                          <span className={`status-pill status-${topic.status}`}>
                            {STATUS_LABELS[topic.status] ?? topic.status}
                          </span>
                          <span className="topic-title">
                            {topic.code ? <span className="mono muted">{topic.code} </span> : null}
                            {topic.title}
                            {topic.source_page ? (
                              <span className="tiny muted"> · p. {topic.source_page}</span>
                            ) : null}
                          </span>
                          <span className="tiny muted nowrap">
                            {topic.minutes_studied > 0 ? formatMinutes(topic.minutes_studied) : '—'}
                            {topicAccuracy !== null ? ` · ${topicAccuracy}%` : ''}
                          </span>
                          {due ? <span className="badge badge-warn">revisar</span> : null}
                          <select
                            className="select"
                            style={{ maxWidth: 132, padding: '4px 8px', fontSize: 12 }}
                            value={topic.status}
                            onChange={event => void setTopicStatus(topic, event.target.value as Topic['status'])}
                            aria-label={`Status de ${topic.title}`}
                          >
                            {Object.entries(STATUS_LABELS).map(([value, label]) => (
                              <option key={value} value={value}>
                                {label}
                              </option>
                            ))}
                          </select>
                          <button className="btn btn-sm btn-ghost" onClick={() => setLogTopic(topic.id)}>
                            Registrar
                          </button>
                        </div>
                      );
                    })}

                    {addingTopicTo === subject.id ? (
                      <div className="row" style={{ padding: '8px 20px 12px 46px', gap: 8 }}>
                        <input
                          className="input"
                          placeholder="Novo assunto"
                          value={newTopic}
                          onChange={event => setNewTopic(event.target.value)}
                          onKeyDown={event => {
                            if (event.key === 'Enter') void addTopic(subject.id);
                          }}
                          aria-label="Nome do novo assunto"
                        />
                        <button className="btn btn-sm" onClick={() => void addTopic(subject.id)}>
                          Adicionar
                        </button>
                        <button
                          className="btn btn-sm btn-ghost"
                          onClick={() => {
                            setAddingTopicTo(null);
                            setNewTopic('');
                          }}
                        >
                          Cancelar
                        </button>
                      </div>
                    ) : (
                      <button
                        className="btn btn-sm btn-ghost"
                        style={{ margin: '4px 20px 10px 40px' }}
                        onClick={() => {
                          setAddingTopicTo(subject.id);
                          setNewTopic('');
                        }}
                      >
                        <IconPlus size={14} />
                        Assunto
                      </button>
                    )}
                  </div>
                ) : null}
              </div>
            );
          })}
        </section>
      )}

      <section className="split">
        <div className="card">
          <div className="card-head">
            <h2>Histórico de atividades</h2>
            <span className="tiny muted">{activities.length} registro(s)</span>
          </div>
          {activities.length === 0 ? (
            <div className="card-body">
              <p className="tiny muted">
                Nenhuma atividade registrada ainda. Cada registro atualiza minutos, aproveitamento e a
                próxima revisão do assunto.
              </p>
            </div>
          ) : (
            <div className="list">
              {activities.map(activity => (
                <div key={activity.id} className="list-item">
                  <div className="list-item-main">
                    <span className="list-title">
                      {ACTIVITY_LABELS[activity.kind] ?? activity.kind}
                      {activity.topic_title ? ` · ${activity.topic_title}` : ''}
                    </span>
                    <span className="list-sub">
                      {formatMinutes(activity.minutes)} · {formatDateTime(activity.occurred_at)}
                      {activity.questions_total
                        ? ` · ${activity.questions_correct ?? 0}/${activity.questions_total} acertos`
                        : ''}
                      {activity.notes ? ` · ${activity.notes}` : ''}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card">
          <div className="card-head">
            <h2>Revisões (FSRS)</h2>
            <span className={`badge ${dueCount > 0 ? 'badge-warn' : 'badge-neutral'}`}>
              {dueCount} devida(s)
            </span>
          </div>
          {reviews.length === 0 ? (
            <div className="card-body">
              <p className="tiny muted">
                O agendador começa a funcionar a partir da primeira atividade registrada em um assunto.
              </p>
            </div>
          ) : (
            <div className="list">
              {reviews.slice(0, 12).map(review => {
                const due = new Date(review.due_at).getTime() <= Date.now();
                return (
                  <div key={review.topic_id} className="list-item">
                    <span className={`badge ${due ? 'badge-warn' : 'badge-neutral'}`}>
                      {due ? `${review.overdue_days}d atrás` : formatDateTime(review.due_at)}
                    </span>
                    <div className="list-item-main">
                      <span className="list-title">{review.topic_title}</span>
                      <span className="list-sub">
                        {review.subject_name} · {review.reps} repetição(ões)
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {logTopic ? (
        <StudyLogDialog
          examId={examId}
          topics={topicOptions}
          presetTopicId={logTopic}
          onClose={() => setLogTopic(null)}
          onSaved={async message => {
            setLogTopic(null);
            notify(message);
            await load();
          }}
        />
      ) : null}
    </>
  );
}
