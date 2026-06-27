import {
  calcularPontos,
  calcularRanking,
  calcularRankingComOverrides,
  calcularEstatisticasParticipante,
  compararRankingItens,
  determinarVencedoresRanking,
  atribuirPosicoesRanking,
  calcularPosicaoPorPontuacao,
  jogoFinalizado,
} from './scoring.js';

const DUAS_HORAS_MS = 2 * 60 * 60 * 1000;

export const TIPOS_ANALISE = [
  {
    id: 'palpites_jogo',
    configKey: 'analise_palpites_jogo',
    label: 'Palpites por jogo',
    desc: 'Distribuição de palpites, heatmap e simulação de resultado por partida.',
  },
  {
    id: 'possibilidades_vencer',
    configKey: 'analise_possibilidades_vencer',
    label: 'Possibilidades de vencer bolão',
    desc: 'Simulação Monte Carlo: sorteia placares conforme a distribuição dos palpites.',
  },
  {
    id: 'possibilidades_exaustivas',
    configKey: 'analise_possibilidades_exaustivas',
    label: 'Simulação pelos palpites',
    desc: 'Se os jogos restantes saírem como cada um palpitou: pontuação, posição final e distância aos vizinhos.',
  },
  {
    id: 'placar_favorito',
    configKey: 'analise_placar_favorito',
    label: 'Placar favorito',
    desc: 'Placar mais palpitado em cada jogo tratado como participante virtual.',
  },
];

export const PLACAR_FAVORITO_ID = '__placar_favorito__';
export const PLACAR_FAVORITO_NOME = 'Placar Favorito';

const MONTE_CARLO_ITERACOES = 3000;

export function getAnalisesHabilitadas(config) {
  return TIPOS_ANALISE.filter((t) => config[t.configKey] !== false);
}

export function getJogosPendentes(jogos) {
  return jogos
    .filter((j) => !jogoFinalizado(j))
    .sort(compararJogosPorData);
}

export function getTodosJogosAnalise(jogos) {
  return [...jogos].sort(compararJogosPorData);
}

function compararJogosPorData(a, b) {
  const da = new Date(a.data_jogo || 0).getTime();
  const db = new Date(b.data_jogo || 0).getTime();
  return da - db || (a.ordem || 0) - (b.ordem || 0);
}

export function getJogoPadraoAnalise(jogos) {
  const todos = getTodosJogosAnalise(jogos);
  if (!todos.length) return null;

  const now = Date.now();

  const recente = todos
    .filter((j) => {
      if (!j.data_jogo) return false;
      const inicio = new Date(j.data_jogo).getTime();
      return inicio <= now && now - inicio <= DUAS_HORAS_MS;
    })
    .sort((a, b) => new Date(b.data_jogo) - new Date(a.data_jogo))[0];

  if (recente) return recente;

  const proximo = todos.find(
    (j) => j.data_jogo && new Date(j.data_jogo).getTime() > now
  );
  if (proximo) return proximo;

  return todos[todos.length - 1];
}

export function analisarPalpitesJogo(jogo, palpites, ranking) {
  const palpitesJogo = palpites.filter((p) => p.jogo_id === jogo.id);
  const total = palpitesJogo.length;

  let vitA = 0;
  let empate = 0;
  let vitB = 0;

  let maxGolsA = 0;
  let maxGolsB = 0;
  const matriz = {};

  for (const p of palpitesJogo) {
    const ga = parseInt(p.gols_a, 10);
    const gb = parseInt(p.gols_b, 10);
    if (Number.isNaN(ga) || Number.isNaN(gb)) continue;

    if (ga > maxGolsA) maxGolsA = ga;
    if (gb > maxGolsB) maxGolsB = gb;

    if (ga > gb) vitA++;
    else if (ga === gb) empate++;
    else vitB++;

    const key = `${ga}-${gb}`;
    matriz[key] = (matriz[key] || 0) + 1;
  }

  const maxGols = Math.max(maxGolsA, maxGolsB, 0);

  for (let a = 0; a <= maxGols; a++) {
    for (let b = 0; b <= maxGols; b++) {
      const key = `${a}-${b}`;
      if (matriz[key] === undefined) matriz[key] = 0;
    }
  }

  let maxContagem = 0;
  for (const key of Object.keys(matriz)) {
    if (matriz[key] > maxContagem) maxContagem = matriz[key];
  }

  const pct = (n) => (total > 0 ? ((n / total) * 100).toFixed(1) : '0.0');

  const listaRanking = ranking
    .map((r) => {
      const palpite = palpitesJogo.find((p) => p.participante_id === r.participante.id);
      if (!palpite) return null;
      return {
        posicao: r.posicao,
        participante: r.participante,
        palpite,
        pontosTotal: r.pontosTotal,
      };
    })
    .filter(Boolean);

  return {
    total,
    vitA,
    empate,
    vitB,
    pctA: pct(vitA),
    pctEmpate: pct(empate),
    pctB: pct(vitB),
    matriz,
    maxGols,
    maxContagem,
    listaRanking,
  };
}

