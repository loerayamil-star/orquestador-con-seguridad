const NOTION_API_BASE = 'https://api.notion.com/v1';
const NOTION_VERSION = '2022-06-28';

// Presupuesto de tiempo (ARQUITECTURA.md §13, tope ~10s en Vercel free tier):
// search 2.0s + blocks.children 2.0s + Groq 2.5s + sendMessage 1.5s = 8.0s,
// dejando ~2s de margen para overhead de invocación. Ver api/telegram-webhook.js.
const TIMEOUT_SEARCH_MS = 2000;
const TIMEOUT_BLOQUES_MS = 2000;

// SOLO LECTURA (ARQUITECTURA.md §2, §3): usa /v1/search, que solo ve páginas
// y bases de datos explícitamente compartidas con la integración — eso acota
// el "scope mínimo" del token, no el código.
export async function buscarContexto(query, maxResultados = 3) {
  const token = process.env.NOTION_TOKEN;
  if (!token) {
    throw new Error('Falta la variable de entorno NOTION_TOKEN');
  }

  const respuesta = await fetch(`${NOTION_API_BASE}/search`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Notion-Version': NOTION_VERSION,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query,
      page_size: maxResultados,
      filter: { property: 'object', value: 'page' },
      sort: { direction: 'descending', timestamp: 'last_edited_time' },
    }),
    signal: AbortSignal.timeout(TIMEOUT_SEARCH_MS),
  });

  if (!respuesta.ok) {
    throw new Error(`Notion search respondió con estado ${respuesta.status}`);
  }

  const datos = await respuesta.json();
  return (datos.results ?? [])
    .map((pagina) => ({ id: pagina.id, titulo: extraerTitulo(pagina), url: pagina.url }))
    .filter((pagina) => pagina.titulo);
}

// SOLO LECTURA: /v1/blocks/{id}/children de lectura, nunca de escritura.
// Trae el texto plano de UNA página (la más relevante ya elegida por quien
// llama), no de las 3 candidatas de buscarContexto — así se mantiene una sola
// llamada extra en la cadena en vez de tres.
const TIPOS_DE_BLOQUE_CON_TEXTO = new Set([
  'paragraph',
  'heading_1',
  'heading_2',
  'heading_3',
  'bulleted_list_item',
  'numbered_list_item',
  'to_do',
  'quote',
  'callout',
  'toggle',
]);

const MAX_CARACTERES_CONTENIDO = 3000;

// pregunta: texto original del usuario — se usa para elegir qué sección (##)
// del documento traer, en vez de siempre los primeros bloques (ver
// extraerSeccionRelevante).
export async function obtenerContenido(pageId, pregunta, maxBloques = 30) {
  const token = process.env.NOTION_TOKEN;
  if (!token) {
    throw new Error('Falta la variable de entorno NOTION_TOKEN');
  }

  const respuesta = await fetch(
    `${NOTION_API_BASE}/blocks/${pageId}/children?page_size=${maxBloques}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        'Notion-Version': NOTION_VERSION,
      },
      signal: AbortSignal.timeout(TIMEOUT_BLOQUES_MS),
    },
  );

  if (!respuesta.ok) {
    throw new Error(`Notion blocks.children respondió con estado ${respuesta.status}`);
  }

  const datos = await respuesta.json();
  const bloques = datos.results ?? [];

  const texto =
    extraerSeccionRelevante(bloques, pregunta) ??
    bloques.map(extraerTextoDeBloque).filter(Boolean).join('\n');

  return texto.length > MAX_CARACTERES_CONTENIDO
    ? `${texto.slice(0, MAX_CARACTERES_CONTENIDO)}…`
    : texto;
}

const STOPWORDS_ES = new Set([
  'de', 'la', 'el', 'en', 'y', 'que', 'los', 'las', 'un', 'una', 'unos', 'unas',
  'con', 'para', 'por', 'es', 'del', 'al', 'lo', 'se', 'su', 'sus', 'como',
  'mas', 'más', 'no', 'si', 'sí', 'mi', 'tu', 'este', 'esta', 'esa', 'ese',
  'cual', 'cuando', 'donde', 'quien', 'me', 'te', 'le', 'les', 'sobre',
  'entre', 'sin', 'todo', 'toda', 'todos', 'todas', 'yo', 'tambien', 'también',
  'pero', 'porque', 'ya', 'muy', 'hay', 'ser', 'fue', 'o', 'a',
]);

// Comparación mecánica por palabras clave compartidas, sin llamar a ningún
// modelo (ARQUITECTURA.md: lo mecánico no debe gastar presupuesto de
// tiempo/tokens de IA en un paso que no lo necesita). Busca el heading_2 (##)
// con más tokens en común con la pregunta y devuelve solo esa sección: desde
// ese ## hasta el siguiente ## del mismo nivel, o el final del documento.
// Si ningún ## comparte ni una palabra clave, devuelve null (fallback a los
// primeros bloques, comportamiento anterior).
function extraerSeccionRelevante(bloques, pregunta) {
  const tokensPregunta = tokenizar(pregunta ?? '');
  if (tokensPregunta.length === 0) return null;

  const indicesEncabezados = bloques
    .map((bloque, indice) => (bloque.type === 'heading_2' ? indice : -1))
    .filter((indice) => indice !== -1);

  if (indicesEncabezados.length === 0) return null;

  let mejorIndice = -1;
  let mejorPuntaje = 0;

  for (const indice of indicesEncabezados) {
    const tituloEncabezado = extraerTextoDeBloque(bloques[indice]) ?? '';
    const puntaje = contarCoincidencias(tokensPregunta, tituloEncabezado);
    if (puntaje > mejorPuntaje) {
      mejorPuntaje = puntaje;
      mejorIndice = indice;
    }
  }

  if (mejorIndice === -1) return null;

  const siguienteIndice = indicesEncabezados.find((indice) => indice > mejorIndice) ?? bloques.length;
  return bloques
    .slice(mejorIndice, siguienteIndice)
    .map(extraerTextoDeBloque)
    .filter(Boolean)
    .join('\n');
}

function contarCoincidencias(tokensPregunta, tituloEncabezado) {
  const tokensEncabezado = new Set(tokenizar(tituloEncabezado));
  let coincidencias = 0;
  for (const token of tokensPregunta) {
    if (tokensEncabezado.has(token)) coincidencias++;
  }
  return coincidencias;
}

function tokenizar(texto) {
  return normalizar(texto)
    .split(/[^a-z0-9]+/)
    .filter((palabra) => palabra.length > 2 && !STOPWORDS_ES.has(palabra));
}

function normalizar(texto) {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, ''); // quita acentos tras la descomposición NFD
}

function extraerTextoDeBloque(bloque) {
  const tipo = bloque.type;
  if (!TIPOS_DE_BLOQUE_CON_TEXTO.has(tipo)) return null; // ignora imágenes, código embebido, etc.

  const richText = bloque[tipo]?.rich_text;
  if (!Array.isArray(richText)) return null;

  const texto = richText.map((fragmento) => fragmento.plain_text).join('').trim();
  return texto || null;
}

function extraerTitulo(pagina) {
  const propiedades = pagina.properties ?? {};
  for (const valor of Object.values(propiedades)) {
    if (valor?.type === 'title' && Array.isArray(valor.title)) {
      const texto = valor.title.map((fragmento) => fragmento.plain_text).join('').trim();
      if (texto) return texto;
    }
  }
  return null;
}
