/**
 * Algoritmo de pontuação do bolão
 * @see bolão dos amigos 2026.md
 *
 * Regras (em ordem de prioridade):
 * - Placar exato dos dois times (vitória A, vitória B ou empate): 12 pts
 * - Vencedor correto + gols corretos do time vencedor: 9 pts
 * - Empate correto, mas com quantidade de gols diferente: 7 pts
 * - Apenas o vencedor correto, com gols diferentes: 5 pts
 * - Demais casos: 0 pts
 */

function asGols(valor) {
  if (valor === null || valor === undefined || valor === '') return null;
  const n = parseInt(valor, 10);
  return Number.isNaN(n) ? null : n;
}

function vencedor(golsA, golsB) {
  if (golsA > golsB) return 'A';
  if (golsB > golsA) return 'B';
  return 'E';
}

export function calcularPontos(palpiteA, palpiteB, resultadoA, resultadoB) {
  const pa = asGols(palpiteA);
  const pb = asGols(palpiteB);
  const ra = asGols(resultadoA);
  const rb = asGols(resultadoB);

  if (ra === null || rb === null) return null;
  if (pa === null || pb === null) return 0;

  if (pa === ra && pb === rb) return 12;

  const vencedorReal = vencedor(ra, rb);
  const vencedorPalpite = vencedor(pa, pb);

  if (vencedorReal !== vencedorPalpite) return 0;

  if (vencedorReal === 'E') return 7;

  if (vencedorReal === 'A' && pa === ra) return 9;
  if (vencedorReal === 'B' && pb === rb) return 9;

  return 5;
}

export function formatarPlacar(golsA, golsB) {
  if (golsA === null || golsB === null) return '—';
  return `${golsA} x ${golsB}`;
}

export function jogoFinalizado(jogo) {
  return jogo.gols_a !== null && jogo.gols_b !== null;
}

export function calcularEstatisticasParticipante(participanteId, jogos, palpitesMap) {
  let pontosTotal = 0;
  let placaresExatos = 0;
  let acertosVencedor = 0;
  let erros = 0;
  let jogosAvaliados = 0;

  for (const jogo of jogos) {
    if (!jogoFinalizado(jogo)) continue;

    const palpite = palpitesMap.get(`${participanteId}:${jogo.id}`);
    if (!palpite) continue;

    jogosAvaliados++;
    const pontos = calcularPontos(
      palpite.gols_a,
      palpite.gols_b,
      jogo.gols_a,
      jogo.gols_b
    );

    pontosTotal += pontos;

    if (pontos === 12) placaresExatos++;
    if (pontos >= 5) acertosVencedor++;
    if (pontos === 0) erros++;
  }

  const aproveitamento =
    jogosAvaliados > 0
      ? Math.round((pontosTotal / (jogosAvaliados * 12)) * 100)
      : 0;

  return {
    pontosTotal,
    placaresExatos,
    acertosVencedor,
    erros,
    jogosAvaliados,
    aproveitamento,
  };
}

export function calcularRanking(participantes, jogos, palpites) {
  const palpitesMap = new Map(
    palpites.map((p) => [`${p.participante_id}:${p.jogo_id}`, p])
  );

  const ranking = participantes.map((p) => {
    const stats = calcularEstatisticasParticipante(p.id, jogos, palpitesMap);
    return { participante: p, ...stats };
  });

  ranking.sort(compararRankingItens);

  return atribuirPosicoesRanking(ranking);
}

/**
 * Posições compartilhadas por pontuação (ranking competitivo).
 * Ex.: dois com mesma pontuação em 1º → ambos 1º; o seguinte fica em 3º.
 */
export function atribuirPosicoesRanking(ranking) {
  let posicao = 1;
  return ranking.map((item, index) => {
    if (index > 0 && item.pontosTotal !== ranking[index - 1].pontosTotal) {
      posicao = index + 1;
    }
    return { posicao, ...item };
  });
}

