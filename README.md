# Local Drive Sync

[![CI](https://github.com/davidtriminio/local-drive-sync/actions/workflows/ci.yml/badge.svg)](https://github.com/davidtriminio/local-drive-sync/actions/workflows/ci.yml)
[![Licencia: MIT](https://img.shields.io/badge/licencia-MIT-green.svg)](LICENSE)

Aplicación de escritorio para **Windows** que copia de forma selectiva el arte final desde carpetas
locales del PC hacia **Google Drive** (montado con *Google Drive para Escritorio*), mostrando las
diferencias **antes** de actuar.

Sin API de Google, sin OAuth y sin cuotas: toda operación es una copia local → local.

## Características

- **Copia unidireccional Local → Drive.** Drive nunca escribe sobre Local; lo que solo existe en
  Drive se informa, jamás se borra.
- **Vista previa de diferencias** (nuevo / modificado / igual / solo en Drive) y selección
  archivo por archivo antes de ejecutar.
- **Mapeos con token `{mes}`** que rotan automáticamente cada mes, tolerantes a variaciones
  del nombre de la carpeta (`Septiembre`, `09`, `Sep-2026`…).
- **Respaldo a papelera** antes de sobrescribir y restauración desde la app.
- **Clientes y notificaciones** de sincronización.
- **Creador de proyectos gráficos** desde plantillas PSD, con eventos y feriados en lote.
- **Bandeja del sistema y vigilancia de exportaciones.**
- Historial de ejecuciones.

## Stack

Electron · Angular 20 (standalone) · Tailwind CSS v4 · TypeScript.
Persistencia en un almacén JSON detrás de una clase `Repository` (preparada para migrar a SQLite).

## Requisitos

- Windows 10/11
- Node.js 20 o superior
- [Google Drive para Escritorio](https://www.google.com/drive/download/) con una unidad montada

## Empezar

```bash
git clone https://github.com/davidtriminio/local-drive-sync.git
cd local-drive-sync
npm install
npm run dev      # desarrollo (ng serve + Electron con recarga)
```

| Comando | Qué hace |
|---|---|
| `npm run dev` | Desarrollo con recarga |
| `npm start` | Compila y abre Electron |
| `npm run build` | Compila main, preload y renderer |
| `npm run dist` | Genera el instalador `.exe` (NSIS) en `release/` |

> Si tu entorno bloquea los *install scripts*, tras `npm install` ejecuta una vez
> `node node_modules/electron/install.js`.

## Documentación

- [Especificación y reglas de sincronización](docs/ESPECIFICACION.md)
- [Arquitectura técnica](docs/ARQUITECTURA.md)
- [Estructura del proyecto](docs/ESTRUCTURA.md)
- [Implementación v1](docs/IMPLEMENTACION.md)
- [Creador de proyectos gráficos](docs/CREADOR.md)
- [Eventos y feriados](docs/EVENTOS.md)
- [Notificaciones](docs/NOTIFICACIONES.md)
- [Eliminación sincronizada](docs/ELIMINACION.md)

## Estado

Proyecto en desarrollo activo, pensado para uso de un solo usuario. Úsalo con copias de seguridad
de tus archivos importantes. Consulta los [issues](https://github.com/davidtriminio/local-drive-sync/issues)
para ver lo que viene.

## Contribuir

Las contribuciones son bienvenidas. Lee [CONTRIBUTING.md](CONTRIBUTING.md) y el
[Código de conducta](CODE_OF_CONDUCT.md).

## Licencia

[MIT](LICENSE) © 2026 David Triminio
