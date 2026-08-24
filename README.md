# Welcome to your Lovable project

## Project info

**URL**: https://lovable.dev/projects/REPLACE_WITH_PROJECT_ID

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/REPLACE_WITH_PROJECT_ID) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## Banco de dados local (PostgreSQL no pgAdmin, sem Supabase Cloud)

Para desvincular totalmente do Supabase e usar apenas PostgreSQL local (ex.: criado no pgAdmin):

1. **Criar o schema no pgAdmin**  
   No pgAdmin, abra o banco (ex.: `mural_digital`) e execute o script completo:
   ```sh
   psql "postgresql://postgres:SUA_SENHA@localhost:5432/mural_digital" -f local_schema_pgadmin.sql
   ```
   Ou copie e cole o conteúdo de `local_schema_pgadmin.sql` no Query Tool do pgAdmin.  
   Esse script cria: **profiles** (com email/password_hash para login local), **companies**, **blocks**, **active_campaigns**, **favorite_influencers**, **partnership_proposals**, **position_bids**, **system_profit**, **direct_offers**, **campaign_applications**, **campaigns**, **campaign_influencers**, **interactions**, **withdrawal_requests**, além de RPCs (accept_position_bid com 30% taxa, release_proposal_payment, accept_direct_offer, etc.).

2. **Variáveis de ambiente**  
   Copie o conteúdo de **`env.local.pgadmin.example`** para o seu arquivo **`.env`** (ou adicione as 3 linhas abaixo). Troque `sua_senha` pela senha do usuário `postgres` no pgAdmin:
   ```env
   VITE_USE_LOCAL_DB=true
   VITE_LOCAL_API_URL=http://localhost:3001
   VITE_PAYMENT_MODE=manual
   LOCAL_PAYMENT_MODE=manual
   DATABASE_URL=postgresql://postgres:sua_senha@localhost:5432/mural_digital
   ```
   Com isso o **supabaseClient** usa o adaptador **localDbClient** e as telas de Campanhas deixam de dar erro de "schema cache".

3. **Subir a API local**  
   Em um terminal:
   ```sh
   npm run server
   ```
   A API escuta em `http://localhost:3001` e usa `DATABASE_URL` para conectar ao Postgres.

4. **Frontend**  
   Com `VITE_USE_LOCAL_DB=true`, o cliente em `src/integrations/supabase/client.ts` usa o adaptador em `src/lib/localDbClient.ts`, que envia as requisições para a API local. **Login** é feito contra a tabela `profiles` (email + senha com bcrypt). Cadastro cria linha em `profiles` e `user_roles`.

5. **Funcionalidades reativadas no modo local**  
   - Sistema de **bids** (position_bids; 30% taxa para a plataforma).  
   - Botão **Salvar na minha Lista** (favorite_influencers).  
   - **Contraproposta** de influencer (partnership_proposals com suggested_amount e status counter_offer).

6. **Erros**  
   Mensagens que mencionavam "schema cache" foram substituídas por log interno; o logger sanitiza termos técnicos. Use o console (F12) para ver `[Auth]`, `[MuralDataLoader]`, etc.

7. **Teste de criação**  
   Depois de configurar o `.env`, subir a API (`npm run server`) e o frontend (`npm run dev`), faça login (cadastre um usuário se precisar) e clique em **Criar campanha**. O sistema passará a escrever direto na tabela `active_campaigns` do pgAdmin local e o erro de "schema cache" deixa de aparecer.

8. **Fluxo local/manual completo**  
   Com `LOCAL_PAYMENT_MODE=manual`, a página **Preços** prepara o plano e leva ao **Dashboard > Simulador**. No simulador, escolha ou ajuste os blocos, revise o resumo e clique em **Publicar agora**. A API local cria um `checkout_order`, conclui em `/api/checkout/manual-complete`, publica os blocos no mural e registra o pagamento local sem depender de Stripe.

9. **Créditos e assinaturas no modo local**  
   O botão **Carregar créditos** no dashboard usa `/api/credits/manual-add` e adiciona saldo direto à empresa autenticada. `check-subscription` retorna lista vazia e `cancel-subscription` retorna sucesso simulado, permitindo operar o painel local sem Supabase Functions.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/REPLACE_WITH_PROJECT_ID) and click on Share -> Publish.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/features/custom-domain#custom-domain)
