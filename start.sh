#!/bin/bash

APP_DIR="/app/project/cafundo-prd/cafundo-api"
PORT="3000"

echo "======================================"
echo "     Iniciando Cafundo API"
echo "======================================"

cd "$APP_DIR" || exit 1

echo "Diretório: $APP_DIR"
echo "Porta: $PORT"
echo ""

# Verifica se já existe uma aplicação usando a porta
if ss -lntp 2>/dev/null | grep -q ":$PORT "; then
    echo "ERRO: A porta $PORT já está em uso."
    ss -lntp 2>/dev/null | grep ":$PORT "
    exit 1
fi

echo "Iniciando Next.js..."
npm start
