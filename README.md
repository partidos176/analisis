# ⚽ FútbolTotal Análisis

Plataforma profesional de **tagueo, videoanálisis táctico y scouting de fútbol en tiempo real** desarrollada con **React 19 + Vite 8** y sincronización instantánea mediante **Firebase Realtime Database**.

Diseñada para analistas tácticos, entrenadores y cuerpos técnicos que necesitan registrar eventos con la máxima rapidez durante partidos en directo o sobre sesiones de videoanálisis.

---

## 📸 Funcionalidades Implementadas (Basadas en los Diseños)

### 1. 🎛️ Matriz Táctica Pro (Fiel a la Plantilla Avanzada / Foto 2)
- **Periodización de Partido**: Control instantáneo de 1er Tiempo, 2º Tiempo y Prórroga.
- **Barra de Posesión en Vivo**: Estado de posesión activa (*Posesión Propia*, *No Posesión / Disputa (S)*, *Posesión Rival*) con estimación porcentual automática.
- **Fases de Inicio de Juego**: Inicio General, Corto, Largo, Combinativo, Directo.
- **Fases Defensivas**: Defensa General, Bloque Alto, Bloque Medio, Despliegue, Presión Rival.
- **Transiciones**:
  - *Transición A-D (Ataque a Defensa)*: Presión tras pérdida, Repliegue.
  - *Transición D-A (Defensa a Ataque)*: Contragolpe, Conservadora.
- **Acciones Técnicas y ABP**:
  - *Tiros*: General, A Puerta, Fuera, Parada, Gol (G).
  - *Balón Parado (ABP)*: General, Saque de Puerta, Saque de Banda, Falta, Córner.
  - *Modificadores*: A Favor / En Contra, Sector Lateral / Sector Central.
- **Pizarra de Alineación (1-4-4-2)**: Dorsales interactivos (#1, #2, #4, #5, #3, #8, #10, #6, #11, #9, #7) para vincular jugadas al futbolista correspondiente.
- **Campo de Fútbol Interactivo**: Terreno de juego con 9 cuadrantes tácticos (Tercios x Carriles) y geolocalización por coordenadas de clic $(x, y)$.

### 2. ⚡ Modo Rápido (Basado en la Plantilla de Conteo Directo / Foto 1)
- Interfaz simplificada de conteo directo para partidos exprés:
  - *Acciones Propias*: Inicio propio, Córner propio, Falta propio, Ataque organizado.
  - *Acciones Rival*: Inicio rival, Córner rival, Falta rival, Estructura, Goles, Varios.

### 3. ⏱️ Cronómetro Inteligente y Atajos de Teclado
- Cronómetro con Iniciar/Pausa, suma/resta de minutos y reinicio.
- Atajos de teclado:
  - `Espacio`: Pausar / Reanudar cronómetro.
  - `G` o `g`: Registrar Gol instantáneo para el equipo activo.
  - `S` o `s`: Cambiar a No Posesión / Disputa.

### 4. 📊 Dashboard Estadístico & Exportación
- Conteo global de acciones, disparos, efectividad a puerta y transiciones.
- Barra visual de posesión de balón calculada en tiempo real.
- Exportación instantánea a **CSV (compatible con Excel)** y **JSON**.
- Modo imprimible de informe para el cuerpo técnico (`🖨 Imprimir`).

### 5. 🎬 Sincronizador de Videoanálisis
- Permite cargar el archivo de video grabado del partido (MP4/WebM) o introducir una URL.
- Al hacer clic en cualquier jugada del listado, el reproductor salta automáticamente a ese segundo exacto (con 4 segundos de anticipación) para revisar la jugada.

### 6. ☁️ Base de Datos Firebase Realtime
- Sincronización instantánea multi-dispositivo (los datos registrados en un portátil o tablet se reflejan en tiempo real).
- Gestión de múltiples partidos y sesiones.

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

2. Iniciar el servidor de desarrollo local:
   ```bash
   pnpm dev
   ```

3. Abrir en el navegador la dirección indicada (por defecto `http://localhost:5173`).

### Build
```bash
pnpm build
```

---

## 📦 Subir a GitHub

Para subir el proyecto a tu repositorio de GitHub:

```bash
# 1. Inicializar repositorio git (si no está inicializado)
git init

# 2. Añadir todos los archivos
git add .

# 3. Crear el primer commit
git commit -m "feat: FutbolTotalAnálisis - Sistema de Tagueo Táctico y Videoanálisis con Firebase Realtime"

# 4. Vincular tu repositorio remoto de GitHub (sustituye con tu URL de GitHub)
git remote add origin https://github.com/TU_USUARIO/futbol-total-analisis.git

# 5. Subir a la rama principal
git branch -M main
git push -u origin main
```
