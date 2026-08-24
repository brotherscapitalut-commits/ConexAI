-- =============================================================================
-- Utilizador de teste: brotherscapitalut@gmail.com (senha: definir no Supabase Auth)
-- Execute no SQL Editor após criar a conta em Authentication > Users (ou sign-up no app).
-- Atribui: admin + advertiser, empresa aprovada com bloco no mural, influencer aprovado.
-- =============================================================================

DO $$
DECLARE
  uid uuid;
  cid uuid;
BEGIN
  SELECT id INTO uid FROM auth.users WHERE lower(trim(email)) = 'brotherscapitalut@gmail.com' LIMIT 1;

  IF uid IS NULL THEN
    RAISE NOTICE 'Crie primeiro o utilizador brotherscapitalut@gmail.com em Authentication (ou /auth). Depois volte a executar este script.';
    RETURN;
  END IF;

  INSERT INTO public.profiles (user_id, display_name, profile_type, is_approved)
  VALUES (uid, 'Brothers Capital UT', 'company', true)
  ON CONFLICT (user_id) DO UPDATE SET
    display_name = COALESCE(NULLIF(public.profiles.display_name, ''), EXCLUDED.display_name),
    is_approved = true,
    profile_type = COALESCE(NULLIF(public.profiles.profile_type, ''), 'company');

  INSERT INTO public.user_roles (user_id, role) VALUES (uid, 'admin'::public.app_role)
  ON CONFLICT (user_id, role) DO NOTHING;
  INSERT INTO public.user_roles (user_id, role) VALUES (uid, 'advertiser'::public.app_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  SELECT id INTO cid FROM public.companies WHERE owner_id = uid AND moderation_status = 'approved' LIMIT 1;

  IF cid IS NULL THEN
    INSERT INTO public.companies (
      owner_id, name, website, category, logo_initials, color,
      moderation_status, contact_email
    ) VALUES (
      uid,
      'Brothers Capital UT',
      'https://conexai.com.br',
      'Tecnologia',
      'BC',
      '#eab308',
      'approved',
      'brotherscapitalut@gmail.com'
    )
    RETURNING id INTO cid;
  END IF;

  IF cid IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.blocks WHERE company_id = cid LIMIT 1) THEN
    INSERT INTO public.blocks (x, y, company_id, region, status)
    VALUES (1, 0, cid, 'borda', 'occupied')
    ON CONFLICT (x, y) DO UPDATE SET
      company_id = EXCLUDED.company_id,
      region = EXCLUDED.region,
      status = 'occupied';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.influencers WHERE owner_id = uid LIMIT 1) THEN
    INSERT INTO public.influencers (
      owner_id, name, category, logo_initials, color, moderation_status, bio
    ) VALUES (
      uid,
      'Brothers Capital UT — Influencer',
      'Lifestyle',
      'BC',
      '#a855f7',
      'approved',
      'Perfil de influencer do mesmo utilizador (testes).'
    );
  END IF;

  RAISE NOTICE 'OK: brotherscapitalut@gmail.com — roles, empresa, bloco e influencer garantidos.';
END $$;
