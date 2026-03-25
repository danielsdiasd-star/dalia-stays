-- ================================================
-- SCHEMA DÁLIA STAYS - FASE 2: AUTH + RLS REAL
-- ================================================

-- Adicionar coluna user_id na tabela proprietarios
ALTER TABLE proprietarios ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);

-- Remover policies permissivas da Fase 1
DROP POLICY IF EXISTS "Enable all for service role" ON proprietarios;
DROP POLICY IF EXISTS "Enable all for service role" ON imoveis;
DROP POLICY IF EXISTS "Enable all for service role" ON reservas;
DROP POLICY IF EXISTS "Enable all for service role" ON financeiro;
DROP POLICY IF EXISTS "Enable all for service role" ON relatorios_mensais;
DROP POLICY IF EXISTS "Enable all for service role" ON manutencoes;

DROP POLICY IF EXISTS "Leitura publica" ON proprietarios;
DROP POLICY IF EXISTS "Leitura publica" ON imoveis;
DROP POLICY IF EXISTS "Leitura publica" ON reservas;
DROP POLICY IF EXISTS "Leitura publica" ON financeiro;
DROP POLICY IF EXISTS "Leitura publica" ON relatorios_mensais;
DROP POLICY IF EXISTS "Leitura publica" ON manutencoes;

-- ================================================
-- POLICIES MULTI-TENANT REAIS
-- ================================================

-- Proprietarios: cada um vê só o próprio perfil
CREATE POLICY "Proprietario ve proprio perfil" ON proprietarios
  FOR SELECT USING (auth.uid() = user_id);

-- Imóveis: proprietário vê só os seus
CREATE POLICY "Proprietario ve proprios imoveis" ON imoveis
  FOR SELECT USING (
    proprietario_id IN (
      SELECT id FROM proprietarios WHERE user_id = auth.uid()
    )
  );

-- Reservas: proprietário vê só as suas
CREATE POLICY "Proprietario ve proprias reservas" ON reservas
  FOR SELECT USING (
    proprietario_id IN (
      SELECT id FROM proprietarios WHERE user_id = auth.uid()
    )
  );

-- Financeiro
CREATE POLICY "Proprietario ve proprio financeiro" ON financeiro
  FOR SELECT USING (
    proprietario_id IN (
      SELECT id FROM proprietarios WHERE user_id = auth.uid()
    )
  );

-- Relatórios
CREATE POLICY "Proprietario ve proprios relatorios" ON relatorios_mensais
  FOR SELECT USING (
    proprietario_id IN (
      SELECT id FROM proprietarios WHERE user_id = auth.uid()
    )
  );

-- Manutenções
CREATE POLICY "Proprietario ve proprias manutencoes" ON manutencoes
  FOR SELECT USING (
    proprietario_id IN (
      SELECT id FROM proprietarios WHERE user_id = auth.uid()
    )
  );

-- ================================================
-- INSTRUÇÃO PARA USUÁRIOS DEMO
-- ================================================
-- 1. Acesse: Supabase Dashboard > Authentication > Users > Add user
-- 2. Crie os 3 usuários com "Auto Confirm User" ativado:
--    carlos@demo.daliastays.com / Demo@2026!
--    ana@demo.daliastays.com    / Demo@2026!
--    roberto@demo.daliastays.com / Demo@2026!
--
-- 3. Após criar, copie os UUIDs gerados e execute:
-- UPDATE proprietarios SET user_id = 'UUID_CARLOS'   WHERE email = 'carlos@demo.daliastays.com';
-- UPDATE proprietarios SET user_id = 'UUID_ANA'      WHERE email = 'ana@demo.daliastays.com';
-- UPDATE proprietarios SET user_id = 'UUID_ROBERTO'  WHERE email = 'roberto@demo.daliastays.com';
