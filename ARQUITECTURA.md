# Arquitectura — Orquestador con Seguridad

Asistente personal orquestador multiagente. Conecta Obsidian, Notion y GitHub, con un diseño de seguridad por capas definido *antes* de escribir código, no añadido después.

> **Cómo leer este documento:** las secciones 1–10 son el diseño conceptual (el "qué" y el "por qué"). Las secciones 11–15 son detalles tácticos de implementación (el "cómo"), y son las que hay que respetar al escribir código. Si algo en 11–15 contradice 1–10, gana 1–10 y hay que reportar la contradicción, no resolverla por cuenta propia.

---

## 1. Componentes principales

```
Telegram (remoto) ──┐
                     ├──→ Orquestador (Antigravity + fallback Groq)
Laptop (local) ──────┘         │
                                ├── MCP: Notion (scope según canal)
                                ├── MCP: Google Drive (lee vault de Obsidian sincronizado)
                                ├── MCP: GitHub (token solo-lectura, repos específicos)
                                └── Catálogo de acciones propio (marcar hábito, etc.)
```

- **Orquestador:** Antigravity 2.0 (multiagente, soporta MCP nativo, nivel gratuito).
- **Fallback si Antigravity falla o se acaba el crédito:** Groq (gpt-oss-120B, ya configurado).
- **Si ambos fallan:** degradación elegante — responde con búsqueda directa vía MCP sin capa de razonamiento, en vez de no responder nada. Cubre también el caso de "sin conexión total", sin necesitar lógica distinta.
- **Interfaz remota:** función serverless en Vercel, actúa como webhook de Telegram — solo despierta cuando llega un mensaje, no requiere servidor prendido 24/7.
- **Interfaz local:** Antigravity corriendo directo en la laptop, con acceso a filesystem para editar Obsidian.

> **Nota (12 agosto):** Antigravity presentó fricción real hoy (crashes del IDE por hardware limitado, complicaciones de autenticación en la CLI, errores genéricos de ejecución). Se usa Groq (gpt-oss-120B) como motor TEMPORAL del Agente de Conocimiento en Fase 2, en vez de Antigravity+MCP nativo. Esto no es un cambio de diseño permanente — Antigravity sigue siendo el plan a futuro. Groq ya estaba contemplado como fallback (sección 1), así que usarlo como principal ahora es coherente con la arquitectura existente, no una desviación.

---

## 2. Catálogo de agentes (por especialidad, no un solo modelo generalista)

```
Agente Orquestador
  ├── Agente de Conocimiento    → Obsidian/Notion, SOLO lectura
  ├── Agente de Investigación   → búsqueda web, SOLO lectura externa
  ├── Agente de Escritura       → Cola de Ediciones (Obsidian) + directo (Notion), riesgo medio
  ├── Agente de Hábitos         → Registro Diario en Notion, automático
  └── Agente de Código          → GitHub, SOLO lectura estricta
```

**Razón de seguridad, no solo organización:** cada subagente solo tiene configuradas las herramientas MCP de su propia especialidad. El Agente de Conocimiento físicamente no tiene la herramienta de escritura disponible — ni un prompt injection exitoso podría hacerlo escribir, porque esa capacidad no existe en su configuración.

**Descartado del alcance:** Gmail (redundante con Gemini nativo), Google Docs/Sheets/Drive como agentes propios (mismo motivo).

---

## 3. Catálogo de acciones por nivel de riesgo

**Automático, sin confirmación (bajo riesgo, reversible en segundos):**
- Buscar un concepto en los vaults de Obsidian
- Consultar estado de un proyecto en Notion
- Leer un archivo específico de GitHub (nunca explorar libremente todo el repo)
- Marcar un hábito como completado

**Con confirmación explícita (riesgo medio, crea/modifica contenido permanente):**
- Crear una nota nueva en Obsidian (vía Cola de Ediciones, ver sección 4)
- Agregar una entrada al Backup de Contexto en Notion

**Prohibido de raíz — la función NO EXISTE en el código, nunca se desbloquea ni en modo elevado temporal:**
- `git push`, borrar archivos, modificar código de repos
- Ejecutar comandos de shell arbitrarios
- Modificar configuración del sistema
- Acceder a Bitwarden o cualquier gestor de secretos
- Enviar correos (si algún día se reconsidera Gmail: solo crear borradores, nunca enviar)

