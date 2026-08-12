const TELEGRAM_API_BASE = 'https://api.telegram.org';

// No depende de req/res de Vercel (ver ARQUITECTURA.md §11) para poder
// reutilizarse desde el canal de laptop más adelante.
export async function sendMessage(chatId, text) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    throw new Error('Falta la variable de entorno TELEGRAM_BOT_TOKEN');
  }

  const respuesta = await fetch(`${TELEGRAM_API_BASE}/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text }),
  });

  const datos = await respuesta.json();
  if (!datos.ok) {
    throw new Error(`Telegram sendMessage falló: ${datos.description ?? 'sin descripción'}`);
  }

  return datos;
}
