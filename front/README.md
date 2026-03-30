# Frontend - Nicatto Beard

Aplicação web em React + Vite com autenticação por sessão e suporte a PWA.

## Tecnologias

- React
- Vite
- Material UI
- vite-plugin-pwa

## Como rodar

1. npm install
2. npm run dev

Build de produção:

1. npm run build
2. npm run preview

## Estrutura principal

- src/App.tsx: roteamento principal e proteção de rotas por papel.
- src/auth/AuthContext.tsx: estado de sessão, login, refresh e logout.
- src/login: tela de login/cadastro.
- src/dashboard: calendário, cards e visão operacional.
- src/schedule: criação de agendamento para cliente.
- src/history: histórico completo de agendamentos.
- src/crud-dashboard + src/crud-pages: CRUDs administrativos.
- src/account: edição de dados da conta logada.
- src/hooks/useApi.ts: wrapper de chamadas à API com token.

## Fluxos do sistema

### Login e sessão

1. Usuário entra com email e senha.
2. Front recebe access token e mantém refresh por cookie httpOnly.
3. Sessão é restaurada automaticamente ao reabrir a aplicação.

### Dashboard e calendário

- Calendário exibe reservas ativas (não canceladas).
- Admin pode filtrar calendário por barbeiro.
- Clique sobre um horário/agendamento abre os detalhes para edição/cancelamento (de acordo com permissão).

### Agendamento (cliente)

1. Seleciona serviço.
2. Front lista apenas barbeiros compatíveis com a especialidade do serviço.
3. Seleciona data e horário disponível.
4. Confirma no modal de revisão.

### Histórico

- Mostra todos os agendamentos, inclusive cancelados.
- Cada item exibe status (Agendado, Realizado, Cancelado).

### CRUDs

Links diretos:

- /crud/clientes
- /crud/barbeiros
- /crud/especialidades
- /crud/servicos

Funcionalidades gerais:

- listagem
- criação
- edição
- exclusão (quando permitido)

## Regras visuais e UX relevantes

- Login otimizado para mobile (layout e espaçamentos responsivos).
- Requisitos de senha exibidos nos formulários de cadastro e edição de senha.

## PWA

- Configuração em vite.config.js com vite-plugin-pwa.
- Build gera service worker e manifest em dist.
- Em localhost/HTTPS, o app pode ser instalado e usar cache offline.

## Scripts

- npm run dev: desenvolvimento com hot reload.
- npm run build: build de produção.
- npm run preview: preview do build local.
