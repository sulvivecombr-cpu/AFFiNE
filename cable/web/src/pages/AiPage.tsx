import { useCallback, useEffect, useState } from 'react';
import { api, formatDate } from '../api';
import type { RecommendationResponse } from '../types';
import { Banner, EmptyState, Loading } from '../components/ui';
import { IconSpark } from '../components/Icons';

const FACTOR_LABELS: Record<string, string> = {
  cobertura: 'Cobertura',
  erro: 'Taxa de erro',
  atraso: 'Tempo desde o último estudo',
  peso: 'Peso no edital',
};

export function AiPage({ examId }: { examId: string }) {
  const [data, setData] = useState<RecommendationResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);
  const [askError, setAskError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const result = await api.get<RecommendationResponse>(`/exams/${examId}/recommendations`);
      setData(result);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Falha ao carregar recomendações.');
    }
  }, [examId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function ask() {
    if (question.trim().length < 5) return;
    setAsking(true);
    setAskError(null);
    setAnswer(null);
    try {
      const result = await api.post<{ answer: string }>(`/exams/${examId}/ai/ask`, {
        question: question.trim(),
      });
      setAnswer(result.answer);
    } catch (requestError) {
      setAskError(
        requestError instanceof Error ? requestError.message : 'Não foi possível consultar o Cable AI.'
      );
    } finally {
      setAsking(false);
    }
  }

  if (!data) {
    return error ? <Banner kind="error">{error}</Banner> : <Loading rows={4} />;
  }

  return (
    <>
      {error ? <Banner kind="error">{error}</Banner> : null}

      <section className="card card-pad col" style={{ gap: 10 }}>
        <div className="row-between wrap">
          <div className="col" style={{ gap: 4 }}>
            <div className="row" style={{ gap: 8 }}>
              <span className="badge badge-brand">motor {data.engine.version}</span>
              <span className={`badge ${data.ai.configured ? 'badge-success' : 'badge-neutral'}`}>
                {data.ai.configured ? `LLM: ${data.ai.model}` : 'LLM não configurado'}
              </span>
            </div>
            <h1 style={{ fontSize: 21 }}>O que estudar e por quê</h1>
            <p className="tiny muted" style={{ maxWidth: 640 }}>
              {data.engine.description} {data.ai.note}
            </p>
          </div>
          <div className="row tiny muted" style={{ gap: 14 }}>
            <span>{data.totals.topics} assuntos</span>
            <span>{data.totals.reviews} revisões</span>
          </div>
        </div>
      </section>

      {data.items.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={<IconSpark size={20} />}
            title="Ainda não há dados suficientes"
            description="O Cable só recomenda com base em dados reais. Importe o edital e registre as primeiras atividades para o motor calcular prioridades."
          />
        </div>
      ) : (
        <section className="col" style={{ gap: 12 }}>
          {data.items.map((item, index) => (
            <article key={item.topicId} className="card card-pad col" style={{ gap: 10 }}>
              <div className="row-between wrap" style={{ alignItems: 'flex-start' }}>
                <div className="row" style={{ gap: 12, minWidth: 0 }}>
                  <span className="priority-score">{Math.round(item.score)}</span>
                  <div className="col" style={{ gap: 2, minWidth: 0 }}>
                    <span className="list-title">
                      {index + 1}. {item.topicTitle}
                    </span>
                    <span className="list-sub">{item.subjectName}</span>
                  </div>
                </div>
                <div className="row" style={{ gap: 6 }}>
                  <span className="badge badge-neutral">confiança {item.confidence}</span>
                  {item.dueAt ? <span className="badge badge-warn">revisão {formatDate(item.dueAt)}</span> : null}
                </div>
              </div>

              <div className="reason-list">
                {item.reasons.map(reason => (
                  <span key={reason.factor} className="reason">
                    {reason.label}
                  </span>
                ))}
              </div>

              <div className="grid grid-4" style={{ gap: 8 }}>
                {Object.entries(item.factors).map(([factor, value]) => (
                  <div key={factor} className="col" style={{ gap: 4 }}>
                    <span className="tiny muted">{FACTOR_LABELS[factor] ?? factor}</span>
                    <div className="bar">
                      <div
                        className={`bar-fill ${factor === 'erro' ? 'accent' : factor === 'cobertura' ? '' : 'success'}`}
                        style={{ width: `${Math.round(value * 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </article>
          ))}
        </section>
      )}

      <section className="card card-pad col" style={{ gap: 12 }}>
        <div>
          <h2>Perguntar ao Cable AI</h2>
          <p className="tiny muted" style={{ marginTop: 4 }}>
            {data.ai.configured
              ? 'As respostas usam apenas os dados reais deste concurso e marcam inferências como inferências.'
              : 'Sem chave de provedor LLM, a resposta em linguagem natural não é gerada. O motor determinístico acima continua funcionando com justificativas calculadas.'}
          </p>
        </div>

        {askError ? <Banner kind="warn">{askError}</Banner> : null}
        {answer ? (
          <div className="card card-pad" style={{ background: 'var(--surface-2)', boxShadow: 'none' }}>
            <p style={{ whiteSpace: 'pre-wrap', fontSize: 13.5 }}>{answer}</p>
          </div>
        ) : null}

        <div className="field">
          <label className="label" htmlFor="ai-question">
            Sua pergunta
          </label>
          <textarea
            id="ai-question"
            className="textarea"
            value={question}
            onChange={event => setQuestion(event.target.value)}
            placeholder="Ex.: por que direito constitucional aparece antes de direito administrativo?"
          />
        </div>
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button className="btn btn-primary" onClick={ask} disabled={asking || question.trim().length < 5}>
            {asking ? 'Consultando…' : 'Perguntar'}
          </button>
        </div>
      </section>
    </>
  );
}
