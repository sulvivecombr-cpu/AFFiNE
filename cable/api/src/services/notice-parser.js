/**
 * Deterministic notice (edital) reader.
 *
 * It never invents content: every subject/topic it returns is a literal span of
 * the document, with the page it came from and a confidence score. Anything
 * ambiguous is left for the candidate to confirm or fix in the review screen.
 */

const KNOWN_SUBJECTS = [
  'Língua Portuguesa',
  'Raciocínio Lógico',
  'Raciocínio Lógico-Matemático',
  'Matemática',
  'Matemática Financeira',
  'Estatística',
  'Direito Constitucional',
  'Direito Administrativo',
  'Direito Penal',
  'Direito Processual Penal',
  'Direito Civil',
  'Direito Processual Civil',
  'Direito Tributário',
  'Direito Previdenciário',
  'Direito do Trabalho',
  'Direito Processual do Trabalho',
  'Direito Eleitoral',
  'Direito Ambiental',
  'Direito Empresarial',
  'Direito Internacional',
  'Direitos Humanos',
  'Legislação Especial',
  'Legislação',
  'Informática',
  'Noções de Informática',
  'Tecnologia da Informação',
  'Contabilidade Geral',
  'Contabilidade Pública',
  'Auditoria',
  'Administração Pública',
  'Administração Financeira e Orçamentária',
  'Economia',
  'Atualidades',
  'História',
  'Geografia',
  'Conhecimentos Gerais',
  'Ética no Serviço Público',
  'Arquivologia',
  'Biblioteconomia',
  'Serviço Social',
  'Psicologia',
  'Pedagogia',
  'Biologia',
  'Física',
  'Química',
  'Redação',
  'Língua Inglesa',
  'Língua Espanhola',
  'Segurança Pública',
  'Criminologia',
  'Medicina Legal',
  'Criminalística',
  'Direito da Criança e do Adolescente',
  'Controle Externo',
  'Finanças Públicas',
  'Gestão de Pessoas',
  'Logística',
  'Comércio Internacional',
  'Enfermagem',
  'Farmácia',
  'Odontologia',
  'Medicina',
  'Engenharia Civil',
];

const ALIASES = {
  portugues: 'Língua Portuguesa',
  'lingua portuguesa': 'Língua Portuguesa',
  'lingua portuguesa e redacao': 'Língua Portuguesa',
  'raciocinio logico': 'Raciocínio Lógico',
  'raciocinio logico matematico': 'Raciocínio Lógico-Matemático',
  'raciocinio logico e matematico': 'Raciocínio Lógico-Matemático',
  matematica: 'Matemática',
  informatica: 'Informática',
  'nocoes de informatica': 'Noções de Informática',
  'direito constitucional': 'Direito Constitucional',
  'direito administrativo': 'Direito Administrativo',
  'direito penal': 'Direito Penal',
  'processo penal': 'Direito Processual Penal',
  'direito processual penal': 'Direito Processual Penal',
  'direito civil': 'Direito Civil',
  'processo civil': 'Direito Processual Civil',
  'direito processual civil': 'Direito Processual Civil',
  'direito tributario': 'Direito Tributário',
  'direito previdenciario': 'Direito Previdenciário',
  'direito do trabalho': 'Direito do Trabalho',
  'direito eleitoral': 'Direito Eleitoral',
  'direitos humanos': 'Direitos Humanos',
  legislacao: 'Legislação',
  'legislacao especial': 'Legislação Especial',
  'etica no servico publico': 'Ética no Serviço Público',
  'etica': 'Ética no Serviço Público',
  'administracao publica': 'Administração Pública',
  'contabilidade geral': 'Contabilidade Geral',
  'contabilidade publica': 'Contabilidade Pública',
  'auditoria': 'Auditoria',
  'atualidades': 'Atualidades',
  historia: 'História',
  geografia: 'Geografia',
  ingles: 'Língua Inglesa',
  'lingua inglesa': 'Língua Inglesa',
  espanhol: 'Língua Espanhola',
  'lingua espanhola': 'Língua Espanhola',
  'seguranca publica': 'Segurança Pública',
  'medicina legal': 'Medicina Legal',
  'gestao de pessoas': 'Gestão de Pessoas',
  arquivologia: 'Arquivologia',
};

