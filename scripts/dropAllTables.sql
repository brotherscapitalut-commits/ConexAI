-- Remove todas as tabelas e tipos do public (e dados). Execute antes de rebuild_supabase_schema.sql

-- Políticas RLS (permite DROP TABLE)
DO $$ DECLARE r record;
BEGIN
  FOR r IN (SELECT schemaname, tablename FROM pg_tables WHERE schemaname = 'public')
  LOOP
    EXECUTE format('DROP TABLE IF EXISTS %I.%I CASCADE', r.schemaname, r.tablename);
  END LOOP;
END $$;

-- Tipos enum
DROP TYPE IF EXISTS public.crm_lead_status CASCADE;
DROP TYPE IF EXISTS public.moderation_status CASCADE;
DROP TYPE IF EXISTS public.mural_type CASCADE;
DROP TYPE IF EXISTS public.app_role CASCADE;
DROP TYPE IF EXISTS public.block_region CASCADE;
DROP TYPE IF EXISTS public.block_status CASCADE;

-- Funções que dependem dos tipos (opcional; CASCADE no tipo já limpa)
-- Nada mais necessário; auth.uid() fica no schema auth
