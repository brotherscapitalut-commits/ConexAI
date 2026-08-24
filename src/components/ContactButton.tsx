import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

interface ContactButtonProps {
  href: string;
  icon: React.ReactNode;
  label: string;
  contactType: string;
  companyId?: string;
  influencerId?: string;
  external?: boolean;
}

const ContactButton = ({ href, icon, label, contactType, companyId, influencerId, external = true }: ContactButtonProps) => {
  const [logging, setLogging] = useState(false);
  const { toast } = useToast();

  const handleClick = async (e: React.MouseEvent) => {
    // Don't prevent default - let the link work
    setLogging(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from("contact_events").insert({
          from_user_id: user.id,
          to_company_id: companyId || null,
          to_influencer_id: influencerId || null,
          contact_type: contactType,
        });
      }
    } catch {
      // Silent fail - don't block the contact action
    }
    setLogging(false);
  };

  return (
    <a
      href={href}
      target={external ? "_blank" : undefined}
      rel={external ? "noopener noreferrer" : undefined}
      onClick={handleClick}
    >
      <Button variant="outline" size="sm" className="gap-2">
        {icon} {label}
      </Button>
    </a>
  );
};

export default ContactButton;
