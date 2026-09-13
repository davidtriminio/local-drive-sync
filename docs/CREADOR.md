# Creador de proyectos gráficos

Sección **Proyectos** de la app. Genera la estructura de carpetas de un proyecto
de diseño para un cliente y copia las plantillas base (PSD/AI). Sustituye a la
app Python anterior (`functionalApp`), migrando su lógica a la arquitectura
Electron + Angular.

## Flujo del usuario

1. Abrir **Proyectos** en la barra lateral.
2. Elegir la **carpeta base** (se recuerda en el equipo).
3. Escribir/elegir **cliente** (autocompletado desde clientes previos) y
   **proyecto**.
4. Marcar **plataformas** (cada una aporta su PSD base), **PSD/AI** y las
   **subcarpetas** deseadas.
5. **Crear proyecto**.

Se crea la carpeta `cliente_proyecto_AAAA-MM-DD` con su árbol y las plantillas.
El cliente queda registrado para la próxima vez.

## Reglas

- **Carpeta base con `{mes}`**: la ruta admite el token `{mes}`, que se
  resuelve al mes actual en formato `Mes-Año` (p. ej. `Septiembre-2026`) al
  crear. Así rota sola cada mes sin editarla. La ruta se guarda al instante al
  editarla (persistencia inmediata, no solo al crear).
- **Icono y color heredados del mapeo**: cada cliente/mapeo tiene icono y
  color. El **mapeo es la fuente**: si existe un mapeo con el mismo nombre que
  el cliente, el creador hereda su icono+color (el selector del cliente se
  oculta y se muestra el aviso «heredado del mapeo»). Sin mapeo, el cliente usa
  el suyo, editable desde el creador.
- **Nombres**: se sanean a minúsculas con guiones bajos (`sanitizeName`).
- **Sin versionado `vNN`**: el nombre no lleva sufijo de versión.
- **Aviso de duplicado**: si el mismo cliente + proyecto ya tiene una carpeta en
  el **mismo mes**, se pide confirmación antes de crear.
- **Nunca sobrescribe**: si la carpeta exacta del día ya existe, se añade un
  sufijo `_2`, `_3`… como respaldo.
- **Plantilla faltante**: se registra en `creation_log.txt` y la creación sigue.

## Estructura de carpetas

```
01_brief · 02_references
03_resources/{fonts,images,icons}
04_workfiles/{psd,ai,figma}
05_exports/{print,web} (+ EXPORT_RULES.txt)
06_archive
creation_log.txt
```

## Arquitectura

| Capa | Archivo |
|------|---------|
| Contrato IPC | `src/shared/ipc-contract.ts` (`clients:list`, `platforms:list`, `project:create`) |
| Dominio | `src/main/domain/project-creator.ts`, `src/main/domain/legacy-import.ts` |
| Persistencia | `src/main/persistence/repository.ts` (`clients`) |
| Rutas de assets | `src/main/resources.ts` |
| Handlers | `src/main/ipc/index.ts` |
| Puente | `src/preload/preload.ts`, `src/renderer/app/services/ipc.service.ts` |
| UI | `src/renderer/app/pages/project-creator.component.ts` |

## Plantillas y catálogo

Viven en `resources/creator/` (`platforms.json`, `base-instagram.psd`,
`base-facebook.psd`, `base.ai`). En desarrollo se leen del repo; empaquetado,
electron-builder los copia a `<resources>/creator` vía `extraResources`.

El PSD de cada plataforma se resuelve como `base-<plataforma>.psd` (p. ej.
`base-instagram.psd`). Para añadir una plataforma: añádela a `platforms.json` y
coloca su `base-<nombre>.psd` en `resources/creator/`.

## Clientes heredados

Al primer arranque, si no hay clientes, se importan una sola vez desde el
historial del proyecto Python (`V:/graphic_design/tools/functionalApp/history`,
constante `LEGACY_HISTORY_DIR` en `src/main/ipc/index.ts`) y se fusionan por
nombre. El contador de *posts* del proyecto anterior se descarta.

## Por qué no se reusó el instalador anterior

La app Python guardaba `config.json` e historial con rutas **relativas al
ejecutable**; instalada en `Program Files` (solo lectura), esas escrituras
fallaban. Aquí los datos van a `app.getPath('userData')` y las plantillas a
`resources`, por lo que el instalador NSIS existente funciona sin ese fallo.