const normalize = value =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const ALIAS_INDEX = new Map();
for (const subject of KNOWN_SUBJECTS) ALIAS_INDEX.set(normalize(subject), subject);
for (const [alias, canonical] of Object.entries(ALIASES)) ALIAS_INDEX.set(normalize(alias), canonical);

const SECTION_START =
  /^(?:anexo\s+[ivxlcdm\d]*\s*[-–—.]?\s*)?(?:conte[uú]do\s+program[aá]tico|programa\s+de\s+provas?|dos\s+programas?|das\s+disciplinas|programa\s+das\s+provas?)\b/i;
const SECTION_END = /^(?:anexo\s+[ivxlcdm\d]+\b|das\s+disposi[cç][oõ]es\s+finais|assinatura|p[aá]gina\s+\d+)/i;

const TOPIC_NUMBERED = /^(\d+(?:\.\d+)*)\.?\s*[-–)]?\s+(.{3,240})$/;
const TOPIC_LETTER = /^([a-z])\)\s+(.{3,240})$/i;
const TOPIC_BULLET = /^[-–•·*]\s*(.{3,240})$/;

const PAGE_ARTIFACT = /^(?:p[aá]gina\s*\d+|\d+\s*\/\s*\d+|di[aá]rio\s+oficial.*)$/i;

function splitLines(pages) {
  const lines = [];
  for (const page of pages) {
    const raw = String(page.text ?? '')
      .replace(/\u00ad/g, '')
      .replace(/-\n(?=[a-zà-ú])/gi, '')
      .replace(/\r/g, '');
    for (const line of raw.split('\n')) {
      const text = line.replace(/\s+/g, ' ').trim();
      if (text.length === 0) continue;
      if (PAGE_ARTIFACT.test(text)) continue;
      lines.push({ text, page: page.pageNo });
    }
  }
  return lines;
}

function findSection(lines) {
  const start = lines.findIndex(line => SECTION_START.test(line.text));
  if (start === -1) return null;
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i += 1) {
    if (SECTION_END.test(lines[i].text)) {
      end = i;
      break;
    }
  }
  return { start, end };
}

function matchKnownSubject(text) {
  const cleaned = text
    .replace(/^[\d.)\s-]+/, '')
    .replace(/[:.\s]+$/, '')
    .trim();
  if (cleaned.length < 3 || cleaned.length > 70) return null;
  const normalized = normalize(cleaned);
  if (!normalized) return null;
  if (ALIAS_INDEX.has(normalized)) {
    return { name: ALIAS_INDEX.get(normalized), confidence: 0.95 };
  }
  // "LÍNGUA PORTUGUESA: 10 questões" / "DIREITO PENAL (peso 2)"
  const withoutTail = normalized.replace(/\s*\(.*$/, '').replace(/\s+\d+.*$/, '').trim();
  if (ALIAS_INDEX.has(withoutTail)) {
    return { name: ALIAS_INDEX.get(withoutTail), confidence: 0.9 };
  }
  return null;
}

function looksLikeSubjectHeading(text) {
  if (text.length < 4 || text.length > 70) return false;
  if (/[.;]$/.test(text) && text.split(' ').length > 6) return false;
  const letters = text.replace(/[^\p{L}]/gu, '');
  if (letters.length < 4) return false;
  const uppercase = letters.replace(/[^\p{Lu}]/gu, '');
  const ratio = uppercase.length / letters.length;
  if (ratio < 0.85) return false;
  const words = text.split(/\s+/).length;
  return words <= 8;
}

