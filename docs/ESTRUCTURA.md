# Estructura del proyecto y andamiaje

> Qué se montó en la fase de *scaffolding* y cómo ejecutarlo.
> Estado: **andamiaje funcional (arranca ventana vacía)** · Fecha: 2026-09-13
> Stack confirmado: **Electron + Angular 20 (standalone) + Tailwind v4 + TypeScript + SQLite (better-sqlite3)**

---

## 1. Qué se hizo

Se creó el andamiaje completo y **verificado que compila** (`tsc` del proceso main + `ng build` del renderer, ambos con salida correcta). El resultado es una app Electron que:

- arranca una ventana con **Angular standalone** dentro,
- tiene **Tailwind v4** activo,
- expone un **puente IPC seguro** (`window.api`) y muestra en pantalla que responde (versión de la app leída desde el proceso main).

La pantalla actual es solo una **pantalla de estado** del andamiaje; se sustituirá por el Dashboard/Wizard real en la fase de UI.

### Decisiones aplicadas (confirmadas)
- Angular **standalone** (sin NgModules), con `bootstrapApplication`.
- **Tailwind v4** vía `@tailwindcss/postcss` (sin `tailwind.config`, detección automática de contenido).
- Driver de datos previsto: **better-sqlite3** (ver §5).
- Renderer servido como **build estático** (`baseHref: "./"`), cargado por `file://` en producción y por el dev-server en desarrollo.
- Concurrencia de copia por defecto 2–4 (se aplicará en el `CopyEngine`).

---

## 2. Estructura de carpetas

```text
local-drive-sync/
├── angular.json              # Config del builder Angular (@angular/build:application)
├── electron-builder.yml      # Config del instalador NSIS (.exe)
├── package.json              # Dependencias y scripts
├── tsconfig.json             # Base TS de Angular (renderer)
├── tsconfig.app.json         # TS del renderer
├── tsconfig.main.json        # TS del proceso main + preload + shared
├── .postcssrc.json           # Activa Tailwind v4
├── .editorconfig
├── docs/
│   ├── ESPECIFICACION.md     # Requisitos y reglas de sincronización
│   ├── ARQUITECTURA.md       # Diseño técnico (procesos, dominio, SQLite, flujo)
│   └── ESTRUCTURA.md         # Este documento
└── src/
    ├── main/                 # Proceso main (Node, confianza)
    │   ├── main.ts           # Bootstrap de Electron + ventana
    │   └── ipc/index.ts      # Registro de handlers IPC (validados)
    ├── preload/
    │   └── preload.ts        # contextBridge → window.api (superficie mínima)
    ├── shared/
    │   └── ipc-contract.ts   # Canales IPC y tipos (fuente única de verdad)
    └── renderer/             # App Angular (UI, sandbox sin Node)
        ├── index.html
        ├── main.ts           # bootstrapApplication
        ├── styles.css        # @import "tailwindcss";
        ├── assets/
        ├── types/global.d.ts # Tipado de window.api
        └── app/
            ├── app.config.ts
            └── app.component.ts
```

### Salida de compilación (generada, no versionada)
```text
dist/
├── main/main.js              # entry de Electron (package.json "main")
├── preload/preload.js
└── renderer/browser/index.html   # build de Angular (lo carga el main)
```

---

## 3. Cómo ejecutarlo

**Desarrollo** (recarga en vivo de Angular + DevTools):
```bash
npm run dev
```
Levanta `ng serve` en `localhost:4200` y, cuando está listo, abre Electron apuntando a ese servidor (`NODE_ENV=development`).

**Producción local** (build estático + Electron):
```bash
npm start
```

**Generar instalador** (`.exe` NSIS en `release/`):
```bash
npm run dist
```

Scripts individuales: `build:main` (tsc), `build:renderer` (ng build), `build` (ambos), `rebuild:native` (reconstruye módulos nativos para Electron).

---

## 4. Seguridad del renderer (ya aplicada)

En `src/main/main.ts` la ventana usa:
- `contextIsolation: true`
- `nodeIntegration: false`
- `sandbox: true`
- `preload` que expone **solo** `window.api` con `contextBridge`.

El renderer no tiene acceso a `fs`, `path` ni `require`. Todo acceso a disco/datos pasará por canales IPC validados en el main.

---

## 5. Nota importante: módulos nativos y scripts de instalación

- **`better-sqlite3`** está declarado como `optionalDependency`. En el entorno actual los *install scripts* nativos están **bloqueados por seguridad**, por lo que **aún no está instalado**. Esto es intencional: no bloquea el andamiaje.
- Cuando empiece la **fase de persistencia**, el procedimiento será:
  1. Asegurar herramientas de compilación (Visual Studio Build Tools + Python) o usar binarios prebuilt.
  2. Instalar: `npm install better-sqlite3`.
  3. **Reconstruir contra Electron** (ABI distinto al de Node): `npm run rebuild:native`.
- Igualmente, si tras un `npm install` limpio Electron no trae binario (install script gateado), ejecutar una vez:
  ```bash
  node node_modules/electron/install.js
  ```

---

## 6. Estado de verificación

| Paso | Resultado |
|---|---|
| `npm install` | ✅ 856 paquetes |
| Binario de Electron | ✅ descargado |
| `tsc` (main/preload/shared) | ✅ sin errores |
| `ng build` (renderer + Tailwind) | ✅ bundle generado |
| Rutas dist alineadas con el main | ✅ |
| Lanzamiento de la ventana GUI | ⏳ pendiente de validación visual por el usuario (`npm run dev`) |

---

## 7. Próximo paso

**Diseño de UI**: definir las pantallas del Wizard (Dashboard → Selección → Diferencias → Vista previa → Ejecución → Historial) antes de implementar el dominio. En paralelo, arrancar la **capa de persistencia** (SQLite) según el esquema de [`ARQUITECTURA.md`](ARQUITECTURA.md).
