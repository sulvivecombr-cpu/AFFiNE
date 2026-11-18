/**
 * Transactional outbox. Events are written in the same transaction as the state
 * change, then consumed by cable-worker (src/worker.js) with retries and a
 * dead-letter status. Consumers must be idempotent: handlers are keyed by
 * (event id, handler name) in `event_deliveries`.
 */
export async function emitEvent(client, { workspaceId, examId, type, actorId, payload = {} }) {
  const { rows } = await client.query(
    `INSERT INTO events (workspace_id, exam_id, type, actor_id, payload)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, occurred_at`,
    [workspaceId ?? null, examId ?? null, type, actorId ?? null, payload]
  );
  return rows[0];
}

export async function audit(client, { workspaceId, actorId, action, entity, entityId, meta = {} }) {
  await client.query(
    `INSERT INTO audit_log (workspace_id, actor_id, action, entity, entity_id, meta)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [workspaceId ?? null, actorId ?? null, action, entity, entityId ?? null, meta]
  );
}

export const EVENT_TYPES = {
  userRegistered: 'usuario.cadastrado',
  examCreated: 'concurso.criado',
  examStatusChanged: 'concurso.status_alterado',
  examAvailabilitySet: 'concurso.disponibilidade_definida',
  noticeCreated: 'edital.registrado',
  noticeVersionUploaded: 'edital.versao_importada',
  noticeProcessed: 'edital.processado',
  noticeConfirmed: 'edital.confirmado',
  subjectCreated: 'disciplina.criada',
  topicCreated: 'assunto.criado',
  activityRecorded: 'estudo.atividade_registrada',
  planGenerated: 'plano.gerado',
  planItemUpdated: 'plano.item_atualizado',
  recommendationsRefreshed: 'recomendacoes.atualizadas',
};
