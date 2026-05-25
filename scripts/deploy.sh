#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# scripts/deploy.sh — Implantação de produção do Grupo Makários Gestão Comercial
#
# Pré-requisitos:
#   - Docker e Docker Compose v2 instalados
#   - Arquivo .env.production criado a partir de .env.production.example
#   - Acesso ao servidor via SSH (se remoto)
#
# Uso:
#   bash scripts/deploy.sh [--skip-migrate] [--skip-build]
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

COMPOSE="docker compose -f docker-compose.prod.yml --env-file .env.production"
SKIP_MIGRATE=false
SKIP_BUILD=false

for arg in "$@"; do
  case $arg in
    --skip-migrate) SKIP_MIGRATE=true ;;
    --skip-build)   SKIP_BUILD=true  ;;
  esac
done

echo "▶  Grupo Makários — Deploy de Produção"
echo "   $(date '+%Y-%m-%d %H:%M:%S')"
echo ""

# ── 0. Verificações ───────────────────────────────────────────────────────────
if [[ ! -f .env.production ]]; then
  echo "❌  .env.production não encontrado."
  echo "    Copie .env.production.example, preencha os segredos e tente novamente."
  exit 1
fi

# ── 1. Build da imagem ────────────────────────────────────────────────────────
if [[ "$SKIP_BUILD" == "false" ]]; then
  echo "▶  Construindo imagem Docker..."
  $COMPOSE build app
fi

# ── 2. Subir banco e Redis ────────────────────────────────────────────────────
echo "▶  Iniciando banco de dados e Redis..."
$COMPOSE up -d postgres redis
echo "   Aguardando serviços ficarem saudáveis..."
$COMPOSE wait postgres redis 2>/dev/null || sleep 15

# ── 3. Migrations ────────────────────────────────────────────────────────────
if [[ "$SKIP_MIGRATE" == "false" ]]; then
  echo "▶  Executando migrations..."
  # Rodar o drizzle-kit migrate dentro de um container temporário que
  # compartilha a rede do compose e usa as variáveis de produção
  $COMPOSE run --rm --no-deps \
    -e DATABASE_URL \
    app sh -c "node_modules/.bin/drizzle-kit migrate" || {
      echo "⚠️  Falha nas migrations. Verifique DATABASE_URL e tente novamente."
      exit 1
    }
fi

# ── 4. Subir a aplicação ───────────────────────────────────────────────────────
echo "▶  Iniciando aplicação..."
$COMPOSE up -d app

# ── 5. Health check ──────────────────────────────────────────────────────────
echo "▶  Aguardando health check..."
for i in $(seq 1 12); do
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/health 2>/dev/null || echo "000")
  if [[ "$STATUS" == "200" ]]; then
    echo "✅  Aplicação saudável em http://localhost:3000"
    break
  fi
  echo "   [$i/12] Aguardando... (HTTP $STATUS)"
  sleep 5
done

if [[ "$STATUS" != "200" ]]; then
  echo "❌  Health check falhou após 60s. Logs:"
  $COMPOSE logs --tail=50 app
  exit 1
fi

echo ""
echo "✅  Deploy concluído com sucesso!"
echo "   App:    http://localhost:3000"
echo "   Health: http://localhost:3000/api/health"
