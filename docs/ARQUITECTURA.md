# Arquitectura — local-drive-sync

> Diseño técnico derivado de [`ESPECIFICACION.md`](ESPECIFICACION.md).
> Estado: **borrador v1** · Fecha: 2026-09-12 · Stack: Electron + Angular + SQLite

---

## 1. Principios de diseño

1. **Seguridad del usuario primero:** nada destructivo sin vista previa y confirmación; respaldo a Papelera antes de sobrescribir.
2. **Separación estricta UI / dominio:** Angular (renderer) nunca toca el disco directamente; todo el acceso a filesystem y datos vive en el proceso *main* (Node).
3. **El dominio es agnóstico de Electron:** los módulos de negocio (escáner, comparador, motor de copia…) son clases/funciones de TypeScript puro, testeables sin Electron.
4. **Incremental por defecto:** el índice SQLite evita reescaneos completos; comparación rápida `tamaño+fecha`, hash solo bajo demanda.
5. **Operaciones cancelables y observables:** toda tarea larga reporta progreso y puede abortarse.

---

## 2. Procesos de Electron y aislamiento

```mermaid
flowchart LR
    subgraph Renderer["Renderer — Angular (sandbox, sin Node)"]
        UI[Componentes UI\nWizard / Dashboard / Historial]
        AppSvc[Servicios Angular\nque llaman a window.api.*]
    end

    subgraph Preload["Preload (contextBridge)"]
        Bridge[window.api\nAPI tipada y acotada]
    end

    subgraph Main["Main — Node.js (confianza)"]
        IPC[Capa IPC\nhandlers ipcMain]
        Domain[Módulos de dominio]
        DB[(SQLite)]
        FS[[Filesystem\nLocal + unidad Drive]]
    end

    UI --> AppSvc --> Bridge
    Bridge <-->|IPC invoke/handle + events| IPC
    IPC --> Domain
    Domain --> DB
    Domain --> FS
```

**Reglas de seguridad del renderer (no negociables):**

- `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`.
- El renderer **no** tiene acceso a `fs`, `path`, ni `require`. Solo ve `window.api`, una superficie mínima y tipada expuesta por el *preload* con `contextBridge`.
- Cada canal IPC valida sus argumentos en el *main* (nunca confiar en el renderer).

---

## 3. Comunicación IPC (contrato)

Dos estilos:

- **Petición/respuesta** (`ipcRenderer.invoke` → `ipcMain.handle`): operaciones con resultado.
- **Eventos** (`webContents.send` → `ipcRenderer.on`): progreso en vivo y notificaciones.

| Canal | Tipo | Entrada → Salida |
|---|---|---|
| `mappings:list` | invoke | `()` → `Mapping[]` |
| `mappings:save` | invoke | `MappingDraft` → `Mapping` |
| `mappings:delete` | invoke | `{ id }` → `void` |
| `scan:diff` | invoke | `{ mappingId, monthKey }` → `DiffResult` |
| `hash:verify` | invoke | `{ files[] }` → `HashResult[]` (avisa descarga en Stream) |
| `sync:preview` | invoke | `{ selection }` → `SyncPlan` |
| `sync:execute` | invoke | `{ planId }` → `RunId` |
| `sync:progress` | event | `{ runId, done, total, current, phase }` |
| `sync:done` | event | `{ runId, summary }` |
| `history:list` | invoke | `{ limit, offset }` → `RunSummary[]` |
| `history:detail` | invoke | `{ runId }` → `RunDetail` |
| `trash:list` | invoke | `()` → `TrashEntry[]` |
| `trash:restore` | invoke | `{ trashId }` → `void` |
| `settings:get` / `settings:set` | invoke | config (exclusiones, formato de mes…) |

Todas las operaciones largas devuelven un `runId`/`taskId` y emiten eventos de progreso; el *main* mantiene un `AbortController` por tarea para cancelación.

---

## 4. Módulos de dominio (main)

