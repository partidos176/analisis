# ⚽ FútbolTotal Análisis

Plataforma profesional de **tagueo, videoanálisis táctico y scouting de fútbol en tiempo real** desarrollada con **React 19 + Vite 8** y sincronización instantánea mediante **Firebase Realtime Database**.

Incluye un **servidor Express + FFmpeg** para corte/edición de video, caché de videos y gestión de biblioteca de videos.

Diseñada para analistas tácticos, entrenadores y cuerpos técnicos que necesitan registrar eventos con la máxima rapidez durante partidos en directo o sobre sesiones de videoanálisis.

---

## 📸 Funcionalidades Implementadas

### 1. 🎛️ Matriz Táctica Pro
- **Periodización de Partido**: Control instantáneo de 1er Tiempo, 2º Tiempo y Prórroga.
- **Barra de Posesión en Vivo**: Estado de posesión activa con estimación porcentual automática.
- **Fases de Inicio de Juego**: Inicio General, Corto, Largo, Combinativo, Directo.
- **Fases Defensivas**: Defensa General, Bloque Alto, Bloque Medio, Despliegue, Presión Rival.
- **Transiciones**: Ataque-Defensa y Defensa-Ataque con variantes.
- **Acciones Técnicas y ABP**: Tiros, Balón Parado (ABP), modificadores de sector.
- **Pizarra de Alineación (1-4-4-2)**: Dorsales interactivos para vincular jugadas al futbolista.
- **Campo de Fútbol Interactivo**: Terreno de juego con cuadrantes tácticos y geolocalización por clic.

### 2. ⚡ Modo Rápido
- Interfaz simplificada de conteo directo para partidos exprés.

### 3. ⏱️ Cronómetro Inteligente y Atajos de Teclado
- Cronómetro con Iniciar/Pausa, suma/resta de minutos y reinicio.
- Atajos: `Espacio` (pausa/reanuda), `G`/`g` (gol), `S`/`s` (no posesión).

### 4. 📊 Dashboard Estadístico & Exportación
- Conteo global de acciones, disparos, efectividad y transiciones.
- Exportación a **CSV** y **JSON**, modo imprimible.

### 5. 🎬 Videoanálisis y Corte de Video
- Carga de video (MP4/WebM) o URL; salto a jugadas registradas.
- **Servidor Express + FFmpeg** para corte de clips, caché de video y gestión de biblioteca de videos local.
- Procesamiento en cliente con FFmpeg.wasm (`@ffmpeg/ffmpeg`).

### 6. ☁️ Firebase Realtime Database + Auth
- Sincronización multi-dispositivo en tiempo real.
- Gestión de partidos/sesiones y autenticación de usuarios.

---

## 🚀 Instalación y Puesta en Marcha

### Prerrequisitos
- Node.js (versión 22.23.4 o superior)
- pnpm

### Pasos
1. Instalar las dependencias del proyecto:
   ```bash
   pnpm install
   ```

2. Iniciar el servidor de desarrollo (frontend):
   ```bash
   pnpm dev
   ```

3. Iniciar el servidor de video (Express + FFmpeg) en otra terminal:
   ```bash
   pnpm server
   ```

4. Abrir en el navegador la dirección indicada (por defecto `http://localhost:5173`).

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
- React 19
- Vite 8
- Firebase (Realtime Database + Auth)
- Express 5 + FFmpeg (servidor de video)
- FFmpeg.wasm (`@ffmpeg/ffmpeg`, `@ffmpeg/util`)
- TensorFlow.js + COCO-SSD (detección)
- Recharts, Lucide, jszip, xlsx
