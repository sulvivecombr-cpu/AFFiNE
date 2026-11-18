import { useEffect, useMemo, useState } from 'react';
import { ACTIVITY_LABELS, api, formatMinutes } from '../api';
import { Banner } from './ui';

export type TopicOption = { id: string; title: string; subjectName: string };

const KINDS = ['leitura', 'resumo', 'questoes', 'revisao', 'simulado', 'videoaula', 'mapa_mental'];

export function StudyLogDialog({
  examId,
  topics,
  presetTopicId,
  presetKind,
  planItemId,
  onClose,
  onSaved,
}: {
  examId: string;
  topics: TopicOption[];
  presetTopicId?: string | null;
  presetKind?: string;
  planItemId?: string | null;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const [kind, setKind] = useState(presetKind && KINDS.includes(presetKind) ? presetKind : 'leitura');
  const [topicId, setTopicId] = useState(presetTopicId ?? '');
  const [minutes, setMinutes] = useState('50');
  const [questionsTotal, setQuestionsTotal] = useState('');
  const [questionsCorrect, setQuestionsCorrect] = useState('');
  const [rating, setRating] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const grouped = useMemo(() => {
    const map = new Map<string, TopicOption[]>();
    for (const topic of topics) {
      const list = map.get(topic.subjectName) ?? [];
      list.push(topic);
      map.set(topic.subjectName, list);
    }
    return [...map.entries()];
  }, [topics]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const asksQuestions = kind === 'questoes' || kind === 'simulado';

  async function submit() {
    setError(null);
    const parsedMinutes = Number(minutes);
    if (!Number.isFinite(parsedMinutes) || parsedMinutes < 1) {
      setError('Informe os minutos estudados.');
      return;
    }
    if (asksQuestions && questionsTotal === '') {
      setError('Informe quantas questões foram respondidas.');
      return;
    }
    setSaving(true);
    try {
      await api.post(`/exams/${examId}/activities`, {
        kind,
        topicId: topicId || null,
        minutes: parsedMinutes,
        questionsTotal: asksQuestions ? Number(questionsTotal) : null,
        questionsCorrect: asksQuestions ? Number(questionsCorrect || 0) : null,
        rating: rating || undefined,
        notes: notes || null,
        planItemId: planItemId ?? null,
      });
      onSaved(`Atividade registrada · ${formatMinutes(parsedMinutes)}`);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Não foi possível registrar.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="study-log-title"
        onClick={event => event.stopPropagation()}
      >
        <div className="modal-head">
          <div>
            <h2 id="study-log-title">Registrar estudo</h2>
            <p className="tiny muted">
              O registro atualiza seu histórico, o domínio estimado e a próxima revisão (FSRS).
            </p>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onClose} aria-label="Fechar">
            Fechar
          </button>
        </div>

        <div className="modal-body col" style={{ gap: 14 }}>
          {error ? <Banner kind="error">{error}</Banner> : null}

          <div className="grid grid-2" style={{ gap: 12 }}>
            <div className="field">
              <label className="label" htmlFor="activity-kind">
                Tipo de atividade
              </label>
              <select
                id="activity-kind"
                className="select"
                value={kind}
                onChange={event => setKind(event.target.value)}
              >
                {KINDS.map(option => (
                  <option key={option} value={option}>
                    {ACTIVITY_LABELS[option]}
                  </option>
                ))}
              </select>
            </div>

            <div className="field">
              <label className="label" htmlFor="activity-minutes">
                Minutos
              </label>
              <input
                id="activity-minutes"
                className="input"
                type="number"
                min={1}
                max={1440}
                value={minutes}
                onChange={event => setMinutes(event.target.value)}
              />
            </div>
          </div>

          <div className="field">
            <label className="label" htmlFor="activity-topic">
              Assunto
            </label>
            <select
              id="activity-topic"
              className="select"
              value={topicId}
              onChange={event => setTopicId(event.target.value)}
            >
              <option value="">Sem assunto específico</option>
              {grouped.map(([subject, list]) => (
                <optgroup key={subject} label={subject}>
                  {list.map(topic => (
                    <option key={topic.id} value={topic.id}>
                      {topic.title}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
            {topics.length === 0 ? (
              <span className="hint">
                Nenhum assunto cadastrado ainda — importe o edital para registrar por assunto.
              </span>
            ) : null}
          </div>

          {asksQuestions ? (
            <div className="grid grid-2" style={{ gap: 12 }}>
              <div className="field">
                <label className="label" htmlFor="questions-total">
                  Questões respondidas
                </label>
                <input
                  id="questions-total"
                  className="input"
                  type="number"
                  min={0}
                  value={questionsTotal}
                  onChange={event => setQuestionsTotal(event.target.value)}
                />
              </div>
              <div className="field">
                <label className="label" htmlFor="questions-correct">
                  Acertos
                </label>
                <input
                  id="questions-correct"
                  className="input"
                  type="number"
                  min={0}
                  value={questionsCorrect}
                  onChange={event => setQuestionsCorrect(event.target.value)}
                />
              </div>
            </div>
          ) : null}

          {kind === 'revisao' ? (
            <div className="field">
              <label className="label" htmlFor="activity-rating">
                Como foi a revisão?
              </label>
              <select
                id="activity-rating"
                className="select"
                value={rating}
                onChange={event => setRating(event.target.value)}
              >
                <option value="">Avaliar pelas questões (padrão: bom)</option>
                <option value="errei">Errei / esqueci</option>
                <option value="dificil">Difícil</option>
                <option value="bom">Bom</option>
                <option value="facil">Fácil</option>
              </select>
            </div>
          ) : null}

          <div className="field">
            <label className="label" htmlFor="activity-notes">
              Anotações (opcional)
            </label>
            <textarea
              id="activity-notes"
              className="textarea"
              value={notes}
              onChange={event => setNotes(event.target.value)}
              placeholder="O que ficou pendente, dúvidas, páginas revisadas…"
            />
          </div>
        </div>

        <div className="modal-foot">
          <button className="btn" onClick={onClose} disabled={saving}>
            Cancelar
          </button>
          <button className="btn btn-primary" onClick={submit} disabled={saving}>
            {saving ? 'Salvando…' : 'Registrar atividade'}
          </button>
        </div>
      </div>
    </div>
  );
}
