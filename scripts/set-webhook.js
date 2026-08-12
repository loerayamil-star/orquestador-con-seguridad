// Script de un solo uso (§14): registra el webhook de Telegram y verifica su estado.
// Uso:
//   node scripts/set-webhook.js <url-del-endpoint-desplegado>   → registra y verifica
//   node scripts/set-webhook.js                                  → solo verifica el estado actual

const token = process.env.TELEGRAM_BOT_TOKEN;
const secreto = process.env.TELEGRAM_WEBHOOK_SECRET;

if (!token) {
  console.error('Falta la variable de entorno TELEGRAM_BOT_TOKEN.');
  process.exit(1);
}

if (!secreto) {
  console.error('Falta la variable de entorno TELEGRAM_WEBHOOK_SECRET.');
  process.exit(1);
}

const urlEndpoint = process.argv[2];

async function registrarWebhook(url) {
  const respuesta = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      url,
      secret_token: secreto,
      allowed_updates: ['message'],
    }),
  });

  const datos = await respuesta.json();
  console.log('setWebhook:', JSON.stringify(datos, null, 2));

  if (!datos.ok) {
    process.exitCode = 1;
  }
}

async function verificarWebhook() {
  const respuesta = await fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`);
  const datos = await respuesta.json();
  console.log('getWebhookInfo:', JSON.stringify(datos, null, 2));
}

async function main() {
  if (urlEndpoint) {
    await registrarWebhook(urlEndpoint);
  } else {
    console.log('No se pasó URL — solo se verifica el estado actual del webhook.\n');
  }
  await verificarWebhook();
}

main();
