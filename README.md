# Bolão dos Amigos 2026 ⚽

Sistema web para gerenciamento de bolão da Copa do Mundo 2026 — fase de grupos (72 jogos).

Desenvolvido com **HTML**, **CSS** e **JavaScript** vanilla, com armazenamento de dados em tabelas no **Supabase** (PostgreSQL).

## Funcionalidades

- Dashboard com estatísticas e ranking resumido
- Cadastro de participantes (nome completo e cidade)
- Registro de palpites para os 72 jogos (12 grupos × 6 jogos)
- Cadastro de resultados oficiais (área admin)
- Cálculo automático de pontuação conforme regras do bolão
- Ranking com critérios de desempate
- Comparação entre dois participantes (jogo a jogo + divergências)
- Perfil com estatísticas individuais
- Bloqueio de novos cadastros pelo administrador
- Exportação do ranking em CSV e impressão/PDF

## Regras de Pontuação

| Condição | Pontos |
|----------|--------|
| Placar exato | 12 |
| Vencedor + gols do vencedor | 9 |
| Apenas empate | 7 |
| Apenas vencedor | 5 |
| Outros | 0 |

## Tecnologias

- **Frontend:** HTML5, CSS3, JavaScript (ES Modules)
- **Backend/Banco:** Supabase (PostgreSQL)
- **Cliente Supabase:** `@supabase/supabase-js` via CDN

## Estrutura do Projeto

```
COPA_2026/
├── index.html          # Aplicação principal (SPA)
├── css/
│   └── styles.css      # Estilos
├── js/
│   ├── config.js       # URL e chave do Supabase
│   ├── db.js           # Operações no Supabase
│   ├── scoring.js      # Algoritmo de pontuação
│   ├── utils.js        # Utilitários
│   └── app.js          # Lógica da aplicação
├── supabase/
│   └── schema.sql      # Tabelas, RLS e seed dos 72 jogos
└── README.md
```

## Configuração do Supabase

### 1. Criar projeto no Supabase

Acesse [supabase.com](https://supabase.com) e crie um novo projeto.

### 2. Executar o schema SQL

No **SQL Editor** do Supabase, execute o conteúdo de `supabase/schema.sql`.

Isso cria as tabelas:

| Tabela | Descrição |
|--------|-----------|
| `participantes` | Nome completo, cidade, data de cadastro |
| `jogos` | 72 jogos da fase de grupos (A–L) |
| `palpites` | Palpites por participante e jogo |
| `configuracao` | Bloqueio de cadastro e settings |

### 3. Configurar credenciais

Edite `js/config.js` com os dados do seu projeto:

```javascript
export const SUPABASE_URL = 'https://seu-projeto.supabase.co';
export const SUPABASE_ANON_KEY = 'sua-chave-anon';
```

Encontre esses valores em: **Dashboard → Settings → API**

### 4. Executar localmente

Como o projeto usa ES Modules, sirva os arquivos via HTTP local:

```bash
# Opção 1: Python
python -m http.server 8080

# Opção 2: Node (npx)
npx serve .

# Opção 3: Live Server (VS Code/Cursor extension)
```

Acesse: `http://localhost:8080`

## Acesso Administrativo

- Acesse a aba **Admin**
- PIN padrão: `2026` (altere em `js/config.js` → `ADMIN_PIN`)
- No modo admin você pode:
  - Registrar resultados oficiais dos jogos
  - Bloquear/liberar cadastro de novos participantes
  - Excluir participantes

## Personalização dos Times

Os jogos são criados com nomes genéricos (`Equipe A1`, `Equipe B2`, etc.). Atualize os nomes reais dos times diretamente na tabela `jogos` do Supabase ou pela tela admin antes de registrar resultados.

## Segurança (Produção)

O schema inclui políticas RLS permissivas para facilitar o desenvolvimento. Para produção:

1. Implemente autenticação Supabase Auth
2. Restrinja INSERT/UPDATE/DELETE apenas a usuários autenticados
3. Crie role de admin via claims ou tabela de permissões
4. Altere o `ADMIN_PIN` e considere autenticação real no lugar do PIN local

## Publicação no Vercel

Este projeto é **100% estático** (HTML + CSS + JS). Não precisa de build nem de `npm install` para publicar.

### O que você precisa

| Recurso | Necessário? | Observação |
|---------|-------------|------------|
| Node.js / npm | Só localmente | Para scripts de importação/teste em `scripts/` |
| Supabase | Sim (já configurado) | Banco na nuvem — não vai para o Vercel |
| Vercel | Sim | Hospeda os arquivos estáticos |
| Framework (React, Next…) | Não | Site vanilla |

### Passo a passo

1. Suba o projeto para um repositório Git (GitHub, GitLab…)
2. Acesse [vercel.com](https://vercel.com) → **Add New Project**
3. Importe o repositório
4. Configurações de build:
   - **Framework Preset:** Other
   - **Build Command:** (deixe vazio)
   - **Output Directory:** (deixe vazio ou `.`)
5. Clique em **Deploy**

As credenciais do Supabase já estão em `js/config.js`. A chave `anon` é pública por design (protegida pelas políticas RLS do Supabase).

### Testar conexão localmente

```bash
node scripts/test-supabase.mjs
node scripts/test-ranking.mjs
```

### Deploy via CLI (opcional)

```bash
npx vercel
```

## Referência

Especificação completa em `bolão dos amigos 2026.md`.
