# orquestador-con-seguridad
Asistente personal orquestador multiagente — conecta Obsidian, Notion y GitHub bajo un diseño de seguridad por capas (permisos asimétricos por canal, catálogo de acciones por riesgo, auditoría de intentos rechazados). Construcción asistida por IA bajo arquitectura y decisiones de seguridad propias.

## Estado del proyecto

**Fase 1** del roadmap (`ARQUITECTURA.md` §10): fundación, código implementado, verificación pendiente.

Ya hecho:
- Sandbox de pruebas creado (workspace de Notion separado + vault `Sandbox-YARVIS` en Obsidian)
- Repo, `package.json`, documentación de arquitectura
- Bot creado en BotFather, token guardado en Bitwarden
- `api/telegram-webhook.js` con las verificaciones de §13 (fusionado en el PR #1)
- `lib/telegram.js` con el helper de `sendMessage`
- `scripts/set-webhook.js` para registrar el webhook (§14)
- `.env.example` con las tres variables de Fase 1

Pendiente de Fase 1:
- Confirmar proyecto en Vercel conectado al repo y variables de entorno configuradas (§12)
- Registrar el webhook y comprobar que `getWebhookInfo` no muestra errores
- Verificar los criterios de §15 y marcar sus casillas en `ARQUITECTURA.md`
- Sustituir el `npm test` de relleno (`exit 1`) por tests de comportamiento del webhook