export function simularRankingComPlacar(
  participantes,
  jogos,
  palpites,
  jogoId,
  golsA,
  golsB
) {
  return calcularRankingComOverrides(participantes, jogos, palpites, {
    [jogoId]: { gols_a: golsA, gols_b: golsB },
  });
}

export function corHeatmap(contagem, maxContagem) {
  if (!contagem || !maxContagem) return null;
  const t = contagem / maxContagem;
  const r = 255;
  const g = Math.round(220 - t * 180);
  const b = Math.round(120 - t * 120);
  return `rgb(${r}, ${g}, ${b})`;
}

function buildDistribuicaoPalpites(jogoId, palpites) {
  const counts = new Map();
  let total = 0;

  for (const p of palpites) {
    if (p.jogo_id !== jogoId) continue;
    const ga = parseInt(p.gols_a, 10);
    const gb = parseInt(p.gols_b, 10);
    if (Number.isNaN(ga) || Number.isNaN(gb)) continue;
    const key = `${ga}-${gb}`;
    counts.set(key, (counts.get(key) || 0) + 1);
    total++;
  }

  if (!total) {
    return [{ gols_a: 0, gols_b: 0, peso: 1 }];
  }

  return [...counts.entries()].map(([key, count]) => {
    const [ga, gb] = key.split('-').map(Number);
    return { gols_a: ga, gols_b: gb, peso: count / total };
  });
}

function amostrarDistribuicao(dist) {
  let r = Math.random();
  for (const item of dist) {
    r -= item.peso;
    if (r <= 0) return item;
  }
  return dist[dist.length - 1];
}

export function calcularPossibilidadesVencer(
  participantes,
  jogos,
  palpites,
  iteracoes = MONTE_CARLO_ITERACOES
) {
  const palpitesMap = new Map(
    palpites.map((p) => [`${p.participante_id}:${p.jogo_id}`, p])
  );

  const jogosFinalizados = jogos.filter(jogoFinalizado);
  const jogosPendentes = jogos.filter((j) => !jogoFinalizado(j));

  const baseStats = participantes.map((p) => ({
    participante: p,
    ...calcularEstatisticasParticipante(p.id, jogosFinalizados, palpitesMap),
  }));

  const distribuicoes = jogosPendentes.map((j) => ({
    jogo: j,
    dist: buildDistribuicaoPalpites(j.id, palpites),
  }));

  const vitorias = new Map(participantes.map((p) => [p.id, 0]));
  const podio = new Map(participantes.map((p) => [p.id, 0]));
  const top10 = new Map(participantes.map((p) => [p.id, 0]));

  const rankingAtual = calcularRanking(participantes, jogos, palpites);

  if (!jogosPendentes.length) {
    const vencedores = determinarVencedoresRanking(rankingAtual);
    const share = 1 / vencedores.length;
    for (const v of vencedores) {
      vitorias.set(v.participante.id, share);
    }
    for (const r of rankingAtual) {
      if (r.posicao === 2) podio.set(r.participante.id, 1);
      if (r.posicao <= 10) top10.set(r.participante.id, 1);
    }

    return buildResultadoPossibilidades(
      participantes,
      rankingAtual,
      vitorias,
      podio,
      top10,
      1,
      0,
      true
    );
  }

  for (let i = 0; i < iteracoes; i++) {
    const rankingSim = baseStats.map((b) => ({
      participante: b.participante,
      pontosTotal: b.pontosTotal,
      placaresExatos: b.placaresExatos,
      acertosVencedor: b.acertosVencedor,
      erros: b.erros,
      jogosAvaliados: b.jogosAvaliados,
      aproveitamento: b.aproveitamento,
    }));

    for (const { jogo, dist } of distribuicoes) {
      const amostra = amostrarDistribuicao(dist);
      for (const r of rankingSim) {
        const palpite = palpitesMap.get(`${r.participante.id}:${jogo.id}`);
        if (!palpite) continue;
        const pontos = calcularPontos(
          palpite.gols_a,
          palpite.gols_b,
          amostra.gols_a,
          amostra.gols_b
        );
        r.pontosTotal += pontos;
        if (pontos === 12) r.placaresExatos++;
        if (pontos >= 5) r.acertosVencedor++;
        if (pontos === 0) r.erros++;
      }
    }

    rankingSim.sort(compararRankingItens);

    const rankingComPos = atribuirPosicoesRanking(rankingSim);

    const vencedores = determinarVencedoresRanking(rankingComPos);
    const share = 1 / vencedores.length;
    for (const v of vencedores) {
      vitorias.set(v.participante.id, (vitorias.get(v.participante.id) || 0) + share);
    }

    rankingComPos.filter((r) => r.posicao === 2).forEach((r) => {
      podio.set(r.participante.id, (podio.get(r.participante.id) || 0) + 1);
    });
    rankingComPos.filter((r) => r.posicao <= 10).forEach((r) => {
      top10.set(r.participante.id, (top10.get(r.participante.id) || 0) + 1);
    });
  }

  return buildResultadoPossibilidades(
    participantes,
    rankingAtual,
    vitorias,
    podio,
    top10,
    iteracoes,
    jogosPendentes.length,
    false
  );
}

