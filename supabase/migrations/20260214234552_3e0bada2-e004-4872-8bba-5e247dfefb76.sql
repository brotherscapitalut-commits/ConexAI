
-- Conversations table for tracking interactions between companies and influencers
CREATE TABLE public.conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  influencer_id uuid REFERENCES public.influencers(id) ON DELETE CASCADE,
  initiated_by uuid NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived', 'blocked')),
  last_message_at timestamptz DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(company_id, influencer_id)
);

-- Messages table
CREATE TABLE public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid REFERENCES public.conversations(id) ON DELETE CASCADE NOT NULL,
  sender_id uuid NOT NULL,
  content text NOT NULL,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Contact events table (tracks external contacts like WhatsApp/email clicks)
CREATE TABLE public.contact_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user_id uuid NOT NULL,
  to_company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL,
  to_influencer_id uuid REFERENCES public.influencers(id) ON DELETE SET NULL,
  contact_type text NOT NULL DEFAULT 'whatsapp' CHECK (contact_type IN ('whatsapp', 'email', 'instagram', 'tiktok', 'website')),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contact_events ENABLE ROW LEVEL SECURITY;

-- Helper function to check if user is part of conversation
CREATE OR REPLACE FUNCTION public.is_conversation_participant(_user_id uuid, _conversation_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.conversations c
    WHERE c.id = _conversation_id
    AND (
      EXISTS (SELECT 1 FROM public.companies WHERE id = c.company_id AND owner_id = _user_id)
      OR EXISTS (SELECT 1 FROM public.influencers WHERE id = c.influencer_id AND owner_id = _user_id)
      OR has_role(_user_id, 'admin')
    )
  )
$$;

-- Conversations RLS
CREATE POLICY "Users can view own conversations" ON public.conversations
FOR SELECT USING (
  is_conversation_participant(auth.uid(), id)
  OR has_role(auth.uid(), 'admin')
);

CREATE POLICY "Authenticated users can create conversations" ON public.conversations
FOR INSERT WITH CHECK (auth.uid() = initiated_by);

CREATE POLICY "Participants can update conversations" ON public.conversations
FOR UPDATE USING (is_conversation_participant(auth.uid(), id));

-- Messages RLS
CREATE POLICY "Participants can view messages" ON public.messages
FOR SELECT USING (is_conversation_participant(auth.uid(), conversation_id));

CREATE POLICY "Participants can send messages" ON public.messages
FOR INSERT WITH CHECK (
  auth.uid() = sender_id
  AND is_conversation_participant(auth.uid(), conversation_id)
);

-- Contact events RLS
CREATE POLICY "Users can log own contact events" ON public.contact_events
FOR INSERT WITH CHECK (auth.uid() = from_user_id);

CREATE POLICY "Admins and relevant users can view contact events" ON public.contact_events
FOR SELECT USING (
  auth.uid() = from_user_id
  OR has_role(auth.uid(), 'admin')
  OR (to_company_id IS NOT NULL AND is_company_owner(auth.uid(), to_company_id))
);

-- Triggers for updated_at
CREATE TRIGGER update_conversations_updated_at
BEFORE UPDATE ON public.conversations
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;
