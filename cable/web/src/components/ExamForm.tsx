import { useState } from 'react';
import { EXAM_STATUS_LABELS } from '../api';
import { Banner } from './ui';

export type ExamFormValues = {
  title: string;
  organizationName: string;
  boardName: string;
  positionTitle: string;
  city: string;
  uf: string;
  status: string;
  examDate: string;
  officialSourceUrl: string;
};

export const emptyExamForm: ExamFormValues = {
  title: '',
  organizationName: '',
  boardName: '',
  positionTitle: '',
  city: '',
  uf: '',
  status: 'planejado',
  examDate: '',
  officialSourceUrl: '',
};

export function ExamForm({
  initial,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial?: Partial<ExamFormValues>;
  submitLabel: string;
  onSubmit: (values: ExamFormValues) => Promise<void>;
  onCancel?: () => void;
}) {
  const [values, setValues] = useState<ExamFormValues>({ ...emptyExamForm, ...initial });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const set = (key: keyof ExamFormValues) => (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setValues(current => ({ ...current, [key]: event.target.value }));

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (values.title.trim().length < 3) {
      setError('Informe o nome do concurso (mínimo 3 caracteres).');
      return;
    }
    setSaving(true);
    try {
      await onSubmit(values);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Não foi possível salvar.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="col" style={{ gap: 14 }} onSubmit={submit}>
      {error ? <Banner kind="error">{error}</Banner> : null}

      <div className="field">
        <label className="label" htmlFor="exam-title">
          Concurso
        </label>
        <input
          id="exam-title"
          className="input"
          value={values.title}
          onChange={set('title')}
          placeholder="Ex.: Polícia Federal — Agente de Polícia"
          autoComplete="off"
        />
      </div>

      <div className="grid grid-2" style={{ gap: 12 }}>
        <div className="field">
          <label className="label" htmlFor="exam-organization">
            Órgão
          </label>
          <input
            id="exam-organization"
            className="input"
            value={values.organizationName}
            onChange={set('organizationName')}
            placeholder="Ex.: Polícia Federal"
          />
        </div>
        <div className="field">
          <label className="label" htmlFor="exam-position">
            Cargo
          </label>
          <input
            id="exam-position"
            className="input"
            value={values.positionTitle}
            onChange={set('positionTitle')}
            placeholder="Ex.: Agente de Polícia Federal"
          />
        </div>
      </div>

      <div className="grid grid-2" style={{ gap: 12 }}>
        <div className="field">
          <label className="label" htmlFor="exam-board">
            Banca
          </label>
          <input
            id="exam-board"
            className="input"
            value={values.boardName}
            onChange={set('boardName')}
            placeholder="Ex.: Cebraspe"
          />
        </div>
        <div className="field">
          <label className="label" htmlFor="exam-status">
            Situação
          </label>
          <select id="exam-status" className="select" value={values.status} onChange={set('status')}>
            {Object.entries(EXAM_STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-2" style={{ gap: 12 }}>
        <div className="field">
          <label className="label" htmlFor="exam-city">
            Localidade
          </label>
          <div className="row" style={{ gap: 8 }}>
            <input
              id="exam-city"
              className="input"
              value={values.city}
              onChange={set('city')}
              placeholder="Cidade"
            />
            <input
              className="input"
              style={{ maxWidth: 78 }}
              value={values.uf}
              onChange={set('uf')}
              placeholder="UF"
              maxLength={2}
              aria-label="UF"
            />
          </div>
        </div>
        <div className="field">
          <label className="label" htmlFor="exam-date">
            Data provável da prova
          </label>
          <input
            id="exam-date"
            className="input"
            type="date"
            value={values.examDate}
            onChange={set('examDate')}
          />
        </div>
      </div>

      <div className="field">
        <label className="label" htmlFor="exam-source">
          Fonte oficial (opcional)
        </label>
        <input
          id="exam-source"
          className="input"
          value={values.officialSourceUrl}
          onChange={set('officialSourceUrl')}
          placeholder="https://www.gov.br/…"
        />
        <span className="hint">
          O Cable guarda a origem de cada informação. Só preencha com a página oficial do concurso.
        </span>
      </div>

      <div className="row" style={{ justifyContent: 'flex-end', gap: 10 }}>
        {onCancel ? (
          <button type="button" className="btn" onClick={onCancel} disabled={saving}>
            Cancelar
          </button>
        ) : null}
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? 'Salvando…' : submitLabel}
        </button>
      </div>
    </form>
  );
}
