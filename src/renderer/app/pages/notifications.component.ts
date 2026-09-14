import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { NotificationsStore } from '../services/notifications.store';
import { IconComponent } from '../shared/icon.component';
import { chipStyle } from '../shared/colors';
import type { SyncNotification } from '../../../shared/ipc-contract';

/**
 * Centro de notificaciones: mapeos con archivos nuevos o modificados
 * pendientes de sincronizar en el mes actual.
 */
@Component({
  selector: 'app-notifications',
  standalone: true,
  imports: [IconComponent],
  template: `
    <section class="mx-auto max-w-3xl p-8">
      <header class="mb-8 flex items-center justify-between gap-3">
        <div class="flex items-center gap-3">
          <div
            class="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 to-orange-600 text-white shadow-lg shadow-orange-500/20"
          >
            <app-icon name="bell" [size]="24" />
          </div>
          <div>
            <h1 class="page-title">Notificaciones</h1>
            <p class="text-sm text-slate-400">
              Archivos nuevos o modificados sin sincronizar (mes actual).
            </p>
          </div>
        </div>
        <div class="flex shrink-0 gap-2">
          <button (click)="refresh()" class="btn-ghost" [disabled]="store.loading()">
            <app-icon name="refresh" [size]="16" />
            {{ store.loading() ? 'Revisando…' : 'Revisar' }}
          </button>
          @if (store.unreadCount() > 0) {
            <button (click)="markAll()" class="btn-ghost">
              <app-icon name="check" [size]="16" /> Marcar todo leído
            </button>
          }
        </div>
      </header>

      @if (store.notifications().length === 0) {
        <div
          class="rounded-2xl border border-dashed border-white/10 bg-slate-900/30 p-12 text-center"
        >
          <div
            class="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-white/5 text-slate-400"
          >
            <app-icon name="check" [size]="24" />
          </div>
          <p class="text-slate-400">
            Todo al día. No hay archivos pendientes de sincronizar.
          </p>
        </div>
      } @else {
        <ul class="space-y-3">
          @for (n of store.notifications(); track n.mappingId) {
            <li
              class="rounded-2xl border p-4 transition-colors"
              [class]="
                n.unread
                  ? 'border-amber-500/40 bg-amber-500/5'
                  : 'border-white/5 bg-slate-900/40'
              "
            >
              <div class="flex items-start justify-between gap-4">
                <div class="flex min-w-0 gap-3">
                  <div
                    class="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                    [style]="chip(n.color)"
                  >
                    <app-icon [name]="n.icon" [size]="20" />
                  </div>
                  <div class="min-w-0">
                    <div class="flex items-center gap-2">
                      @if (n.unread) {
                        <span class="h-2 w-2 shrink-0 rounded-full bg-amber-400"></span>
                      }
                      <h2 class="truncate font-medium">{{ n.mappingName }}</h2>
                    </div>
                    <p class="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                      @if (n.newCount > 0) {
                        <span class="text-emerald-300">{{ n.newCount }} nuevos</span>
                      }
                      @if (n.modifiedCount > 0) {
                        <span class="text-sky-300">
                          {{ n.modifiedCount }} modificados
                        </span>
                      }
                    </p>
                    <ul class="mt-2 space-y-0.5">
                      @for (f of n.sampleFiles; track f) {
                        <li class="flex items-center gap-1.5 truncate font-mono text-xs text-slate-400">
                          <app-icon name="file" [size]="12" /> {{ f }}
                        </li>
                      }
                      @if (extra(n) > 0) {
                        <li class="text-xs text-slate-500">
                          y {{ extra(n) }} más…
                        </li>
                      }
                    </ul>
                  </div>
                </div>
                <div class="flex shrink-0 flex-col items-end gap-1.5">
                  <button (click)="sync(n)" class="btn-primary btn-sm">
                    <app-icon name="refresh" [size]="15" /> Sincronizar
                  </button>
                  @if (n.unread) {
                    <button (click)="markRead(n)" class="btn-ghost btn-sm">
                      Marcar leído
                    </button>
                  }
                </div>
              </div>
            </li>
          }
        </ul>
      }
    </section>
  `,
})
export class NotificationsComponent {
  protected readonly store = inject(NotificationsStore);
  private readonly router = inject(Router);
  protected readonly chip = chipStyle;

  constructor() {
    void this.store.refresh();
  }

  /** Cantidad de pendientes que no caben en la muestra. */
  protected extra(n: SyncNotification): number {
    return n.newCount + n.modifiedCount - n.sampleFiles.length;
  }

  protected refresh(): void {
    void this.store.refresh();
  }

  protected markRead(n: SyncNotification): void {
    void this.store.markRead(n.mappingId, n.signature);
  }

  protected markAll(): void {
    void this.store.markAllRead();
  }

  protected sync(n: SyncNotification): void {
    void this.router.navigate(['/sync', n.mappingId]);
  }
}
