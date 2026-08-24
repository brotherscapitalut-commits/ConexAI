# PRE_FLIGHT_CHECK — Stress Test de Produção

**Data:** Pré-lançamento (atualizado pós-identidade ConeXai)  
**Objetivo:** Auditoria de código, edge cases, performance, Admin Quick Jump e identidade ConeXai.

---

## 0. Identidade ConeXai e Produção (Status: Concluído)

### 0.1 Atualização de Marca — ConeXai

| Item | Status | Detalhe |
|------|--------|---------|
| Nome "MuralDigital" → "ConeXai" em todo o site | **Concluído** | Header, Footer, Dashboards, Termos, E-mails, SEO, i18n. |
| Logo 4 blocos + texto "ConeXai" no Header | **Concluído** | Componente `ConeXaiLogo` com 4 blocos (2x2); bloco destacado com brilho pulsante AI (Sparkles). |
| Termos de Uso e Política de Privacidade | **Concluído** | Rota `/termos` publicada com conteúdo legal atualizado para ConeXai (30% comissão e responsabilidades). |
| E-mails transacionais | **Concluído** | Templates e assuntos em `server/emailTemplates.js` e `server/emailService.js` atualizados para ConeXai. |

### 0.2 UI Cósmica Ultra HD

| Item | Status | Detalhe |
|------|--------|---------|
| Poeira estelar (fundo roxo cósmico) no MuralGrid | **Concluído** | Sobreposição sutil com gradientes radiais roxo/violeta em `MuralGrid.tsx`. |
| Brilho neon tipo constelação nas marcas | **Concluído** | Drop-shadow e box-shadow com toque roxo (rgba 139, 92, 246) além da cor da marca; hover com glow constelação. |

### 0.3 Admin Quick Jump

| Item | Status | Detalhe |
|------|--------|---------|
| Visível apenas para brotherscapitalut@gmail.com | **Concluído** | Verificado em `AdminQuickJump.tsx`. |
| Links corretos (Admin, Empresa, Influencer, Mural) | **Concluído** | Dashboard Admin, Dashboard Empresa, Dashboard Influencer, Mural Público. |

### 0.4 Checkout e Termos

| Item | Status | Detalhe |
|------|--------|---------|
| Fluxo de pagamento (Stripe) e liberação de blocos | **Verificar em produção** | Teste final com Stripe Live recomendado; fluxo implementado com `failure_url` e tratamento de `payment=failed`/canceled no Dashboard. |
| Rota /termos publicada | **Concluído** | Conteúdo legal atualizado para ConeXai. |

---

## 1. Auditoria de Código

### 1.1 Remoção de `console.log` e debug

| Arquivo | Problema | Correção |
|---------|----------|----------|
| `src/components/dashboard/BrandSimulator.tsx` | `console.log("[Checkout] handlePayAndPublish chamado", ...)` | Removido. |
| `src/components/dashboard/BrandSimulator.tsx` | `console.error("[Checkout] STRIPE_PRICES[region] undefined", ...)` | Removido; o toast já informa "Plano inválido". |
| `src/pages/AdminMaster.tsx` | `console.log("Admin logado:", ...)` | Removido. |
| `src/pages/AdminMaster.tsx` | `console.error("AdminMaster check error:", err)` em catch | Removido. |
| `src/pages/NotFound.tsx` | `console.error("404 Error: ...", location.pathname)` | Removido. |

### 1.2 Mantidos (uso legítimo)

- **`src/lib/logger.ts`**: Uso de `console.error` / `console.warn` / `console.info` no logger da aplicação — mantido.
- **Páginas Admin** (`AdminFinancePage`, `AdminUsersPage`, `AdminInfluencersPage`): `console.error` em blocos catch para diagnóstico — mantidos (úteis em produção para suporte).
- **Server (`server/index.js`)**: `console.error` em rotas para falhas de API e `console.log` de startup — mantidos para operação.

---

## 2. Simulação de Erros (Edge Cases)

### 2.1 Pagamento Stripe recusado ou cancelado

**Pergunta:** O sistema mostra mensagem amigável quando o pagamento é recusado?

**Estado anterior:** Apenas `success_url` e `cancel_url` eram usados. Não havia tratamento explícito para `payment=canceled` no Dashboard.

**Correções:**

1. **Dashboard (`src/pages/Dashboard.tsx`)**  
   - Tratamento de `payment=canceled`, `payment=failed` e `payment=declined` na query string.  
   - Toast amigável: *"Pagamento não concluído — O pagamento foi cancelado ou recusado. Você pode tentar novamente quando quiser."*  
   - Limpeza da query com `setSearchParams({}, { replace: true })`.

2. **BrandSimulator (`src/components/dashboard/BrandSimulator.tsx`)**  
   - Inclusão de `failure_url: ${baseUrl}/dashboard?payment=failed` na chamada ao checkout (para uso pela Edge Function `create-payment`, se suportado).  
   - Se a Edge Function não repassar `failure_url` ao Stripe, o usuário continua sendo redirecionado para `cancel_url` em caso de falha; o novo tratamento no Dashboard cobre ambos os casos.

