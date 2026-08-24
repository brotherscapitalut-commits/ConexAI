# Relatório de Auditoria Técnica — MuralDigital

**Modo:** Consultor de Produto (PM)  
**Objetivo:** Prontidão para o mercado e visão de status, gaps, escalabilidade e segurança.

---

## 1. Status Atual — O que está 100% funcional

| Área | Status | Observações |
|------|--------|-------------|
| **Admin Financeiro** | ✅ Funcional | Dashboard de finanças com passivo circulante, receita líquida, transações (`platform_finances`), solicitações de saque (aprovar/negar), geração de resumo de faturamento. |
| **CRM (Admin Usuários)** | ✅ Funcional | Lista de anunciantes, saldo de créditos, data de cadastro, destaque de inatividade (>30 dias). Simulação de usuário ("Entrar como"), ajuste de saldo. |
| **Admin Influencers** | ✅ Funcional | Lista de influencers, status de verificação (Pendente/Verificado/Rejeitado), aprovar/banir, dossiê rápido com propostas e redes. |
| **Admin Sistema** | ✅ Funcional | Health check da API, log de requisições, gráfico de uptime/latência, console de erros (`system_health_logs`), contador de requisições de IA, modo manutenção, taxa de crescimento semanal. |
| **AI Lab** | ✅ Funcional | Sugestão de top 5 influencers por texto de campanha, histórico de buscas do mural. |
| **Sumário Executivo (Admin Master)** | ✅ Funcional | Visão consolidada + Top 10 Compradores e Top 10 Influencers. |
| **SEO** | ✅ Funcional | Rota pública `/p/[username]` com card de visitas do influencer (bio, categoria, botão "Contratar via MuralDigital"), título e meta description dinâmicos. |
| **Simulador de Marca** | ✅ Funcional | Grid 50×30, clique e arrasto, blocos ocupados (inventário em tempo real), fusão visual, preview proporcional, persistência pós-pagamento (`/api/blocks/purchase`), preço dinâmico por região, cursor seta e zoom 1.1x no arrasto. |
| **Painel de Ofertas (Bids)** | ✅ Funcional | "Suas ofertas atuais", valor líquido exibido (70%), sem menção a % da plataforma. Aceitar/recusar lances. |
| **Notificações (Sino)** | ✅ Funcional | Centro de notificações in-app, pop-up ao receber lance com valor líquido, e-mail (log no backend; integração SMTP opcional). |
| **Feed de Atividade** | ✅ Funcional | LiveStatusTicker com frases reais (24h) + mocks (50 nomes), sem repetição em sequência. |
| **Celebração** | ✅ Funcional | Confetti + som de sucesso no pós-compra; brilho (pulse) 10s no mural quando nova marca é publicada. |
| **Referral** | ✅ Funcional | Link de convite por perfil no dashboard. |
| **Modo Manutenção** | ✅ Funcional | Aviso "Sistema em Atualização" para todos exceto `brotherscapitalut@gmail.com`. |
| **Tour de Primeiro Acesso** | ✅ Funcional | Guia que destaca Simulador de Marca e Painel de Finanças; controle via `dashboard_tour_done` no localStorage. |

---

## 2. Gaps de Lançamento — O que falta para o "Dia 1"

| Gap | Prioridade | Ação sugerida |
|-----|------------|----------------|
| **Stripe em produção** | Alta | Trocar `create-payment` (Supabase Edge / mock) por fluxo real: Stripe Checkout ou Payment Element, webhooks para confirmar pagamento e liberar blocos. Garantir `STRIPE_*` em produção. |
| **Termos de Uso** | Alta | Página `/termos` (ou `/legal/termos`) com texto jurídico; link no footer e no fluxo de cadastro/checkout. |
| **Política de Privacidade** | Alta | Página `/privacidade` com LGPD/privacidade; link no footer e no cadastro. |
| **FAQ** | Média | Página `/faq` ou seção no site com perguntas frequentes (blocos, créditos, ofertas, saques). |
| **E-mail transacional** | Média | Nodemailer/SendGrid para notificação de lance recebido e confirmação de compra (hoje só log no servidor). |
| **Pagamento de blocos sem Stripe** | Alta | Se o checkout atual depender de Supabase Functions, implementar no backend Node (Express) a criação de sessão Stripe e o webhook de conclusão. |
| **Rate limiting** | Média | Limitar requisições por IP/usuário em endpoints sensíveis (auth, purchase, adjust-credits) para evitar abuso. |
| **Cookie/consent** | Baixa | Banner de cookies/consentimento se houver tracking ou analytics. |

