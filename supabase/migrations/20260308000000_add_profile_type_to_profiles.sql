-- profile_type em profiles para redirecionamento pós-login (company | influencer)
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS profile_type text;

COMMENT ON COLUMN public.profiles.profile_type IS 'company ou influencer; usado no redirect pós-login.';

-- Atualizar trigger para preencher profile_type a partir de raw_user_meta_data
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _profile_type text := COALESCE(NEW.raw_user_meta_data->>'profile_type', 'company');
BEGIN
  INSERT INTO public.profiles (user_id, display_name, profile_type)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email), _profile_type);
  IF _profile_type = 'influencer' THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user');
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'advertiser');
  END IF;
  RETURN NEW;
END;
$$;
