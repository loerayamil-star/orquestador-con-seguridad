const NOTION_API_BASE = 'https://api.notion.com/v1';
const NOTION_VERSION = '2022-06-28';

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
    signal: AbortSignal.timeout(5000),
  });

  if (!respuesta.ok) {
    throw new Error(`Notion search respondió con estado ${respuesta.status}`);
  }

  const datos = await respuesta.json();
  return (datos.results ?? [])
    .map((pagina) => ({ titulo: extraerTitulo(pagina), url: pagina.url }))
    .filter((pagina) => pagina.titulo);
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
