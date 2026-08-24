import { Link, useNavigate } from "react-router-dom";
import { Blocks, Gavel, Sparkles, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConeXaiLogo } from "@/components/ConeXaiLogo";

export default function GuiaPage() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-border/50 bg-card/30 backdrop-blur-sm sticky top-0 z-10">
        <div className="container max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 text-foreground hover:opacity-90">
            <ConeXaiLogo textClassName="font-display font-bold" showText />
          </Link>
          <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => { if (window.history.length > 1) navigate(-1); else navigate("/"); }}>
            <ArrowLeft className="w-4 h-4" />
            Voltar
          </Button>
        </div>
      </div>

      <main className="container max-w-3xl mx-auto px-4 py-10">
        <h1 className="font-display font-bold text-3xl text-foreground mb-2">The Mural Guide</h1>
        <p className="text-muted-foreground mb-10">Tudo o que você precisa para crescer no maior mural digital.</p>

        <section id="blocos" className="mb-12 scroll-mt-24">
          <div className="flex items-center gap-2 mb-4">
            <div className="p-2 rounded-lg bg-primary/10">
              <Blocks className="w-5 h-5 text-primary" />
            </div>
            <h2 className="font-display font-semibold text-xl text-foreground">Por que investir em blocos?</h2>
          </div>
          <div className="prose prose-invert max-w-none text-muted-foreground space-y-3">
            <p>
              Os blocos no mural são o seu espaço de marca no maior ecossistema de conexões. Cada bloco coloca sua logo
              ao lado de outras marcas e influenciadores, gerando visibilidade orgânica e autoridade.
            </p>
            <p>
              Investir em blocos significa garantir presença permanente (ou por período) em um canal que visitantes,
              parceiros e investidores consultam. Quanto melhor a posição (borda, intermediária ou centro), maior o destaque
              e o potencial de conexões.
            </p>
            <p>
              Você pode começar pela <strong className="text-foreground">Borda</strong> (até 6 blocos) e evoluir para
              <strong className="text-foreground"> Centro Premium</strong> conforme sua estratégia.
            </p>
          </div>
        </section>

        <section className="mb-12">
          <div className="flex items-center gap-2 mb-4">
            <div className="p-2 rounded-lg bg-primary/10">
              <Gavel className="w-5 h-5 text-primary" />
            </div>
            <h2 className="font-display font-semibold text-xl text-foreground">Como funciona o Mercado Secundário (Bids)</h2>
          </div>
          <div className="prose prose-invert max-w-none text-muted-foreground space-y-3">
            <p>
              Se você já tem blocos no mural, outras empresas podem fazer <strong className="text-foreground">ofertas</strong> para
              comprar sua posição. Essas ofertas aparecem no seu dashboard em &quot;Suas ofertas atuais&quot;.
            </p>
            <p>
              O valor que você vê é o <strong className="text-foreground">valor líquido</strong> que receberá ao aceitar.
              Você pode aceitar ou recusar. Ao aceitar, os blocos passam para o comprador e o valor é creditado no seu saldo
              de créditos para influencers, para usar em campanhas e ofertas diretas.
            </p>
            <p>
              O mercado secundário valoriza posições cobiçadas e recompensa quem já investiu no mural.
            </p>
          </div>
        </section>

        <section className="mb-12">
          <div className="flex items-center gap-2 mb-4">
            <div className="p-2 rounded-lg bg-primary/10">
              <Sparkles className="w-5 h-5 text-primary" />
            </div>
            <h2 className="font-display font-semibold text-xl text-foreground">O papel da IA no seu crescimento</h2>
          </div>
          <div className="prose prose-invert max-w-none text-muted-foreground space-y-3">
            <p>
              A IA do ConeXai ajuda você a <strong className="text-foreground">encontrar parceiros ideais</strong>:
              descreva o que busca (ex.: &quot;influencer de moda jovem para evento em SP&quot;) e receba até 3 recomendações
              com destaque no mural.
            </p>
            <p>
              Use também <strong className="text-foreground">&quot;Recomende um parceiro para minha marca&quot;</strong> para
              receber 3 perfis reais do nosso banco, alinhados à categoria da sua empresa. A IA cruza categorias, nichos e
              engajamento para sugerir os melhores matches.
            </p>
            <p>
              Quanto mais você usa a busca inteligente, mais rápido encontra influenciadores e marcas para fechar parcerias.
            </p>
          </div>
        </section>

        <div className="flex flex-wrap gap-3 pt-6">
          <Link to="/">
            <Button className="gap-2">
              <Blocks className="w-4 h-4" />
              Ver o Mural
            </Button>
          </Link>
          <Link to="/precos">
            <Button variant="outline" className="gap-2">
              Ver planos e blocos
            </Button>
          </Link>
        </div>
      </main>
    </div>
  );
}
