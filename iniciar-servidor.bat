@echo off
REM Arranca el servidor de recortes (puerto 3001) en ventana minimizada.
REM Lo usa el boton "Iniciar servidor" de la hoja Montaje.
REM %~dp0 es la carpeta donde vive este .bat, asi que ya no hay ninguna ruta
REM escrita a mano: antes apuntaba a C:\Users\uSer\..., que aqui no existe.
cd /d "%~dp0"
start "Servidor de cortes - puerto 3001" /min node server.js
exit