**Prueba para clasificar una acción nueva:** ¿deshacer el error cuesta segundos, o cuesta tiempo/confianza real? Lo primero es automático, lo segundo pide confirmación.

**Permisos ajustables por sesión:** el usuario puede elevar temporalmente un permiso para una tarea específica (ej. "para esto, permite escribir, preguntando antes de cada acción"). Las acciones prohibidas de raíz NUNCA se desbloquean, ni temporalmente.

---

## 4. Integridad de datos: Cola de Ediciones para Obsidian

**Problema:** el vault existe en dos copias (laptop local + Drive, para que Telegram pueda leerlo). Editar desde ambos lados puede causar pérdida silenciosa de datos (sincronización tipo espejo, sin fusión inteligente como git).

**Solución: el vault se edita ÚNICAMENTE desde la laptop.** Telegram nunca toca el archivo real.

```
1. Desde Telegram: "agrega X a mi nota de Y"
2. Se escribe como entrada en base de Notion "Cola de Ediciones a Obsidian"
   (nota destino, acción, contenido propuesto, estado: Pendiente)
3. Al llegar a la laptop, el Agente de Escritura consulta la cola
4. Muestra el diff propuesto, pide confirmación
5. Confirmado → escribe al archivo real
6. Se marca como "Aplicado" en Notion
```

**Sincronización Drive:** vía `rclone`, tarea programada (cron), NO ejecutada por el agente — evita depender de que el agente "se acuerde", y evita gastar llamadas en una tarea mecánica.

---

## 5. Identidad y permisos por canal

**Telegram — dos capas independientes de verificación, ambas obligatorias:**

1. **`secret_token`**: al registrar el webhook se define un token secreto; Telegram lo envía en la cabecera `X-Telegram-Bot-Api-Secret-Token` en cada petición. Si no coincide, se rechaza inmediatamente — prueba que la petición viene de Telegram y no de alguien que descubrió la URL del endpoint.
2. **`from.id`**: se compara contra el ID de Telegram del usuario autorizado (variable de entorno). Si no coincide, se descarta sin gastar ninguna llamada a MCP/IA — prueba que el mensaje viene del usuario correcto y no de otra persona hablándole al bot.

(Filtrar por IP no funciona: los mensajes de Telegram siempre llegan desde los servidores de Telegram, no desde el dispositivo del remitente.)

**Permisos asimétricos por canal, a propósito:**
- **Laptop:** todo el catálogo de lectura + escritura controlada, lectura profunda de Obsidian.
- **Telegram:** solo lectura + automáticos de bajo impacto. Nada de exploración libre de vaults completos — solo consultas puntuales y acotadas. Confirmaciones más estrictas que en laptop.

**Riesgos residuales aceptados (documentados, no "resueltos"):**
- Teléfono desbloqueado en manos de otra persona: mitigado por bloqueo biométrico del dispositivo + la Cola de Ediciones (revisión manual antes de aplicar cualquier escritura).
- Laptop desbloqueada en manos de otra persona: riesgo bajo por default (se queda en casa); revisitar si cambia el contexto de uso.

---

## 6. Auditoría — Bitácora de Acciones

Base de Notion separada de los datos reales, dedicada a registro de sistema: fecha/hora, canal, acción ejecutada, automática o con confirmación, resultado.

**Registra TAMBIÉN los intentos rechazados**, no solo los exitosos — es la señal más importante de seguridad (alguien que no es el usuario intentando usar el bot, o el agente intentando algo fuera del catálogo permitido).

**Qué NUNCA se registra, ni en la Bitácora ni en logs de Vercel:** tokens, API keys, contraseñas, ni el contenido completo de notas personales. Se registra *qué* acción ocurrió y *sobre qué recurso*, no el contenido íntegro del recurso.

---

## 7. Resiliencia operacional

