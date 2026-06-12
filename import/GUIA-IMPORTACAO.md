# Guia de Importação — Bolão dos Amigos 2026

Sim, **é possível importar tudo da sua planilha existente**. O sistema aceita CSV ou Excel (.xlsx).

## Opção 1 — Pela tela Admin (recomendado)

1. Abra o site e entre em **Admin** (PIN: `2026`)
2. Role até **Importar da Planilha**
3. Escolha um dos modos abaixo
4. Clique em **Pré-visualizar** → confira os números → **Importar para o Supabase**

### Modo A — 3 arquivos CSV separados

| Arquivo | Conteúdo |
|---------|----------|
| `jogos.csv` | Lista dos 72 jogos |
| `participantes.csv` | Lista de participantes |
| `palpites.csv` | Todos os palpites |

### Modo B — 1 planilha Excel com 3 abas

Nomeie as abas exatamente:

- `jogos`
- `participantes`
- `palpites`

Use o arquivo único no campo **Planilha única (.xlsx com 3 abas)**.

---

## Formato das colunas

### Jogos (`jogos.csv`)

```csv
codigo,grupo,rodada,time_a,time_b,gols_a,gols_b,data_jogo,ordem
A01,A,1,Brasil,Argentina,,,2026-06-11,1
A02,A,1,França,Alemanha,2,1,2026-06-12,2
```

| Coluna | Obrigatório | Descrição |
|--------|-------------|-----------|
| `codigo` | Sim | Código do jogo: A01 … L06 |
| `grupo` | Sim | Letra do grupo (A–L) |
| `rodada` | Sim | 1, 2 ou 3 |
| `time_a` | Sim | Time mandante |
| `time_b` | Sim | Time visitante |
| `gols_a`, `gols_b` | Não | Resultado oficial (deixe vazio se ainda não jogou) |
| `ordem` | Não | Ordem de exibição (1–72) |

> Se você já rodou `schema.sql`, os 72 jogos genéricos já existem. Importar jogos **atualiza** os nomes dos times e resultados pelo `codigo`.

---

### Participantes (`participantes.csv`)

```csv
nome,cidade
João Silva,São Paulo/SP
Maria Souza,Rio de Janeiro/RJ
```

| Coluna | Obrigatório |
|--------|-------------|
| `nome` | Sim (nome completo — referência em todo o sistema) |
| `cidade` | Não |

---

### Palpites — formato longo (1 linha por palpite)

Ideal se sua planilha tem uma linha para cada palpite:

```csv
nome,codigo_jogo,gols_a,gols_b
João Silva,A01,2,1
João Silva,A02,0,0
Maria Souza,A01,1,1
```

Alternativa com placar em uma coluna:

```csv
nome,codigo_jogo,placar
João Silva,A01,2x1
Maria Souza,A02,0x0
```

---

### Palpites — formato largo (matriz na planilha)

Ideal se sua planilha tem **participantes nas linhas** e **jogos nas colunas** (muito comum):

```csv
nome,A01,A02,A03,...,L06
João Silva,2x1,0x0,3x1,...,1x2
Maria Souza,1x1,2x0,2x2,...,0x1
```

Formatos de placar aceitos: `2x1`, `2-1`, `2:1`, `2;1`

---

## Ordem de importação

Importe sempre nesta ordem (o sistema faz isso automaticamente):

1. **Jogos** — para existirem A01…L06 no banco
2. **Participantes** — para existirem os nomes completos
3. **Palpites** — vinculados por `nome` + `codigo_jogo`

---

## Como adaptar sua planilha atual

### Se tudo está em uma única aba

1. Copie a parte dos **jogos** para uma aba `jogos`
2. Copie os **participantes** para aba `participantes`
3. Copie a **matriz de palpites** para aba `palpites` (mantendo nome completo na 1ª coluna e códigos A01…L06 no cabeçalho)
4. Salve como `.xlsx` e importe pela tela Admin

### Se sua planilha usa nomes diferentes de coluna

Renomeie o cabeçalho para bater com os nomes acima, ou use estes aliases aceitos:

| Padrão | Aliases aceitos |
|--------|-----------------|
| `time_a` | `time1`, `time_1` |
| `time_b` | `time2`, `time_2` |
| `codigo_jogo` | `codigo`, `jogo` |

### Exportar do Excel para CSV

No Excel: **Arquivo → Salvar como → CSV UTF-8**. Faça um CSV por aba.

---

## Opção 2 — Importar direto no Supabase

No [Dashboard Supabase](https://supabase.com/dashboard) → **Table Editor**:

1. Abra a tabela `jogos` → **Insert** → **Import data from CSV**
2. Repita para `participantes` e `palpites`

Para `palpites`, o CSV precisa de `participante_id` e `jogo_id` (UUIDs), não nome/código. Por isso a **tela Admin é mais prática** — ela resolve os vínculos automaticamente.

---

## Opção 3 — Cadastro manual (poucos dados)

- **Jogos:** já vêm do `schema.sql` (72 jogos genéricos). Edite nomes dos times na tela Admin ou importe CSV.
- **Participantes:** aba Participantes no site
- **Palpites:** aba Palpites no site (participante por participante)

---

## Arquivos de exemplo

Na pasta `import/`:

| Arquivo | Descrição |
|---------|-----------|
| `jogos-exemplo.csv` | Modelo de jogos |
| `participantes-exemplo.csv` | Modelo de participantes |
| `palpites-longo-exemplo.csv` | Palpites linha a linha |
| `palpites-largo-exemplo.csv` | Palpites em matriz |

---

## Erros comuns

| Erro | Solução |
|------|---------|
| Participante não encontrado | Importe participantes antes dos palpites; confira se o nome completo é idêntico |
| Jogo não encontrado | Importe jogos primeiro; use códigos A01…L06 |
| Placar inválido | Use formato `2x1` (números separados por x, - ou :) |
| Nome duplicado | Cada participante precisa de nome completo único |

---

## Política RLS no Supabase

Se a importação falhar com erro de permissão, execute no SQL Editor:

```sql
CREATE POLICY "Inserção jogos" ON jogos FOR INSERT WITH CHECK (true);
```

(Isso já está incluído no `schema.sql` atualizado.)
