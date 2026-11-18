'use strict';

/** Utilidades de escape e de marcação segura. */

const ESCAPES = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

function esc(value) {
  return String(value == null ? '' : value).replace(/[&<>"']/g, (ch) => ESCAPES[ch]);
}

/** Token de dado pendente de cadastro (nunca inventamos identidade empresarial). */
function pending(label) {
  return `<span class="pending-data" role="note">${esc(label || '[pendente de cadastro]')}</span>`;
}

/**
 * Substitui {{chave}} pelos dados reais da configuração.
 * Valores vazios viram marcador visível de pendência.
 */
function fillTokens(text, map) {
  return String(text).replace(/\{\{(\w+)\}\}/g, (_match, key) => {
    const value = map[key];
    return value ? esc(value) : pending(`[${key} pendente]`);
  });
}

function renderBlocks(blocks, map) {
  return blocks
    .map((block) => {
      const heading = block.h ? `<h2>${fillTokens(block.h, map)}</h2>` : '';
      const paras = (block.p || [])
        .map((p) => `<p>${fillTokens(p, map)}</p>`)
        .join('');
      return `<section class="doc-block">${heading}${paras}</section>`;
    })
    .join('');
}

function formatDate(iso) {
  if (!iso) return '—';
  const date = new Date(`${iso}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) return esc(iso);
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
}

module.exports = { esc, pending, fillTokens, renderBlocks, formatDate };
