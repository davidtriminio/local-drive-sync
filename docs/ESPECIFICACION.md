# Especificación — Sincronizador Local → Google Drive

> Documento de requisitos y reglas de sincronización. Base acordada antes de diseñar arquitectura.
> Estado: **borrador v1** · Fecha: 2026-09-12

---

## 1. Resumen

Aplicación de escritorio para Windows que facilita **copiar arte final desde carpetas locales del PC hacia Google Drive**, mostrando las diferencias antes de actuar y permitiendo decidir exactamente qué copiar. Sustituye un proceso manual diario (copiar/pegar tras presentar el arte de la empresa).

**Modelo adoptado:** copia **unidireccional PC → Drive**, con detección (solo informativa) de lo que existe únicamente en Drive y **nunca** borra en Drive.

---

## 2. Glosario

- **Local:** carpeta de origen en el PC (ej. `D:\Exports\{mes}\Cliente 1`).
- **Destino / Drive:** carpeta dentro de la unidad montada por **Google Drive para Escritorio** (ej. `G:\...\artes\{mes}`).
- **Mapeo:** relación guardada entre una carpeta local y su carpeta destino en Drive.
- **Clave de mes canónica:** representación `AAAA-MM` usada para emparejar carpetas de mes aunque su nombre esté escrito distinto.
- **Índice:** base de datos local (SQLite) con el último estado sincronizado, para acelerar análisis posteriores.
- **Papelera:** carpeta local de respaldo donde se guarda la versión previa de un archivo antes de sobrescribirlo en Drive.

---

## 3. Contexto técnico y restricciones

- Integración con Drive vía **Google Drive para Escritorio** (unidad montada). **Sin API, sin OAuth, sin cuotas.** Toda operación es **copia local → local**.
- Drive está en **modo *Stream*** → los archivos de Drive son *placeholders* en la nube, no están en disco.
- **Consecuencia 1 (hash):** hashear archivos de Drive los descargaría enteros. Por eso el hash es **opcional y manual**, nunca automático.
- **Consecuencia 2 (subida diferida):** cuando la app copia a la unidad de Drive, el archivo llega al disco al instante, pero **Drive lo sube en segundo plano después**. La app **no** afirmará "subido a la nube"; mostrará *"Copiado. Drive terminará de subirlo en segundo plano."*
- Cuenta **personal** de Google. Uso **de un solo usuario** (el propietario).

---

## 4. Alcance

### Dentro (v1)
- Configuración de mapeos carpeta local → carpeta Drive, con token de **mes**.
- Análisis de diferencias (nuevo / modificado / igual / solo-en-Drive).
- Copia selectiva: por **archivo (checkbox)** y por **carpeta completa**.
- Creación de carpetas faltantes en Drive **previa confirmación**.
- Resolución de conflictos con **local gana por defecto**, decidible por archivo.
- **Papelera** local antes de sobrescribir.
- **Exclusión** por patrones.
- **Historial persistente** consultable.
- Ejecución con icono en **bandeja**, pero **cerrable**; sincronización **manual**.
- **Instalador real** (`.exe`).

### Fuera (v1 — posibles fases futuras)
- Sincronización bidireccional (Drive → PC).
- Borrado automático en Drive.
- Sincronización programada / automática / al iniciar Windows.
- Detección de renombrados/movidos como tales (se tratan como borrado + nuevo).
- Uso mediante API de Google Drive / multiusuario / Workspace.

---

## 5. Reglas de sincronización (la "verdad" del sistema)

1. **Dirección:** solo **Local → Drive**. Drive nunca escribe sobre Local.
2. **Estados por archivo:**
   - `NUEVO` — existe en Local, no en Drive → candidato a copiar.
   - `MODIFICADO` — existe en ambos pero difiere (tamaño/fecha) → candidato a actualizar, **preguntar**.
   - `IGUAL` — coincide → no se hace nada.
   - `SOLO_EN_DRIVE` — existe en Drive, no en Local → **solo se informa**, nunca se borra.
3. **Comparación:** `tamaño + fecha de modificación` por defecto. **Hash (MD5) solo manual**, con aviso de descarga (modo Stream).
4. **Conflicto** (difiere en ambos lados desde la última sincronización): **gana Local por defecto**; el usuario puede, por archivo, **conservar la versión de Drive**.
5. **Antes de sobrescribir** un archivo en Drive → su versión previa se mueve a la **Papelera** local.
6. **Carpeta nueva en Local** sin destino → la app propone crearla en Drive y **pregunta** antes.
7. **Carpeta que desaparece en Local** → **no se toca** en Drive.
8. **Exclusiones:** patrones configurables (ej. `*.tmp`, `*.bak`, `Thumbs.db`, `.DS_Store`) se ignoran en ambos lados.
9. **Nada se ejecuta sin una vista previa** que liste exactamente qué se va a copiar, actualizar o crear.

---

## 6. Mapeo de carpetas y normalización de mes

- Un mapeo define: `raízLocal` + `raízDrive` + `plantilla` con token `{mes}` y `{cliente}`.
  - Ejemplo: `D:\Exports\{mes}\{cliente}` → `G:\...\{cliente}\artes\{mes}`.