```mermaid
flowchart TB
    MappingMgr[MappingManager\nCRUD de mapeos + plantillas]
    MonthNorm[MonthNormalizer\nnombre de carpeta → AAAA-MM]
    Scanner[Scanner\nrecorre Local y Drive]
    Excluder[ExclusionFilter\npatrones glob]
    Comparator[Comparator\nestado por archivo + índice]
    Planner[SyncPlanner\nselección → plan de acciones]
    CopyEngine[CopyEngine\ncopia + reintentos + progreso]
    Trash[TrashService\nrespaldo antes de sobrescribir]
    History[HistoryService\nregistro de ejecuciones]
    Repo[(RepositoryLayer\nacceso SQLite)]

    MappingMgr --> Repo
    Scanner --> Excluder
    Scanner --> MonthNorm
    Comparator --> Repo
    Scanner --> Comparator --> Planner --> CopyEngine
    CopyEngine --> Trash
    CopyEngine --> History --> Repo
    Trash --> Repo
```

**Responsabilidades:**

- **MappingManager:** guarda/valida mapeos (`raízLocal`, `raízDrive`, plantilla con `{cliente}`/`{mes}`, formato de mes preferido `Mes-Año`, opciones como "crear carpeta faltante").
- **MonthNormalizer:** parsea nombres de carpeta en español (nombre o número de mes + año, varios separadores) a clave canónica `AAAA-MM`; expone mapeos manuales recordados para nombres no reconocidos.
- **Scanner:** recorre recursivamente un lado (Local o Drive), aplicando exclusiones; produce metadatos **sin hash** (ruta relativa, tamaño, `mtime`). En la unidad Drive lee solo metadatos (no materializa placeholders).
- **ExclusionFilter:** aplica patrones glob configurables.
- **Comparator:** combina el escaneo de ambos lados + el índice previo para asignar estado (`NUEVO`/`MODIFICADO`/`IGUAL`/`SOLO_EN_DRIVE`) y detectar conflictos.
- **SyncPlanner:** toma la selección del usuario y produce un `SyncPlan` inmutable (lista ordenada de acciones: crear carpeta, copiar, actualizar-con-respaldo). Es lo que se muestra en la vista previa.
- **CopyEngine:** ejecuta el plan con concurrencia limitada, reintentos ante "archivo en uso/bloqueado por Drive", progreso y cancelación.
- **TrashService:** antes de sobrescribir, mueve la versión previa a `%APPDATA%\local-drive-sync\trash\<runId>\...` y registra la entrada.
- **HistoryService:** persiste cada ejecución y su detalle por archivo.

---

## 5. Esquema de datos (SQLite)

```mermaid
erDiagram
    mappings ||--o{ file_index : indexa
    mappings ||--o{ runs : origina
    runs ||--o{ run_items : contiene
    runs ||--o{ trash_entries : genera

    mappings {
        TEXT id PK
        TEXT name
        TEXT local_root
        TEXT drive_root
        TEXT template
        TEXT month_format
        INTEGER create_missing
        TEXT created_at
    }
    file_index {
        TEXT id PK
        TEXT mapping_id FK
        TEXT month_key
        TEXT rel_path
        INTEGER size
        INTEGER mtime
        TEXT md5
        TEXT last_synced_at
    }
    runs {
        TEXT id PK
        TEXT mapping_id FK
        TEXT month_key
        TEXT started_at
        TEXT finished_at
        TEXT status
        INTEGER n_copied
        INTEGER n_updated
        INTEGER n_created_dirs
        INTEGER n_conflicts
        INTEGER n_errors
    }
    run_items {
        TEXT id PK
        TEXT run_id FK
        TEXT rel_path
        TEXT action
        TEXT result
        TEXT error_msg
    }
    trash_entries {
        TEXT id PK
        TEXT run_id FK
        TEXT original_drive_path
        TEXT backup_path
        INTEGER size
        TEXT created_at
    }
    settings {
        TEXT key PK
        TEXT value
    }
```