function buildResultadoPossibilidades(
  participantes,
  rankingAtual,
  vitorias,
  podio,
  top10,
  iteracoes,
  jogosPendentes,
  encerrado
) {
  return {
    iteracoes,
    jogosPendentes,
    rankingAtual,
    resultados: participantes
      .map((p) => {
        const r = rankingAtual.find((x) => x.participante.id === p.id);
        return {
          participante: p,
          posicaoAtual: r?.posicao ?? null,
          pontosAtual: r?.pontosTotal ?? 0,
          probVencer: ((vitorias.get(p.id) || 0) / iteracoes) * 100,
          probPodio: ((podio.get(p.id) || 0) / iteracoes) * 100,
          probTop10: ((top10.get(p.id) || 0) / iteracoes) * 100,
        };
      })
      .sort((a, b) => b.probVencer - a.probVencer || a.posicaoAtual - b.posicaoAtual),
    encerrado,
  };
}

function construirOverridesPalpitesProprios(participanteId, jogosPendentes, palpitesMap) {
  const overrides = {};
  let jogosSimulados = 0;
  for (const jogo of jogosPendentes) {
    const palpite = palpitesMap.get(`${participanteId}:${jogo.id}`);
    if (!palpite) continue;
    overrides[jogo.id] = { gols_a: palpite.gols_a, gols_b: palpite.gols_b };
    jogosSimulados++;
  }
  return { overrides, jogosSimulados };
}

function encontrarVizinhosRanking(rankingSim, participanteId) {
  const idx = rankingSim.findIndex((r) => r.participante.id === participanteId);
  if (idx === -1) return null;

  const alvo = rankingSim[idx];

  let acima = null;
  for (let i = idx - 1; i >= 0; i--) {
    if (rankingSim[i].pontosTotal > alvo.pontosTotal) {
      acima = rankingSim[i];
      break;
    }
  }

  let abaixo = null;
  for (let i = idx + 1; i < rankingSim.length; i++) {
    if (rankingSim[i].pontosTotal < alvo.pontosTotal) {
      abaixo = rankingSim[i];
      break;
    }
  }

  return {
    acima,
    abaixo,
    distPontosAcima: acima ? acima.pontosTotal - alvo.pontosTotal : null,
    distPontosAbaixo: abaixo ? alvo.pontosTotal - abaixo.pontosTotal : null,
  };
}

/**
 * Para cada participante: simula os jogos pendentes com resultados iguais aos seus palpites.
 * Calcula pontuação final, posição no bolão e distância em pontos aos vizinhos imediatos.
 */
export function calcularSimulacaoPalpitesProprios(participantes, jogos, palpites) {
  const palpitesMap = new Map(
    palpites.map((p) => [`${p.participante_id}:${p.jogo_id}`, p])
  );

  const jogosPendentes = jogos.filter((j) => !jogoFinalizado(j));
  const rankingAtual = calcularRanking(participantes, jogos, palpites);

  const resultados = participantes.map((alvo) => {
    const atual = rankingAtual.find((r) => r.participante.id === alvo.id);
    const { overrides, jogosSimulados } = construirOverridesPalpitesProprios(
      alvo.id,
      jogosPendentes,
      palpitesMap
    );

    const rankingSim = calcularRankingComOverrides(
      participantes,
      jogos,
      palpites,
      overrides
    );

    const final = rankingSim.find((r) => r.participante.id === alvo.id);
    const viz = final ? encontrarVizinhosRanking(rankingSim, alvo.id) : null;

    const posicaoAtual = atual?.posicao ?? null;
    const posicaoFinal = final?.posicao ?? null;

    return {
      participante: alvo,
      posicaoAtual,
      pontosAtual: atual?.pontosTotal ?? 0,
      posicaoFinal,
      pontosFinal: final?.pontosTotal ?? 0,
      deltaPosicao:
        posicaoAtual != null && posicaoFinal != null
          ? posicaoAtual - posicaoFinal
          : null,
      deltaPontos: (final?.pontosTotal ?? 0) - (atual?.pontosTotal ?? 0),
      jogosSimulados,
      jogosPendentes: jogosPendentes.length,
      vizinhoAcima: viz?.acima ?? null,
      vizinhoAbaixo: viz?.abaixo ?? null,
      distPontosAcima: viz?.distPontosAcima ?? null,
      distPontosAbaixo: viz?.distPontosAbaixo ?? null,
    };
  });

  resultados.sort(
    (a, b) =>
      (a.posicaoFinal ?? 999) - (b.posicaoFinal ?? 999) ||
      b.pontosFinal - a.pontosFinal
  );

  return {
    jogosPendentes: jogosPendentes.length,
    encerrado: jogosPendentes.length === 0,
    rankingAtual,
    resultados,
  };
}