- **El nombre del mes puede variar en ambos lados** (`Septiembre-2026`, `09-2026`, `sep 2026`…).
- **Normalizador de mes:** convierte cada nombre de carpeta a clave canónica `AAAA-MM` (reconoce nombres de mes en español y números). El emparejamiento Local↔Drive se hace por esa clave, no por texto literal.
- Si un nombre **no se puede interpretar**, el asistente pide mapearlo **manualmente una vez** y lo **recuerda**.
- Al **crear** carpeta de mes en Drive, se usa el **formato preferido** elegido por el usuario: **`Mes-Año` (ej. `Septiembre-2026`)**.

---

## 7. Casos de uso

- **CU-01 Configurar mapeo:** el usuario elige raíz local, raíz Drive y plantilla; la app valida rutas y guarda el mapeo.
- **CU-02 Analizar diferencias:** la app escanea Local y Drive del mes seleccionado y presenta el árbol con estados por archivo.
- **CU-03 Seleccionar qué copiar:** el usuario marca archivos (checkbox) o carpetas completas.
- **CU-04 Vista previa y confirmación:** la app resume acciones (X nuevos, Y actualizados, Z carpetas a crear, conflictos) y pide confirmación.
- **CU-05 Ejecutar copia:** copia con barra de progreso; respalda a Papelera antes de sobrescribir; informa "Drive subirá en segundo plano".
- **CU-06 Revisar solo-en-Drive:** lista informativa de archivos que están en Drive y no en Local (sin acción destructiva).
- **CU-07 Consultar historial:** ver sincronizaciones pasadas con conteos y errores.
- **CU-08 Restaurar desde Papelera:** recuperar una versión previa respaldada.
- **CU-09 Gestionar exclusiones:** editar patrones ignorados.

---

## 8. Interfaz (asistente por pasos)

Flujo principal tipo **wizard**:

1. **Inicio / Dashboard:** lista de mapeos guardados y botón "Analizar".
2. **Selección:** elegir mapeo + mes (o carpeta) a sincronizar.
3. **Diferencias:** árbol de archivos con estado por color, **checkbox por archivo** y selección de **carpeta completa**; acción opcional "Verificar con hash".
4. **Vista previa:** resumen de lo que se hará, con conflictos destacados y la decisión por archivo (local / conservar Drive).
5. **Ejecución:** progreso en tiempo real; al terminar, resumen y aviso de subida diferida de Drive.
6. **Historial / Logs:** accesible en todo momento.

Otros elementos: icono en **bandeja** (la app puede cerrarse), **notificaciones** de resultado, configuración de exclusiones y formato de mes preferido.

---

## 9. Historial y trazabilidad

- Registro **persistente** por ejecución:
  - Fecha/hora, mapeo y mes, nº copiados, nº actualizados, nº carpetas creadas, nº conflictos, nº errores.
  - Detalle por archivo (ruta, acción, resultado).
- Consultable desde la UI. Ligado a las entradas de Papelera para permitir restauración.

---

## 10. Rendimiento

- **Índice local (SQLite)** guarda el último estado sincronizado → los análisis siguientes solo recomparan lo que cambió (evita reescanear todo).
- Ruta rápida `tamaño + fecha`; hash solo bajo demanda.
- Escaneo en segundo plano sin bloquear la UI; progreso incremental.
- Preparado para cientos/miles de archivos por carpeta-mes.

---

## 11. Seguridad y reversibilidad

- **Papelera** en carpeta local de la app (`%APPDATA%`), **fuera** de la unidad de Drive (para no reupload de respaldos). Consultable y restaurable.
- Sin credenciales ni tokens que gestionar (se delega en Google Drive para Escritorio).
- Confirmación explícita antes de cualquier sobrescritura o creación.
- Exclusión de patrones para evitar copiar basura o archivos no deseados.

---

## 12. Tecnología

- **App:** Electron + Angular (UI en Angular/TypeScript; proceso principal de Node para filesystem e índice).
- **Persistencia:** SQLite local (índice, mapeos, historial, registro de Papelera).
- **Distribución:** instalador real para Windows (`.exe`, p. ej. con electron-builder / NSIS).
- Descartados para este proyecto: Spring Boot (servidor, inadecuado como desktop), .NET MAUI (orientado a móvil), API de Google Drive (no se usa; se delega en el cliente de escritorio).

---

## 13. Puntos abiertos / a decidir en arquitectura

- Estructura exacta del esquema SQLite.
- Política de retención de la Papelera (tamaño/tiempo máximo).
- Detalle del algoritmo del normalizador de mes (patrones soportados).
- Forma de detectar "fin de copia" vs "fin de subida de Drive" (probablemente solo mensaje informativo).
- Estrategia de empaquetado e íconos del instalador.

---

## 14. Próximos pasos

Requisitos ✅ → **Arquitectura** (procesos Electron, módulos, esquema de datos) → Estructura del proyecto → Diseño de UI → Implementación → Pruebas → Distribución.
