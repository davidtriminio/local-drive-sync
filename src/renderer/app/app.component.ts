import { Component, signal } from '@angular/core';

/**
 * Pantalla de arranque del andamiaje.
 *
 * Su único propósito en esta fase es confirmar visualmente que:
 *  - Angular standalone arranca dentro de Electron,
 *  - Tailwind está activo,
 *  - el puente IPC seguro (window.api) responde desde el proceso main.
 *
 * Se sustituirá por el Dashboard / Wizard real en la fase de UI.
 */
@Component({
  selector: 'app-root',
  standalone: true,
  template: `
    <main
      class="min-h-screen w-full bg-slate-900 text-slate-100 flex items-center justify-center p-8"
    >
      <div
        class="w-full max-w-xl rounded-2xl border border-slate-700 bg-slate-800/60 shadow-xl p-8"
      >
        <div class="flex items-center gap-3">
          <span class="inline-block h-3 w-3 rounded-full bg-emerald-400"></span>
          <h1 class="text-2xl font-semibold tracking-tight">
            Local Drive Sync
          </h1>
        </div>

        <p class="mt-2 text-slate-400">
          Andamiaje listo — copia selectiva Local &rarr; Google Drive.
        </p>

        <dl class="mt-6 grid grid-cols-2 gap-3 text-sm">
          <div class="rounded-lg bg-slate-900/60 p-3">
            <dt class="text-slate-500">Puente IPC</dt>
            <dd class="mt-1 font-medium" [class.text-emerald-400]="bridgeOk()" [class.text-amber-400]="!bridgeOk()">
              {{ bridgeOk() ? 'Conectado' : 'Sin conexión' }}
            </dd>
          </div>
          <div class="rounded-lg bg-slate-900/60 p-3">
            <dt class="text-slate-500">Versión app</dt>
            <dd class="mt-1 font-medium">{{ version() }}</dd>
          </div>
        </dl>

        <div class="mt-6">
          <p class="text-xs uppercase tracking-wider text-slate-500">
            Hoja de ruta
          </p>
          <ol class="mt-2 space-y-1 text-sm text-slate-300">
            <li>✅ Requisitos y arquitectura</li>
            <li>✅ Andamiaje Electron + Angular + Tailwind</li>
            <li>◻ Capa de datos (SQLite) y dominio</li>
            <li>◻ Diseño e implementación de UI (Wizard)</li>
            <li>◻ Pruebas y distribución (instalador)</li>
          </ol>
        </div>
      </div>
    </main>
  `,
})
export class AppComponent {
  protected readonly version = signal('—');
  protected readonly bridgeOk = signal(false);

  constructor() {
    if (window.api?.getAppVersion) {
      window.api
        .getAppVersion()
        .then((v) => {
          this.version.set(v);
          this.bridgeOk.set(true);
        })
        .catch(() => this.bridgeOk.set(false));
    }
  }
}
