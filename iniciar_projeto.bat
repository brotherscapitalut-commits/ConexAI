@echo off
setlocal EnableDelayedExpansion
chcp 65001 >nul 2>&1
title ConeXai - Inicializacao

echo.
echo ===============================================================
echo   ConeXai - Inicializacao do ambiente de desenvolvimento
echo ===============================================================
echo.

cd /d "%~dp0"

REM ============================================================
REM  1. PRE-REQUISITOS
REM ============================================================
echo [1/7] Verificando pre-requisitos...

where node >nul 2>&1
if errorlevel 1 (
  echo.
  echo   [ERRO] Node.js nao encontrado.
  echo   Instale a versao LTS em: https://nodejs.org
  echo.
  pause
  exit /b 1
)
for /f "tokens=*" %%v in ('node --version') do echo   - Node.js %%v

where npm >nul 2>&1
if errorlevel 1 (
  echo   [ERRO] npm nao encontrado. Reinstale o Node.js.
  pause
  exit /b 1
)

where docker >nul 2>&1
if errorlevel 1 (
  echo.
  echo   [ERRO] Docker nao encontrado.
  echo   Instale o Docker Desktop: https://www.docker.com/products/docker-desktop
  echo.
  pause
  exit /b 1
)

docker info >nul 2>&1
if errorlevel 1 (
  echo.
  echo   [ERRO] O Docker Desktop esta instalado, porem NAO esta em execucao.
  echo   Abra o Docker Desktop, aguarde ficar "Running" e rode este script de novo.
  echo.
  pause
  exit /b 1
)
echo   - Docker esta rodando

set "COMPOSE=docker compose"
docker compose version >nul 2>&1
if errorlevel 1 (
  where docker-compose >nul 2>&1
  if errorlevel 1 (
    echo   [ERRO] Docker Compose nao encontrado.
    pause
    exit /b 1
  )
  set "COMPOSE=docker-compose"
)
echo   - Compose: !COMPOSE!

REM ============================================================
REM  2. ARQUIVO .env
REM ============================================================
echo.
echo [2/7] Verificando configuracao (.env)...
if not exist ".env" (
  if exist ".env.example" (
    copy ".env.example" ".env" >nul
    echo   - .env criado a partir de .env.example
    echo.
    echo   [ATENCAO] Revise o .env antes de usar em producao.
    echo   Em especial: JWT_SECRET, MASTER_ADMIN_EMAIL e STRIPE_WEBHOOK_SECRET.
    echo.
  ) else (
    echo   [ERRO] .env e .env.example nao existem. Nao ha como configurar o banco.
    pause
    exit /b 1
  )
) else (
  echo   - .env encontrado
)

REM ============================================================
REM  3. DEPENDENCIAS
REM ============================================================
echo.
echo [3/7] Instalando dependencias...
if not exist "node_modules" (
  echo   - node_modules ausente, rodando npm install ^(pode demorar^)...
  call npm install
  if errorlevel 1 (
    echo   [ERRO] npm install falhou. Veja as mensagens acima.
    pause
    exit /b 1
  )
) else (
  echo   - node_modules presente, sincronizando...
  call npm install --no-audit --no-fund
  if errorlevel 1 (
    echo   [AVISO] npm install retornou erro. Continuando mesmo assim.
  )
)

REM ============================================================
REM  4. BANCO DE DADOS
REM ============================================================
echo.
echo [4/7] Subindo o banco de dados...

for /f "usebackq tokens=1,* delims==" %%a in (`node scripts/dbEnv.js`) do (
  set "%%a=%%b"
)
if not defined POSTGRES_DB (
  echo   [ERRO] Nao foi possivel ler DATABASE_URL do .env.
  echo   Verifique se a linha DATABASE_URL=postgresql://usuario:senha@host:porta/banco existe.
  pause
  exit /b 1
)
echo   - Banco '!POSTGRES_DB!' como usuario '!POSTGRES_USER!' na porta !POSTGRES_PORT!

!COMPOSE! up -d
if errorlevel 1 (
  echo   [ERRO] Falha ao subir o container do banco.
  pause
  exit /b 1
)

