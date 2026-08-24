-- =============================================================================
-- Super-admin de testes: brotherescapitalut@gamil.com (e variação gmail)
-- Após criar o usuário pelo /auth local, execute este script no Postgres.
-- Atribui: admin + empresa de teste no mural + influencer de teste (mesmo dono).
-- =============================================================================

DO $$
DECLARE
  v_owner_id uuid;
  v_company_id uuid;
BEGIN
  SELECT id INTO v_owner_id FROM public.profiles
    WHERE LOWER(TRIM(email)) IN (
      'brotherescapitalut@gamil.com',
      'brotherescapitalut@gmail.com',
      'brotherscapitalut@gmail.com'
    )
    ORDER BY created_at ASC LIMIT 1;

  IF v_owner_id IS NULL THEN
    RAISE NOTICE 'Nenhum perfil com e-mail brotherescapitalut@*. Crie a conta no app (auth) e rode de novo.';
    RETURN;
  END IF;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (v_owner_id, 'admin'::public.app_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (v_owner_id, 'super_admin'::public.app_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  IF NOT EXISTS (SELECT 1 FROM public.companies WHERE owner_id = v_owner_id AND moderation_status = 'approved' LIMIT 1) THEN
    INSERT INTO public.companies (
      id, owner_id, name, website, category, logo_initials, color,
      moderation_status, contact_email, contact_whatsapp
    ) VALUES (
      gen_random_uuid(),
      v_owner_id,
      'Marca Admin Teste',
      'https://conexai.com.br',
      'Tecnologia',
      'MA',
      '#eab308',
      'approved',
      'brotherescapitalut@gamil.com',
      NULL
    )
    RETURNING id INTO v_company_id;

    INSERT INTO public.blocks (x, y, company_id, region, status)
    VALUES (0, 0, v_company_id, 'borda', 'occupied')
    ON CONFLICT (x, y) DO UPDATE SET
      company_id = EXCLUDED.company_id,
      region = EXCLUDED.region,
      status = 'occupied';

    RAISE NOTICE 'Empresa de teste criada para o admin (id empresa: %).', v_company_id;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.influencers WHERE owner_id = v_owner_id LIMIT 1) THEN
    INSERT INTO public.influencers (
      owner_id, name, category, logo_initials, color, moderation_status, bio
    ) VALUES (
      v_owner_id,
      'Influencer Admin Teste',
      'Lifestyle',
      'IA',
      '#a855f7',
      'approved',
      'Perfil influencer do mesmo admin para testes.'
    );
    RAISE NOTICE 'Influencer de teste criado.';
  END IF;
END $$;
