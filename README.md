# Ponto CLT - Full Stack (Neon + Cloudflare)

Este projeto foi preparado para deploy no **Cloudflare Pages** com banco de dados **Neon (PostgreSQL)**.

## 🚀 Como subir para o GitHub e Deploy

### 1. Preparação do Banco de Dados (Neon)
1. Crie uma conta no [Neon.tech](https://neon.tech).
2. Crie um novo projeto e copie a **Connection String** (DATABASE_URL).
3. No seu terminal local, execute as migrações para criar as tabelas:
   ```bash
   npx drizzle-kit push
   ```

### 2. Deploy no Cloudflare Pages
1. Conecte seu repositório GitHub ao Cloudflare Pages.
2. Configure o build:
   - **Framework preset**: `None` (ou `Vite` se preferir, mas usaremos um comando customizado).
   - **Build command**: `npm run build`
   - **Build output directory**: `dist`
3. **Variáveis de Ambiente**:
   - Adicione `DATABASE_URL` com o valor obtido no Neon.
   - Certifique-se de habilitar o "Node.js compatibility" nas configurações do projeto no Cloudflare.

### 3. Estrutura do Projeto
- `server.ts`: Servidor Express que gerencia a API e serve o frontend.
- `src/db/schema.ts`: Definição das tabelas usando Drizzle ORM.
- `src/db/index.ts`: Conexão com o Neon.

## 🛠️ Desenvolvimento Local
1. Instale as dependências: `npm install`
2. Crie um arquivo `.env` baseado no `.env.example` e adicione sua `DATABASE_URL`.
3. Inicie o servidor: `npm run dev`
