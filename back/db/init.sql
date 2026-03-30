CREATE TABLE IF NOT EXISTS clientes (
  id_cliente SERIAL PRIMARY KEY,
  nome VARCHAR(100) NOT NULL,
  telefone VARCHAR(20),
  email VARCHAR(100) NOT NULL UNIQUE,
  senha VARCHAR(255) NOT NULL
);

CREATE TABLE IF NOT EXISTS barbeiros (
  id_barbeiro SERIAL PRIMARY KEY,
  nome VARCHAR(100) NOT NULL,
  telefone VARCHAR(20),
  email VARCHAR(100) NOT NULL UNIQUE,
  senha VARCHAR(255) NOT NULL,
  nascimento DATE,
  contratacao DATE,
  admin BOOLEAN NOT NULL DEFAULT FALSE,
  cor VARCHAR(7) NOT NULL DEFAULT '#1e88e5'
);

CREATE TABLE IF NOT EXISTS especialidade (
  id_especialidade SERIAL PRIMARY KEY,
  nome VARCHAR(100) NOT NULL UNIQUE,
  descricao TEXT
);

CREATE TABLE IF NOT EXISTS servicos (
  id_servico SERIAL PRIMARY KEY,
  nome VARCHAR(100) NOT NULL UNIQUE,
  descricao TEXT,
  valor NUMERIC(10, 2) NOT NULL,
  tempo_medio INTEGER NOT NULL CHECK (tempo_medio >= 1 AND tempo_medio <= 4),
  id_especialidade INTEGER NOT NULL REFERENCES especialidade(id_especialidade) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS barbeiro_especialidade (
  id_barbeiro INTEGER NOT NULL REFERENCES barbeiros(id_barbeiro) ON DELETE CASCADE,
  id_especialidade INTEGER NOT NULL REFERENCES especialidade(id_especialidade) ON DELETE CASCADE,
  PRIMARY KEY (id_barbeiro, id_especialidade)
);

CREATE TABLE IF NOT EXISTS reservas (
  id_reserva SERIAL PRIMARY KEY,
  id_barbeiro INTEGER NOT NULL REFERENCES barbeiros(id_barbeiro) ON DELETE CASCADE,
  id_cliente INTEGER NOT NULL REFERENCES clientes(id_cliente) ON DELETE CASCADE,
  id_servico INTEGER NOT NULL REFERENCES servicos(id_servico) ON DELETE CASCADE,
  data DATE NOT NULL,
  horario_inicial TIME NOT NULL,
  cancelado BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE UNIQUE INDEX IF NOT EXISTS reservas_slot_unique_active
  ON reservas (id_barbeiro, data, horario_inicial)
  WHERE cancelado = FALSE;

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  user_type VARCHAR(20) NOT NULL CHECK (user_type IN ('cliente', 'barbeiro')),
  token_hash VARCHAR(64) NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires_at
  ON refresh_tokens (expires_at);