- **Preview Deployments (Vercel):** push a rama nueva → URL de preview separada, se prueba ahí con datos del sandbox. Solo merge a `main` vía Pull Request dispara deploy a producción.
- **Alertas activas:** si el orquestador primario Y el fallback fallan a la vez, se manda una notificación de Telegram al usuario (mismo bot, dirección inversa) — no depender de que alguien revise la Bitácora activamente.
- **Límite de iteraciones:** contador de profundidad máxima entre llamadas de agentes (máximo 8) para evitar bucles que vacíen la cuota gratuita sin que nada "falle" técnicamente. Al alcanzar el límite, se registra como error y dispara la misma alerta de fallo.
- **Rotación de credenciales:** si un token se filtra — revocar en la plataforma emisora, generar uno nuevo con el mismo scope mínimo, actualizar la variable de entorno en Vercel (nunca toca el código ni requiere commit).

---

## 8. Gestión de secretos

Ninguna API key hardcodeada. Viven en Environment Variables de Vercel (dashboard del proyecto), cifradas, separadas del repo. El código las lee vía `process.env.NOMBRE_VARIABLE`. El archivo `.env.example` muestra la *forma* (nombres de variables, sin valores) y sí se versiona; un `.env` con valores reales nunca se versiona.

**Origen de servidores MCP:** conectar ÚNICAMENTE servidores MCP oficiales y verificados (Google/Notion/GitHub directamente) — nunca uno de la comunidad sin auditar. Mismo tipo de riesgo que un paquete de npm comprometido (caso PhantomRaven), aplicado a la cadena de suministro del propio proyecto.

---

## 9. Entorno de pruebas antes de datos reales

**Aislamiento total, no solo scope limitado dentro del workspace real** — un error durante pruebas no debe tener ninguna posibilidad de tocar datos reales.

- Notion: workspace de prueba separado, con datos de mentira.
- Obsidian: vault separado `Sandbox-YARVIS`, con notas de prueba enlazadas entre sí.
- GitHub: token de scope mínimo apuntando a un repo de práctica, no a repos reales.

**Criterio de graduación a datos reales:** no solo "funcionó de forma estable" — requiere intentos deliberados de romper cada defensa (prompt injection real en el sandbox, confirmar que agentes de solo lectura de verdad no pueden escribir) sin éxito.

---

## 10. Orden de construcción por fases

1. **Fundación** — sandbox de pruebas + función básica de Vercel (recibe/verifica/responde, sin IA).
2. **Un solo agente, solo lectura** — Agente de Conocimiento vía Antigravity + MCP.
3. **Escritura controlada** — Cola de Ediciones + Agente de Escritura, confirmaciones funcionando.
4. **Hábitos** — Agente de Hábitos, acciones automáticas de bajo riesgo.
5. **Multiagente completo + fallback** — Orquestador clasificando intención, fallback a Groq, Bitácora de Acciones de punta a punta.
6. **Migración a datos reales** — solo tras red-teaming exitoso del sandbox.

**Estado actual: Fase 2, en progreso.** (Fase 1 cerrada el 12 de agosto: criterios de §15 verificados — webhook registrado, `getWebhookInfo` limpio, variables de entorno configuradas en Vercel.)

---
---

# Detalles tácticos de implementación

> Todo lo de aquí abajo es específico y no negociable al escribir código. Si algo no está cubierto aquí, preguntar antes de asumir.

## 11. Stack y convenciones técnicas

- **Runtime:** Node.js 20+ (por defecto en Vercel). No usar dependencias que requieran compilación nativa.
- **Sistema de módulos:** ESM (`import`/`export`), no CommonJS (`require`). El `package.json` declara `"type": "module"`.
- **Dependencias:** mínimas. Para Fase 1, cero dependencias externas — `fetch` es nativo en Node 20+, no hace falta `axios` ni `node-fetch`. Cada dependencia nueva se justifica ante Yamil antes de agregarse (cadena de suministro, ver sección 8).
- **Estructura de carpetas:**

```
orquestador-con-seguridad/
├── api/
│   └── telegram-webhook.js    ← endpoint (Vercel lo expone en /api/telegram-webhook)
├── lib/                        ← lógica reutilizable, sin acoplarse a Vercel
│   └── telegram.js             ← helpers de la API de Telegram (sendMessage, etc.)
├── scripts/
│   └── set-webhook.js          ← script de un solo uso para registrar el webhook
├── .env.example
├── ARQUITECTURA.md
├── CLAUDE.md
├── package.json
└── README.md
```

**Por qué `lib/` separado de `api/`:** la lógica en `lib/` no debe depender de objetos de Vercel (`req`/`res`) — así puede probarse y reutilizarse desde el canal de laptop, que no pasa por Vercel.

