# MuralDigital — Pronto para Lançamento

Resumo da preparação para o lançamento oficial: página legal, schema, proteção de admin e estado das tabelas de produção.

---

## 1. Página Legal (/termos)

- **Rota:** `/termos`
- **Componente:** `src/pages/TermosPage.tsx`
- **Conteúdo:**
  - **Termos de Uso:** aceite do uso da plataforma, **regra de comissão de 30%** da MuralDigital sobre transações (bids, campanhas, etc.), **responsabilidade das marcas** sobre o conteúdo (logos, textos, links), uso aceitável e alterações dos termos.
  - **Política de Privacidade:** dados coletados, finalidade (incluindo aplicação da comissão e processamento de pagamentos), compartilhamento e direitos do usuário.
- **Navegação:** link “Voltar” no topo e no fim da página para a home.

---

## 2. Schema do Banco — Pagamentos e Status (Stripe)

### 2.1 Tabela `payments`

- **Campo `status`:** `text NOT NULL DEFAULT 'pending'`.
- **Constraint adicionada (em `scripts/admin_suite_tables.sql`):**
  ```sql
  CHECK (status IN ('pending', 'completed', 'failed', 'cancelled', 'refunded'))
  ```
- **Uso:** pronto para webhooks do Stripe que atualizam o pagamento para `completed` ou `failed`; `cancelled` e `refunded` para cancelamentos e reembolsos.

### 2.2 Tabela `platform_finances`

- Já possui `status` com `CHECK (status IN ('pending', 'completed', 'cancelled', 'refunded'))`.
- Usada para receita da plataforma (taxas); pode ser alimentada pelas mesmas notificações de pagamento quando aplicável.

### 2.3 “Transactions” e “Wallet”

- Não existe tabela com nome `transactions`; o fluxo de pagamento está em **`payments`** (compras de blocos, Stripe).
- “Wallet” / saldo de influenciador está em **`profiles.withdrawable_balance`** e movimentações em **`withdrawal_requests`** e **`partnership_proposals`** (status `paid`), além de **`platform_finances`** para a parte da plataforma.
- Para notificações reais do Stripe: atualizar **`payments.status`** para `completed` ou `failed` conforme o evento (ex.: `checkout.session.completed` / `payment_intent.payment_failed`).

---

## 3. Proteção de Admin (SUPER_ADMIN)

- **E-mail master:** `brotherscapitalut@gmail.com`
- **No código:**
  - **AdminMasterGuard** e **AdminQuickJump** continuam validando esse e-mail para acesso ao painel master e ao menu Admin Quick Jump.
- **No banco:**
  - **Enum `app_role`:** adicionado o valor `'super_admin'` em `scripts/admin_suite_tables.sql`.
  - **Tabela `user_roles`:** o perfil desse e-mail deve ter a role `super_admin` para que a base “identifique” o administrador master.
  - **Script:** `scripts/seed_super_admin.sql` insere em `user_roles` a role `super_admin` para o perfil com e-mail `brotherscapitalut@gmail.com`.
- **Como aplicar:** após rodar `admin_suite_tables.sql`, executar `scripts/seed_super_admin.sql` (uma vez, ou após criar o perfil desse usuário). Assim a tabela de usuários/roles identifica corretamente o SUPER_ADMIN e o acesso ao painel master e ao Admin Quick Jump fica alinhado ao e-mail e à base.

---

## 4. Tabelas Prontas para Produção

Resumo das tabelas principais e uso em produção:

| Tabela | Uso em produção | Status / observação |
|--------|----------------------------------|----------------------|
| **influencers** | Perfis de influenciadores, categorias, moderação, redes | `moderation_status`; `public_username` para SEO. Pronta. |
| **companies** | Empresas, saldo de créditos, logo, cor | `influencer_credits_balance`; blocos e bids vinculados. Pronta. |
| **blocks** | Blocos do mural (x, y, empresa, região) | `status`: free/occupied; validação de ocupação no backend. Pronta. |
| **position_bids** | Ofertas por posição (lances no mural) | `status`: pending, accepted, rejected. Pronta. |
| **payments** | Pagamentos Stripe (blocos, assinaturas) | `status`: pending, completed, failed, cancelled, refunded (CHECK aplicado). Pronta para webhooks. |
| **partnership_proposals** | Propostas empresa–influenciador | Status e liberação de pagamento. Pronta. |
| **withdrawal_requests** | Saques de influenciadores | Status e aprovação no admin. Pronta. |
| **platform_finances** | Receita da plataforma (taxas) | Status e valores. Pronta. |
| **profiles** | Usuários, saldo sacável, roles | `withdrawable_balance`, `referral_code`. Pronta. |
| **user_roles** | Roles (admin, advertiser, user, **super_admin**) | Enum atualizado; seed para SUPER_ADMIN. Pronta após seed. |

Não há tabela separada “transactions”; o fluxo de transações de pagamento está em **payments** e, quando aplicável, em **platform_finances** e movimentações de saldo em **profiles** e **withdrawal_requests**.

---

## 5. Checklist Pré-Lançamento

- [x] Página legal `/termos` (Termos de Uso + Política de Privacidade) com comissão 30% e responsabilidade sobre conteúdo.
- [x] `payments.status` com CHECK para pending, completed, failed, cancelled, refunded (Stripe).
- [x] Enum `app_role` com `super_admin`; script `seed_super_admin.sql` para identificar brotherscapitalut@gmail.com na base.
- [x] Acesso admin (painel master e Admin Quick Jump) garantido por e-mail no código e, na base, por `user_roles` (após seed).
- [x] Tabelas influencers, companies, blocks, position_bids, payments (e demais listadas) revisadas e prontas para receber dados de produção.

---

**Conclusão:** Com a aplicação de `admin_suite_tables.sql` e, em seguida, `scripts/seed_super_admin.sql`, o schema e a identificação do SUPER_ADMIN ficam prontos para o lançamento. A página `/termos` está publicada e as tabelas de pagamentos e roles estão preparadas para uso em produção amanhã.
