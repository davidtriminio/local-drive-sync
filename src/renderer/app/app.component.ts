import { Component, inject, OnDestroy, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { IpcService } from './services/ipc.service';
import { NotificationsStore } from './services/notifications.store';
import { IconComponent } from './shared/icon.component';
import type { ExportActivity, MonthChangeNotice } from '../../shared/ipc-contract';

interface NavItem {
  path: string;
  label: string;
  icon: string;
  exact: boolean;
}

/** Aviso transitorio mostrado tras mover (o no) un archivo de export. */
interface ExportToast {
  id: number;
  kind: ExportActivity['kind'];
  icon: string;
  text: string;
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
              @if (item.path === 'notifications' && notifications.unreadCount() > 0) {
                <span
                  class="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-400 px-1.5 text-[11px] font-semibold text-slate-950"
                >
                  {{ notifications.unreadCount() }}
                </span>
              }
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
        @if (monthNotice(); as n) {
          <div
            class="m-4 mb-0 flex items-start gap-3 rounded-xl border border-sky-500/40 bg-sky-500/10 px-4 py-3 text-sm text-sky-200"
          >
            <app-icon name="calendar" [size]="18" class="mt-0.5 shrink-0" />
            <div class="min-w-0 flex-1">
              <p class="font-medium">
                @if (n.changed) {
                  Ya cambiamos de mes: ahora es {{ n.label }}.
                } @else {
                  Carpetas de {{ n.label }} preparadas.
                }
              </p>
              @if (n.created.length > 0) {
                <p class="mt-0.5 text-xs text-sky-300/80">
                  Se crearon {{ n.created.length }} carpeta(s) para los mapeos.
                </p>
              }
              @if (n.rotated.length > 0) {
                <p class="mt-0.5 text-xs text-sky-300/80">
                  Ahora rotan solos cada mes: {{ n.rotated.join(', ') }}.
                </p>
              }
              @if (n.errors.length > 0) {
                <ul class="mt-1 list-disc pl-4 text-xs text-amber-300">
                  @for (e of n.errors; track e) {
                    <li class="break-all">{{ e }}</li>
                  }
                </ul>
              }
            </div>
            <button (click)="monthNotice.set(null)" class="shrink-0 opacity-60 hover:opacity-100">
              <app-icon name="x" [size]="15" />
            </button>
          </div>
        }
        <router-outlet />
      </main>

      <!-- Avisos de la vigilancia de la carpeta de export -->
      @if (toasts().length > 0) {
        <div class="pointer-events-none fixed bottom-4 right-4 z-50 flex w-80 flex-col gap-2">
          @for (t of toasts(); track t.id) {
            <div
              class="pointer-events-auto flex items-start gap-2.5 rounded-xl border px-3.5 py-3 text-sm shadow-xl shadow-black/30 backdrop-blur"
              [class]="toastClass(t.kind)"
            >
              <app-icon [name]="t.icon" [size]="18" class="mt-0.5 shrink-0" />
              <span class="flex-1">{{ t.text }}</span>
              <button
                (click)="dismissToast(t.id)"
                class="shrink-0 opacity-60 transition-opacity hover:opacity-100"
              >
                <app-icon name="x" [size]="15" />
              </button>
            </div>
          }
        </div>
      }
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
  protected readonly notifications = inject(NotificationsStore);
  protected readonly version = signal('—');
  protected readonly fullScreen = signal(false);
  protected readonly toasts = signal<ExportToast[]>([]);
  protected readonly monthNotice = signal<MonthChangeNotice | null>(null);
  private toastSeq = 0;
  private readonly unsubFullScreen: () => void;
  private readonly unsubSyncDone: () => void;
  private readonly unsubExport: () => void;
  private readonly unsubMonth: () => void;

  protected readonly nav: NavItem[] = [
    { path: '', label: 'Mapeos', icon: 'layers', exact: true },
    { path: 'creator', label: 'Proyectos', icon: 'palette', exact: false },
    { path: 'clients', label: 'Clientes', icon: 'user', exact: false },
    { path: 'events', label: 'Eventos', icon: 'calendar', exact: false },
    {
      path: 'notifications',
      label: 'Notificaciones',
      icon: 'bell',
      exact: false,
    },
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

    // Revisa pendientes al arrancar y tras cada sincronización terminada.
    void this.notifications.refresh();
    this.unsubSyncDone = this.ipc.onSyncDone(() => {
      void this.notifications.refresh();
    });

    // Avisos de la vigilancia de la carpeta de export.
    this.unsubExport = this.ipc.onExportActivity((a) => this.pushToast(a));

    // Cambio de mes: muestra el aviso y refresca los pendientes.
    this.unsubMonth = this.ipc.onMonthChanged((n) => {
      this.monthNotice.set(n);
      void this.notifications.refresh();
    });
  }

  ngOnDestroy(): void {
    this.unsubFullScreen();
    this.unsubSyncDone();
    this.unsubExport();
    this.unsubMonth();
  }

  protected toggleFullScreen(): void {
    // El estado del botón lo actualiza el evento onFullScreenChange.
    void this.ipc.toggleFullScreen();
  }

  /** Muestra un aviso de export y lo retira solo tras unos segundos. */
  private pushToast(a: ExportActivity): void {
    const id = ++this.toastSeq;
    const toast: ExportToast = {
      id,
      kind: a.kind,
      icon:
        a.kind === 'moved' ? 'check' : a.kind === 'unmatched' ? 'alert' : 'x',
      text: this.toastText(a),
    };
    this.toasts.update((list) => [...list, toast]);
    setTimeout(() => this.dismissToast(id), a.kind === 'moved' ? 5000 : 8000);
  }

  private toastText(a: ExportActivity): string {
    switch (a.kind) {
      case 'moved':
        return `Movido «${a.file}» → ${a.mapping}`;
      case 'unmatched':
        return a.suggestion
          ? `«${a.file}»: ningún mapeo coincide. ¿Quisiste escribir «${a.suggestion}»? Corrige el nombre del archivo.`
          : `«${a.file}»: ningún mapeo coincide con el prefijo del nombre.`;
      default:
        return `Error al mover «${a.file}»: ${a.message}`;
    }
  }

  protected dismissToast(id: number): void {
    this.toasts.update((list) => list.filter((t) => t.id !== id));
  }

  protected toastClass(kind: ExportActivity['kind']): string {
    switch (kind) {
      case 'moved':
        return 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200';
      case 'unmatched':
        return 'border-amber-500/40 bg-amber-500/10 text-amber-200';
      default:
        return 'border-rose-500/40 bg-rose-500/10 text-rose-200';
    }
  }
}
