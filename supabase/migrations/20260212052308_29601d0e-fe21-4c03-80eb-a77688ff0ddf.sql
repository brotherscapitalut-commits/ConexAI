
-- CRM Lead status enum
CREATE TYPE public.crm_lead_status AS ENUM ('lead', 'contato', 'negociacao', 'proposta', 'cliente', 'perdido');

-- CRM Leads table
CREATE TABLE public.crm_leads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  
  -- Contact info
  company_name TEXT NOT NULL,
  contact_name TEXT,
  email TEXT,
  phone TEXT,
  whatsapp TEXT,
  website TEXT,
  
  -- Address
  address TEXT,
  city TEXT,
  state TEXT,
  zip_code TEXT,
  country TEXT DEFAULT 'BR',
  
  -- Commercial
  cnpj TEXT,
  business_sector TEXT,
  company_size TEXT, -- micro, pequena, media, grande
  estimated_revenue TEXT,
  employee_count INTEGER,
  lead_source TEXT, -- mural, indicacao, site, cold_call, evento, etc.
  
  -- Funnel
  status crm_lead_status NOT NULL DEFAULT 'lead',
  
  -- Notes
  notes TEXT,
  tags TEXT[],
  
  -- Link to mural company (optional)
  linked_company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  
  -- Admin who created/owns this lead
  created_by UUID NOT NULL,
  assigned_to UUID,
  
  -- Timestamps
  last_interaction_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- CRM Interactions / Activity log
CREATE TABLE public.crm_interactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID NOT NULL REFERENCES public.crm_leads(id) ON DELETE CASCADE,
  
  interaction_type TEXT NOT NULL DEFAULT 'note', -- note, call, email, meeting, whatsapp, proposal
  description TEXT NOT NULL,
  
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.crm_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_interactions ENABLE ROW LEVEL SECURITY;

-- Only admins can access CRM
CREATE POLICY "Admins can do everything on crm_leads"
  ON public.crm_leads FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can do everything on crm_interactions"
  ON public.crm_interactions FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Indexes
CREATE INDEX idx_crm_leads_status ON public.crm_leads(status);
CREATE INDEX idx_crm_leads_sector ON public.crm_leads(business_sector);
CREATE INDEX idx_crm_leads_city ON public.crm_leads(city);
CREATE INDEX idx_crm_interactions_lead ON public.crm_interactions(lead_id);

-- Updated_at trigger
CREATE TRIGGER update_crm_leads_updated_at
  BEFORE UPDATE ON public.crm_leads
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