function escolherPlacarFavorito(palpitesJogo) {
  const counts = new Map();
  for (const p of palpitesJogo) {
    const ga = parseInt(p.gols_a, 10);
    const gb = parseInt(p.gols_b, 10);
    if (Number.isNaN(ga) || Number.isNaN(gb)) continue;
    const key = `${ga}-${gb}`;
    counts.set(key, (counts.get(key) || 0) + 1);
  }

  let melhor = null;
  let melhorCount = -1;

  for (const [key, count] of counts) {
    const [ga, gb] = key.split('-').map(Number);
    if (
      count > melhorCount ||
      (count === melhorCount &&
        melhor &&
        (ga + gb < melhor.gols_a + melhor.gols_b ||
          (ga + gb === melhor.gols_a + melhor.gols_b && ga < melhor.gols_a)))
    ) {
      melhor = { gols_a: ga, gols_b: gb, count };
      melhorCount = count;
    }
  }

  return melhor;
}

export function calcularAnalisePlacarFavorito(participantes, jogos, palpites) {
  const palpitesPorJogo = new Map();
  for (const p of palpites) {
    if (!palpitesPorJogo.has(p.jogo_id)) palpitesPorJogo.set(p.jogo_id, []);
    palpitesPorJogo.get(p.jogo_id).push(p);
  }

  const jogosOrdenados = [...jogos].sort(
    (a, b) => (a.ordem || 0) - (b.ordem || 0) || a.codigo.localeCompare(b.codigo)
  );

  const favoritos = [];
  const palpitesVirtuais = [];

  for (const jogo of jogosOrdenados) {
    const lista = palpitesPorJogo.get(jogo.id) || [];
    const fav = escolherPlacarFavorito(lista);
    const total = lista.length;
    const item = {
      jogo,
      gols_a: fav?.gols_a ?? null,
      gols_b: fav?.gols_b ?? null,
      votos: fav?.count ?? 0,
      pct: total > 0 && fav ? ((fav.count / total) * 100).toFixed(1) : '0.0',
      totalPalpites: total,
      pontos: null,
    };

    if (fav && jogoFinalizado(jogo)) {
      item.pontos = calcularPontos(fav.gols_a, fav.gols_b, jogo.gols_a, jogo.gols_b);
    }

    favoritos.push(item);

    if (fav) {
      palpitesVirtuais.push({
        participante_id: PLACAR_FAVORITO_ID,
        jogo_id: jogo.id,
        gols_a: fav.gols_a,
        gols_b: fav.gols_b,
      });
    }
  }

  const virtual = {
    id: PLACAR_FAVORITO_ID,
    nome: PLACAR_FAVORITO_NOME,
    cidade: 'Consenso estatístico',
  };

  const ranking = calcularRanking(
    [...participantes, virtual],
    jogos,
    [...palpites, ...palpitesVirtuais]
  );

  const statsVirtual = ranking.find((r) => r.participante.id === PLACAR_FAVORITO_ID);

  let posicaoEntreHumanos = null;
  if (statsVirtual) {
    const rankingHumanos = calcularRanking(participantes, jogos, palpites);
    posicaoEntreHumanos = calcularPosicaoPorPontuacao(
      statsVirtual.pontosTotal,
      rankingHumanos
    );
  }

  const pontosPossiveis = jogos.filter(jogoFinalizado).length * 12;
  const pontosObtidos = favoritos
    .filter((f) => f.pontos !== null)
    .reduce((s, f) => s + f.pontos, 0);

  return {
    favoritos,
    statsVirtual,
    posicaoEntreHumanos,
    rankingComVirtual: ranking,
    resumo: {
      jogosComFavorito: favoritos.filter((f) => f.gols_a !== null).length,
      pontosObtidos,
      pontosPossiveis,
      aproveitamento:
        pontosPossiveis > 0
          ? Math.round((pontosObtidos / pontosPossiveis) * 100)
          : 0,
    },
  };
}
