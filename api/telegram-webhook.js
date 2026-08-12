import { sendMessage } from '../lib/telegram.js';

export default async function handler(req, res) {
  // 1. Método debe ser POST.
  if (req.method !== 'POST') {
    res.status(405).end();
    return;
  }

  const secretoEsperado = process.env.TELEGRAM_WEBHOOK_SECRET;
  const usuarioAutorizado = process.env.TELEGRAM_ALLOWED_USER_ID;
  console.error('DEBUG longitud del secreto en Vercel:', secretoEsperado?.length);

  if (!secretoEsperado || !usuarioAutorizado) {
    // Falla explícita en logs del servidor (§12); nunca se expone al usuario ni en la respuesta HTTP.
    console.error(
      'Faltan variables de entorno requeridas: TELEGRAM_WEBHOOK_SECRET y/o TELEGRAM_ALLOWED_USER_ID',
    );
    res.status(200).end();
    return;
  }

  // 2. El secret_token de la cabecera debe coincidir con el registrado en el webhook.
  const secretoRecibido = req.headers['x-telegram-bot-api-secret-token'];
  if (secretoRecibido !== secretoEsperado) {
    res.status(401).end();
    return;
  }

  // 3. El remitente debe ser el único usuario autorizado.
  const mensaje = req.body?.message;
  const idRemitente = mensaje?.from?.id != null ? String(mensaje.from.id) : undefined;

  if (idRemitente !== usuarioAutorizado) {
    // Se descarta sin procesar, pero se responde 200 para que Telegram no reintente.
    res.status(200).end();
    return;
  }

  try {
    await sendMessage(mensaje.chat.id, 'Recibido. Fase 1: sin IA todavía.');
  } catch (error) {
    // Nunca exponer detalles internos al usuario ni en la respuesta (§13).
    console.error('Error al enviar mensaje a Telegram:', error.message);
  }

  res.status(200).end();
}
