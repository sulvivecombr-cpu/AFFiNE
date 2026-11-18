import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractMetadata, parseNotice } from '../src/services/notice-parser.js';

const pages = [
  {
    pageNo: 1,
    text: `EDITAL Nº 01/2026
CONCURSO PÚBLICO PARA PROVIMENTO DE CARGOS
Órgão: Tribunal Regional Federal da 3ª Região
Banca: Cebraspe
Cargo: Analista Judiciário
Data da prova: 15/03/2026
`,
  },
  {
    pageNo: 12,
    text: `ANEXO II — CONTEÚDO PROGRAMÁTICO

LÍNGUA PORTUGUESA
1. Compreensão e interpretação de textos
2. Ortografia e acentuação
3. Concordância verbal e nominal

DIREITO CONSTITUCIONAL
1. Direitos e garantias fundamentais
2. Organização do Estado
3. Poder Judiciário

DIREITO ADMINISTRATIVO
1. Princípios da Administração Pública
2. Atos administrativos
`,
  },
  {
    pageNo: 13,
    text: `ANEXO III — DAS DISPOSIÇÕES FINAIS
Este edital entra em vigor na data de sua publicação.
`,
  },
];

test('extracts subjects and topics with page numbers', () => {
  const result = parseNotice(pages);
  const names = result.subjects.map(subject => subject.name);

  assert.ok(names.includes('Língua Portuguesa'), `esperava Língua Portuguesa em ${names.join(', ')}`);
  assert.ok(names.includes('Direito Constitucional'));
  assert.ok(names.includes('Direito Administrativo'));

  const portugues = result.subjects.find(subject => subject.name === 'Língua Portuguesa');
  assert.equal(portugues.topics.length, 3);
  assert.equal(portugues.topics[0].code, '1');
  assert.match(portugues.topics[0].title, /Compreensão e interpretação/);
  assert.equal(portugues.topics[0].page, 12);
  assert.ok(portugues.topics[0].confidence >= 0.85);
});

test('stops at the next annex instead of swallowing the whole document', () => {
  const result = parseNotice(pages);
  const titles = result.subjects.flatMap(subject => subject.topics.map(topic => topic.title));
  assert.ok(!titles.some(title => /entra em vigor/i.test(title)));
});

test('returns nothing instead of inventing content when the document has no program', () => {
  const result = parseNotice([{ pageNo: 1, text: 'Contrato administrativo de serviço de limpeza.' }]);
  assert.equal(result.subjects.length, 0);
  assert.equal(result.stats.topicsFound, 0);
});

test('reads header metadata only when the pattern is present', () => {
  const meta = extractMetadata(pages);
  assert.equal(meta.board.value, 'Cebraspe');
  assert.equal(meta.position.value, 'Analista Judiciário');
  assert.equal(meta.examDate.value, '2026-03-15');
  assert.equal(meta.organization.value, 'Tribunal Regional Federal da 3ª Região');

  const empty = extractMetadata([{ pageNo: 1, text: 'Documento sem cabeçalho padronizado.' }]);
  assert.deepEqual(empty, {});
});
