import { useState } from "react";
import { Link } from "react-router-dom";
import { Sparkles, MessageCircle, BookOpen, UserPlus, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import AISearchChat from "@/components/mural/AISearchChat";

export interface AIAssistantWidgetProps {
  onResult: (companyIds: string[], influencerIds: string[], rationale: string) => void;
  companyId?: string | null;
  companyName?: string | null;
  /** Posição do botão: padrão bottom-right. */
  className?: string;
}

export default function AIAssistantWidget({
  onResult,
  companyId = null,
  companyName = null,
  className = "fixed bottom-6 right-6 z-50",
}: AIAssistantWidgetProps) {
  const [aiChatOpen, setAiChatOpen] = useState(false);
  const [aiRecommendPartner, setAiRecommendPartner] = useState(false);

  return (
    <>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className={`rounded-full h-12 w-12 bg-card/90 border-primary/30 shadow-lg hover:bg-primary/20 ${className}`}
            title="IA e Suporte"
          >
            <Sparkles className="w-5 h-5 text-primary" />
          </Button>
        </PopoverTrigger>
        <PopoverContent side="top" align="end" sideOffset={8} className="w-64 rounded-xl border-border bg-card shadow-xl">
          <p className="text-xs font-medium text-muted-foreground mb-3">Atalhos da IA</p>
          <div className="flex flex-col gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="justify-start gap-2"
              onClick={() => {
                setAiRecommendPartner(false);
                setAiChatOpen(true);
              }}
            >
              <MessageCircle className="w-4 h-4 text-primary" />
              Busca por IA / Encontre um influenciador
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="justify-start gap-2"
              onClick={() => {
                setAiRecommendPartner(true);
                setAiChatOpen(true);
              }}
            >
              <UserPlus className="w-4 h-4 text-primary" />
              Recomende um parceiro para minha marca
            </Button>
            <Link to="/guia#blocos">
              <Button variant="ghost" size="sm" className="w-full justify-start gap-2">
                <BookOpen className="w-4 h-4 text-primary" />
                Como comprar blocos?
              </Button>
            </Link>
            <a href="mailto:brotherscapitalut@gmail.com" rel="noopener noreferrer">
              <Button variant="ghost" size="sm" className="w-full justify-start gap-2">
                <HelpCircle className="w-4 h-4 text-primary" />
                Falar com suporte real
              </Button>
            </a>
          </div>
        </PopoverContent>
      </Popover>

      <AISearchChat
        open={aiChatOpen}
        onClose={() => {
          setAiChatOpen(false);
          setAiRecommendPartner(false);
        }}
        onResult={onResult}
        initialRecommendPartner={aiRecommendPartner}
        companyId={companyId}
        companyName={companyName}
      />
    </>
  );
}
