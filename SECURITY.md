# Política de seguridad

## Reportar una vulnerabilidad

Por favor **no abras un issue público** para vulnerabilidades. Usa el reporte privado de GitHub:
pestaña **Security → Report a vulnerability** de este repositorio.

Incluye pasos para reproducir el problema y su impacto. Responderemos lo antes posible.

## Alcance

La app opera solo sobre archivos locales y una unidad de Drive montada; no usa credenciales de
Google ni envía datos a servidores propios. Son de especial interés los problemas de manejo de
rutas (path traversal), ejecución de comandos y exposición de archivos fuera de las carpetas mapeadas.
