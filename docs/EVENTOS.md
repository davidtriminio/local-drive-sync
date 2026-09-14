# Eventos y feriados

Sección **Eventos** de la app. Permite asociar clientes a un evento (feriado o
fecha comercial) y crear el mismo **arte** (proyecto) para todos ellos en una
sola acción, en lugar de repetir la creación cliente por cliente.

## Idea

Un arte suele hacerse **una vez para todos los clientes** de un evento (p. ej.
el 15 de septiembre) y luego se exporta el PNG a la carpeta de cada uno. Los
eventos capturan esa relación: un evento tiene N clientes asociados y el creador
genera la estructura de proyecto para cada cliente en lote.

## Catálogo integrado (Honduras)

`src/main/domain/events.ts` trae un catálogo integrado de feriados cívicos y
fechas de diseño de Honduras (Año Nuevo, San Valentín, Semana Santa, Día de la
Madre/Padre, Independencia, Navidad, etc.), recurrentes por **mes/día**. Las de
fecha variable (Semana Santa, Día de la Madre/Padre) se marcan con `variable` y
una nota descriptiva. Es dato de dominio, sin dependencias de red.

## Eventos personalizados y asociaciones

- Desde **Eventos** se pueden crear eventos personalizados (nombre, mes/día o
  fecha variable con nota, icono y color).
- A cualquier evento (integrado o personalizado) se le asignan clientes con un
  clic en su badge.
- Las asociaciones y los ajustes de icono/color de un evento **integrado** se
  guardan como *override* por `id`; el catálogo no se duplica. Al listar, el
  main hace *merge* (`mergeHondurasEvents`) del catálogo con lo guardado.

## Creación en lote

En **Proyectos** (creador), el selector **Evento** activa el modo lote:

1. Al elegir un evento se preseleccionan sus clientes y se propone el nombre del
   arte.
2. «Crear para N cliente(s)» genera la estructura de proyecto para cada cliente
   con la configuración elegida (plataformas, tipos, subcarpetas, carpeta base).
3. El resultado se reporta por cliente (creado / duplicado / error). Los
   duplicados del mismo mes se pueden forzar con «Crear de todos modos».

Reutiliza `ProjectCreator.create` por cliente, por lo que hereda sus reglas
(token `{mes}`, aviso de duplicado, nunca sobrescribe, `creation_log.txt`).

## Arquitectura

| Capa | Archivo |
|------|---------|
| Contrato IPC | `src/shared/ipc-contract.ts` (`events:list/save/delete`, `project:createBatch`) |
| Dominio | `src/main/domain/events.ts` (catálogo + merge) |
| Persistencia | `src/main/persistence/repository.ts` (`events`) |
| Handlers | `src/main/ipc/index.ts` |
| Puente | `src/preload/preload.ts`, `src/renderer/app/services/ipc.service.ts` |
| UI | `src/renderer/app/pages/events.component.ts`, `project-creator.component.ts` |