---

## 3. Escalabilidade — 1 milhão de blocos?

**Resposta curta:** o desenho atual aguenta crescimento, mas precisa de ajustes para **1 milhão de blocos** e tráfego alto.

| Aspecto | Situação atual | Recomendações |
|---------|----------------|----------------|
| **Grid 50×30** | 1.500 células; modelo atual é fixo. | Para "1 milhão de blocos" seria um mural gigante (ou vários murais). Manter grid lógico (ex.: 50×30 por "mural") e escalar por **múltiplos murais** ou **zoom/tiles**. |
| **Banco de dados** | `blocks` com `(x, y)` únicos; índices em `(x,y)`, `company_id`, `status`. | Índices adequados para consultas por empresa e por status. Para milhões de linhas: particionar por `mural_id` ou região; considerar cache (Redis) para inventário "quente" (blocos ocupados). |
| **API de inventário** | `GET /api/mural-inventory` retorna todos os blocos ocupados. | Com 1M de blocos ocupados, paginar ou retornar por região/tile. Front pode pedir só a "janela" visível (ex.: coordenadas do viewport). |
| **Activity feed** | Últimas 24h, limit 25. | Mantém-se leve; aumentar janela ou limites conforme necessário. |
| **Frontend (canvas)** | Desenho de N marcas no mural. | Virtualização: desenhar só marcas na viewport; nível de zoom (LOD) para muitos blocos. |
| **Sessão / auth** | JWT em localStorage. | Para escala: refresh tokens, sessões server-side ou Supabase Auth em produção. |

**Conclusão:** para 1 milhão de **células** no mesmo mural, é essencial: (1) não carregar todo o inventário de uma vez; (2) consultas por região/tile e cache; (3) virtualização no canvas. O backend atual está preparado para dezenas de milhares de blocos com índices; acima disso, aplicar as otimizações acima.

---

## 4. Segurança — Riscos de manipulação

| Risco | Mitigação atual | Recomendações |
|-------|------------------|----------------|
| **Manipulação de saldo** | Ajuste de créditos (`POST /api/admin/adjust-credits`) protegido por `isMasterAdmin` (e-mail). Endpoints de compra e aceite de lance validam ownership. | Manter admin restrito a um ou poucos e-mails; auditoria (log) de alterações de saldo; 2FA para admin em produção. |
| **Coordenadas (blocos)** | `POST /api/blocks/purchase` verifica `company_id` pertencente ao `userId` (JWT). Apenas células livres são atualizadas (`ON CONFLICT ... WHERE status = 'free'`). | Validar no backend que `blocks` não excedem o limite do plano; revalidar após pagamento confirmado (webhook) antes de persistir. |
| **Impersonação** | "Entrar como usuário" só para admin; `admin_simulate_owner_id` no localStorage. | Considerar token de impersonação de curta duração e revogável no backend em vez de só localStorage. |
| **JWT** | Assinatura e `sub` (user id). | Usar segredo forte e expiração curta; refresh token para renovar. |
| **CORS** | Origens explícitas (localhost). | Em produção, restringir a domínios conhecidos; não usar `*` para credenciais. |
| **SQL injection** | Uso de parâmetros (`$1`, `$2`) com `pg`. | Manter padrão; evitar concatenação de SQL com input do usuário. |
| **Dados sensíveis** | Senhas com bcrypt; valor líquido (70%) não expõe regra de repasse no front. | Não logar senhas nem tokens; mascarar PII em logs. |

**Resumo:** Não há exposição direta de endpoints que permitam a um usuário comum alterar saldo ou coordenadas de outro. O maior cuidado é manter o admin (e-mail) e o fluxo de pagamento (webhook) sob controle e auditoria.

---

## 5. Checklist de Prontidão (Dia 1)

- [ ] Stripe em produção (checkout + webhook)
- [ ] Termos de Uso e Política de Privacidade publicados e linkados
- [ ] FAQ disponível
- [ ] E-mail de notificação de lance (e opcionalmente de compra) configurado
- [ ] Variáveis de produção (`.env`) seguras e CORS ajustado
- [ ] Tour e demais fluxos testados em staging
- [ ] Decisão de escala: um mural 50×30 ou múltiplos murais/tiles para crescimento futuro

---

*Relatório gerado no contexto da auditoria de experiência do usuário e prontidão para o mercado.*
