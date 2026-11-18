import { useCallback, useEffect, useState } from 'react';
import { EXAM_STATUS_LABELS, api, formatDate, formatDateTime } from '../api';
import type { Exam, Notice, SubjectSummary } from '../types';
import { NoticeImport } from '../components/NoticeImport';
import { Banner, EmptyState, Loading } from '../components/ui';
import { IconBook, IconUpload } from '../components/Icons';

type ExamDetail = {
  exam: Exam;
  subjects: SubjectSummary[];
  notices: Notice[];
  statusHistory: { from_status: string | null; to_status: string; reason: string | null; changed_at: string }[];
};

const STATUS_ORDER = Object.keys(EXAM_STATUS_LABELS);

export function ExamPage({
  examId,
  onChanged,
  notify,
  onGoStudies,
}: {
  examId: string;
  onChanged: () => Promise<unknown>;
  notify: (message: string) => void;
  onGoStudies: () => void;
}) {
  const [data, setData] = useState<ExamDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [status, setStatus] = useState('');
  const [statusReason, setStatusReason] = useState('');
  const [savingStatus, setSavingStatus] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const result = await api.get<ExamDetail>(`/exams/${examId}`);
      setData(result);
      setStatus(result.exam.status);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Falha ao carregar o concurso.');
    }
  }, [examId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function changeStatus() {
    if (!data || status === data.exam.status) return;
    setSavingStatus(true);
    try {
      await api.patch(`/exams/${examId}`, { status, statusReason: statusReason || null });
      setStatusReason('');
      await load();
      await onChanged();
      notify('Situação atualizada e registrada no histórico.');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Falha ao atualizar situação.');
    } finally {
      setSavingStatus(false);
    }
  }

  if (!data) {
    return error ? <Banner kind="error">{error}</Banner> : <Loading rows={4} />;
  }

  const { exam } = data;
  const totalTopics = data.subjects.reduce((sum, subject) => sum + subject.topics_total, 0);

  return (
    <>
      {error ? <Banner kind="error">{error}</Banner> : null}

      <section className="card card-pad col" style={{ gap: 16 }}>
        <div className="row-between wrap" style={{ alignItems: 'flex-start' }}>
          <div className="col" style={{ gap: 6 }}>
            <div className="row wrap" style={{ gap: 8 }}>
              <span className="badge badge-brand">{EXAM_STATUS_LABELS[exam.status] ?? exam.status}</span>
              {exam.onboardingDone ? (
                <span className="badge badge-success">disponibilidade definida</span>
              ) : (
                <span className="badge badge-warn">disponibilidade pendente</span>
              )}
            </div>
            <h1 style={{ fontSize: 22 }}>{exam.title}</h1>
          </div>
          <div className="row" style={{ gap: 8 }}>
            <button className="btn" onClick={onGoStudies}>
              <IconBook size={15} />
              Abrir estudos
            </button>
            <button className="btn btn-primary" onClick={() => setImporting(current => !current)}>
              <IconUpload size={15} />
              {importing ? 'Fechar importação' : 'Importar documento'}
            </button>
          </div>
        </div>

        <div className="grid grid-3" style={{ gap: 12 }}>
          <Info label="Órgão" value={exam.organizationName} />
          <Info label="Cargo" value={exam.positionTitle} />
          <Info label="Banca" value={exam.boardName} />
          <Info label="Localidade" value={[exam.city, exam.uf].filter(Boolean).join(' / ') || null} />
          <Info label="Data da prova" value={exam.examDate ? formatDate(exam.examDate) : null} />
          <Info
            label="Disponibilidade"
            value={
              exam.weeklyHours
                ? `${exam.weeklyHours}h/semana · ${exam.dailyMinutes ?? 60} min/dia`
                : null
            }
          />
        </div>

        {exam.officialSourceUrl ? (
          <p className="tiny muted">
            Fonte oficial:{' '}
            <a href={exam.officialSourceUrl} target="_blank" rel="noreferrer noopener">
              {exam.officialSourceUrl}
            </a>
          </p>
        ) : (
          <p className="tiny muted">
            Nenhuma fonte oficial registrada. Adicione o link do órgão para manter a origem dos dados.
          </p>
        )}
      </section>

      {importing ? (
        <section className="card card-pad col" style={{ gap: 14 }}>
          <div>
            <h2>Importar edital, retificação ou prova</h2>
            <p className="tiny muted" style={{ marginTop: 4 }}>
              O processamento extrai o texto página por página e identifica disciplinas e assuntos. Você
              revisa tudo antes de criar a trilha.
            </p>
          </div>
          <NoticeImport
            examId={examId}
            onDone={async message => {
              notify(message);
              setImporting(false);
              await load();
              await onChanged();
            }}
          />
        </section>
      ) : null}

      <section className="split">
        <div className="card">
          <div className="card-head">
            <h2>Documentos do concurso</h2>
            <span className="tiny muted">{data.notices.length} arquivo(s)</span>
          </div>
          {data.notices.length === 0 ? (
            <EmptyState
              icon={<IconUpload size={18} />}
              title="Nenhum documento importado"
              description="Importe o edital para o Cable extrair disciplinas, assuntos e o conteúdo programático com a página de origem."
              action={
                <button className="btn btn-sm btn-primary" onClick={() => setImporting(true)}>
                  Importar edital
                </button>
              }
            />
          ) : (
            <div className="list">
              {data.notices.map(notice => (
                <div key={notice.id} className="list-item">
                  <div className="list-item-main">
                    <span className="list-title">{notice.title}</span>
                    <span className="list-sub">
                      {notice.kind} · {notice.page_count ?? '—'} página(s) ·{' '}
                      {notice.published_at ? formatDate(notice.published_at) : 'sem data de publicação'}
                    </span>
                  </div>
                  <div className="row" style={{ gap: 6 }}>
                    <span
                      className={`badge ${
                        notice.confirmed
                          ? 'badge-success'
                          : notice.extraction_status === 'done'
                            ? 'badge-info'
                            : notice.extraction_status === 'failed'
                              ? 'badge-danger'
                              : 'badge-neutral'
                      }`}
                    >
                      {notice.confirmed
                        ? 'confirmado'
                        : notice.extraction_status === 'done'
                          ? 'processado'
                          : notice.extraction_status === 'failed'
                            ? 'falhou'
                            : 'processando'}
                    </span>
                    {notice.official_url ? (
                      <a
                        className="btn btn-sm btn-ghost"
                        href={notice.official_url}
                        target="_blank"
                        rel="noreferrer noopener"
                      >
                        Fonte
                      </a>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="col" style={{ gap: 16 }}>
          <div className="card">
            <div className="card-head">
              <h2>Situação do concurso</h2>
            </div>
            <div className="card-body col" style={{ gap: 10 }}>
              <div className="field">
                <label className="label" htmlFor="exam-status">
                  Atualizar situação
                </label>
                <select
                  id="exam-status"
                  className="select"
                  value={status}
                  onChange={event => setStatus(event.target.value)}
                >
                  {STATUS_ORDER.map(value => (
                    <option key={value} value={value}>
                      {EXAM_STATUS_LABELS[value]}
                    </option>
                  ))}
                </select>
              </div>
              {status !== exam.status ? (
                <div className="field">
                  <label className="label" htmlFor="status-reason">
                    Evidência (opcional)
                  </label>
                  <input
                    id="status-reason"
                    className="input"
                    value={statusReason}
                    onChange={event => setStatusReason(event.target.value)}
                    placeholder="Ex.: retificação publicada no DOU em 12/03"
                  />
                </div>
              ) : null}
              <button
                className="btn btn-sm"
                onClick={changeStatus}
                disabled={savingStatus || status === exam.status}
              >
                {savingStatus ? 'Salvando…' : 'Registrar mudança'}
              </button>
              <p className="tiny muted">
                Toda mudança de situação fica no histórico com data e evidência. O Cable não altera a
                situação sozinho.
              </p>
            </div>
          </div>

          <div className="card">
            <div className="card-head">
              <h2>Histórico de situação</h2>
            </div>
            <div className="card-body">
              {data.statusHistory.length === 0 ? (
                <p className="tiny muted">Sem registros.</p>
              ) : (
                <div className="timeline">
                  {data.statusHistory.map((entry, index) => (
                    <div key={`${entry.changed_at}-${index}`} className="timeline-item">
                      <span className="timeline-dot" />
                      <div className="col" style={{ gap: 2 }}>
                        <span className="tiny" style={{ color: 'var(--ink)', fontWeight: 550 }}>
                          {EXAM_STATUS_LABELS[entry.to_status] ?? entry.to_status}
                        </span>
                        <span className="tiny muted">{formatDateTime(entry.changed_at)}</span>
                        {entry.reason ? <span className="tiny muted">{entry.reason}</span> : null}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="card">
            <div className="card-head">
              <h2>Trilha de estudos</h2>
            </div>
            <div className="card-body col" style={{ gap: 8 }}>
              <p className="tiny muted">
                {data.subjects.length} disciplina(s) · {totalTopics} assunto(s) cadastrados
              </p>
              <div className="bar">
                <div
                  className="bar-fill"
                  style={{
                    width: `${
                      totalTopics > 0
                        ? Math.round(
                            (data.subjects.reduce((sum, subject) => sum + subject.topics_started, 0) /
                              totalTopics) *
                              100
                          )
                        : 0
                    }%`,
                  }}
                />
              </div>
              <button className="btn btn-sm" onClick={onGoStudies}>
                Gerenciar disciplinas e assuntos
              </button>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

function Info({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="col" style={{ gap: 2 }}>
      <span className="tiny muted">{label}</span>
      <span style={{ fontSize: 13.5, color: value ? 'var(--ink)' : 'var(--ink-4)', fontWeight: 520 }}>
        {value || 'não informado'}
      </span>
    </div>
  );
}
