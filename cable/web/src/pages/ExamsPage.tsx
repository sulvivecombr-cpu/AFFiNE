import { useState } from 'react';
import { EXAM_STATUS_LABELS, api, formatDate } from '../api';
import type { Exam } from '../types';
import { ExamForm, type ExamFormValues } from '../components/ExamForm';
import { Banner, EmptyState } from '../components/ui';
import { IconExams, IconPlus } from '../components/Icons';

export function ExamsPage({
  exams,
  activeExamId,
  onSelect,
  onChanged,
  notify,
}: {
  exams: Exam[];
  activeExamId: string | null;
  onSelect: (id: string) => void;
  onChanged: () => Promise<unknown>;
  notify: (message: string) => void;
}) {
  const [creating, setCreating] = useState(exams.length === 0);
  const [error, setError] = useState<string | null>(null);

  async function create(values: ExamFormValues) {
    setError(null);
    try {
      const created = await api.post<{ exam: Exam }>('/exams', {
        ...values,
        examDate: values.examDate || null,
        officialSourceUrl: values.officialSourceUrl || null,
      });
      await onChanged();
      setCreating(false);
      notify('Concurso criado.');
      onSelect(created.exam.id);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Falha ao criar concurso.');
    }
  }

  return (
    <>
      <div className="row-between wrap">
        <div>
          <h1>Meus concursos</h1>
          <p className="tiny muted" style={{ marginTop: 4 }}>
            Cada concurso tem seu próprio edital, trilha de estudos, plano e histórico — nada se mistura.
          </p>
        </div>
        {!creating ? (
          <button className="btn btn-primary" onClick={() => setCreating(true)}>
            <IconPlus size={15} />
            Novo concurso
          </button>
        ) : null}
      </div>

      {creating ? (
        <div className="card card-pad">
          <div className="col" style={{ gap: 14 }}>
            <div>
              <h2>Cadastrar concurso</h2>
              <p className="tiny muted" style={{ marginTop: 4 }}>
                Informe apenas o que você sabe. Os dados ficam marcados como informados por você até
                serem conferidos no edital oficial.
              </p>
            </div>
            {error ? <Banner kind="error">{error}</Banner> : null}
            <ExamForm
              submitLabel="Criar concurso"
              onSubmit={create}
              onCancel={exams.length > 0 ? () => setCreating(false) : undefined}
            />
          </div>
        </div>
      ) : null}

      {exams.length === 0 && !creating ? (
        <div className="card">
          <EmptyState
            icon={<IconExams size={20} />}
            title="Nenhum concurso ainda"
            description="Cadastre o concurso que você vai prestar para começar a organizar sua preparação."
            action={
              <button className="btn btn-primary" onClick={() => setCreating(true)}>
                Criar concurso
              </button>
            }
          />
        </div>
      ) : null}

      {exams.length > 0 ? (
        <div className="grid grid-2">
          {exams.map(exam => {
            const progress =
              exam.topicsCount && exam.topicsCount > 0
                ? Math.round(((exam.topicsStarted ?? 0) / exam.topicsCount) * 100)
                : 0;
            return (
              <article key={exam.id} className="card card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div className="row-between wrap" style={{ alignItems: 'flex-start' }}>
                  <div className="col" style={{ gap: 5, minWidth: 0 }}>
                    <span className="badge badge-neutral">{EXAM_STATUS_LABELS[exam.status] ?? exam.status}</span>
                    <h2 style={{ fontSize: 16 }}>{exam.title}</h2>
                    <span className="tiny muted">
                      {[exam.positionTitle, exam.organizationName, exam.boardName]
                        .filter(Boolean)
                        .join(' · ') || 'Sem órgão/cargo informado'}
                    </span>
                  </div>
                  {exam.id === activeExamId ? <span className="badge badge-brand">ativo</span> : null}
                </div>

                <div className="col" style={{ gap: 5 }}>
                  <div className="row-between tiny muted">
                    <span>Cobertura</span>
                    <span>
                      {exam.topicsStarted ?? 0}/{exam.topicsCount ?? 0} assuntos
                    </span>
                  </div>
                  <div className="bar">
                    <div className="bar-fill" style={{ width: `${progress}%` }} />
                  </div>
                </div>

                <div className="row-between tiny muted">
                  <span>{exam.examDate ? `Prova: ${formatDate(exam.examDate)}` : 'Data da prova não informada'}</span>
                  <span>{exam.noticesCount ?? 0} documento(s)</span>
                </div>

                <div className="row" style={{ gap: 8 }}>
                  <button className="btn btn-sm btn-primary" onClick={() => onSelect(exam.id)}>
                    Abrir
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      ) : null}
    </>
  );
}
