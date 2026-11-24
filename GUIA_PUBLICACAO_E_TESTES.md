# Guia Completo de Configuração, Publicação na Vercel e Testes

Este guia reúne todas as etapas práticas para colocar a loja virtual no ar usando **GitHub**, **Supabase** e **Vercel**.

---

## 1. Estrutura de Pastas do Projeto

- `api/index.ts`: Ponto de entrada das rotas `/api/*` como Serverless Function na Vercel.
- `server.ts`: Servidor local/desenvolvimento na porta `3000` (junta Express + Vite).
- `server/`: Lógica de backend protegida no servidor (autenticação, catálogo, carrinho, CEP, pedidos atômicos, avaliações e painel admin).
- `src/`: Interface em React + TypeScript + Tailwind CSS.
- `supabase/sql/`: Scripts SQL numerados (`001` a `005`) para criar tabelas, funções atômicas, RLS e Storage no Supabase.
- `vercel.json`: Regras de roteamento da Vercel para `/api/*` e SPA React.
- `.env.example`: Modelo seguro das variáveis de ambiente (sem senhas nem chaves reais).
- `.gitignore`: Bloqueia envio de `.env`, chaves e pastas de build ao GitHub.

---

## 2. Onde Encontrar as Chaves no Supabase

1. Acesse o painel do seu projeto no Supabase (`https://supabase.com/dashboard`).
2. No menu lateral, clique em **Project Settings** (ícone de engrenagem) e depois em **API**.
3. Anote os três valores:
   - **Project URL** -> use em `SUPABASE_URL`
   - **anon / public** -> use em `SUPABASE_ANON_KEY`
   - **service_role / secret** -> use em `SUPABASE_SERVICE_ROLE_KEY` (nunca exponha no frontend nem coloque prefixo `VITE_`).

---

## 3. Scripts SQL no Supabase (Ordem Obrigatória)

No painel do Supabase, abra **SQL Editor** -> **New query** e execute os arquivos da pasta `supabase/sql/` **exatamente nesta ordem**, um por vez:

1. `supabase/sql/001_extensions_and_types.sql`
2. `supabase/sql/002_tables_and_indexes.sql`
3. `supabase/sql/003_functions_and_atomic_rpc.sql`
4. `supabase/sql/004_rls_policies.sql`
5. `supabase/sql/005_storage_setup.sql`

> O script `005_storage_setup.sql` cria automaticamente o bucket público `product-images` com limite de 4 MB e permissão de envio restrita a administradores.

---

## 4. Variáveis de Ambiente (Local e Vercel)

### Variáveis públicas (seguras no navegador)
- `VITE_STORE_NAME`: Nome exibido na loja.
- `VITE_STORE_DESCRIPTION`: Descrição curta da página inicial.
- `VITE_WHATSAPP_NUMBER`: `+55 42 98809-3611`.
- `VITE_HERO_IMAGE_URL`: (Opcional) URL de imagem personalizada para substituir a imagem de destaque inicial.

### Variáveis secretas (exclusivas do servidor / Vercel — sem prefixo `VITE_`)
- `SUPABASE_URL`: URL do projeto Supabase.
- `SUPABASE_ANON_KEY`: Chave `anon` do Supabase.
- `SUPABASE_SERVICE_ROLE_KEY`: Chave `service_role` (secreta!).
- `ADMIN_BOOTSTRAP_SECRET`: Senha/token forte (mín. 16 caracteres) usado uma única vez para liberar a criação do administrador máximo inicial.
- `INITIAL_SUPERADMIN_CPF`: Seu CPF (11 dígitos válidos, sem colocar no código).
- `INITIAL_SUPERADMIN_EMAIL`: Seu e-mail de acesso inicial.
- `INITIAL_SUPERADMIN_NAME`: Seu nome completo.
- `INITIAL_SUPERADMIN_PHONE`: Seu telefone/WhatsApp.
- `INITIAL_SUPERADMIN_PASSWORD`: Senha forte inicial (mín. 8 caracteres com maiúscula, minúscula, número e símbolo). No primeiro login será exigida a troca.
- `PAYMENT_PROVIDER_SECRET_KEY`: (Opcional) Deixe vazia até integrar um gateway real (Mercado Pago, Asaas ou Stripe).

