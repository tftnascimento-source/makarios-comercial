# Grupo Makários — Gestão Comercial

Sistema interno de gestão comercial: faturamento, inadimplência, metas, NF-e e relatórios em PDF/Excel.

**Stack:** Next.js 16 · Tailwind CSS v4 · Drizzle ORM · PostgreSQL 16 · Redis 7 · JWT · Docker

---

## Desenvolvimento local

### 1. Pré-requisitos

- Node.js 20+
- Docker e Docker Compose v2

### 2. Configurar variáveis de ambiente

```bash
cp .env.example .env.local
# Edite .env.local com as senhas locais (ou use os padrões do compose)
```

### 3. Subir infraestrutura local

```bash
docker compose up -d
# PostgreSQL em localhost:5433 · Redis em localhost:6380
```

### 4. Instalar dependências e preparar banco

```bash
npm install
npm run db:generate   # gera SQL das migrations
npm run db:migrate    # aplica as migrations
npm run db:seed       # popula dados de desenvolvimento
```

### 5. Iniciar o servidor

```bash
npm run dev
# http://localhost:3000
```

### Credenciais de desenvolvimento

| Role         | E-mail                     | Senha       |
|--------------|----------------------------|-------------|
| admin_grupo  | admin@makarios.com.br      | Admin@123   |
| gestor       | gestor@makarios.com.br     | Gestor@123  |
| visualizador | view@makarios.com.br       | View@123    |

### pgAdmin (opcional)

```bash
docker compose --profile tools up -d
# http://localhost:5050  admin@mkrs.local / admin
```

---

## Produção (Docker)

### 1. Preparar servidor

Instale Docker Engine e Docker Compose v2 no servidor.

### 2. Clonar e configurar

```bash
git clone <repo> /opt/mkrs-comercial
cd /opt/mkrs-comercial

cp .env.production.example .env.production
# Edite .env.production com segredos reais
```

Gere segredos fortes:

```bash
openssl rand -base64 48   # JWT_SECRET
openssl rand -base64 48   # AUTH_SECRET
openssl rand -base64 32   # POSTGRES_PASSWORD
openssl rand -base64 32   # REDIS_PASSWORD
```

### 3. Deploy

```bash
bash scripts/deploy.sh
```

O script:
1. Constrói a imagem Docker (multi-stage, saída standalone)
2. Sobe PostgreSQL e Redis, aguarda health checks
3. Executa migrations Drizzle
4. Sobe a aplicação na porta 3000
5. Verifica o endpoint `/api/health`

### Flags opcionais

```bash
bash scripts/deploy.sh --skip-migrate   # não roda migrations
bash scripts/deploy.sh --skip-build     # reutiliza imagem já construída
```

### 4. Configurar proxy reverso (Nginx/Caddy)

**Nginx** (exemplo):

```nginx
server {
    listen 443 ssl;
    server_name comercial.makarios.com.br;

    ssl_certificate     /etc/ssl/certs/makarios.crt;
    ssl_certificate_key /etc/ssl/private/makarios.key;

    location / {
        proxy_pass         http://localhost:3000;
        proxy_set_header   Host              $host;
        proxy_set_header   X-Real-IP         $remote_addr;
        proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
    }
}
```

**Caddy** (com HTTPS automático):

```caddyfile
comercial.makarios.com.br {
    reverse_proxy localhost:3000
}
```

---

## Comandos úteis

```bash
# Desenvolvimento
npm run dev            # servidor de desenvolvimento
npm run build          # build de produção local
npm run typecheck      # checagem TypeScript sem compilar
npm run lint           # ESLint
npm run test           # testes unitários (Vitest)

# Banco de dados
npm run db:generate    # gerar SQL das migrations
npm run db:migrate     # aplicar migrations
npm run db:studio      # abrir Drizzle Studio na porta 4983
npm run db:seed        # popular dados de desenvolvimento

# Docker (produção)
docker compose -f docker-compose.prod.yml --env-file .env.production logs -f app
docker compose -f docker-compose.prod.yml --env-file .env.production restart app
docker compose -f docker-compose.prod.yml --env-file .env.production down
```

---

## Estrutura

```
src/
├── app/
│   ├── (auth)/login/          # Página de login
│   ├── (dashboard)/           # Área autenticada
│   │   ├── dashboard/         # KPIs + gráficos
│   │   ├── faturamento/       # Histórico de faturamento
│   │   ├── inadimplencia/     # Aging de inadimplência
│   │   ├── metas/             # CRUD de metas
│   │   ├── empresas/          # Cadastro de empresas
│   │   ├── importacoes/       # Importação de NF-e XML
│   │   └── configuracoes/     # Gestão de usuários (admin)
│   └── api/                   # API Routes (Next.js)
├── components/
│   ├── exports/ExportMenu     # Botão de exportação PDF/Excel
│   └── layout/                # Sidebar + Header
└── lib/
    ├── auth/                  # JWT + Redis sessions + RBAC
    ├── db/                    # Schema Drizzle + pool pg
    ├── exports/               # Geradores PDF (jsPDF) e Excel (SheetJS)
    ├── validations/           # Schemas Zod
    └── utils.ts               # formatBRL, formatDateBR, agingBucket
```

---

## RBAC

| Role          | Acesso                                                  |
|---------------|---------------------------------------------------------|
| admin_grupo   | Todas as empresas do grupo + Configurações de usuários  |
| gestor        | Empresas atribuídas + pode criar/editar dados           |
| visualizador  | Empresas atribuídas, somente leitura                    |

---

## Health check

```
GET /api/health
```

Retorna `200 OK` com `{ status: "ok", checks: { database: "ok", redis: "ok" } }` quando ambos os serviços estão acessíveis, ou `503` em caso de degradação.
