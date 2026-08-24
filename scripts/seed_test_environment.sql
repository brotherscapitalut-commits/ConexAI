-- =============================================================================
-- Ambiente de teste real: Empresa Teste ConexAi + Influencer Teste
-- Permite testar fluxo de propostas com UUIDs válidos no banco local.
-- Executar: psql "postgresql://USER:PASS@localhost:5432/DB" -f scripts/seed_test_environment.sql
-- =============================================================================

DO $$
DECLARE
  v_owner_id uuid;
  v_company_id uuid;
  v_exists_company boolean;
  v_exists_influencer boolean;
BEGIN
  -- Usar admin (brotherescapitalut@gamil.com / gmail) ou primeiro perfil disponível.
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'email') THEN
    SELECT id INTO v_owner_id FROM public.profiles WHERE LOWER(TRIM(email)) IN (
      'brotherescapitalut@gamil.com',
      'brotherescapitalut@gmail.com',
      'brotherscapitalut@gmail.com'
    ) ORDER BY created_at ASC LIMIT 1;
  END IF;
  IF v_owner_id IS NULL THEN
    SELECT id INTO v_owner_id FROM public.profiles ORDER BY created_at ASC LIMIT 1;
  END IF;
  IF v_owner_id IS NULL THEN
    RAISE NOTICE 'Nenhum perfil encontrado. Crie um usuário (ex: login com brotherscapitalut@gmail.com) antes de rodar este seed.';
    RETURN;
  END IF;

  -- Evitar duplicar empresa de teste
  SELECT EXISTS (
    SELECT 1 FROM public.companies WHERE name = 'Empresa Teste ConexAi' LIMIT 1
  ) INTO v_exists_company;
  IF NOT v_exists_company THEN
    INSERT INTO public.companies (
      id, owner_id, name, website, category, logo_initials, color,
      moderation_status, contact_email, contact_whatsapp
    ) VALUES (
      gen_random_uuid(),
      v_owner_id,
      'Empresa Teste ConexAi',
      'https://conexai.com.br',
      'Tecnologia',
      'ET',
      '#00d4ff',
      'approved',
      'contato@conexai.com.br',
      NULL
    )
    RETURNING id INTO v_company_id;

    -- Um bloco ocupado para a empresa aparecer no mural (coordenada 0,0; se já ocupada, usa 1,0)
    INSERT INTO public.blocks (x, y, company_id, region, status)
    VALUES (0, 0, v_company_id, 'borda', 'occupied')
    ON CONFLICT (x, y) DO UPDATE SET
      company_id = EXCLUDED.company_id,
      region = EXCLUDED.region,
      status = 'occupied';

    RAISE NOTICE 'Empresa Teste ConexAi criada (id: %) com 1 bloco no mural.', v_company_id;
  ELSE
    RAISE NOTICE 'Empresa Teste ConexAi já existe; nada a fazer.';
  END IF;

  -- Influencer Teste (vinculado ao mesmo admin)
  SELECT EXISTS (
    SELECT 1 FROM public.influencers WHERE name = 'Influencer Teste' AND owner_id = v_owner_id LIMIT 1
  ) INTO v_exists_influencer;
  IF NOT v_exists_influencer THEN
    INSERT INTO public.influencers (
      owner_id, name, category, logo_initials, color, moderation_status, bio
    ) VALUES (
      v_owner_id,
      'Influencer Teste',
      'Lifestyle',
      'IT',
      '#8b5cf6',
      'approved',
      'Perfil de teste para validar propostas no Painel Master.'
    );
    RAISE NOTICE 'Influencer Teste criado e vinculado ao admin.';
  ELSE
    RAISE NOTICE 'Influencer Teste já existe; nada a fazer.';
  END IF;
END $$;
