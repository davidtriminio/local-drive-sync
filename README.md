# local-drive-sync

Aplicación de escritorio (Windows) para copiar de forma selectiva arte final desde carpetas
locales del PC hacia Google Drive (montado con **Google Drive para Escritorio**), mostrando las
diferencias antes de actuar.

- **Modelo:** copia unidireccional **Local → Drive** (Drive nunca escribe sobre Local; lo que solo
  existe en Drive se informa, nunca se borra).
- **Stack:** Electron + Angular + SQLite.
- **Estado:** fase de definición. Ver [`docs/ESPECIFICACION.md`](docs/ESPECIFICACION.md).

## Documentación

- [Especificación de requisitos y reglas de sincronización](docs/ESPECIFICACION.md)

## Roadmap de definición

Requisitos ✅ → Arquitectura → Estructura del proyecto → Diseño de UI → Implementación → Pruebas → Distribución.