### Como configurar na Vercel
1. No projeto da Vercel, vá em **Settings -> Environment Variables**.
2. Cadastre todas as variáveis acima nos ambientes **Production**, **Preview** e **Development**.
3. **Importante:** Sempre que criar ou alterar qualquer variável na Vercel, vá em **Deployments**, clique nos três pontinhos do último deploy e selecione **Redeploy** para que os novos valores entrem em vigor.

---

## 5. Como Executar e Testar Localmente

1. Copie `.env.example` para `.env` e preencha os valores no seu computador (nunca envie `.env` para o GitHub).
2. Instale as dependências:
   ```bash
   npm install
   ```
3. Inicie o servidor local:
   ```bash
   npm run dev
   ```
4. Abra `http://localhost:3000`.

---

## 6. Como Enviar ao GitHub e Publicar na Vercel

1. Inicialize o repositório Git local (se ainda não existir) e confirme que `.env` **não** aparece no `git status`:
   ```bash
   git init
   git status
   git add .
   git commit -m "Estrutura inicial da loja virtual"
   ```
2. Crie um repositório privado no GitHub, conecte e envie:
   ```bash
   git branch -M main
   git remote add origin https://github.com/SEU_USUARIO/SEU_REPOSITORIO.git
   git push -u origin main
   ```
3. Acesse `https://vercel.com`, clique em **Add New... -> Project**, importe o repositório do GitHub.
4. Em **Framework Preset**, mantenha **Vite**. Preencha todas as **Environment Variables** e clique em **Deploy**.
5. Após publicar, abra `https://seu-projeto.vercel.app`, acesse **Entrar**, clique em **Inicializar administrador máximo do sistema**, informe apenas o `ADMIN_BOOTSTRAP_SECRET` e faça login com o **CPF** e a **senha** definidos nas variáveis de ambiente. Em seguida, altere a senha na tela obrigatória.
6. Para atualizações futuras no código: basta rodar `git add .`, `git commit -m "descrição"` e `git push` — a Vercel gera um novo deploy automaticamente.

---

## 7. Checklist de Testes Recomendados

1. **Catálogo público:** Navegar deslogado, buscar por nome/descrição, filtrar por categoria e promoção, alternar ordenação menor/maior preço e testar paginação (20 itens/página).
2. **Bloqueio de carrinho deslogado:** Tentar adicionar produto sem login, verificar mensagem obrigatória e botões **Entrar** / **Criar uma conta**, concluir login e confirmar que o item foi preservado e adicionado automaticamente.
3. **Cadastro e CPF:** Testar CPF inválido, senha fraca e cadastro válido de cliente.
4. **Isolamento multiusuário:** Abrir dois navegadores ou abas diferentes com Cliente A e Cliente B logados simultaneamente; adicionar itens distintos e confirmar que carrinhos e pedidos nunca se misturam.
5. **Frete Irati-PR vs outras cidades:** Buscar CEP de Irati-PR (frete fixo R$ 4,99) e testar CEP de outra cidade (finalização bloqueada com link direto de WhatsApp `+55 42 98809-3611`).
6. **Idempotência e estoque:** Clicar repetidamente em confirmar pedido e validar que apenas um pedido é criado e o estoque é descontado uma única vez.
7. **Administração e Storage:** Logar como admin em outra aba, enviar imagem real do computador/celular no cadastro de produto, criar/editar/desativar produto e atualizar status de pedido até `Entregue`.
8. **Avaliações pós-entrega:** Tentar avaliar antes da entrega (bloqueado no servidor); após marcar pedido como `Entregue`, enviar nota 1–5 e comentário de até 150 caracteres.
9. **Segurança RBAC:** Confirmar que cliente comum recebe erro `403` ao tentar chamar rotas `/api/admin/*` e que um administrador comum não consegue criar outro administrador (apenas o `super_admin`).
