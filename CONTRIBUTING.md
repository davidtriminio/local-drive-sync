# Contribuir a Local Drive Sync

¡Gracias por tu interés! Esta guía resume cómo colaborar.

## Antes de empezar

1. Busca en los [issues](https://github.com/davidtriminio/local-drive-sync/issues) si ya existe lo que quieres reportar o proponer.
2. Para cambios grandes, abre primero un issue y conversemos el enfoque.

## Entorno de desarrollo

```bash
npm install
npm run dev
```

Requiere Windows, Node.js 20+ y Google Drive para Escritorio para probar la copia real.
Lee [docs/ARQUITECTURA.md](docs/ARQUITECTURA.md) y [docs/ESTRUCTURA.md](docs/ESTRUCTURA.md) para orientarte.

## Flujo de trabajo

- Crea una rama desde `main`: `feat/...`, `fix/...`, `docs/...` o `chore/...`.
- Haz commits pequeños con mensajes en formato [Conventional Commits](https://www.conventionalcommits.org/es/) (`feat: ...`, `fix: ...`).
- Asegúrate de que `npm run build` termina sin errores.
- Abre el Pull Request contra `main` describiendo qué cambia y por qué.

## Reglas del dominio

La app es **unidireccional Local → Drive** y **nunca borra en Drive**. Los cambios que rompan
esta garantía no se aceptarán. Detalles en [docs/ESPECIFICACION.md](docs/ESPECIFICACION.md).

## Estilo

Sigue `.editorconfig`, TypeScript estricto y componentes standalone de Angular.
