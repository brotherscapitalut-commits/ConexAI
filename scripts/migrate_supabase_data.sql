-- =============================================================================
-- Estrutura para migração de dados (Supabase → PostgreSQL local)
-- =============================================================================
-- Use COPY ou INSERT para importar CSVs/dados. Exemplo de ordem e colunas.
-- Execute após rebuild_supabase_schema.sql e ajuste os caminhos dos CSVs.
-- =============================================================================

-- Ordem sugerida (respeitando FKs):
-- 1. profiles (id, user_id, email, password_hash, display_name, profile_type, ...)
-- 2. user_roles (user_id, role)
-- 3. companies (owner_id, name, website, category, ...)
-- 4. influencers (owner_id, name, category, ...)
-- 5. blocks, clicks, payments, interactions, etc.

-- Exemplo COPY (descomente e ajuste o caminho):
-- COPY public.profiles (id, user_id, email, password_hash, display_name, profile_type, is_approved, withdrawable_balance, reputation_score, created_at, updated_at)
-- FROM '/caminho/para/profiles.csv' WITH (FORMAT csv, HEADER true, DELIMITER ',');

-- Exemplo INSERT manual (dados de teste):
-- INSERT INTO public.profiles (email, password_hash, display_name, profile_type, is_approved)
-- VALUES ('admin@local.test', '$2a$10$...', 'Admin', 'company', true)
-- ON CONFLICT (email) DO NOTHING;

-- Tabelas que costumam ser populadas por export Supabase:
-- profiles, user_roles, companies, blocks, clicks, payments, influencers,
-- partnership_proposals, direct_offers, active_campaigns, campaign_applications,
-- favorite_influencers, position_bids, withdrawal_requests, system_profit