/** Posição que uma pontuação ocuparia em um ranking já ordenado (desc). */
export function calcularPosicaoPorPontuacao(pontosTotal, rankingOrdenado) {
  if (!rankingOrdenado.length) return 1;

  let posicao = 1;
  for (let i = 0; i < rankingOrdenado.length; i++) {
    if (i > 0 && rankingOrdenado[i].pontosTotal !== rankingOrdenado[i - 1].pontosTotal) {
      posicao = i + 1;
    }
    if (pontosTotal === rankingOrdenado[i].pontosTotal) return posicao;
    if (pontosTotal > rankingOrdenado[i].pontosTotal) return posicao;
  }

  const n = rankingOrdenado.length;
  let posUltima = 1;
  for (let i = 0; i < n; i++) {
    if (i > 0 && rankingOrdenado[i].pontosTotal !== rankingOrdenado[i - 1].pontosTotal) {
      posUltima = i + 1;
    }
  }
  const qtdUltimaPos = rankingOrdenado.filter(
    (r) => r.pontosTotal === rankingOrdenado[n - 1].pontosTotal
  ).length;
  return posUltima + qtdUltimaPos;
}

/** Ranking com resultados simulados (override por jogo_id). */
export function calcularRankingComOverrides(participantes, jogos, palpites, overrides = {}) {
  const jogosEff = jogos.map((j) => {
    const o = overrides[j.id];
    if (!o) return j;
    return { ...j, gols_a: o.gols_a, gols_b: o.gols_b };
  });
  return calcularRanking(participantes, jogosEff, palpites);
}

export function compararRankingItens(a, b) {
  if (b.pontosTotal !== a.pontosTotal) return b.pontosTotal - a.pontosTotal;
  if (b.placaresExatos !== a.placaresExatos)
    return b.placaresExatos - a.placaresExatos;
  if (b.acertosVencedor !== a.acertosVencedor)
    return b.acertosVencedor - a.acertosVencedor;
  if (a.erros !== b.erros) return a.erros - b.erros;
  return String(a.participante.nome || '').localeCompare(
    String(b.participante.nome || ''),
    'pt-BR'
  );
}

export function determinarVencedoresRanking(ranking) {
  if (!ranking.length) return [];
  const ptsLider = ranking[0].pontosTotal;
  return ranking.filter((r) => r.pontosTotal === ptsLider);
}

export function compararParticipantes(id1, id2, jogos, palpites) {
  const palpitesMap = new Map(
    palpites.map((p) => [`${p.participante_id}:${p.jogo_id}`, p])
  );

  const stats1 = calcularEstatisticasParticipante(id1, jogos, palpitesMap);
  const stats2 = calcularEstatisticasParticipante(id2, jogos, palpitesMap);

  const jogosComparados = [];
  const divergencias = [];
  let palpitesIguais = 0;
  let palpitesDiferentes = 0;

  for (const jogo of jogos) {
    const p1 = palpitesMap.get(`${id1}:${jogo.id}`);
    const p2 = palpitesMap.get(`${id2}:${jogo.id}`);
    if (!p1 || !p2) continue;

    const mesmoPalpite =
      p1.gols_a === p2.gols_a && p1.gols_b === p2.gols_b;

    if (mesmoPalpite) palpitesIguais++;
    else palpitesDiferentes++;

    const pontos1 = jogoFinalizado(jogo)
      ? calcularPontos(p1.gols_a, p1.gols_b, jogo.gols_a, jogo.gols_b)
      : null;
    const pontos2 = jogoFinalizado(jogo)
      ? calcularPontos(p2.gols_a, p2.gols_b, jogo.gols_a, jogo.gols_b)
      : null;

    const item = {
      jogo,
      palpite1: p1,
      palpite2: p2,
      pontos1,
      pontos2,
      mesmoPalpite,
    };

    jogosComparados.push(item);
    if (!mesmoPalpite) divergencias.push(item);
  }

  return {
    stats1,
    stats2,
    jogosComparados,
    divergencias,
    resumo: {
      palpitesIguais,
      palpitesDiferentes,
      maisPontos:
        stats1.pontosTotal > stats2.pontosTotal
          ? 1
          : stats2.pontosTotal > stats1.pontosTotal
            ? 2
            : 0,
      maisExatos:
        stats1.placaresExatos > stats2.placaresExatos
          ? 1
          : stats2.placaresExatos > stats1.placaresExatos
            ? 2
            : 0,
      maisVencedores:
        stats1.acertosVencedor > stats2.acertosVencedor
          ? 1
          : stats2.acertosVencedor > stats1.acertosVencedor
            ? 2
            : 0,
    },
  };
}
