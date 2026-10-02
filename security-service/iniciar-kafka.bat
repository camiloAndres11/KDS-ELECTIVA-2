@echo off
REM ===========================================================================
REM  Levanta Kafka (broker + zookeeper) y la interfaz web kafka-ui.
REM
REM  Desde la carpeta security-service\.  Doble click, o:
REM      iniciar-kafka.bat
REM
REM  La primera vez descarga las imagenes y puede tardar varios minutos.
REM  Despues: interfaz en http://localhost:8083
REM
REM  Para detenerlo:
REM      docker compose down
REM  Para detenerlo y ademas borrar los datos guardados:
REM      docker compose down -v
REM ===========================================================================

echo.
echo Levantando Kafka, Zookeeper y kafka-ui...
echo.

docker compose up -d

if errorlevel 1 (
  echo.
  echo ERROR: no se pudo levantar. Comprueba que Docker este abierto.
  pause
  exit /b 1
)

echo.
echo Kafka levantado. Comprobando...
echo.

REM Damos unos segundos a que Kafka termine de arrancar.
timeout /t 15 /nobreak > nul

docker compose ps

echo.
echo ------------------------------------------------------------------
echo  Interfaz web : http://localhost:8083
echo  Kafka        : localhost:9092
echo  Zookeeper    : localhost:2181
echo ------------------------------------------------------------------
echo.
echo Para detenerlo ejecuta:  docker compose down
echo.
pause
