import { useEffect, useRef, useState } from 'react';
import { api } from '../api';
import type { NoticeDetail } from '../types';
import { Banner } from './ui';
import { IconCheck, IconUpload } from './Icons';

type Step = 'form' | 'uploading' | 'processing' | 'review' | 'failed';

const KINDS: { value: string; label: string }[] = [
  { value: 'edital', label: 'Edital' },
  { value: 'retificacao', label: 'Retificação' },
  { value: 'prova', label: 'Prova' },
  { value: 'gabarito', label: 'Gabarito' },
  { value: 'outro', label: 'Outro documento' },
];

export function NoticeImport({
  examId,
  onDone,
  compact,
}: {
  examId: string;
  onDone: (message: string) => void;
  compact?: boolean;
}) {
  const [step, setStep] = useState<Step>('form');
  const [title, setTitle] = useState('Edital');
  const [kind, setKind] = useState('edital');
  const [officialUrl, setOfficialUrl] = useState('');
  const [publishedAt, setPublishedAt] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [detail, setDetail] = useState<NoticeDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const pollRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (pollRef.current) window.clearTimeout(pollRef.current);
    };
  }, []);

  async function poll(noticeId: string, attempt = 0) {
    try {
      const data = await api.get<NoticeDetail>(`/notices/${noticeId}`);
      const version = data.versions[0];
      if (!version) {
        setStep('failed');
        setError('Versão do documento não encontrada.');
        return;
      }
      if (version.extraction_status === 'done') {
        setDetail(data);
        setStep('review');
        return;
      }
      if (version.extraction_status === 'failed') {
        setDetail(data);
        setError(version.extraction_error ?? 'Falha ao processar o documento.');
        setStep('failed');
        return;
      }
      if (attempt > 90) {
        setStep('failed');
        setError('O processamento demorou mais que o esperado. Tente novamente.');
        return;
      }
      pollRef.current = window.setTimeout(() => poll(noticeId, attempt + 1), 1500);
    } catch (requestError) {
      setStep('failed');
      setError(requestError instanceof Error ? requestError.message : 'Falha ao consultar o processamento.');
    }
  }

  async function startImport() {
    setError(null);
    if (!file) {
      setError('Selecione o arquivo do edital (PDF, TXT ou Markdown).');
      return;
    }
    setSaving(true);
    try {
      const created = await api.post<{ notice: { id: string } }>(`/exams/${examId}/notices`, {
        title,
        kind,
        officialUrl: officialUrl || null,
        publishedAt: publishedAt || null,
      });
      setStep('uploading');
      await api.upload(`/notices/${created.notice.id}/versions?filename=${encodeURIComponent(file.name)}`, file);
      setStep('processing');
      await poll(created.notice.id);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Não foi possível importar.');
      setStep('form');
    } finally {
      setSaving(false);
    }
  }

  async function confirm() {
    if (!detail) return;
    setSaving(true);
    setError(null);
    try {
      const subjects = detail.subjects
        .filter(subject => !subject.discarded)
        .map(subject => ({
          id: subject.id,
          name: subject.name,
          topics: subject.topics.map(topic => ({
            id: topic.id,
            title: topic.title,
            code: topic.code,
            sourcePage: topic.source_page,
            discarded: topic.discarded,
          })),
        }));
      const result = await api.post<{ subjectsCreated: number; topicsCreated: number }>(
        `/notices/${detail.notice.id}/confirm`,
        { subjects }
      );
      onDone(
        `Edital confirmado · ${result.subjectsCreated} disciplina(s) e ${result.topicsCreated} assunto(s) criados`
      );
      setDetail(null);
      setStep('form');
      setTitle('Edital');
      setFile(null);
      setMessage(null);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Não foi possível confirmar.');
    } finally {
      setSaving(false);
    }
  }

  function toggleSubject(subjectId: string) {
    setDetail(current =>
      current
        ? {
            ...current,
            subjects: current.subjects.map(subject =>
              subject.id === subjectId ? { ...subject, discarded: !subject.discarded } : subject
            ),
          }
        : current
    );
  }

  function toggleTopic(subjectId: string, topicId: string) {
    setDetail(current =>
      current
        ? {
            ...current,
            subjects: current.subjects.map(subject =>
              subject.id === subjectId
                ? {
                    ...subject,
                    topics: subject.topics.map(topic =>
                      topic.id === topicId ? { ...topic, discarded: !topic.discarded } : topic
                    ),
                  }
                : subject
            ),
          }
        : current
    );
  }

  function renameSubject(subjectId: string, name: string) {
    setDetail(current =>
      current
        ? {
            ...current,
            subjects: current.subjects.map(subject =>
              subject.id === subjectId ? { ...subject, name } : subject
            ),
          }
        : current
    );
  }

  if (step === 'uploading' || step === 'processing') {
    return (
      <div className="col" style={{ gap: 12 }} aria-live="polite">
        <Banner kind="info">
          {step === 'uploading'
            ? 'Enviando o documento…'
            : 'Processando o documento: extraindo páginas, disciplinas e assuntos.'}
        </Banner>
        <div className="col" style={{ gap: 8 }}>
          {[70, 92, 84].map((width, index) => (
            <div key={index} className="skeleton" style={{ height: 14, width: `${width}%` }} />
          ))}
        </div>
      </div>
    );
  }

  if (step === 'review' && detail) {
    const kept = detail.subjects.filter(subject => !subject.discarded);
    const totalTopics = kept.reduce(
      (sum, subject) => sum + subject.topics.filter(topic => !topic.discarded).length,
      0
    );
    const lowConfidence = kept.filter(subject => Number(subject.confidence) < 0.6).length;

    return (
      <div className="col" style={{ gap: 14 }}>
        <Banner kind="info">
          Encontramos <strong>{kept.length}</strong> disciplina(s) e <strong>{totalTopics}</strong>{' '}
          assunto(s) nas páginas processadas. Revise antes de criar sua trilha de estudos — nada é
          criado sem a sua confirmação.
        </Banner>
        {lowConfidence > 0 ? (
          <Banner kind="warn">
            {lowConfidence} disciplina(s) foram identificadas apenas por heurística de texto. Confira os
            nomes antes de confirmar.
          </Banner>
        ) : null}
        {error ? <Banner kind="error">{error}</Banner> : null}

        <div className="col" style={{ gap: 10 }}>
          {detail.subjects.map(subject => (
            <div key={subject.id} className="card card-pad" style={{ padding: 14 }}>
              <div className="row" style={{ gap: 10, alignItems: 'flex-start' }}>
                <input
                  className="checkbox"
                  type="checkbox"
                  checked={!subject.discarded}
                  onChange={() => toggleSubject(subject.id)}
                  aria-label={`Incluir disciplina ${subject.name}`}
                  style={{ marginTop: 8 }}
                />
                <div className="col" style={{ gap: 4, flex: 1 }}>
                  <input
                    className="input"
                    value={subject.name}
                    onChange={event => renameSubject(subject.id, event.target.value)}
                    aria-label="Nome da disciplina"
                    disabled={subject.discarded}
                  />
                  <span className="tiny muted">
                    página {subject.source_page ?? '—'} · confiança{' '}
                    {Math.round(Number(subject.confidence) * 100)}% ·{' '}
                    {subject.topics.filter(topic => !topic.discarded).length} assunto(s)
                  </span>
                </div>
              </div>

              {!subject.discarded && subject.topics.length > 0 ? (
                <div style={{ marginTop: 8, paddingLeft: 26 }}>
                  {subject.topics.map(topic => (
                    <label key={topic.id} className="notice-topic">
                      <input
                        className="checkbox"
                        type="checkbox"
                        checked={!topic.discarded}
                        onChange={() => toggleTopic(subject.id, topic.id)}
                      />
                      <span className="tiny" style={{ flex: 1 }}>
                        {topic.code ? <span className="mono muted">{topic.code} </span> : null}
                        {topic.title}
                        <span className="muted"> · p. {topic.source_page ?? '—'}</span>
                      </span>
                    </label>
                  ))}
                </div>
              ) : null}
            </div>
          ))}
        </div>

        <div className="row" style={{ justifyContent: 'space-between' }}>
          <button
            className="btn"
            onClick={() => {
              setStep('form');
              setDetail(null);
            }}
            disabled={saving}
          >
            Importar outro
          </button>
          <button className="btn btn-primary" onClick={confirm} disabled={saving || kept.length === 0}>
            {saving ? 'Criando trilha…' : `Confirmar ${kept.length} disciplina(s)`}
          </button>
        </div>
      </div>
    );
  }

  if (step === 'failed') {
    return (
      <div className="col" style={{ gap: 12 }}>
        <Banner kind="error">{error ?? 'Não foi possível processar o documento.'}</Banner>
        <div className="row">
          <button
            className="btn"
            onClick={() => {
              setStep('form');
              setError(null);
            }}
          >
            Tentar outro arquivo
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="col" style={{ gap: 14 }}>
      {error ? <Banner kind="error">{error}</Banner> : null}
      {message ? <Banner kind="success">{message}</Banner> : null}

      <div className="grid grid-2" style={{ gap: 12 }}>
        <div className="field">
          <label className="label" htmlFor="notice-title">
            Título do documento
          </label>
          <input
            id="notice-title"
            className="input"
            value={title}
            onChange={event => setTitle(event.target.value)}
          />
        </div>
        <div className="field">
          <label className="label" htmlFor="notice-kind">
            Tipo
          </label>
          <select
            id="notice-kind"
            className="select"
            value={kind}
            onChange={event => setKind(event.target.value)}
          >
            {KINDS.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-2" style={{ gap: 12 }}>
        <div className="field">
          <label className="label" htmlFor="notice-url">
            Link oficial (opcional)
          </label>
          <input
            id="notice-url"
            className="input"
            value={officialUrl}
            onChange={event => setOfficialUrl(event.target.value)}
            placeholder="https://www.in.gov.br/…"
          />
        </div>
        <div className="field">
          <label className="label" htmlFor="notice-date">
            Publicação (opcional)
          </label>
          <input
            id="notice-date"
            className="input"
            type="date"
            value={publishedAt}
            onChange={event => setPublishedAt(event.target.value)}
          />
        </div>
      </div>

      <label
        className={`dropzone ${dragging ? 'dragging' : ''}`}
        onDragOver={event => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={event => {
          event.preventDefault();
          setDragging(false);
          const dropped = event.dataTransfer.files?.[0];
          if (dropped) {
            setFile(dropped);
            if (title === 'Edital') setTitle(dropped.name.replace(/\.[^.]+$/, ''));
          }
        }}
      >
        <input
          type="file"
          accept=".pdf,.txt,.md,application/pdf,text/plain,text/markdown"
          onChange={event => {
            const selected = event.target.files?.[0] ?? null;
            setFile(selected);
            if (selected && title === 'Edital') setTitle(selected.name.replace(/\.[^.]+$/, ''));
          }}
        />
        <span className="empty-icon" style={{ marginBottom: 0 }}>
          <IconUpload />
        </span>
        <strong style={{ fontSize: 14, color: 'var(--ink)' }}>
          {file ? file.name : 'Arraste o arquivo ou clique para selecionar'}
        </strong>
        <span className="tiny muted">
          {file
            ? `${(file.size / 1024 / 1024).toFixed(2)} MB · pronto para processar`
            : 'PDF, TXT ou Markdown · até 32 MB'}
        </span>
      </label>

      <div className="row" style={{ justifyContent: 'flex-end' }}>
        <button className="btn btn-primary" onClick={startImport} disabled={saving || !file}>
          {saving ? 'Enviando…' : 'Processar documento'}
          <IconCheck size={15} />
        </button>
      </div>

      {!compact ? (
        <p className="tiny muted">
          O Cable lê o conteúdo programático do documento, mantém a página de origem de cada assunto e
          nunca cria disciplinas que não estejam escritas no arquivo.
        </p>
      ) : null}
    </div>
  );
}
