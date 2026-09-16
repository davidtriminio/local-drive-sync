import { Injectable, inject, signal } from '@angular/core';
import { IpcService } from './ipc.service';
import type { SyncNotification } from '../../../shared/ipc-contract';

/**
 * Estado compartido de las notificaciones de sincronización. Lo consumen el
 * shell (badge de no leídas) y la página de notificaciones, de modo que marcar
 * leído en un sitio actualiza el otro.
 */
@Injectable({ providedIn: 'root' })
export class NotificationsStore {
  private readonly ipc = inject(IpcService);

  readonly notifications = signal<SyncNotification[]>([]);
  readonly unreadCount = signal(0);
  readonly loading = signal(false);

  /** Reescanea los mapeos y actualiza la lista y el contador. */
  async refresh(): Promise<void> {
    this.loading.set(true);
    try {
      this.apply(await this.ipc.checkNotifications());
    } catch {
      // No romper el shell si un mapeo tiene rutas inaccesibles.
    } finally {
      this.loading.set(false);
    }
  }

  async markRead(mappingId: string, signature: string): Promise<void> {
    this.apply(await this.ipc.markNotificationRead(mappingId, signature));
  }

  async markAllRead(): Promise<void> {
    this.apply(await this.ipc.markAllNotificationsRead());
  }

  private apply(result: {
    notifications: SyncNotification[];
    unreadCount: number;
  }): void {
    this.notifications.set(result.notifications);
    this.unreadCount.set(result.unreadCount);
  }
}
