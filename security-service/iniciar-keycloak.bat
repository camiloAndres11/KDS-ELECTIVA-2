@echo off
REM ===========================================================================
REM  Arranca Keycloak en modo desarrollo, con el realm "kds" ya importado.
REM
REM  Desde la carpeta security-service\. Doble click, o:
REM      iniciar-keycloak.bat
REM
REM  La primera vez tarda 1-2 minutos. Cuando veas
REM  "Keycloak ... started in" la aplicacion esta lista.
REM
REM  Para detenerlo: pulsa Ctrl+C en esta ventana.
REM ===========================================================================

setlocal

REM --- Localizamos Keycloak ------------------------------------------------
REM %~dp0 es la carpeta de este archivo, con la barra final. Asi el script
REM funciona aunque lo ejecutes desde otro sitio.
set "KEYCLOAK_HOME=%~dp0..\keycloak-26.1.4"
set "KEYCLOAK_BIN=%KEYCLOAK_HOME%\bin"
set "REALM_ORIGEN=%~dp0keycloak\kds-realm.json"

if not exist "%KEYCLOAK_BIN%\kc.bat" (
  echo.
  echo ERROR: no encuentro Keycloak en "%KEYCLOAK_BIN%".
  echo.
  echo Este script espera keycloak-26.1.4 en la raiz del repositorio,
  echo junto a la carpeta security-service. Descargalo de:
  echo   https://github.com/keycloak/keycloak/releases/download/26.1.4/keycloak-26.1.4.zip
  echo.
  echo Si tu Keycloak esta en otro sitio, edita KEYCLOAK_BIN y KEYCLOAK_HOME
  echo en este archivo y vuelve a ejecutarlo.
  echo.
  pause
  exit /b 1
)

if not exist "%REALM_ORIGEN%" (
  echo.
  echo ERROR: no encuentro el archivo del realm en "%REALM_ORIGEN%".
  echo Keycloak arrancara, pero sin el realm "kds".
  echo.
  pause
)

REM --- Preparamos la importacion del realm ---------------------------------
REM Keycloak solo importa realms al arrancar si encuentra los .json dentro de
REM   <KEYCLOAK_HOME>\data\import\
REM y solo si ese archivo no existe todavia (no reimporta uno ya creado).
REM Por eso copiamos el nuestro ahi en cada arranque.
echo.
echo Iniciando Keycloak 26.1.4 en modo desarrollo...
echo   Binarios : %KEYCLOAK_BIN%
echo   Realm    : %REALM_ORIGEN%
echo.

if not exist "%KEYCLOAK_HOME%\data\import" (
  mkdir "%KEYCLOAK_HOME%\data\import" >nul 2>&1
)
REM Todos los realms (kds + uno por empresa: kds-starpizza, kds-delarosepizza).
copy /Y "%~dp0keycloak\*-realm.json" "%KEYCLOAK_HOME%\data\import\" >nul

echo La primera vez puede tardar 1-2 minutos.
echo Para detenerlo: Ctrl+C
echo.

pushd "%KEYCLOAK_BIN%"

REM La cuenta de administracion. Sin estas dos lineas, Keycloak genera una
REM contrasena temporal aleatoria y el login admin/admin del README no
REM funcionaria. Son credenciales de clase, solo para desarrollo local.
set "KC_BOOTSTRAP_ADMIN_USERNAME=admin"
set "KC_BOOTSTRAP_ADMIN_PASSWORD=admin123"

kc.bat start-dev ^
  --http-port 8080 ^
  --http-enabled true ^
  --hostname-strict=false ^
  --import-realm

popd

echo.
echo Keycloak se detuvo.
pause
endlocal
