# ⚽ FútbolTotal Análisis

Plataforma profesional de **tagueo, videoanálisis táctico y scouting de fútbol en tiempo real**. Combina un frontend **React 19 + Vite 8**, sincronización con **Firebase Realtime Database/Auth** y un **servidor local Express + FFmpeg** para corte, montaje y gestión de vídeo.

Está pensada para analistas, entrenadores y cuerpos técnicos que registran acciones durante un partido o revisan vídeo después.

---

## 🧭 Vistas principales

Al iniciar sesión se accede a un menú con tres modos:

- **ON LIVE**: registro de acciones en directo con pestañas por área.
- **TOTALES**: agregados y estadísticas por partido, jornada, jugador o periodo.
- **OFF LIVE**: análisis de vídeo con timeline, cortes y montaje.

### ON LIVE — pestañas
| Pestaña | Contenido |
|---|---|
| `ALINEACION` | Alineación 1-4-4-2, dorsales y jugadores. |
| `ACCIONES` | Registro de acciones propias/rival, tiros, faltas, centros, córners, pérdidas, transiciones, goles, penaltis, saques, infracciones y ocasiones. |
| `FINALIZACIONES` | Finalizaciones: fuera, blocaje, final a boca, final desde dentro, despejes, etc. |
| `GOLES` | Listado de goles propios y rivales. |
| `SUSTITUCIONES` | Cambios de jugadores. |
| `DATOS` | Datos del partido: equipos, jornada y metadatos. |
| `POSESIÓN` | Posesión propia/rival y disputas. |
| `VÍDEOS` | Carga/gestión del vídeo del partido y reproducción. |
| `NOTA VOZ` | Notas de voz asociadas al análisis. |

### TOTALES — pestañas
`TOTAL RESULTADOS`, `TOTAL GOLES`, `TOTAL ACCIONES`, `PERIODO/ACCIÓN`, `TOTAL %`, `TOTAL POSESIÓN`, `TOTAL JUGADO`, `MINUTOS JORNADA`, `DATOS JUGADOR`, `CADETES`.

Incluye filtros por jornada, rol, encuentro, estado al descanso, marca del primer gol y estado final.

### OFF LIVE
- Timeline de acciones con filas editables y periodos (1ª parte, 2ª parte, prórroga).
- Saltos al segundo exacto del vídeo al seleccionar una jugada.
- Exportación de clips y montajes.
- Composición de vídeo con overlay de tracking (`src/compositeVideo.js`).

---

## 🎬 Servidor local de vídeo (Express + FFmpeg)

El archivo `server.js` expone una API para trabajar con vídeos grandes sin subirlos por el navegador:

- `POST /api/videos/copiar`: copia un vídeo desde la biblioteca local (mismo nombre/tamaño) a la caché de trabajo.
- `POST /api/videos/borrar`: elimina un vídeo de la caché.
- `GET /api/cortar`: estado/consulta del servicio de corte.
- `POST /api/upload`: subida de un vídeo completo.
- `POST /api/upload-init` / `POST /api/upload-chunk` / `POST /api/upload-complete`: subida por fragmentos para vídeos muy grandes.
- `POST /api/cortar`: corte de un tramo de vídeo.
- `POST /api/trim-webm`: recorte específico para WebM.
- `POST /api/recurso`: subida de recursos auxiliares.
- `GET /api/estado`: estado del servidor/caché.
- `POST /api/montaje`: montaje final con FFmpeg (tramos, fundidos y concatenación).
- `POST /api/guardar-partido`: autoguardado de un partido en JSON en disco.

El servidor usa `ffmpeg-static`, caché en `.video-cache`, temporales en `.tmp-cortes` y una carpeta de biblioteca local configurada en `server.js`.

---

## 📁 Estructura del proyecto

```
analisis/
├── src/
│   ├── App.jsx              # Aplicación principal (vistas, tagueo, totales, timeline)
│   ├── components/Login.jsx # Autenticación Firebase
│   ├── compositeVideo.js    # Overlay de tracking sobre vídeo
│   ├── ffmpegCut.js         # Corte en cliente con FFmpeg.wasm
│   ├── firebase.js          # Configuración Firebase (RTDB + Auth)
│   ├── main.jsx
│   └── index.css
├── server.js                # API Express + FFmpeg
├── vite.config.js
├── firebase.json            # Hosting
├── storage.rules            # Reglas de Storage
├── pnpm-workspace.yaml      # allowBuilds de pnpm
└── package.json
```

---

## 🚀 Instalación y Puesta en Marcha

### Prerrequisitos
- Node.js **22.23.4 o superior**
- pnpm

### Instalación
```bash
pnpm install
```

### Desarrollo
Frontend:
```bash
pnpm dev
```

Servidor de vídeo (otra terminal):
```bash
pnpm server
```

Abrir `http://localhost:5173`.

### Build
```bash
pnpm build
```

### Deploy (Firebase Hosting)
```bash
pnpm deploy
```

---

## 📦 Stack principal

- **React 19** + **Vite 8**
- **Firebase** Realtime Database + Auth
- **Express 5** + **FFmpeg** (`ffmpeg-static`, `archiver`, `multer`)
- **FFmpeg.wasm** (`@ffmpeg/ffmpeg`, `@ffmpeg/util`)
- **TensorFlow.js** + **COCO-SSD** para detección
- **Recharts**, **Lucide**, **jszip**, **xlsx**, **html2canvas**

---

## 🔐 Seguridad y mantenimiento

- `engines.node` fijado a `>=22.23.4` (parche de vulnerabilidades críticas de Node.js y CA eMudhra).
- **Dependabot** semanal para npm (patch/minor) + auto-merge cuando CI pasa.
- Reglas de Firebase en `storage.rules`.
- **Regla de código**: ningún componente nuevo debe superar las 500 líneas (ver `AGENTS.md`).
