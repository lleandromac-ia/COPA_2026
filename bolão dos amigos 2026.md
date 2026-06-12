# Sistema de Controle de Bolão da Copa do Mundo

## Objetivo

Criar uma página web para gerenciamento de um bolão da Copa do Mundo, onde todos os participantes registram seus palpites para os 72 jogos da fase de grupos.

O sistema deverá permitir:

* Cadastro de participantes.
* Registro dos palpites de todos os jogos.
* Cadastro dos resultados oficiais dos jogos.
* Cálculo automático da pontuação.
* Exibição do ranking geral.
* Comparação de palpites entre dois participantes.
* Estatísticas e desempenho dos participantes.
* Bloqueio de novos cadastros pelo administrador

---

# Regras de Pontuação

| Condição                                              | Pontuação |
| ----------------------------------------------------- | --------- |
| Acertar o placar exato do jogo                        | 12 pontos |
| Acertar o vencedor e a quantidade de gols do vencedor | 9 pontos  |
| Acertar apenas que o jogo terminaria empatado         | 7 pontos  |
| Acertar apenas o vencedor da partida                  | 5 pontos  |
| Qualquer outro resultado                              | 0 pontos  |

---

# Exemplos de Pontuação

## Resultado Oficial

Brasil 3 x 1 Argentina

### Palpite

Brasil 3 x 1 Argentina

Pontuação: **12 pontos**

---

### Palpite

Brasil 3 x 0 Argentina

Pontuação: **9 pontos**

(Acertou vencedor e gols do vencedor)

---

### Palpite

Brasil 2 x 1 Argentina

Pontuação: **5 pontos**

(Acertou apenas o vencedor)

---

## Resultado Oficial

Brasil 2 x 2 Argentina

### Palpite

Brasil 1 x 1 Argentina

Pontuação: **7 pontos**

(Acertou condição de empate)

---

# Estrutura da Aplicação

## Dashboard Principal

Exibir:

### Cards

* Total de Participantes
* Jogos Realizados
* Jogos Restantes
* Maior Pontuação
* Líder Atual
* Média Geral de Pontos

### Ranking Geral

Tabela ordenada por pontuação:

| Posição | Participante | Pontos |
| ------- | ------------ | ------ |
| 1       | João         | 180    |
| 2       | Maria        | 175    |
| 3       | Carlos       | 170    |

---

# Gestão dos Participantes

## Campos

* Nome completo
* Cidade
* Data de cadastro

### Exemplo

| Nome        | Cidade           |
| ----------- | ---------------- |
| João Silva  | São Paulo/SP     |
| Maria Souza | Rio de Janeiro/RJ |

---

# Cadastro dos Palpites

Cada participante deve possuir um palpite para todos os jogos da fase de grupos.

Estrutura:

```json
{
  "participante": "João Silva",
  "jogo": 1,
  "time1": "Brasil",
  "gols1": 2,
  "gols2": 1,
  "time2": "Argentina"
}
```

---

# Jogos da Fase de Grupos

## Grupo A

| Jogo | Time 1    | Placar    | Time 2         |
| ---- | --------- | --------- | -------------- |
| A01  | Equipe A1 | ___ x ___ | Equipe A2      |
| A02  | Equipe A3 | ___ x ___ | Equipe A4      |
| A03  | Equipe A1 | ___ x ___ | Equipe A3      |
| A04  | Equipe A2 | ___ x ___ | Equipe A4      |
| A05  | Equipe A1 | ___ x ___ | Equipe A4      |
| A06  | Equipe A2 | ___ x ___ | Equipe A3      |

---

## Grupo B

| Jogo | Time 1    | Placar    | Time 2         |
| ---- | --------- | --------- | -------------- |
| B01  | Equipe B1 | ___ x ___ | Equipe B2      |
| B02  | Equipe B3 | ___ x ___ | Equipe B4      |
| B03  | Equipe B1 | ___ x ___ | Equipe B3      |
| B04  | Equipe B2 | ___ x ___ | Equipe B4      |
| B05  | Equipe B1 | ___ x ___ | Equipe B4      |
| B06  | Equipe B2 | ___ x ___ | Equipe B3      |

---

## Grupo C

Repete mesma estrutura.

---

## Grupo D

Repete mesma estrutura.

---

## Grupo E

Repete mesma estrutura.

---

## Grupo F

Repete mesma estrutura.

---

## Grupo G

Repete mesma estrutura.

---

## Grupo H

Repete mesma estrutura.

---

## Grupo I

Repete mesma estrutura.

---

## Grupo J

Repete mesma estrutura.

---

## Grupo K

Repete mesma estrutura.

---

## Grupo L

Repete mesma estrutura.

---

# Total

12 grupos x 6 jogos = 72 jogos

---

# Cadastro dos Resultados Oficiais

Tela exclusiva para administrador.

Campos:

* Grupo
* Rodada
* Time A
* Gols A
* Gols B
* Time B

