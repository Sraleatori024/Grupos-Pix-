-- ============================================================================
-- ESQUEMA RELACIONAL POSTGRESQL PARA PRODUÇÃO / SERVERLESS
-- Plataforma de Grupos Pix e Sorteios Auditáveis
-- ============================================================================

CREATE TABLE IF NOT EXISTS system_config (
  id VARCHAR(32) PRIMARY KEY DEFAULT 'default',
  entry_price_cents INT NOT NULL DEFAULT 100,
  promotion_legal_status VARCHAR(32) NOT NULL DEFAULT 'PENDING_REVIEW',
  legal_process_number VARCHAR(128) NOT NULL DEFAULT '',
  webhook_secret VARCHAR(256) NOT NULL,
  gateway_fee_fixed_cents INT NOT NULL DEFAULT 25,
  gateway_fee_percentage NUMERIC(5,2) NOT NULL DEFAULT 0.99,
  prize_allocation_percentage INT NOT NULL DEFAULT 70,
  reserve_allocation_percentage INT NOT NULL DEFAULT 10,
  max_capacity_per_group INT NOT NULL DEFAULT 10000,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS groups (
  group_id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT DEFAULT '',
  capacity INT NOT NULL,
  confirmed_participants INT NOT NULL DEFAULT 0,
  entry_price_cents INT NOT NULL DEFAULT 100,
  prize_amount_cents INT NOT NULL DEFAULT 0,
  admin_fee_cents INT NOT NULL DEFAULT 0,
  group_type VARCHAR(32) NOT NULL DEFAULT 'WHATSAPP',
  group_link TEXT NOT NULL DEFAULT '',
  status VARCHAR(32) NOT NULL DEFAULT 'DRAFT',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closed_at TIMESTAMPTZ,
  draw_status VARCHAR(32) NOT NULL DEFAULT 'NONE',
  draw_id VARCHAR(128),
  participation_model VARCHAR(32) NOT NULL DEFAULT 'FIXED_NUMBER',
  share_price_cents INT
);

CREATE TABLE IF NOT EXISTS payments (
  payment_id VARCHAR(64) PRIMARY KEY,
  gateway_transaction_id VARCHAR(128) UNIQUE NOT NULL,
  group_id VARCHAR(64) NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'PENDING',
  amount_cents INT NOT NULL,
  gateway_fee_cents INT NOT NULL DEFAULT 0,
  net_amount_cents INT NOT NULL,
  user_name VARCHAR(255) NOT NULL,
  user_cpf VARCHAR(32) NOT NULL,
  user_email VARCHAR(255) NOT NULL,
  user_phone VARCHAR(32) NOT NULL,
  pix_qr_code TEXT DEFAULT '',
  pix_copia_e_cola TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  paid_at TIMESTAMPTZ,
  participant_id VARCHAR(128),
  assigned_number VARCHAR(32),
  shares_count INT DEFAULT 1,
  keyword_used VARCHAR(64),
  webhook_processed BOOLEAN NOT NULL DEFAULT FALSE,
  raw_event_id VARCHAR(128),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS participants (
  participant_id VARCHAR(128) PRIMARY KEY,
  group_id VARCHAR(64) NOT NULL,
  payment_id VARCHAR(64) NOT NULL,
  number VARCHAR(32) NOT NULL,
  sequence_number INT NOT NULL,
  name VARCHAR(255) NOT NULL,
  cpf VARCHAR(32) NOT NULL,
  email VARCHAR(255) NOT NULL,
  phone VARCHAR(32) NOT NULL,
  shares_count INT NOT NULL DEFAULT 1,
  weight INT NOT NULL DEFAULT 1,
  keyword_used VARCHAR(64),
  bonus_shares INT NOT NULL DEFAULT 0,
  total_shares INT NOT NULL DEFAULT 1,
  entry_value_cents INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  confirmed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS draws (
  draw_id VARCHAR(128) PRIMARY KEY,
  group_id VARCHAR(64) NOT NULL,
  group_name VARCHAR(255),
  prize_amount_cents INT NOT NULL DEFAULT 0,
  status VARCHAR(32) NOT NULL DEFAULT 'COMPLETED',
  participants_count INT NOT NULL,
  eligible_participants INT,
  participants_list_hash VARCHAR(64) NOT NULL,
  closed_at TIMESTAMPTZ NOT NULL,
  drawn_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ,
  created_by VARCHAR(64) DEFAULT 'ADMIN',
  algorithm_version VARCHAR(64) NOT NULL,
  randomness_seed VARCHAR(128) NOT NULL,
  randomness_method VARCHAR(128) NOT NULL,
  winning_number VARCHAR(32) NOT NULL,
  winning_participant_id VARCHAR(128) NOT NULL,
  winner_name VARCHAR(255) NOT NULL,
  winner_phone VARCHAR(32),
  winner_phone_masked VARCHAR(32),
  winner_masked_cpf VARCHAR(32) NOT NULL,
  result_hash VARCHAR(64),
  is_immutable BOOLEAN NOT NULL DEFAULT TRUE,
  public_verification_code VARCHAR(32) NOT NULL
);

CREATE TABLE IF NOT EXISTS processed_webhooks (
  raw_event_id VARCHAR(128) PRIMARY KEY,
  payment_id VARCHAR(64) NOT NULL,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_logs (
  event_id VARCHAR(128) PRIMARY KEY,
  type VARCHAR(64) NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actor VARCHAR(64) NOT NULL,
  group_id VARCHAR(64),
  participant_id VARCHAR(128),
  payment_id VARCHAR(64),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

-- Índices de alta performance para busca e concorrência
CREATE INDEX IF NOT EXISTS idx_participants_group ON participants(group_id);
CREATE INDEX IF NOT EXISTS idx_participants_cpf ON participants(cpf);
CREATE INDEX IF NOT EXISTS idx_payments_gateway_tx ON payments(gateway_transaction_id);
CREATE INDEX IF NOT EXISTS idx_payments_group ON payments(group_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp DESC);
