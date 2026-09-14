# local-drive-sync

Aplicación de escritorio (Windows) para copiar de forma selectiva arte final desde carpetas
locales del PC hacia Google Drive (montado con **Google Drive para Escritorio**), mostrando las
diferencias antes de actuar.

- **Modelo:** copia unidireccional **Local → Drive** (Drive nunca escribe sobre Local; lo que solo
  existe en Drive se informa, nunca se borra).
- **Stack:** Electron + Angular 20 (standalone) + Tailwind v4 + TypeScript + SQLite.
- **Estado:** andamiaje funcional (arranca ventana). Ver [`docs/ESTRUCTURA.md`](docs/ESTRUCTURA.md).

## Ejecutar

```bash
npm install
npm run dev     # desarrollo (ng serve + Electron con recarga)
npm start       # build + Electron
npm run dist    # instalador .exe (NSIS) en release/
```

> En entornos que bloquean install scripts, tras `npm install` ejecuta una vez
> `node node_modules/electron/install.js`. Ver nota de módulos nativos en `docs/ESTRUCTURA.md`.

## Documentación

- [Especificación de requisitos y reglas de sincronización](docs/ESPECIFICACION.md)
- [Arquitectura técnica](docs/ARQUITECTURA.md)
- [Estructura del proyecto y andamiaje](docs/ESTRUCTURA.md)
- [Implementación v1 (qué se construyó)](docs/IMPLEMENTACION.md)
- [Creador de proyectos gráficos](docs/CREADOR.md)
- [Eventos y feriados (creación en lote)](docs/EVENTOS.md)
- [Notificaciones de sincronización](docs/NOTIFICACIONES.md)
- [Eliminación sincronizada](docs/ELIMINACION.md)

## Roadmap

Requisitos ✅ → Arquitectura ✅ → Andamiaje ✅ → Implementación v1 ✅ → Validación funcional → Pruebas → Distribución.
