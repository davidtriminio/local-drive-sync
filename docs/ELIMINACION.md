# Eliminación sincronizada

Permite eliminar **proyectos** y **clientes** sin dejar registros huérfanos, y
corrige el borrado de **mapeos** para que arrastre todo lo que dependía de
ellos. **Nunca borra carpetas del disco** (solo registros internos de la app).

## Qué se puede eliminar

- **Proyecto de un cliente**: quita una entrada del historial de proyectos del
  cliente (`Client.projects[]`). Sin efectos colaterales.
- **Cliente**: elimina el cliente y lo desvincula de todo lo que lo referencia.
- **Mapeo/sincronizador** (mejora del borrado existente): ahora la eliminación
  es en cascada.

## Cascada al borrar un mapeo

`Repository.deleteMapping` elimina, además del mapeo:

- su **historial** de ejecuciones (`runs` con ese `mappingId`),
- las entradas de **papelera** de esas ejecuciones,
- su **índice incremental** (todas las claves `"<mappingId>::<mes>"`),
- su **firma de notificación** (`notifAcks`).

Antes solo se quitaba el mapeo, dejando esos registros huérfanos.

## Cliente ↔ mapeo (relación por nombre)

No hay enlace explícito cliente↔mapeo: se relacionan por **nombre saneado** (el
creador ya hereda icono/color del mapeo homónimo). Por eso, al eliminar un
cliente:

1. Se buscan los mapeos cuyo nombre saneado coincide con el del cliente.
2. Si hay coincidencias, la UI las muestra y el usuario elige **eliminarlos
   también** (con su cascada) o **conservarlos**.
3. El cliente se quita de los `clients` de todos los eventos que lo referencian
   y se limpia `creatorPrefs.lastClient` si apuntaba a él.

## UI

Nueva página **Clientes**: lista los clientes, permite desplegar su historial de
proyectos y eliminar proyectos o el cliente completo (con el aviso de mapeos
relacionados). El borrado de mapeos desde **Mapeos** ahora también hereda la
cascada.

## Arquitectura

| Capa | Archivo |
|------|---------|
| Contrato IPC | `src/shared/ipc-contract.ts` (`clients:delete`, `clients:deleteProject`) |
| Persistencia | `src/main/persistence/repository.ts` (`deleteMapping` cascada, `deleteClient`, `deleteClientProject`) |
| Handlers | `src/main/ipc/index.ts` |
| Puente | `src/preload/preload.ts`, `src/renderer/app/services/ipc.service.ts` |
| UI | `src/renderer/app/pages/clients.component.ts` |
