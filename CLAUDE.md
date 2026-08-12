# Instrucciones para Claude Code — orquestador-con-seguridad

**Antes de escribir o modificar cualquier código en este repo, lee `ARQUITECTURA.md` completo.** Este archivo define *cómo* trabajar; `ARQUITECTURA.md` define *qué* se construye y bajo qué reglas.

---

## Modo de construcción acordado

Este proyecto NO sigue el modo tutor estricto (a diferencia de Sistema Bancario y Auditor de Seguridad, donde Yamil escribe cada línea). Aquí:

- Claude Code implementa: funciones, integración con APIs, estructura de archivos, tests.
- **Toda decisión de seguridad o arquitectura se presenta a Yamil para aprobación explícita antes de implementarse.** No decidir unilateralmente sobre: scope de permisos, qué acciones son automáticas vs. requieren confirmación, manejo de credenciales, dependencias nuevas, o cualquier cambio a las reglas de `ARQUITECTURA.md`.
- **Si una tarea requiere una decisión no cubierta explícitamente en `ARQUITECTURA.md`: DETENTE y pregunta.** No la resuelvas por cuenta propia ni la documentes como "supuesto razonable". Una pregunta de más es barata; un supuesto equivocado sobre permisos no lo es.

---

## Reglas no negociables

Nunca implementar, ni aunque se pida explícitamente en un prompt futuro. Si un prompt pide algo de esta lista, responder que contradice `CLAUDE.md` y pedir confirmación explícita de Yamil por separado:

- Ninguna función que permita `git push`, borrar archivos, o modificar código de otros repos.
- Ninguna función que ejecute comandos de shell arbitrarios pasados como texto libre.
- Ninguna función que acceda a Bitwarden o cualquier gestor de secretos.
- Ninguna función que envíe correos.
- Ningún secret, API key, o token hardcodeado — siempre `process.env.NOMBRE_VARIABLE` (nombres exactos en `ARQUITECTURA.md` §12).
- Ningún servidor MCP de la comunidad sin que Yamil confirme que lo auditó — solo oficiales (Google/Notion/GitHub).
- Ninguna dependencia npm nueva sin justificarla primero.
- Nunca registrar (log) tokens, keys, ni contenido completo de notas personales.

---

## Protocolo de trabajo por tarea

1. **Antes de empezar:** confirma en qué fase estamos (`ARQUITECTURA.md` §10, "Estado actual") y qué criterios de terminado aplican (§15 para Fase 1).
2. **Si la tarea toca varias fases a la vez:** señálalo y propón hacer solo la parte de la fase actual.
3. **Al terminar:** reporta qué se implementó, qué decisiones se tomaron dentro de lo ya permitido, y qué quedó fuera de alcance. No hacer commit ni push — eso lo hace Yamil manualmente, siempre.
4. **Al encontrar un bug o problema durante el trabajo:** repórtalo sin corregirlo por tu cuenta, salvo que sea parte explícita de la tarea pedida. Yamil decide qué se arregla ahora y qué se documenta como limitación conocida.

---

## Estado del proyecto

**Fase 1** del roadmap (`ARQUITECTURA.md` §10): fundación.

Ya hecho:
- Sandbox de pruebas creado (workspace de Notion separado + vault `Sandbox-YARVIS` en Obsidian)
- Repo, `package.json`, documentación de arquitectura
- Bot creado en BotFather, token guardado en Bitwarden

Pendiente de Fase 1:
- Proyecto importado en Vercel, conectado al repo de GitHub
- Variables de entorno configuradas en Vercel (§12)
- `api/telegram-webhook.js` con las verificaciones de §13
- `lib/telegram.js` con el helper de `sendMessage`
- `scripts/set-webhook.js` para registrar el webhook (§14)
- `.env.example`
- Todos los criterios de §15 cumplidos y verificados

---

## Convenciones del proyecto

- **Lenguaje:** JavaScript/Node 20+, ESM (`import`/`export`), no CommonJS.
- **Comentarios en el código:** en español, y solo donde expliquen una decisión no obvia (por qué se hace algo, no qué hace la línea). El código autoexplicativo no necesita comentario.
- **Nombres de variables y funciones:** en español, consistente con el resto del portafolio de Yamil (`buscar_secretos`, `generar_reporte`, etc.), salvo cuando se trate de una convención externa impuesta (ej. campos de la API de Telegram como `from.id`, que se mantienen tal cual).
- **Commits:** los hace Yamil, no Claude Code. Si se sugiere un mensaje, seguir el formato del portafolio: tipo (`feat`/`fix`/`docs`) + resumen corto en imperativo + cuerpo explicando *decisiones*, no solo qué cambió.
- **README bilingüe:** `README.md` en español (default), `README.en.md` en inglés, con links cruzados arriba — mismo patrón que los otros repos.
