# Backend - Nicatto Beard

API REST em Express + TypeScript com autenticação JWT e refresh token em cookie httpOnly.

## Visão geral

- Runtime: Node.js
- Framework: Express
- Banco: PostgreSQL
- Auth: access token + refresh token
- Validação: Zod

## Estrutura de pastas

### db

- init.sql: cria tabelas, chaves, constraints e objetos iniciais do banco.

### scripts

- db-up.ts: sobe o container PostgreSQL via Docker Compose, aguarda healthcheck e executa seed automático.

### src

- app.ts: configura o Express app (middlewares globais, CORS, cookies e roteadores).
- server.ts: ponto de entrada da API, inicializa o servidor HTTP.
- bd.ts: conexão/pool com PostgreSQL.
- seed.ts: popula dados iniciais (clientes, barbeiros, especialidades, serviços, vínculos e reservas).

#### src/middlewares

- auth.ts: valida JWT, injeta usuário no request e aplica regras de autorização por papel.

#### src/routes

- auth.routes.ts: endpoints de autenticação e conta do usuário.
  - login
  - refresh
  - logout
  - register-cliente
  - me (GET/PUT)
- inserts.routes.ts: endpoints de domínio e CRUDs (clientes, barbeiros, especialidades, serviços, reservas, disponibilidade).

#### src/utils

- httpErrors.ts: utilitários para padronizar respostas de erro e identificação de erros de banco.

## Scripts npm

- npm run dev: roda API em modo watch (tsx).
- npm run build: compila TypeScript para dist.
- npm run seed: executa população de dados.
- npm run db:up: sobe PostgreSQL no Docker e roda seed automaticamente.
- npm run db:down: derruba containers do compose.
- npm run db:reset: derruba containers e remove volume do banco.
- npm run dev:with-db: executa db:up e depois dev.

## Fluxos importantes

### Autenticação

1. POST /auth/login recebe email e senha.
2. API retorna access token e define refresh token em cookie httpOnly.
3. Front usa /auth/refresh para restaurar sessão silenciosa.

### Reservas

- GET /reservas suporta parâmetro includeCanceled.
- Calendário usa includeCanceled=false (somente ativos).
- Histórico usa includeCanceled=true (todos os status).

### Seed

O seed é idempotente para dados principais:

- atualiza registros existentes por chaves naturais (como email/nome)
- cria quando não existe
- atualiza status cancelado das reservas seedadas