## 12. Variables de entorno (nombres exactos, no inventar variantes)

| Variable | Uso | Fase |
|---|---|---|
| `TELEGRAM_BOT_TOKEN` | Token del bot dado por BotFather | 1 |
| `TELEGRAM_ALLOWED_USER_ID` | ID numérico del único usuario autorizado | 1 |
| `TELEGRAM_WEBHOOK_SECRET` | Cadena aleatoria para validar `X-Telegram-Bot-Api-Secret-Token` | 1 |
| `NOTION_TOKEN` | Integración de Notion, scope mínimo | 2+ |
| `GITHUB_TOKEN` | PAT solo-lectura, repos específicos | 2+ |
| `GROQ_API_KEY` | Fallback del orquestador | 5 |

Todas se leen con `process.env.NOMBRE`. Si una variable requerida falta, la función debe fallar de forma explícita y clara — no continuar con un valor vacío que provoque un error confuso más adelante.

## 13. Contrato del webhook de Telegram

**Dos partes que se confunden fácil y son distintas:**

1. **Responder al webhook:** cuando Telegram entrega un mensaje, la función devuelve `200 OK`. Esto solo le confirma a Telegram que llegó — el usuario no ve nada.
2. **Mandar el mensaje al usuario:** requiere una llamada HTTP *separada* a `https://api.telegram.org/bot<TOKEN>/sendMessage`. Esto es lo que el usuario ve en su chat.

**Reglas del endpoint:**
- Solo acepta `POST`. Cualquier otro método → `405`.
- Verificación en este orden estricto, antes de cualquier otra lógica:
  1. Método es `POST` → si no, rechazar.
  2. Cabecera `X-Telegram-Bot-Api-Secret-Token` coincide con `TELEGRAM_WEBHOOK_SECRET` → si no, `401`.
  3. `body.message.from.id` coincide con `TELEGRAM_ALLOWED_USER_ID` → si no, responder `200 OK` a Telegram (para que no reintente) pero **no procesar nada ni responder al usuario**.
- **Siempre devolver `200 OK` a Telegram, incluso ante errores internos.** Un código de error hace que Telegram reintente el mismo mensaje varias veces, causando procesamiento duplicado.
- **Nunca exponer detalles internos** (stack traces, nombres de variables, rutas) en el texto que se manda al usuario ni en la respuesta HTTP.
- **Límite de tiempo:** las funciones serverless de Vercel en plan gratuito tienen un tope de ejecución de ~10 segundos. Si en fases posteriores una llamada a IA se acerca a ese límite, responder primero al usuario ("procesando…") y continuar en una segunda llamada — no dejar que la función expire silenciosamente.

## 14. Registro del webhook (paso manual, una sola vez por deploy)

Después de desplegar en Vercel, el webhook no funciona hasta registrarlo. Se hace con una llamada única a `setWebhook` de la API de Telegram, pasando: la URL del endpoint desplegado, el `secret_token`, y `allowed_updates` limitado solo a `message` (scope mínimo: no recibir tipos de evento que no se usan).

Vive en `scripts/set-webhook.js`, se ejecuta a mano, y lee el token desde variable de entorno — nunca hardcodeado, nunca commiteado con valores reales.

**Verificación:** `getWebhookInfo` de la API de Telegram muestra si el webhook quedó registrado correctamente y si hay errores de entrega pendientes.

## 15. Criterio de "terminado" para Fase 1

Fase 1 está completa cuando **todo** lo siguiente es cierto:

- [x] El endpoint responde `405` a métodos distintos de `POST`.
- [x] Rechaza con `401` si el `secret_token` no coincide.
- [x] Ignora silenciosamente (pero responde `200`) mensajes de un `from.id` no autorizado.
- [x] Ante un mensaje válido del usuario autorizado, responde en el chat de Telegram con un texto fijo (ej. "Recibido. Fase 1: sin IA todavía.").
- [x] No hay ningún secreto en el código ni en el historial de git.
- [x] `.env.example` documenta las tres variables de Fase 1, sin valores.
- [x] El webhook está registrado y `getWebhookInfo` no muestra errores pendientes.

Sin IA, sin MCP, sin acceso a Notion/Obsidian/GitHub en esta fase — cualquiera de esas cosas es Fase 2 o posterior.
