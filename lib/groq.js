const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = 'openai/gpt-oss-120b';

const INSTRUCCION_SISTEMA =
  'Eres el Agente de Conocimiento de un asistente personal. Respondes en español, ' +
  'breve y directo. Usa SOLO el contexto de Notion provisto (títulos y enlaces de ' +
  'páginas relevantes) para orientar tu respuesta; si no alcanza para responder con ' +
  'certeza, dilo explícitamente en vez de inventar contenido que no está en el contexto.';

export async function generarRespuesta(pregunta, contexto) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error('Falta la variable de entorno GROQ_API_KEY');
  }

  const contextoTexto = contexto.length
    ? contexto.map((pagina) => `- ${pagina.titulo} (${pagina.url})`).join('\n')
    : 'Sin resultados relevantes en Notion para esta consulta.';

  const respuesta = await fetch(GROQ_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      temperature: 0.3,
      max_tokens: 500,
      messages: [
        { role: 'system', content: INSTRUCCION_SISTEMA },
        {
          role: 'user',
          content: `Pregunta: ${pregunta}\n\nContexto de Notion (solo títulos y enlaces):\n${contextoTexto}`,
        },
      ],
    }),
    signal: AbortSignal.timeout(7000),
  });

  if (!respuesta.ok) {
    throw new Error(`Groq respondió con estado ${respuesta.status}`);
  }

  const datos = await respuesta.json();
  const texto = datos.choices?.[0]?.message?.content?.trim();
  return texto || 'No obtuve una respuesta utilizable de Groq.';
}
