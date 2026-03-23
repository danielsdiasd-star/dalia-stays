-- ================================================
-- SCHEMA DÁLIA STAYS - FASE 1
-- ================================================

-- Habilitar extensões necessárias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ================================================
-- TABELA: proprietarios (tenants do SaaS)
-- ================================================
CREATE TABLE IF NOT EXISTS proprietarios (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nome TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  telefone TEXT,
  cpf_cnpj TEXT,
  cidade TEXT,
  estado TEXT,
  plano TEXT DEFAULT 'basico' CHECK (plano IN ('basico', 'profissional', 'premium')),
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ================================================
-- TABELA: imoveis
-- ================================================
CREATE TABLE IF NOT EXISTS imoveis (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  proprietario_id UUID NOT NULL REFERENCES proprietarios(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  tipo TEXT DEFAULT 'apartamento' CHECK (tipo IN ('apartamento', 'casa', 'studio', 'cobertura', 'chalé')),
  endereco TEXT,
  cidade TEXT NOT NULL,
  estado TEXT NOT NULL,
  cep TEXT,
  quartos INTEGER DEFAULT 1,
  banheiros INTEGER DEFAULT 1,
  capacidade INTEGER DEFAULT 2,
  diaria_base DECIMAL(10,2),
  taxa_limpeza DECIMAL(10,2) DEFAULT 0,
  ativo BOOLEAN DEFAULT true,
  plataformas TEXT[] DEFAULT ARRAY[]::TEXT[],
  airbnb_listing_id TEXT,
  booking_listing_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ================================================
-- TABELA: reservas
-- ================================================
CREATE TABLE IF NOT EXISTS reservas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  imovel_id UUID NOT NULL REFERENCES imoveis(id) ON DELETE CASCADE,
  proprietario_id UUID NOT NULL REFERENCES proprietarios(id),
  plataforma TEXT NOT NULL CHECK (plataforma IN ('airbnb', 'booking', 'vrbo', 'direto', 'outro')),
  codigo_reserva TEXT,
  nome_hospede TEXT NOT NULL,
  email_hospede TEXT,
  telefone_hospede TEXT,
  checkin DATE NOT NULL,
  checkout DATE NOT NULL,
  noites INTEGER GENERATED ALWAYS AS (checkout - checkin) STORED,
  valor_total DECIMAL(10,2) NOT NULL,
  valor_plataforma DECIMAL(10,2) DEFAULT 0,
  valor_limpeza DECIMAL(10,2) DEFAULT 0,
  valor_liquido DECIMAL(10,2),
  comissao_dalia DECIMAL(10,2) DEFAULT 0,
  repasse_proprietario DECIMAL(10,2) DEFAULT 0,
  status TEXT DEFAULT 'confirmada' CHECK (status IN ('confirmada', 'checkin_feito', 'checkout_feito', 'cancelada', 'pendente')),
  observacoes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ================================================
-- TABELA: financeiro (repasses e pagamentos)
-- ================================================
CREATE TABLE IF NOT EXISTS financeiro (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  proprietario_id UUID NOT NULL REFERENCES proprietarios(id),
  imovel_id UUID REFERENCES imoveis(id),
  reserva_id UUID REFERENCES reservas(id),
  tipo TEXT NOT NULL CHECK (tipo IN ('repasse', 'despesa', 'manutencao', 'taxa', 'ajuste')),
  descricao TEXT,
  valor DECIMAL(10,2) NOT NULL,
  data_lancamento DATE NOT NULL DEFAULT CURRENT_DATE,
  data_pagamento DATE,
  status TEXT DEFAULT 'pendente' CHECK (status IN ('pendente', 'pago', 'cancelado')),
  mes_referencia TEXT, -- formato: 'YYYY-MM'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ================================================
-- TABELA: relatorios_mensais (snapshots de performance)
-- ================================================
CREATE TABLE IF NOT EXISTS relatorios_mensais (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  proprietario_id UUID NOT NULL REFERENCES proprietarios(id),
  imovel_id UUID NOT NULL REFERENCES imoveis(id),
  mes_referencia TEXT NOT NULL, -- formato: 'YYYY-MM'
  total_reservas INTEGER DEFAULT 0,
  noites_ocupadas INTEGER DEFAULT 0,
  noites_disponiveis INTEGER DEFAULT 0,
  taxa_ocupacao DECIMAL(5,2) DEFAULT 0,
  receita_bruta DECIMAL(10,2) DEFAULT 0,
  adr DECIMAL(10,2) DEFAULT 0, -- Average Daily Rate
  revpar DECIMAL(10,2) DEFAULT 0, -- Revenue Per Available Room
  comissao_dalia DECIMAL(10,2) DEFAULT 0,
  despesas DECIMAL(10,2) DEFAULT 0,
  repasse_liquido DECIMAL(10,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(proprietario_id, imovel_id, mes_referencia)
);

-- ================================================
-- TABELA: manutencoes
-- ================================================
CREATE TABLE IF NOT EXISTS manutencoes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  imovel_id UUID NOT NULL REFERENCES imoveis(id),
  proprietario_id UUID NOT NULL REFERENCES proprietarios(id),
  titulo TEXT NOT NULL,
  descricao TEXT,
  tipo TEXT DEFAULT 'corretiva' CHECK (tipo IN ('corretiva', 'preventiva', 'melhoria')),
  status TEXT DEFAULT 'aberta' CHECK (status IN ('aberta', 'em_andamento', 'concluida', 'cancelada')),
  custo DECIMAL(10,2) DEFAULT 0,
  data_abertura DATE DEFAULT CURRENT_DATE,
  data_conclusao DATE,
  responsavel TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ================================================
-- ROW LEVEL SECURITY (RLS)
-- ================================================

ALTER TABLE proprietarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE imoveis ENABLE ROW LEVEL SECURITY;
ALTER TABLE reservas ENABLE ROW LEVEL SECURITY;
ALTER TABLE financeiro ENABLE ROW LEVEL SECURITY;
ALTER TABLE relatorios_mensais ENABLE ROW LEVEL SECURITY;
ALTER TABLE manutencoes ENABLE ROW LEVEL SECURITY;

-- Policies permissivas para fase inicial (auth será implementado na Fase 2)
CREATE POLICY "Enable all for service role" ON proprietarios FOR ALL USING (true);
CREATE POLICY "Enable all for service role" ON imoveis FOR ALL USING (true);
CREATE POLICY "Enable all for service role" ON reservas FOR ALL USING (true);
CREATE POLICY "Enable all for service role" ON financeiro FOR ALL USING (true);
CREATE POLICY "Enable all for service role" ON relatorios_mensais FOR ALL USING (true);
CREATE POLICY "Enable all for service role" ON manutencoes FOR ALL USING (true);

-- ================================================
-- DADOS SEED - proprietários demo da Dália Stays
-- ================================================

INSERT INTO proprietarios (id, nome, email, telefone, cidade, estado, plano) VALUES
  ('00000000-0000-0000-0000-000000000001', 'Carlos Eduardo Mendes', 'carlos@demo.daliastays.com', '(21) 99999-0001', 'Rio de Janeiro', 'RJ', 'profissional'),
  ('00000000-0000-0000-0000-000000000002', 'Ana Paula Rodrigues', 'ana@demo.daliastays.com', '(11) 99999-0002', 'São Paulo', 'SP', 'premium'),
  ('00000000-0000-0000-0000-000000000003', 'Roberto Silva', 'roberto@demo.daliastays.com', '(48) 99999-0003', 'Florianópolis', 'SC', 'basico')
ON CONFLICT (id) DO NOTHING;

INSERT INTO imoveis (id, proprietario_id, nome, tipo, cidade, estado, quartos, banheiros, capacidade, diaria_base, plataformas) VALUES
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'Apartamento Ipanema Vista Mar', 'apartamento', 'Rio de Janeiro', 'RJ', 2, 2, 4, 450.00, ARRAY['airbnb', 'booking']),
  ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'Studio Leblon Premium', 'studio', 'Rio de Janeiro', 'RJ', 1, 1, 2, 320.00, ARRAY['airbnb']),
  ('10000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000002', 'Cobertura Moema', 'cobertura', 'São Paulo', 'SP', 3, 3, 6, 680.00, ARRAY['airbnb', 'booking', 'vrbo']),
  ('10000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000003', 'Casa Jurerê Internacional', 'casa', 'Florianópolis', 'SC', 4, 3, 8, 890.00, ARRAY['airbnb', 'booking'])
ON CONFLICT (id) DO NOTHING;

-- Reservas dos últimos 3 meses (dados realistas)
INSERT INTO reservas (imovel_id, proprietario_id, plataforma, nome_hospede, checkin, checkout, valor_total, valor_liquido, comissao_dalia, repasse_proprietario, status) VALUES
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'airbnb', 'Marina Costa', '2026-01-05', '2026-01-10', 2250.00, 1912.50, 286.88, 1625.62, 'checkout_feito'),
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'booking', 'João Pedro Lima', '2026-01-15', '2026-01-20', 2250.00, 1912.50, 286.88, 1625.62, 'checkout_feito'),
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'airbnb', 'Fernanda Alves', '2026-02-01', '2026-02-07', 3150.00, 2677.50, 401.62, 2275.88, 'checkout_feito'),
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'airbnb', 'Ricardo Santos', '2026-02-14', '2026-02-18', 2100.00, 1785.00, 267.75, 1517.25, 'checkout_feito'),
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'booking', 'Lucia Martins', '2026-03-01', '2026-03-06', 2700.00, 2295.00, 344.25, 1950.75, 'confirmada'),
  ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'airbnb', 'Paulo Henrique', '2026-01-10', '2026-01-14', 1536.00, 1305.60, 195.84, 1109.76, 'checkout_feito'),
  ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'airbnb', 'Camila Torres', '2026-02-10', '2026-02-15', 1920.00, 1632.00, 244.80, 1387.20, 'checkout_feito'),
  ('10000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000002', 'airbnb', 'Bruno Oliveira', '2026-01-20', '2026-01-25', 4080.00, 3468.00, 520.20, 2947.80, 'checkout_feito'),
  ('10000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000003', 'booking', 'Mariana Souza', '2026-02-20', '2026-02-26', 6408.00, 5446.80, 817.02, 4629.78, 'checkout_feito');
