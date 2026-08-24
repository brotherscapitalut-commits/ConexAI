-- Atribui role super_admin ao perfil com e-mail brotherscapitalut@gmail.com.
-- Execute após aplicar admin_suite_tables.sql (para o enum app_role conter 'super_admin').
INSERT INTO public.user_roles (user_id, role)
  SELECT p.id, 'super_admin'::public.app_role
  FROM public.profiles p
  WHERE LOWER(TRIM(p.email)) = 'brotherscapitalut@gmail.com'
ON CONFLICT (user_id, role) DO NOTHING;
