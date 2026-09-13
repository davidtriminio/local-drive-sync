# Implementación v1 — qué se construyó

> Aplicación funcional completa (dominio + persistencia + IPC + UI).
> Estado: **compila y arranca; pendiente de validación funcional real por el usuario.**
> Fecha: 2026-09-13

---

## 1. Resumen

Se implementó la app completa de punta a punta, sobre el andamiaje previo. El flujo
**Dashboard → Sincronizar → Analizar diferencias → Vista previa → Ejecutar → Historial**
está cableado y compilando (`tsc` del main + `ng build` del renderer, ambos en verde).

> ⚠️ **Verificación:** se verificó que **compila** y que el **normalizador de mes**
> funciona (pruebas de humor abajo). **No** se ejecutó aún la copia real de archivos
> contra un Google Drive montado — esa validación funcional la hace el usuario.

---

## 2. Decisión importante de persistencia

La arquitectura definía **SQLite (better-sqlite3)**. En el entorno de desarrollo actual
los *install scripts* nativos están bloqueados y no se puede compilar el módulo nativo.

**Solución adoptada:** se implementó la persistencia detrás de una clase `Repository`
con un **almacén JSON** (`local-drive-sync.json` en `userData`). Expone exactamente la
API que el resto del dominio necesita, de modo que **sustituir JSON por SQLite más
adelante no requiere tocar ningún otro archivo** — solo reimplementar `Repository`.

Para los volúmenes de este caso de uso (carpetas de arte por mes) el almacén JSON es
perfectamente suficiente; SQLite se justificará si el índice crece mucho.

---

## 3. Capa de dominio (proceso main, TypeScript puro)

| Módulo | Archivo | Función |
|---|---|---|
| MonthNormalizer | `src/main/domain/month-normalizer.ts` | Nombre de carpeta ↔ clave `AAAA-MM` (nombres en español, números, variantes). |
| ExclusionFilter | `src/main/domain/exclusion-filter.ts` | Glob simple (`*`, `?`) para excluir. |
| Scanner | `src/main/domain/scanner.ts` | Recorre un lado devolviendo solo metadatos (no materializa placeholders de Drive). |
| Comparator | `src/main/domain/comparator.ts` | Estado por archivo (`NEW/MODIFIED/EQUAL/ONLY_DRIVE`) + conflicto vía índice. |
| SyncPlanner | `src/main/domain/sync-planner.ts` | Selección → plan de acciones (mkdir/copy/update). |
| CopyEngine | `src/main/domain/copy-engine.ts` | Ejecuta el plan: concurrencia limitada, reintentos ante bloqueo, progreso, cancelación. |
| TrashService | `src/main/domain/trash-service.ts` | Respaldo a papelera antes de sobrescribir; restauración. |
| SyncService | `src/main/services/sync-service.ts` | Orquesta: resuelve rutas (token `{mes}`), escanea, compara, planifica, ejecuta, actualiza índice e historial. |

### Reglas implementadas (según especificación)
- **Unidireccional Local → Drive.** `ONLY_DRIVE` solo se informa; nunca se borra.
- **Comparación** por tamaño + fecha (tolerancia 2 s). Hash no automático (modo Stream).
- **Conflicto** = cambió en ambos lados respecto al índice previo (se marca).
- **Local gana** por defecto; por archivo se puede elegir *Conservar Drive* u *Omitir*.
- **Respaldo** a papelera (`userData/trash/<runId>/...`) antes de cada sobrescritura.
- **Resolución de mes:** si el nombre exacto no existe, busca un hermano cuyo nombre
  normalice al mismo mes; al crear, usa el formato preferido.

---

## 4. IPC (seguro)

- `src/shared/ipc-contract.ts`: canales + tipos (fuente única de verdad).
- `src/main/ipc/index.ts`: handlers validados; emite eventos `sync:progress` / `sync:done`;
  mantiene `AbortController` por ejecución para cancelar.
- `src/preload/preload.ts`: expone `window.api` (tipado `Api`) vía `contextBridge`.
- Renderer: `IpcService` envuelve `window.api`.

Canales: folder picker, CRUD de mapeos, settings, `scan:diff`, `sync:preview`,
`sync:execute` (+progreso/done), `sync:cancel`, historial, papelera.

---

## 5. UI (Angular 20 standalone + Tailwind, hash routing)

| Ruta | Componente | Contenido |
|---|---|---|
| `/` | Dashboard | Lista de mapeos; crear/editar/eliminar/sincronizar. |
| `/mapping/new`, `/mapping/:id` | MappingEditor | Form con selector de carpeta y auto-detección del token `{mes}`. |
| `/sync/:id` | SyncWizard | Mes → diff (checkbox + estados por color + decisión por archivo) → preview → ejecución con barra de progreso → resumen. |
| `/history` | History | Ejecuciones con conteos; detalle expandible por archivo. |
| `/trash` | Trash | Respaldos; restaurar a Drive. |
| `/settings` | Settings | Exclusiones globales, formato de mes, concurrencia. |

El shell (`app.component.ts`) es una barra lateral + `router-outlet`.
Tras ejecutar, la UI muestra el aviso honesto: *"Google Drive terminará de subir en segundo plano."*

---

## 6. Estado de verificación

| Paso | Resultado |
|---|---|
| `tsc` main (dominio + IPC) | ✅ sin errores |
| `ng build` renderer (toda la UI) | ✅ bundle generado, lazy por ruta |
| Pruebas de humo del MonthNormalizer | ✅ (nombres/números/variantes → AAAA-MM) |
| Ejecución real de copia contra Drive | ⏳ pendiente (validación del usuario) |
| Lanzamiento GUI | ⏳ pendiente (`npm run dev`) |

---

## 7. Cómo probar

```bash
npm run dev        # ng serve + Electron con recarga
```
1. Crear un mapeo (botón *Elegir…* detecta el mes y lo reemplaza por `{mes}`).
2. *Sincronizar* → elegir mes → *Analizar diferencias*.
3. Marcar archivos → *Vista previa* → *Ejecutar*.
4. Revisar *Historial* y *Papelera*.

---

## 8. Pendiente / siguientes pasos

- Validación funcional real contra la unidad de Google Drive (modo Stream).
- Migrar `Repository` a SQLite (better-sqlite3 + electron-rebuild) si se desea.
- Pruebas automatizadas del dominio (normalizador, comparador, planner).
- Icono de bandeja / segundo plano y empaquetado final del instalador (`npm run dist`).
- Pulido de UI y estados de error (carpeta no montada, permisos).
