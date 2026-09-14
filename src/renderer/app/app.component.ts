import { Component, inject, OnDestroy, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { IpcService } from './services/ipc.service';
import { IconComponent } from './shared/icon.component';

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
  imports: [RouterOutlet, RouterLink, RouterLinkActive, IconComponent],
  template: `
    <div class="flex h-screen w-full bg-slate-950 text-slate-100">
      <aside
        class="flex w-64 flex-col border-r border-white/5 bg-slate-900/40 p-4 backdrop-blur"
      >
        <div class="mb-8 flex items-center gap-3 px-2 pt-2">
          <div
            class="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 to-teal-600 text-slate-950 shadow-lg shadow-emerald-500/20"
          >
            <app-icon name="layers" [size]="20" />
          </div>
          <div class="leading-tight">
            <div class="text-sm font-semibold tracking-tight">Drive Sync</div>
            <div class="text-[11px] text-slate-500">Estudio gráfico</div>
          </div>
        </div>

        <nav class="flex flex-1 flex-col gap-1">
          @for (item of nav; track item.path) {
            <a
              [routerLink]="item.path"
              routerLinkActive="nav-active"
              [routerLinkActiveOptions]="{ exact: item.exact }"
              class="group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-slate-400 transition-colors hover:bg-white/5 hover:text-slate-100"
            >
              <span
                class="nav-bar absolute left-0 top-1/2 h-0 w-1 -translate-y-1/2 rounded-r-full bg-emerald-400 transition-all"
              ></span>
              <app-icon [name]="item.icon" [size]="18" />
              <span class="font-medium">{{ item.label }}</span>
            </a>
          }
        </nav>

        <button
          (click)="toggleFullScreen()"
          class="mt-4 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-slate-400 transition-colors hover:bg-white/5 hover:text-slate-100"
        >
          <app-icon [name]="fullScreen() ? 'minimize' : 'maximize'" [size]="18" />
          {{ fullScreen() ? 'Salir pantalla' : 'Pantalla completa' }}
        </button>

        <div class="mt-2 px-3 text-[11px] text-slate-600">
          v{{ version() }} · F11
        </div>
      </aside>

      <main class="flex-1 overflow-y-auto">
        <router-outlet />
      </main>
    </div>
  `,
  styles: [
    `
      .nav-active {
        background: rgba(255, 255, 255, 0.06);
        color: rgb(241 245 249);
      }
      .nav-active .nav-bar {
        height: 1.25rem;
      }
    `,
  ],
})
export class AppComponent implements OnDestroy {
  private readonly ipc = inject(IpcService);
  protected readonly version = signal('—');
  protected readonly fullScreen = signal(false);
  private readonly unsubFullScreen: () => void;

  protected readonly nav: NavItem[] = [
    { path: '', label: 'Mapeos', icon: 'layers', exact: true },
    { path: 'creator', label: 'Proyectos', icon: 'palette', exact: false },
    { path: 'events', label: 'Eventos', icon: 'calendar', exact: false },
    { path: 'history', label: 'Historial', icon: 'clock', exact: false },
    { path: 'trash', label: 'Papelera', icon: 'trash', exact: false },
    { path: 'settings', label: 'Ajustes', icon: 'settings', exact: false },
  ];

  constructor() {
    this.ipc
      .getAppVersion()
      .then((v) => this.version.set(v))
      .catch(() => this.version.set('?'));

    this.unsubFullScreen = this.ipc.onFullScreenChange((fs) =>
      this.fullScreen.set(fs),
    );
  }

  ngOnDestroy(): void {
    this.unsubFullScreen();
  }

  protected toggleFullScreen(): void {
    // El estado del botón lo actualiza el evento onFullScreenChange.
    void this.ipc.toggleFullScreen();
  }
}
