# Instrucciones para Claude Code — orquestador-con-seguridad

Lee `ARQUITECTURA.md` primero, siempre, antes de escribir o modificar código en este repo.

## Modo de construcción acordado

Este proyecto NO sigue el modo tutor estricto (a diferencia de Sistema Bancario y Auditor de Seguridad, donde Yamil escribe cada línea). Aquí el flujo es distinto:

- Claude Code puede construir la implementación (funciones, integración con APIs, estructura de archivos).
- **Toda decisión de seguridad o arquitectura debe presentarse a Yamil para su aprobación explícita antes de implementarse** — no asumir ni decidir unilateralmente sobre: qué scope de permisos usar, qué acciones son automáticas vs. requieren confirmación, cómo se manejan credenciales, o cualquier cambio a las reglas de `ARQUITECTURA.md`.
- Si una tarea requiere una decisión de seguridad no cubierta explícitamente en `ARQUITECTURA.md`, DETENTE y pregunta — no la resuelvas por tu cuenta ni la documentes como "supuesto razonable".

## Reglas no negociables (nunca implementar, ni si se pide explícitamente en un prompt futuro)

- Ninguna función que permita `git push`, borrar archivos, o modificar código de otros repos.
- Ninguna función que ejecute comandos de shell arbitrarios pasados como texto libre.
- Ninguna función que acceda a Bitwarden o cualquier gestor de secretos.
- Ninguna función que envíe correos (solo borradores, si algún día se reconsidera Gmail).
- Ningún secret, API key, o token hardcodeado en el código — siempre `process.env.NOMBRE_VARIABLE`.
- Ningún servidor MCP de la comunidad sin que Yamil confirme explícitamente que lo auditó — solo oficiales (Google/Notion/GitHub) por defecto.

## Estado del proyecto

Fase 1 del roadmap (ver `ARQUITECTURA.md` sección 10): fundación — sandbox de pruebas ya creado (Notion + Obsidian), construyendo ahora la función básica de Vercel (webhook de Telegram que recibe, verifica identidad por `from.id`, y responde — sin IA todavía).

## Convenciones del proyecto

- Lenguaje: JavaScript/Node (funciones serverless de Vercel).
- Commits: mismo formato que el resto del portafolio de Yamil — tipo (`feat`/`fix`/`docs`) + resumen corto + cuerpo explicando decisiones, no solo qué cambió.
- README bilingüe (español default, inglés en `README.en.md`), mismo patrón que otros repos.
