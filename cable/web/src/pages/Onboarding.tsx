import { useState } from 'react';
import { WEEKDAYS, api } from '../api';
import type { Exam, SubjectWithTopics, User } from '../types';
import { ExamForm, type ExamFormValues } from '../components/ExamForm';
import { NoticeImport } from '../components/NoticeImport';
import { Banner } from '../components/ui';

const STEPS = ['Concurso', 'Disponibilidade', 'Edital', 'Plano'];

export function Onboarding({ user, onFinished }: { user: User; onFinished: () => Promise<void> }) {
  const [step, setStep] = useState(0);
  const [exam, setExam] = useState<Exam | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [topicsCount, setTopicsCount] = useState(0);

  const [weeklyHours, setWeeklyHours] = useState('10');
  const [dailyMinutes, setDailyMinutes] = useState('60');
  const [studyDays, setStudyDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [experience, setExperience] = useState('intermediario');
  const [planMessage, setPlanMessage] = useState<string | null>(null);

  async function createExam(values: ExamFormValues) {
    const created = await api.post<{ exam: Exam }>('/exams', {
      ...values,
      examDate: values.examDate || null,
      officialSourceUrl: values.officialSourceUrl || null,
    });
    setExam(created.exam);
    setStep(1);
  }

  async function saveAvailability() {
    if (!exam) return;
    setError(null);
    setBusy(true);
    try {
      const hours = Number(weeklyHours);
      if (!Number.isFinite(hours) || hours <= 0) throw new Error('Informe as horas semanais disponíveis.');
      if (studyDays.length === 0) throw new Error('Selecione ao menos um dia de estudo.');
      await api.post(`/exams/${exam.id}/availability`, {
        weeklyHours: hours,
        dailyMinutes: Number(dailyMinutes) || 60,
        studyDays,
        experienceLevel: experience,
      });
      setStep(2);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Não foi possível salvar.');
    } finally {
      setBusy(false);
    }
  }

  async function afterImport() {
    if (!exam) return;
    try {
      const data = await api.get<{ subjects: SubjectWithTopics[] }>(`/exams/${exam.id}/subjects`);
      setTopicsCount(data.subjects.reduce((sum, subject) => sum + subject.topics.length, 0));
    } catch {
      // The trail was already created server-side by the confirmation; a failed
      // recount must not trap the candidate on the edital step.
    } finally {
      setStep(3);
    }
  }

  async function generatePlan() {
    if (!exam) return;
    setError(null);
    setBusy(true);
    try {
      await api.post(`/exams/${exam.id}/plan/generate`);
      await onFinished();
    } catch (requestError) {
      setPlanMessage(requestError instanceof Error ? requestError.message : 'Falha ao gerar o plano.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="wizard">
      <div>
        <div className="topbar-eyebrow">Configuração inicial</div>
        <h1 style={{ marginTop: 4 }}>Vamos montar sua preparação, {user.name.split(' ')[0]}</h1>
        <p className="tiny muted" style={{ marginTop: 6 }}>
          Quatro passos. O Cable só cria o que estiver nos seus dados — nada de concurso ou edital
          fictício.
        </p>
      </div>

      <div className="steps">
        {STEPS.map((label, index) => (
          <div
            key={label}
            className={`step ${index < step ? 'done' : ''} ${index === step ? 'current' : ''}`}
          >
            <div className="step-bar" />
            <span className="step-label">{label}</span>
          </div>
        ))}
      </div>

      <div className="card card-pad">
        {step === 0 ? (
          <div className="col" style={{ gap: 14 }}>
            <div>
              <h2>Qual concurso você vai prestar?</h2>
              <p className="tiny muted" style={{ marginTop: 4 }}>
                Cadastre o concurso e o cargo. Cada concurso tem seu próprio contexto de preparação.
              </p>
            </div>
            <ExamForm submitLabel="Continuar" onSubmit={createExam} />
          </div>
        ) : null}

        {step === 1 && exam ? (
          <div className="col" style={{ gap: 16 }}>
            <div>
              <h2>Quanto tempo você tem por semana?</h2>
              <p className="tiny muted" style={{ marginTop: 4 }}>
                Usamos isso para distribuir os blocos de estudo e as revisões do plano.
              </p>
            </div>

            {error ? <Banner kind="error">{error}</Banner> : null}

            <div className="grid grid-2" style={{ gap: 12 }}>
              <div className="field">
                <label className="label" htmlFor="weekly-hours">
                  Horas por semana
                </label>
                <input
                  id="weekly-hours"
                  className="input"
                  type="number"
                  min={1}
                  max={80}
                  value={weeklyHours}
                  onChange={event => setWeeklyHours(event.target.value)}
                />
              </div>
              <div className="field">
                <label className="label" htmlFor="daily-minutes">
                  Minutos por dia de estudo
                </label>
                <input
                  id="daily-minutes"
                  className="input"
                  type="number"
                  min={15}
                  max={720}
                  value={dailyMinutes}
                  onChange={event => setDailyMinutes(event.target.value)}
                />
              </div>
            </div>

            <div className="field">
              <span className="label">Dias em que você estuda</span>
              <div className="day-picker">
                {WEEKDAYS.map((label, index) => (
                  <button
                    key={label}
                    type="button"
                    className={`day-toggle ${studyDays.includes(index) ? 'on' : ''}`}
                    onClick={() =>
                      setStudyDays(current =>
                        current.includes(index)
                          ? current.filter(day => day !== index)
                          : [...current, index].sort()
                      )
                    }
                    aria-pressed={studyDays.includes(index)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="field">
              <label className="label" htmlFor="experience">
                Sua experiência com concursos
              </label>
              <select
                id="experience"
                className="select"
                value={experience}
                onChange={event => setExperience(event.target.value)}
              >
                <option value="iniciante">Iniciante — primeiro concurso</option>
                <option value="intermediario">Intermediário — já estudei antes</option>
                <option value="avancado">Avançado — já fui aprovado em etapas</option>
              </select>
            </div>

            <div className="row" style={{ justifyContent: 'space-between' }}>
              <button className="btn" onClick={() => setStep(0)} disabled={busy}>
                Voltar
              </button>
              <button className="btn btn-primary" onClick={saveAvailability} disabled={busy}>
                {busy ? 'Salvando…' : 'Continuar'}
              </button>
            </div>
          </div>
        ) : null}

        {step === 2 && exam ? (
          <div className="col" style={{ gap: 16 }}>
            <div>
              <h2>Importe o edital</h2>
              <p className="tiny muted" style={{ marginTop: 4 }}>
                O Cable lê o conteúdo programático, extrai disciplinas e assuntos e guarda a página de
                origem de cada um.
              </p>
            </div>

            <NoticeImport examId={exam.id} onDone={() => void afterImport()} />

            <div className="row" style={{ justifyContent: 'space-between', borderTop: '1px solid var(--line)', paddingTop: 14 }}>
              <button className="btn" onClick={() => setStep(1)}>
                Voltar
              </button>
              <button className="btn btn-ghost" onClick={() => setStep(3)}>
                Fazer depois
              </button>
            </div>
          </div>
        ) : null}

        {step === 3 && exam ? (
          <div className="col" style={{ gap: 16 }}>
            <div>
              <h2>Gerar o plano inicial</h2>
              <p className="tiny muted" style={{ marginTop: 4 }}>
                {topicsCount > 0
                  ? `Encontramos ${topicsCount} assunto(s) na sua trilha. O plano distribui os próximos 7 dias conforme sua disponibilidade.`
                  : 'Sua trilha ainda está vazia. Você pode gerar o plano depois de importar o edital.'}
              </p>
            </div>

            {planMessage ? <Banner kind="warn">{planMessage}</Banner> : null}

            <div className="row" style={{ justifyContent: 'space-between' }}>
              <button className="btn" onClick={() => setStep(2)} disabled={busy}>
                Voltar
              </button>
              <div className="row" style={{ gap: 10 }}>
                <button className="btn" onClick={() => void onFinished()} disabled={busy}>
                  Ir para o painel
                </button>
                <button
                  className="btn btn-primary"
                  onClick={generatePlan}
                  disabled={busy || topicsCount === 0}
                >
                  {busy ? 'Gerando…' : 'Gerar plano e concluir'}
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
