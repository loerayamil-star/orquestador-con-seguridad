# Arquitectura — Orquestador con Seguridad (YARVIS)

Asistente personal orquestador multiagente. Conecta Obsidian, Notion y GitHub, con un diseño de seguridad por capas definido *antes* de escribir código, no añadido después.

**Roadmap del proyecto:** este orquestador se construye después del proyecto "Auditor de Seguridad + API" (Flask/FastAPI). El bot de Telegram se integra *dentro* de este mismo sistema como una de sus interfaces — no es un proyecto separado.

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

**Descartado del alcance:** Gmail (redundante con Gemini nativo), Google Docs/Sheets/Drive como agentes propios (mismo motivo — Gemini ya lo cubre).

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

**Prohibido de raíz — no es "pide confirmación", la función NO EXISTE en el código, nunca se desbloquea ni en modo elevado temporal:**
- `git push`, borrar archivos, modificar código de repos
- Ejecutar comandos de shell arbitrarios
- Modificar configuración del sistema
- Acceder a Bitwarden o cualquier gestor de secretos
- Enviar correos (si algún día se reconsidera Gmail: solo crear borradores, nunca enviar)

**Prueba para clasificar una acción nueva:** ¿deshacer el error cuesta segundos, o cuesta tiempo/confianza real? Lo primero es automático, lo segundo pide confirmación.

**Permisos ajustables por sesión (inspirado en modos de Claude Code):** el usuario puede elevar temporalmente un permiso para una tarea específica (ej. "para esto, permite que el agente escriba, preguntando antes de cada acción"). Las acciones prohibidas de raíz NUNCA se desbloquean, ni temporalmente.

---

## 4. Integridad de datos: Cola de Ediciones para Obsidian

**Problema:** el vault de Obsidian existe en dos copias (laptop local + Drive, para que Telegram pueda leerlo). Editar directo desde ambos lados puede causar pérdida silenciosa de datos (sincronización tipo espejo, sin fusión inteligente como git).

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

**Telegram:** cada mensaje incluye `from.id`. La función de Vercel compara contra el ID de Telegram del usuario (variable de entorno) ANTES de llamar al orquestador — si no coincide, se descarta sin gastar ninguna llamada a MCP/IA. (Filtrar por IP no funciona: los mensajes de Telegram siempre llegan desde los servidores de Telegram, no desde el dispositivo del remitente.)

**Permisos asimétricos por canal, a propósito:**
- **Laptop:** todo el catálogo de lectura + escritura controlada, lectura profunda de Obsidian.
- **Telegram:** solo lectura + automáticos de bajo impacto. Nada de exploración libre de vaults completos — solo consultas puntuales y acotadas. Confirmaciones más estrictas que en laptop.

**Riesgos residuales aceptados (documentados, no "resueltos" — límite honesto de lo que el software puede controlar):**
- Teléfono desbloqueado en manos de otra persona: mitigado por bloqueo biométrico del dispositivo + la Cola de Ediciones (revisión manual antes de aplicar cualquier escritura).
- Laptop desbloqueada en manos de otra persona: riesgo bajo por default (se queda en casa); revisitar si cambia el contexto de uso.

---

## 6. Auditoría — Bitácora de Acciones

Base de Notion separada de los datos reales, dedicada a registro de sistema: fecha/hora, canal, acción ejecutada, automática o con confirmación, resultado.

**Registra TAMBIÉN los intentos rechazados**, no solo los exitosos — es la señal más importante de seguridad (alguien que no es el usuario intentando usar el bot, o el agente intentando algo fuera del catálogo permitido).

---

## 7. Resiliencia operacional

- **Preview Deployments (Vercel):** push a rama nueva → URL de preview separada, se prueba ahí con datos del sandbox. Solo merge a `main` vía Pull Request dispara deploy a producción.
- **Alertas activas:** si el orquestador primario Y el fallback fallan a la vez, se manda una notificación de Telegram al usuario (mismo bot, dirección inversa) — no depender de que alguien revise la Bitácora activamente.
- **Límite de iteraciones:** contador de profundidad máxima entre llamadas de agentes (ej. 8) para evitar bucles que vacíen la cuota gratuita sin que nada "falle" técnicamente. Al alcanzar el límite, se registra como error y dispara la misma alerta de fallo.
- **Rotación de credenciales:** si un token se filtra — revocar en la plataforma emisora, generar uno nuevo con el mismo scope mínimo, actualizar la variable de entorno en Vercel (nunca toca el código ni requiere commit).

---

## 8. Gestión de secretos

Ninguna API key hardcodeada. Viven en Environment Variables de Vercel (dashboard del proyecto), cifradas, separadas del repo. El código las lee vía `process.env.NOMBRE_VARIABLE`. Mismo patrón que `env.example` en otros proyectos: el archivo de ejemplo muestra la forma, el valor real vive fuera del código versionado.

**Origen de servidores MCP:** conectar ÚNICAMENTE servidores MCP oficiales y verificados (Google/Notion/GitHub directamente) — nunca uno de la comunidad sin auditar. Mismo tipo de riesgo que un paquete de npm comprometido (ver caso PhantomRaven), aplicado a la cadena de suministro del propio proyecto.

---

## 9. Entorno de pruebas antes de datos reales

**Aislamiento total, no solo scope limitado dentro del workspace real** — un error durante pruebas no debe tener ninguna posibilidad de tocar datos reales.

- Notion: workspace/páginas de prueba separadas, con datos de mentira.
- Obsidian: vault separado `Sandbox-YARVIS`, con notas de prueba enlazadas entre sí.
- GitHub: token de scope mínimo apuntando a un repo de práctica, no a repos reales.

**Criterio de graduación a datos reales:** no solo "funcionó de forma estable" — requiere intentos deliberados de romper cada defensa (prompt injection real en el sandbox, confirmar que agentes de solo lectura de verdad no pueden escribir) sin éxito. Mismo espíritu que un ejercicio de red-teaming.

---

## 10. Orden de construcción por fases

1. **Fundación** — sandbox de pruebas + función básica de Vercel (recibe/verifica/responde, sin IA).
2. **Un solo agente, solo lectura** — Agente de Conocimiento vía Antigravity + MCP.
3. **Escritura controlada** — Cola de Ediciones + Agente de Escritura, confirmaciones funcionando.
4. **Hábitos** — Agente de Hábitos, acciones automáticas de bajo riesgo.
5. **Multiagente completo + fallback** — Orquestador clasificando intención, fallback a Groq, Bitácora de Acciones de punta a punta.
6. **Migración a datos reales** — solo tras red-teaming exitoso del sandbox.

**Estado actual: Fase 1, en progreso.**