function cleanTopicTitle(text) {
  return text
    .replace(/\s*\.{2,}\s*\d+$/, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/**
 * @param {{pageNo: number, text: string}[]} pages
 * @returns {{subjects: Array, section: object|null, stats: object}}
 */
export function parseNotice(pages) {
  const lines = splitLines(pages);
  const section = findSection(lines);
  const scope = section ? lines.slice(section.start, section.end) : lines;

  const subjects = [];
  let current = null;
  const seenTopic = new Set();

  const pushSubject = (name, confidence, page) => {
    const existing = subjects.find(s => normalize(s.name) === normalize(name));
    if (existing) {
      current = existing;
      return existing;
    }
    const created = { name, confidence, page, topics: [] };
    subjects.push(created);
    current = created;
    return created;
  };

  for (const line of scope) {
    const known = matchKnownSubject(line.text);
    if (known) {
      pushSubject(known.name, known.confidence, line.page);
      continue;
    }

    if (!section && looksLikeSubjectHeading(line.text)) {
      pushSubject(
        line.text.replace(/[:.\s]+$/, ''),
        0.7,
        line.page
      );
      continue;
    }

    if (section && looksLikeSubjectHeading(line.text) && current === null) {
      pushSubject(line.text.replace(/[:.\s]+$/, ''), 0.6, line.page);
      continue;
    }

    if (!current) continue;

    const numbered = line.text.match(TOPIC_NUMBERED);
    const lettered = line.text.match(TOPIC_LETTER);
    const bulleted = line.text.match(TOPIC_BULLET);
    let code = null;
    let title = null;
    let confidence = 0;

    if (numbered && !/^\d{1,3}$/.test(line.text)) {
      code = numbered[1];
      title = numbered[2];
      confidence = 0.9;
    } else if (lettered) {
      code = lettered[1].toLowerCase();
      title = lettered[2];
      confidence = 0.7;
    } else if (bulleted) {
      title = bulleted[1];
      confidence = 0.6;
    } else if (line.text.length >= 12 && line.text.length <= 240 && /[a-zà-ú]/.test(line.text)) {
      title = line.text;
      confidence = 0.45;
    }

    if (!title) continue;
    const cleaned = cleanTopicTitle(title);
    if (cleaned.length < 4) continue;
    const key = `${normalize(current.name)}::${normalize(cleaned)}`;
    if (seenTopic.has(key)) continue;
    seenTopic.add(key);

    current.topics.push({
      code,
      title: cleaned.slice(0, 240),
      page: line.page,
      confidence,
    });
  }

  const meaningful = subjects.filter(s => s.topics.length > 0);
  return {
    subjects: meaningful,
    section: section ? { lineStart: section.start, lineEnd: section.end } : null,
    stats: {
      lines: lines.length,
      subjectsFound: meaningful.length,
      topicsFound: meaningful.reduce((total, s) => total + s.topics.length, 0),
    },
  };
}

/**
 * Best-effort header metadata (banca, órgão, cargo, data). Only patterns that
 * actually matched are returned — nothing is filled in by default.
 */
export function extractMetadata(pages) {
  const text = pages
    .slice(0, 6)
    .map(page => String(page.text ?? ''))
    .join('\n');

  const found = {};
  const grab = (key, regex, transform = v => v) => {
    const match = text.match(regex);
    if (!match) return;
    const value = transform(match[1].replace(/\s+/g, ' ').trim());
    if (value) found[key] = { value, page: pages[0]?.pageNo ?? 1 };
  };

  grab('board', /(?:banca|organizadora|empresa\s+organizadora)\s*[:\-–—]\s*([^\n]{3,60})/i);
  grab('organization', /(?:[oó]rg[aã]o|entidade|institui[cç][aã]o)\s*[:\-–—]\s*([^\n]{3,80})/i);
  grab('position', /(?:cargo|emprego)\s*[:\-–—]\s*([^\n]{3,80})/i);
  grab('examDate', /(?:data\s+da\s+(?:prova|avalia[cç][aã]o)|provas?\s+em)\s*[:\-–—]?\s*(\d{1,2}\/\d{1,2}\/\d{4})/i, value => {
    const [day, month, year] = value.split('/');
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  });

  return found;
}
