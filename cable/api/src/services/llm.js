/**
 * LLM bridge (optional). Cable's core intelligence is deterministic and always
 * available; this module only adds natural-language explanation on top of real
 * data when an OpenAI-compatible key is configured.
 *
 * Required environment (delivered by the platform, never committed):
 *   CABLE_AI_API_KEY    — provider key
 *   CABLE_AI_BASE_URL   — default https://api.openai.com/v1
 *   CABLE_AI_MODEL      — default gpt-4o-mini
 */
export function aiStatus() {
  const configured = Boolean(process.env.CABLE_AI_API_KEY);
  return {
    configured,
    provider: configured ? 'openai-compatible' : null,
    model: configured ? process.env.CABLE_AI_MODEL ?? 'gpt-4o-mini' : null,
    fallback: 'Motor determinístico de priorização (prioridade-v1)',
    note: configured
      ? 'Respostas geradas a partir dos dados reais do concurso.'
      : 'Sem chave de LLM configurada: as recomendações vêm do motor determinístico, com justificativas calculadas.',
  };
}

const SYSTEM_PROMPT = `Você é o Cable AI, assistente de preparação para concursos públicos.
Regras invioláveis:
- Use apenas os dados fornecidos no contexto JSON. Nunca invente concursos, editais, datas, fontes ou números.
- Diferencie fato (presente no contexto) de inferência (sua análise). Marque inferências como "inferência".
- Se o contexto não tiver dados suficientes, diga exatamente o que falta.
- Nunca prometa aprovação nem preveja resultado.
- Responda em português do Brasil, de forma objetiva, no máximo 6 parágrafos.`;

export async function askAgent({ question, context }) {
  const status = aiStatus();
  if (!status.configured) {
    const error = new Error('CABLE_AI_API_KEY não configurada.');
    error.code = 'ai_not_configured';
    throw error;
  }
  const baseUrl = (process.env.CABLE_AI_BASE_URL ?? 'https://api.openai.com/v1').replace(/\/$/, '');
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${process.env.CABLE_AI_API_KEY}`,
    },
    body: JSON.stringify({
      model: status.model,
      temperature: 0.2,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: `Contexto (dados reais):\n${JSON.stringify(context)}\n\nPergunta: ${question}` },
      ],
    }),
  });
  if (!response.ok) {
    const text = await response.text();
    const error = new Error(`Provedor respondeu ${response.status}: ${text.slice(0, 300)}`);
    error.code = 'ai_provider_error';
    throw error;
  }
  const data = await response.json();
  return {
    answer: data.choices?.[0]?.message?.content ?? '',
    model: status.model,
  };
}
