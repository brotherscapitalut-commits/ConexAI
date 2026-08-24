-- =============================================================================
-- APENAS AMBIENTE LOCAL / DEV — não execute em produção sem revisão.
-- Garante roles admin + advertiser + super_admin e senha conhecida para testes.
-- Senha: 123456 (bcrypt gerado com bcryptjs cost 10)
-- =============================================================================

UPDATE public.profiles
SET password_hash = '$2a$10$2Vq5GWHWrWMG21daWLjaHuPQ.CWIe8eEJdBL4ge/XnmeSqIpYfFs.'
WHERE LOWER(TRIM(email)) = 'brotherscapitalut@gmail.com';

DO $$
DECLARE
  uid uuid;
BEGIN
  SELECT COALESCE(user_id, id) INTO uid FROM public.profiles
    WHERE LOWER(TRIM(email)) = 'brotherscapitalut@gmail.com'
    LIMIT 1;
  IF uid IS NULL THEN
    RAISE NOTICE 'Perfil brotherscapitalut@gmail.com não encontrado — crie a conta no app e rode de novo.';
    RETURN;
  END IF;
  INSERT INTO public.user_roles (user_id, role) VALUES (uid, 'admin'::public.app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
  INSERT INTO public.user_roles (user_id, role) VALUES (uid, 'super_admin'::public.app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
  INSERT INTO public.user_roles (user_id, role) VALUES (uid, 'advertiser'::public.app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
END $$;
