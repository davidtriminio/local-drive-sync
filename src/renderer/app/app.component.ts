import { Component, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { IpcService } from './services/ipc.service';

interface NavItem {
  path: string;
  label: string;
  icon: string;
  exact: boolean;
}

/** Shell de la aplicación: barra lateral de navegación + outlet de rutas. */
@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <div class="flex h-screen w-full bg-slate-900 text-slate-100">
      <aside
        class="flex w-60 flex-col border-r border-slate-800 bg-slate-950/60 p-4"
      >
        <div class="mb-6 flex items-center gap-2 px-2">
          <span class="inline-block h-2.5 w-2.5 rounded-full bg-emerald-400"></span>
          <span class="text-sm font-semibold tracking-tight">Local Drive Sync</span>
        </div>

        <nav class="flex flex-1 flex-col gap-1">
          @for (item of nav; track item.path) {
            <a
              [routerLink]="item.path"
              routerLinkActive="bg-slate-800 text-white"
              [routerLinkActiveOptions]="{ exact: item.exact }"
              class="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-slate-300 hover:bg-slate-800/60"
            >
              <span class="w-5 text-center">{{ item.icon }}</span>
              {{ item.label }}
            </a>
          }
        </nav>

        <button
          (click)="toggleFullScreen()"
          class="mt-4 flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-slate-300 hover:bg-slate-800/60"
        >
          <span class="w-5 text-center">{{ fullScreen() ? '🗗' : '⛶' }}</span>
          {{ fullScreen() ? 'Salir de pantalla completa' : 'Pantalla completa' }}
        </button>

        <div class="mt-2 px-3 text-xs text-slate-600">v{{ version() }} · F11</div>
      </aside>

      <main class="flex-1 overflow-y-auto">
        <router-outlet />
      </main>
    </div>
  `,
})
export class AppComponent {
  private readonly ipc = inject(IpcService);
  protected readonly version = signal('—');
  protected readonly fullScreen = signal(false);

  protected readonly nav: NavItem[] = [
    { path: '', label: 'Mapeos', icon: '🗂️', exact: true },
    { path: 'history', label: 'Historial', icon: '🕑', exact: false },
    { path: 'trash', label: 'Papelera', icon: '♻️', exact: false },
    { path: 'settings', label: 'Ajustes', icon: '⚙️', exact: false },
  ];

  constructor() {
    this.ipc
      .getAppVersion()
      .then((v) => this.version.set(v))
      .catch(() => this.version.set('?'));
  }

  protected async toggleFullScreen(): Promise<void> {
    this.fullScreen.set(await this.ipc.toggleFullScreen());
  }
}