Ao salvar:

* Recalcular ranking automaticamente.
* Atualizar estatísticas.
* Atualizar comparação de participantes.

---

# Algoritmo de Pontuação

```javascript
function calcularPontos(
    palpiteA,
    palpiteB,
    resultadoA,
    resultadoB
) {

    if (
        palpiteA === resultadoA &&
        palpiteB === resultadoB
    ) {
        return 12;
    }

    const vencedorReal =
        resultadoA > resultadoB
            ? "A"
            : resultadoB > resultadoA
            ? "B"
            : "E";

    const vencedorPalpite =
        palpiteA > palpiteB
            ? "A"
            : palpiteB > palpiteA
            ? "B"
            : "E";

    if (
        vencedorReal === vencedorPalpite
    ) {

        if (
            vencedorReal === "A" &&
            palpiteA === resultadoA
        ) {
            return 9;
        }

        if (
            vencedorReal === "B" &&
            palpiteB === resultadoB
        ) {
            return 9;
        }

        if (
            vencedorReal === "E"
        ) {
            return 7;
        }

        return 5;
    }

    return 0;
}
```

---

# Ranking Geral

## Critérios de Ordenação

1. Maior pontuação total.
2. Maior quantidade de placares exatos.
3. Maior quantidade de acertos de vencedor.
4. Menor quantidade de erros.
5. Ordem alfabética.

---

# Perfil do Participante

Exibir:

## Resumo

* Pontuação total
* Posição no ranking
* Jogos acertados
* Placares exatos
* Aproveitamento

### Estatísticas

| Métrica             | Valor |
| ------------------- | ----- |
| Jogos Avaliados     | 72    |
| Placares Exatos     | 10    |
| Acertos de Vencedor | 35    |
| Pontuação Total     | 210   |

---

# Comparação Entre Participantes

## Objetivo

Comparar dois participantes jogo a jogo.

---

## Seletores

Participante 1:

[ João ]

Participante 2:

[ Maria ]

Botão:

[ Comparar ]

---

## Resultado da Comparação

### Resumo

| Métrica             | João | Maria |
| ------------------- | ---- | ----- |
| Pontuação Total     | 210  | 198   |
| Placares Exatos     | 12   | 10    |
| Acertos de Vencedor | 38   | 35    |

---

## Comparação Jogo a Jogo

| Jogo | Resultado | João | Pontos | Maria | Pontos |
| ---- | --------- | ---- | ------ | ----- | ------ |
| A01  | 2x1       | 2x1  | 12     | 1x0   | 5      |
| A02  | 0x0       | 1x1  | 7      | 2x2   | 7      |
| A03  | 3x1       | 3x0  | 9      | 2x1   | 5      |

---

## Divergências

Mostrar jogos onde os participantes fizeram palpites diferentes.

Exemplo:

| Jogo | João | Maria |
| ---- | ---- | ----- |
| A04  | 2x0  | 1x1   |
| A07  | 3x2  | 1x0   |

---

## Estatísticas da Comparação

* Jogos com palpites iguais.
* Jogos com palpites diferentes.
* Quem fez mais pontos.
* Quem acertou mais placares exatos.
* Quem acertou mais vencedores.

---

# Funcionalidades Extras

## Filtros

* Por grupo
* Por participante
* Por rodada

---

## Exportação

Permitir exportar:

* Ranking em PDF
* Ranking em Excel
* Comparação em PDF

---

# Tecnologias do Projeto

## Frontend

* HTML
* CSS
* JavaScript (ES Modules)

## Backend e Banco de Dados

* **Supabase** — armazenamento dos dados em tabelas PostgreSQL
* Cliente `@supabase/supabase-js` para comunicação com o banco

### Tabelas no Supabase

Os dados são persistidos nas seguintes tabelas:

| Tabela | Descrição |
| ------ | --------- |
| `participantes` | Cadastro dos participantes do bolão |
| `jogos` | 72 jogos da fase de grupos (grupos A a L) |
| `palpites` | Palpites de cada participante por jogo |
| `configuracao` | Configurações do sistema (ex.: bloqueio de cadastro) |

> O schema SQL completo está em `supabase/schema.sql`. Configure as credenciais em `js/config.js`.

---

# Estrutura de Banco de Dados

## participantes

```sql
id
nome
cidade
created_at
```

## jogos

```sql
id
grupo
rodada
time_a
time_b
gols_a
gols_b
data_jogo
```

## palpites

```sql
id
participante_id
jogo_id
gols_a
gols_b
```

## pontuacoes

```sql
id
participante_id
jogo_id
pontos
```

---

# Objetivo Final

O sistema deve permitir acompanhar toda a evolução do bolão em tempo real, calcular automaticamente a pontuação dos participantes, gerar um ranking atualizado após cada jogo e fornecer uma comparação detalhada entre quaisquer dois participantes do bolão.