Notas:
- `file_index` es el **estado incremental**: guarda lo conocido de la última sincronización (incluido `md5` solo si el usuario verificó por hash). Acelera `scan:diff`.
- `month_key` siempre en canónico `AAAA-MM`; el nombre "bonito" se reconstruye con `month_format`.
- Fechas como texto ISO-8601 UTC. Booleanos como `INTEGER 0/1`.
- Acceso vía una **capa repositorio** con sentencias preparadas (driver `better-sqlite3`, síncrono y rápido en el main).

---

## 6. Flujo de una sincronización (extremo a extremo)

```mermaid
sequenceDiagram
    participant U as Usuario (Angular)
    participant M as Main (dominio)
    participant DB as SQLite
    participant FS as Filesystem

    U->>M: scan:diff(mappingId, monthKey)
    M->>FS: escanear Local (meta) + Drive (meta)
    M->>DB: leer file_index previo
    M-->>U: DiffResult (estados por archivo)
    U->>M: sync:preview(selección)
    M-->>U: SyncPlan (copiar/actualizar/crear, conflictos)
    Note over U: Usuario revisa y confirma
    U->>M: sync:execute(planId)
    loop por cada acción
        M->>FS: (si sobrescribe) mover previo a Papelera
        M->>FS: copiar archivo / crear carpeta
        M-->>U: sync:progress(done/total)
        M->>DB: actualizar file_index + run_items
    end
    M->>DB: cerrar run (summary)
    M-->>U: sync:done(summary + aviso subida Drive)
```

---

## 7. Manejo de errores y casos límite

- **Archivo bloqueado / en uso por Drive:** reintento con *backoff* (N intentos); si falla, se marca ese `run_item` como error y la ejecución continúa con el resto.
- **Placeholder de Drive (Stream):** el escaneo nunca fuerza descarga; `hash:verify` avisa del coste antes de materializar.
- **Unidad de Drive no montada / ruta inexistente:** validación previa en `scan:diff`; error claro, sin ejecutar.
- **Corte de energía / cierre durante copia:** `runs.status = 'interrupted'`; la Papelera permite restaurar; el siguiente `scan:diff` reconcilia contra el estado real del disco.
- **Cancelación:** `AbortController` detiene tras la acción en curso; lo ya copiado queda registrado.
- **"Drive terminará de subir":** la UI muestra este aviso al cerrar la ejecución (no afirmamos subida confirmada).

---

## 8. Estructura de carpetas propuesta del proyecto

```text
local-drive-sync/
├── docs/                      # Especificación, arquitectura, UI
├── src/
│   ├── main/                  # Proceso main (Node)
│   │   ├── domain/            # Módulos de dominio (TS puro, testeable)
│   │   ├── persistence/       # Repositorios + migraciones SQLite
│   │   ├── ipc/               # Handlers ipcMain (validación)
│   │   └── main.ts            # Bootstrap de Electron
│   ├── preload/               # contextBridge → window.api
│   └── renderer/              # App Angular (UI)
├── electron-builder.yml       # Config del instalador
└── package.json
```

---

## 9. Decisiones técnicas abiertas (a cerrar antes de implementar)

1. **Driver SQLite:** `better-sqlite3` (síncrono, simple, rápido en main) — recomendado — vs `sql.js`. → *propuesta: better-sqlite3*.
2. **Empaquetado Angular dentro de Electron:** cómo se sirve el build de Angular al renderer (protocolo `file://` vs servidor interno). → *propuesta: cargar el build estático.*
3. **Concurrencia del CopyEngine:** nº de copias en paralelo (discos lentos vs unidad Drive). → *propuesta: configurable, por defecto 2–4.*
4. **Política de retención de Papelera:** por tiempo y/o tamaño máximo.

---

## 10. Próximo paso

Validada la arquitectura → **estructura del proyecto** (andamiaje Electron + Angular vacío pero ejecutable) y luego **diseño de UI** (pantallas del wizard). Aún sin lógica de negocio.
