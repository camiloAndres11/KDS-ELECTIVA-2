@echo off
REM ===========================================================================
REM  Arranca Keycloak en modo desarrollo, con el realm "kds" ya importado.
REM
REM  Desde la carpeta security-service\.  Doble click, o:
REM      iniciar-keycloak.bat
REM
REM  La primera vez tarda 1-2 minutos. Cuando veas
REM  "Keycloak ... started in" la aplicacion esta lista.
REM
REM  Para detenerlo: pulsa Ctrl+C en esta ventana.
REM ===========================================================================

setlocal

REM --- Comprobamos que la carpeta de Keycloak este donde creemos -----------
set "KEYCLOAK_BIN=..\..\keycloak-26.1.4\bin"
set "REALM_DIR=..\..\KDS-ELECTIVA-2\security-service\keycloak"

if not exist "%KEYCLOAK_BIN%\kc.bat" (
  echo.
  echo ERROR: no encuentro Keycloak en "%KEYCLOAK_BIN%".
  echo.
  echo Este script espera que keycloak-26.1.4 este dos niveles por encima
  echo de security-service, es decir, junto a la carpeta Proyecto.
  echo.
  echo Si tu Keycloak esta en otro sitio, edita la variable KEYCLOAK_BIN
  echo de este archivo y vuelve a ejecutarlo.
  echo.
  pause
  exit /b 1
)

if not exist "%REALM_DIR%\kds-realm.json" (
  echo.
  echo ERROR: no encuentro el archivo kds-realm.json en "%REALM_DIR%".
  echo Keycloak arrancara, pero sin el realm "kds".
  echo.
  pause
)

echo.
echo Iniciando Keycloak 26.1.4 en modo desarrollo...
echo   Binarios : %KEYCLOAK_BIN%
echo   Realm    : %REALM_DIR%
echo.
echo La primera vez puede tardar 1-2 minutos.
echo Para detenerlo: Ctrl+C
echo.

pushd "%KEYCLOAK_BIN%"

kc.bat start-dev ^
  --http-port 8080 ^
  --http-enabled true ^
  --hostname-strict=false ^
  --import-realm ^
  --dir "%REALM_DIR%"

popd

echo.
echo Keycloak se detuvo.
pause
endlocal
