import { Link, useNavigate } from "react-router-dom";
import { FileText, Shield, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConeXaiLogo } from "@/components/ConeXaiLogo";

export default function TermosPage() {
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

      <main className="container max-w-3xl mx-auto px-4 py-10 pb-20">
        <h1 className="font-display font-bold text-3xl text-foreground mb-2">Termos de Uso e Política de Privacidade</h1>
        <p className="text-muted-foreground mb-10">Última atualização: agosto de 2026.</p>

        <section className="mb-12 scroll-mt-24">
          <div className="flex items-center gap-2 mb-4">
            <div className="p-2 rounded-lg bg-primary/10">
              <FileText className="w-5 h-5 text-primary" />
            </div>
            <h2 className="font-display font-semibold text-xl text-foreground">Termos de Uso</h2>
          </div>
          <div className="prose prose-invert max-w-none text-muted-foreground space-y-4">
            <p>
              Ao utilizar a plataforma ConeXai (&quot;Plataforma&quot;), você concorda com estes Termos de Uso. A Plataforma
              conecta marcas e influenciadores por meio de um mural digital de blocos, ofertas de posição (bids) e campanhas.
            </p>

            <h3 className="font-display font-semibold text-foreground text-base mt-6">1. Planos e Assinatura de Blocos</h3>
            <p>
              A ocupação de blocos no mural segue um <strong className="text-foreground">modelo híbrido</strong>, composto
              por uma <strong className="text-foreground">assinatura base mensal</strong> (que remunera os serviços
              inclusos no plano) somada a uma <strong className="text-foreground">taxa mensal por bloco ocupado</strong>.
              Ambas são recorrentes e cobradas mensalmente.
            </p>
            <ul className="list-disc pl-5 space-y-2">
              <li>
                <strong className="text-foreground">Basic (Zona de Borda)</strong> — de 1 a 6 blocos. Assinatura base de
                US$ 9,99/mês mais US$ 2,50 por bloco/mês. Inclui dashboard, rastreamento de cliques e 1 artigo
                institucional por mês. Total de US$ 12,49 a US$ 24,99 por mês.
              </li>
              <li>
                <strong className="text-foreground">Standard (Zona Intermediária)</strong> — de 7 a 12 blocos. Assinatura
                base de US$ 20,99/mês mais US$ 3,50 por bloco/mês. Inclui badge de destaque e 2 artigos por mês. Total de
                US$ 45,49 a US$ 62,99 por mês.
              </li>
              <li>
                <strong className="text-foreground">Premium (Centro Nobre)</strong> — de 13 a 25 blocos. Assinatura base de
                US$ 49,99/mês mais US$ 5,00 por bloco/mês. Inclui badge &quot;Premium Center&quot;, animação especial,
                suporte prioritário, 4 artigos por mês e relatório de perfil. Total de US$ 114,99 a US$ 174,99 por mês.
              </li>
            </ul>
            <p>
              As faixas de blocos são <strong className="text-foreground">mínimos e máximos obrigatórios</strong> de cada
              plano: não é possível, por exemplo, contratar o plano Standard para menos de 7 blocos. A assinatura é
              renovada automaticamente a cada mês e pode ser cancelada a qualquer momento, permanecendo ativa até o fim do
              ciclo já pago. Não há fidelidade nem multa por cancelamento.
            </p>

            <h3 className="font-display font-semibold text-foreground text-base mt-6">2. Ofertas por Posição (Takeover)</h3>
            <p>
              Qualquer anunciante pode ofertar pela posição ocupada por outro. A{" "}
              <strong className="text-foreground">oferta mínima corresponde a 5 (cinco) vezes o valor pago</strong> pelo
              atual ocupante daquela posição. A transferência do bloco só ocorre mediante{" "}
              <strong className="text-foreground">aceite expresso do proprietário atual</strong>; enquanto não houver
              aceite, os valores permanecem retidos em custódia e são devolvidos integralmente ao ofertante caso a oferta
              seja recusada ou expire.
            </p>
            <p>
              Aceita a oferta, o valor pago pelo ofertante é repartido da seguinte forma:{" "}
              <strong className="text-foreground">70% (setenta por cento) destinados ao proprietário do bloco</strong> e{" "}
              <strong className="text-foreground">30% (trinta por cento) retidos pela Plataforma</strong> a título de
              intermediação, custódia e processamento. Em outras palavras:{" "}
              <strong className="text-foreground">
                sobre tudo o que um usuário pagar a outro para adquirir seu bloco, a Plataforma retém 30%
              </strong>
              . O ofertante paga o valor integral da oferta; o proprietário recebe o valor líquido, já descontada a
              participação da Plataforma.
            </p>
            <p>
              Exemplo: em uma oferta aceita de US$ 500,00, o proprietário do bloco recebe US$ 350,00 e a Plataforma retém
              US$ 150,00. A retenção de 30% é a mesma aplicada às campanhas, de modo que uma única regra de comissão vale
              para todas as negociações intermediadas.
            </p>

            <h3 className="font-display font-semibold text-foreground text-base mt-6">3. Comissão da Plataforma</h3>
            <p>
              A ConeXai aplica uma <strong className="text-foreground">taxa única de 30% (trinta por cento)</strong> sobre
              o valor de <strong className="text-foreground">todas</strong> as transações intermediadas na Plataforma,
              incluindo: ofertas por posição (bids) entre anunciantes, liberação de pagamentos de campanhas a
              influenciadores e demais operações financeiras realizadas por meio da Plataforma. Em qualquer caso, quem
              paga arca com o valor integral e quem recebe obtém 70% desse valor.
            </p>

            <h3 className="font-display font-semibold text-foreground text-base mt-6">4. Responsabilidade sobre o Conteúdo das Marcas</h3>
            <p>
              Cada anunciante ou marca é <strong className="text-foreground">exclusivamente responsável</strong> pelo conteúdo que
              publica no mural (logos, textos, links e quaisquer materiais). A ConeXai atua como intermediária e não se
              responsabiliza por violações de direitos de terceiros, conteúdo enganoso ou ilícito publicado pelos usuários. Ao
              publicar, você declara que detém os direitos necessários e que o conteúdo está em conformidade com a lei. A
              Plataforma reserva-se o direito de remover conteúdo que viole estes Termos ou a legislação aplicável.
            </p>

            <h3 className="font-display font-semibold text-foreground text-base mt-6">5. Uso Aceitável</h3>
            <p>
              É proibido usar a Plataforma para atividades ilegais, fraudes, spam ou para prejudicar outros usuários. O não
              cumprimento pode resultar em suspensão ou encerramento da conta, sem prejuízo de medidas legais.
            </p>

            <h3 className="font-display font-semibold text-foreground text-base mt-6">6. Alterações</h3>
            <p>
              A ConeXai pode atualizar estes Termos periodicamente. O uso continuado após a publicação de alterações
              constitui aceitação das novas condições. Em mudanças relevantes, poderemos notificar por e-mail ou aviso na Plataforma.
            </p>
          </div>
        </section>

        <section className="mb-12">
          <div className="flex items-center gap-2 mb-4">
            <div className="p-2 rounded-lg bg-primary/10">
              <Shield className="w-5 h-5 text-primary" />
            </div>
            <h2 className="font-display font-semibold text-xl text-foreground">Política de Privacidade</h2>
          </div>
          <div className="prose prose-invert max-w-none text-muted-foreground space-y-4">
            <p>
              Respeitamos sua privacidade. Esta política descreve como coletamos, usamos e protegemos seus dados na ConeXai.
            </p>

            <h3 className="font-display font-semibold text-foreground text-base mt-6">Dados que Coletamos</h3>
            <p>
              Coletamos dados fornecidos no cadastro (e-mail, nome, dados da empresa ou perfil de influenciador), dados de uso da
              Plataforma (acessos, interações com o mural, ofertas e campanhas) e dados de transação necessários ao processamento
              de pagamentos (em conformidade com os provedores de pagamento, como Stripe).
            </p>

            <h3 className="font-display font-semibold text-foreground text-base mt-6">Finalidade</h3>
            <p>
              Utilizamos os dados para operar a Plataforma, processar pagamentos (incluindo a aplicação da comissão de 30%),
              cumprir obrigações legais, melhorar nossos serviços e, quando autorizado, enviar comunicações sobre ofertas e
              novidades.
            </p>

            <h3 className="font-display font-semibold text-foreground text-base mt-6">Compartilhamento</h3>
            <p>
              Não vendemos seus dados pessoais. Podemos compartilhar dados com prestadores de serviço essenciais (hospedagem,
              pagamentos, e-mail) e quando exigido por lei. Dados públicos de perfil (nome, categoria, links) podem ser exibidos
              no mural e em perfis públicos conforme suas configurações.
            </p>

            <h3 className="font-display font-semibold text-foreground text-base mt-6">Seus Direitos</h3>
            <p>
              Você pode acessar, corrigir ou solicitar a exclusão dos seus dados pessoais, na medida permitida pela lei, entrando
              em contato conosco. Para dúvidas sobre privacidade ou estes termos, utilize o canal de suporte indicado na Plataforma.
            </p>
          </div>
        </section>

        <div className="pt-6 border-t border-border/50">
          <Link to="/">
            <Button variant="outline" className="gap-2">
              <ArrowLeft className="w-4 h-4" />
              Voltar ao início
            </Button>
          </Link>
        </div>
      </main>
    </div>
  );
}
