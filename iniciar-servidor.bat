@echo off
REM Arranca el servidor de recortes (puerto 3001) en ventana minimizada.
REM Lo usa el boton "Iniciar servidor" de la hoja Montaje.
cd /d "C:\Users\uSer\Documents\Default Project\futbol"
start "Servidor de cortes - puerto 3001" /min node server.js
exit
