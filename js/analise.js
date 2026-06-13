import { jogoFinalizado } from './scoring.js';

const DURACAO_JOGO_MS = 105 * 60 * 1000;

export function getJogosPendentes(jogos) {
  return jogos
    .filter((j) => !jogoFinalizado(j))
    .sort((a, b) => {
      const da = new Date(a.data_jogo || 0).getTime();
      const db = new Date(b.data_jogo || 0).getTime();
      return da - db || (a.ordem || 0) - (b.ordem || 0);
    });
}

/** Próximo jogo ou jogo em andamento (sem resultado oficial). */
export function getJogoPadraoAnalise(jogos) {
  const pendentes = getJogosPendentes(jogos);
  if (!pendentes.length) return null;

  const now = Date.now();

  const emAndamento = pendentes.find((j) => {
    if (!j.data_jogo) return false;
    const inicio = new Date(j.data_jogo).getTime();
    return inicio <= now && now <= inicio + DURACAO_JOGO_MS;
  });
  if (emAndamento) return emAndamento;

  const proximo = pendentes.find((j) => j.data_jogo && new Date(j.data_jogo).getTime() >= now);
  if (proximo) return proximo;

  return pendentes[0];
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

  for (let a = 0; a <= maxGolsA; a++) {
    for (let b = 0; b <= maxGolsB; b++) {
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
    maxGolsA,
    maxGolsB,
    maxContagem,
    listaRanking,
  };
}

export function corHeatmap(contagem, maxContagem) {
  if (!contagem || !maxContagem) return null;
  const t = contagem / maxContagem;
  const r = 255;
  const g = Math.round(220 - t * 180);
  const b = Math.round(120 - t * 120);
  return `rgb(${r}, ${g}, ${b})`;
}