REM ============================================================
REM  5. ESPERAR O BANCO E VALIDAR AS CREDENCIAIS
REM ============================================================
echo.
echo [5/7] Aguardando o banco ficar pronto...
set /a TRIES=0
:waitdb
set /a TRIES+=1
set "DBHEALTH="
for /f "tokens=*" %%s in ('!COMPOSE! ps --format "{{.Health}}" db 2^>nul') do set "DBHEALTH=%%s"
if /i "!DBHEALTH!"=="healthy" goto dbready
if !TRIES! GEQ 40 (
  echo.
  echo   [ERRO] O banco nao ficou pronto a tempo ^(120s^).
  echo   Diagnostico: !COMPOSE! logs db
  echo.
  pause
  exit /b 1
)
echo   - aguardando... ^(!TRIES!/40^)
timeout /t 3 /nobreak >nul
goto waitdb

:dbready
echo   - Container saudavel. Testando as credenciais da aplicacao...

set "DBCHECK="
set "TABLECOUNT="
for /f "tokens=1,2" %%a in ('node scripts/dbEnv.js --check 2^>^&1') do (
  if not defined DBCHECK set "DBCHECK=%%a"
  if /i "%%a"=="OK" set "TABLECOUNT=%%b"
)

if /i "!DBCHECK!"=="OK" (
  echo   - Conexao autenticada com sucesso
  goto dbauthok
)

if /i "!DBCHECK!"=="AUTH" (
  echo.
  echo   ============================================================
  echo   [ERRO] A senha do banco nao confere.
  echo.
  echo   O volume do Postgres foi criado ANTES, com outra senha. O
  echo   Postgres grava a senha na primeira inicializacao e ignora
  echo   mudancas posteriores na variavel de ambiente.
  echo   ============================================================
  echo.
  set /p RECREATE="   Apagar o volume e recriar o banco do zero? (S/N): "
  if /i "!RECREATE!"=="S" (
    echo.
    echo   - Removendo container e volume...
    !COMPOSE! down -v
    echo   - Recriando com as credenciais do DATABASE_URL...
    !COMPOSE! up -d
    if errorlevel 1 (
      echo   [ERRO] Falha ao recriar o banco.
      pause
      exit /b 1
    )
    set /a TRIES=0
    goto waitdb
  ) else (
    pause
    exit /b 1
  )
)

echo.
echo   [ERRO] Nao foi possivel conectar ao banco.
node scripts/dbEnv.js --check
echo.
pause
exit /b 1

:dbauthok

REM ============================================================
REM  6. SCHEMA
REM ============================================================
echo.
echo [6/7] Verificando schema...

if "!TABLECOUNT!"=="0" (
  echo   - Banco vazio. Aplicando schema inicial...
  call npm run apply-schema
  if errorlevel 1 (
    echo   [ERRO] Falha ao aplicar o schema. Veja as mensagens acima.
    pause
    exit /b 1
  )
  echo   - Schema aplicado
) else (
  echo   - Banco ja possui !TABLECOUNT! tabela^(s^). Schema preservado.
)

REM ============================================================
REM  7. APLICACAO E WEBHOOKS DO STRIPE
REM ============================================================
echo.
echo [7/7] Iniciando aplicacao e Stripe Listener...
start "ConeXai - Backend (API :3001)" cmd /k "npm run server"
timeout /t 3 /nobreak >nul
start "ConeXai - Frontend (Vite :8080)" cmd /k "npm run dev"
timeout /t 2 /nobreak >nul

REM Verifica se a CLI do Stripe esta instalada antes de tentar abrir
where stripe >nul 2>&1
if not errorlevel 1 (
  start "ConeXai - Stripe Webhook Listener" cmd /k "stripe listen --forward-to localhost:3001/api/webhooks/stripe"
  echo   - Stripe Listener iniciado em nova janela
) else (
  echo   [AVISO] Stripe CLI nao encontrada. Webhooks locais nao serao encaminhados automaticamente.
)

echo.
echo ===============================================================
echo   Tudo pronto.
echo.
echo   Banco    : container Docker ^(rodando em segundo plano^)
echo   Backend  : http://localhost:3001
echo   Frontend : http://localhost:8080
echo   Stripe   : Listener ativo redirecionando para a porta 3001
echo.
echo   Tres janelas foram abertas (Backend, Frontend e Stripe CLI).
echo   Para parar o banco:  !COMPOSE! down
echo ===============================================================
echo.
pause