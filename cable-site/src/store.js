'use strict';

/**
 * Armazenamento do site institucional do Cable.
 *
 * Persistência simples em arquivo JSON (gravação atômica). Não há dependências
 * externas: o objetivo é um site institucional independente do aplicativo Cable,
 * sem replicar autenticação nem banco do app.
 */

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { seedState } = require('./content');

const DATA_DIR = process.env.CABLE_DATA_DIR || path.join(__dirname, '..', 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

let state = null;

function ensureDir() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function persist() {
  ensureDir();
  const tmp = `${DB_FILE}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(state, null, 2), 'utf8');
  fs.renameSync(tmp, DB_FILE);
}

function db() {
  if (state) return state;
  ensureDir();
  if (fs.existsSync(DB_FILE)) {
    try {
      state = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    } catch (error) {
      console.error('[store] banco ilegível, recriando a partir do seed:', error.message);
      state = seedState();
      persist();
    }
  } else {
    state = seedState();
    persist();
  }
  return state;
}

function save() {
  db();
  persist();
  return state;
}

function nextId(prefix) {
  return `${prefix}_${Date.now().toString(36)}${crypto.randomBytes(3).toString('hex')}`;
}

function audit(actor, action, detail) {
  const data = db();
  data.auditLogs.unshift({
    id: nextId('log'),
    actor: actor || 'sistema',
    action,
    detail: detail || '',
    at: new Date().toISOString(),
  });
  data.auditLogs = data.auditLogs.slice(0, 500);
}

module.exports = { db, save, nextId, audit, DATA_DIR, DB_FILE };
