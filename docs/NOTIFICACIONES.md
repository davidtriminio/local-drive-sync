# Notificaciones de sincronización

Sección **Notificaciones** de la app. Avisa cuando un mapeo tiene archivos
**nuevos o modificados** en local que aún no se han sincronizado a Drive, en el
mes actual.

## Detección

Reutiliza `SyncService.scanDiff(mappingId, monthKey)`, que compara local vs
Drive apoyándose en el índice incremental persistido. Los pendientes son los
archivos con estado `NEW` o `MODIFIED`. `checkNotifications`
(`src/main/domain/notifications.ts`) recorre todos los mapeos del **mes actual**
y emite una notificación por cada uno con pendientes.

Un mapeo con rutas inaccesibles se omite sin romper el resto de la revisión.

## Avisar solo de lo nuevo

Cada notificación lleva una **firma** (`pendingSignature`) del conjunto
pendiente —hash estable de rutas + tamaño + fecha—. Se guarda por mapeo la
última firma que el usuario marcó como leída (`notifAcks` en la persistencia).
Una notificación es **no leída** si su firma difiere de la guardada, de modo
que:

- No re-avisa del mismo conjunto ya visto.
- Vuelve a avisar si aparece, cambia o desaparece algún archivo pendiente.

## UI

- Entrada de nav **Notificaciones** (icono `bell`) con **badge** del número de
  no leídas en la barra lateral.
- El shell revisa pendientes al arrancar y tras cada sincronización terminada
  (evento `sync:done`).
- La página lista los mapeos con pendientes: conteos (nuevos/modificados), una
  muestra de rutas, atajo **Sincronizar** y **Marcar leído** (individual o
  todo). El estado se comparte vía `NotificationsStore`, así el badge y la
  página quedan sincronizados.

## Arquitectura

| Capa | Archivo |
|------|---------|
| Contrato IPC | `src/shared/ipc-contract.ts` (`notifications:check/markRead/markAllRead`) |
| Dominio | `src/main/domain/notifications.ts` |
| Persistencia | `src/main/persistence/repository.ts` (`notifAcks`) |
| Handlers | `src/main/ipc/index.ts` |
| Puente | `src/preload/preload.ts`, `src/renderer/app/services/ipc.service.ts` |
| Estado UI | `src/renderer/app/services/notifications.store.ts` |
| UI | `src/renderer/app/pages/notifications.component.ts`, `app.component.ts` |
