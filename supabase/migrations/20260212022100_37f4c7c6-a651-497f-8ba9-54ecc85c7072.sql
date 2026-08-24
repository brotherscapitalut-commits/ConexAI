
-- Add waitlist approval status to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_approved boolean NOT NULL DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS waitlist_position integer;

-- Create a function to auto-assign waitlist position
CREATE OR REPLACE FUNCTION public.assign_waitlist_position()
RETURNS TRIGGER AS $$
BEGIN
  NEW.waitlist_position := (SELECT COALESCE(MAX(waitlist_position), 0) + 1 FROM public.profiles);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Trigger to auto-assign position on insert
CREATE TRIGGER assign_waitlist_position_trigger
BEFORE INSERT ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.assign_waitlist_position();
