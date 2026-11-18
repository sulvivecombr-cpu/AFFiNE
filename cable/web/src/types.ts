export type User = {
  id: string;
  name: string;
  email: string;
  role: string;
  locale: string;
  timezone: string;
  workspaceId: string;
  workspaceName?: string;
};

export type Exam = {
  id: string;
  title: string;
  organizationName: string | null;
  boardName: string | null;
  positionTitle: string | null;
  city: string | null;
  uf: string | null;
  status: string;
  examDate: string | null;
  officialSourceUrl: string | null;
  weeklyHours: number | null;
  studyDays: number[] | null;
  dailyMinutes: number | null;
  experienceLevel: string | null;
  onboardingDone: boolean;
  subjectsCount?: number;
  topicsCount?: number;
  topicsStarted?: number;
  noticesCount?: number;
};

export type SubjectSummary = {
  id: string;
  name: string;
  weight: number | null;
  topics_total: number;
  topics_started: number;
  topics_mastered: number;
  minutes_studied: number;
  questions_total: number;
  questions_correct: number;
};

export type Topic = {
  id: string;
  subject_id: string;
  code: string | null;
  title: string;
  status: 'nao_iniciado' | 'em_andamento' | 'revisao' | 'dominado';
  mastery: string | number | null;
  minutes_studied: number;
  questions_total: number;
  questions_correct: number;
  last_studied_at: string | null;
  source_page: number | null;
  review_due_at: string | null;
};

export type SubjectWithTopics = SubjectSummary & { topics: Topic[] };

export type Notice = {
  id: string;
  title: string;
  kind: string;
  official_url: string | null;
  published_at: string | null;
  confirmed: boolean;
  created_at: string;
  extraction_status: string | null;
  page_count: number | null;
};

export type NoticeVersion = {
  id: string;
  version_no: number;
  file_name: string;
  mime: string;
  byte_size: number;
  page_count: number | null;
  extraction_status: 'pending' | 'processing' | 'done' | 'failed';
  extraction_error: string | null;
  parsed_at: string | null;
  created_at: string;
};

export type ParsedTopic = {
  id: string;
  code: string | null;
  title: string;
  source_page: number | null;
  confidence: string | number;
  confirmed: boolean;
  discarded: boolean;
};

export type ParsedSubject = {
  id: string;
  name: string;
  source_page: number | null;
  confidence: string | number;
  confirmed: boolean;
  discarded: boolean;
  topics: ParsedTopic[];
};

export type NoticeDetail = {
  notice: {
    id: string;
    exam_id: string;
    title: string;
    kind: string;
    official_url: string | null;
    published_at: string | null;
    confirmed: boolean;
  };
  versions: NoticeVersion[];
  subjects: ParsedSubject[];
};

export type PriorityItem = {
  topicId: string;
  topicTitle: string;
  subjectName: string;
  status: Topic['status'];
  score: number;
  confidence: 'alta' | 'media' | 'baixa';
  factors: Record<string, number>;
  reasons: { factor: string; label: string; value: number }[];
  dueAt: string | null;
};

export type Indicator = {
  key: string;
  label: string;
  value: number | null;
  unit: string;
  detail: string;
  rule: string;
  insufficient: boolean;
};

export type Dashboard = {
  exam: {
    id: string;
    title: string;
    positionTitle: string | null;
    organizationName: string | null;
    boardName: string | null;
    status: string;
    examDate: string | null;
    daysUntilExam: number | null;
  } | null;
  exams: { id: string; title: string }[];
  indicators: Indicator[];
  week: { minutes: number; questions: number; accuracy: number | null };
  statusBreakdown: { status: string; count: number }[];
  todayPlan: PlanItem[];
  recentActivities: Activity[];
  dueReviews: { topicId: string; topicTitle: string; overdueDays: number }[];
  priorities: PriorityItem[];
  engine: { version: string; kind: string };
  empty: { reason: string; message: string } | null;
  today: string;
};

export type Activity = {
  id: string;
  kind: string;
  minutes: number;
  questions_total: number | null;
  questions_correct: number | null;
  occurred_at: string;
  notes: string | null;
  topic_title?: string | null;
  subject_name?: string | null;
};

export type PlanItem = {
  id: string;
  day: string;
  topic_id: string | null;
  topic_title: string | null;
  subject_name: string | null;
  kind: 'estudo' | 'questoes' | 'revisao' | 'simulado' | 'descanso';
  target_minutes: number;
  status: 'pendente' | 'concluido' | 'pulado';
  reason: string | null;
};

export type Plan = {
  id: string;
  version: number;
  horizon_start: string;
  horizon_end: string;
  rationale: Record<string, unknown>;
  generated_at: string;
  items: PlanItem[];
};

export type AiStatus = {
  configured: boolean;
  provider: string | null;
  model: string | null;
  fallback: string;
  note: string;
};

export type RecommendationResponse = {
  engine: { version: string; kind: string; description: string };
  ai: AiStatus;
  items: PriorityItem[];
  dueReviews: { topicId: string; topicTitle: string; overdueDays: number; dueAt: string }[];
  totals: { topics: number; reviews: number };
};

export type ReviewRow = {
  topic_id: string;
  topic_title: string;
  subject_name: string;
  due_at: string;
  overdue_days: number;
  reps: number;
  lapses: number;
  stability: string | number;
};