**Resultado:** Sim — mensagem amigável exibida quando o pagamento não é concluído (cancelado, falha ou recusado).

### 2.2 Compra de bloco já ocupado

**Pergunta:** O backend bloqueia a transação se tentarem comprar um bloco já ocupado?

**Estado anterior:** O endpoint `POST /api/blocks/purchase` usava `INSERT ... ON CONFLICT (x, y) DO UPDATE ... WHERE status = 'free'`. Em conflito com bloco já ocupado, o UPDATE não alterava linhas, mas a API não rejeitava explicitamente a requisição.

**Correção (server `server/index.js`):**

1. Antes de qualquer INSERT, o backend passa a consultar blocos já ocupados nas coordenadas pedidas.
2. Se existir pelo menos um `(x, y)` ocupado, responde com **400** e mensagem:  
   *"Um ou mais blocos selecionados já estão ocupados. Atualize a página e escolha blocos disponíveis."*
3. Nenhum bloco é inserido/atualizado nesse caso.

**Resultado:** Sim — o backend bloqueia a transação e devolve mensagem clara quando há bloco ocupado.

---

## 3. Verificação de Performance

**Pergunta:** Com máximo de brilho e efeitos “Ultra HD”, o mural ainda carrega em menos de 3 segundos em conexão lenta?

**Medidas já implementadas no código:**

- **Canvas:** `clearRect` no início de cada frame (anti-ghosting) em `InfluencerMuralCanvas`, `DynamicMuralCanvas` e `BrandSimulator` (MiniCanvasPreview).
- **Nitidez:** Uso de `window.devicePixelRatio` (com limite em 3 no BrandSimulator) e `imageRendering: high-quality` / `crisp-edges` onde aplicável.
- **Renderização:** Componentes memoizados (`React.memo`) e, no mural de influencers, uso de `useInView` para reduzir trabalho fora da viewport.
- **Camada do mural:** `isolation` e `contain: layout paint` para limitar repaint.

**Recomendação:** Validar manualmente com **DevTools → Network → Slow 3G** (ou throttling similar) e medir o tempo até o mural interativo. Se ultrapassar 3 s, considerar lazy load de partículas/glow ou reduzir número de elementos animados na primeira tela.

---

## 4. Checagem de Links Admin (Admin Quick Jump)

**Pergunta:** O Admin Quick Jump funciona apenas para `brotherscapitalut@gmail.com` e os botões levam aos dashboards corretos?

**Verificação em `src/components/admin/AdminQuickJump.tsx`:**

| Item | Implementação |
|------|----------------|
| Restrição de e-mail | `const isAdmin = (user?.email ?? "").toLowerCase().trim() === "brotherscapitalut@gmail.com"`; componente retorna `null` se `!isAdmin`. |
| Dashboard Admin | Link para `/admin-master` (Sumário Executivo). |
| Dashboard Empresa | Link para `/dashboard`. |
| Dashboard Influencer | Link para `/dashboard/influencer`. |
| Mural Público | Link para `/mural`. |

**Resultado:** Sim — visível apenas para `brotherscapitalut@gmail.com` e todos os links apontam para os destinos corretos.

---

## 5. Resumo das Alterações por Arquivo

| Arquivo | Alteração |
|---------|-----------|
| `src/components/dashboard/BrandSimulator.tsx` | Remoção de `console.log` e `console.error` de debug; inclusão de `failure_url` no checkout. |
| `src/pages/AdminMaster.tsx` | Remoção de `console.log` e `console.error` do fluxo de check do admin. |
| `src/pages/NotFound.tsx` | Remoção de `console.error` em 404. |
| `src/pages/Dashboard.tsx` | Tratamento de `payment=canceled`, `payment=failed` e `payment=declined` com toast e limpeza da URL. |
| `server/index.js` | Validação de blocos já ocupados em `POST /api/blocks/purchase` e resposta 400 com mensagem amigável. |

---

## 6. Itens Mantidos de Forma Consciente

- **`console.error` em catch (admin e server):** Mantidos para suporte e operação em produção.
- **Logger (`src/lib/logger.ts`):** Mantido como canal de log da aplicação.
- **Performance em 3 s:** Depende de rede e dispositivo; recomendado teste manual com throttling.

---

**Status:** Pré-voo concluído. Código limpo de logs de debug, edge cases de pagamento e blocos ocupados tratados, Admin Quick Jump verificado. Identidade ConeXai aplicada em todo o site; UI cósmica (poeira estelar + brilho constelação) no MuralGrid; rota `/termos` publicada com conteúdo legal atualizado. Teste final de checkout com Stripe Live recomendado em produção. Performance do mural sujeita a validação manual em conexão lenta.
