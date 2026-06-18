import { calcularPontos, jogoFinalizado } from './scoring.js';
import { escapeHtml } from './utils.js';

/**
 * Série cumulativa de pontos jogo a jogo (apenas jogos finalizados com palpite).
 */
export function buildEvolucaoPontos(participanteId, jogos, palpites) {
  const palpitesMap = new Map(
    palpites.filter((p) => p.participante_id === participanteId).map((p) => [p.jogo_id, p])
  );

  const jogosOrd = jogos
    .filter((j) => jogoFinalizado(j) && palpitesMap.has(j.id))
    .sort(
      (a, b) =>
        (a.ordem || 0) - (b.ordem || 0) ||
        new Date(a.data_jogo || 0) - new Date(b.data_jogo || 0) ||
        a.codigo.localeCompare(b.codigo)
    );

  const pontos = [{ x: 0, y: 0, label: 'Início', codigo: '' }];
  let acum = 0;

  jogosOrd.forEach((jogo, i) => {
    const palpite = palpitesMap.get(jogo.id);
    const pts = calcularPontos(
      palpite.gols_a,
      palpite.gols_b,
      jogo.gols_a,
      jogo.gols_b
    );
    acum += pts;
    pontos.push({
      x: i + 1,
      y: acum,
      label: `J${i + 1}`,
      codigo: jogo.codigo,
    });
  });

  return pontos;
}

const CORES_SERIE = ['#29b6f6', '#00c853', '#ffd700', '#ff5252'];

/**
 * Gráfico de linha em degrau (SVG) — uma ou mais séries.
 * @param {Array<{ label: string, pontos: Array<{x,y,label,codigo?}> }>} series
 */
export function renderGraficoEvolucao(series, { height = 300 } = {}) {
  const validas = series.filter((s) => s.pontos?.length > 1);
  if (!validas.length) {
    return `<div class="evolucao-chart evolucao-chart--empty"><p>Nenhum jogo finalizado com palpite para exibir evolução.</p></div>`;
  }

  const pad = { top: 24, right: 24, bottom: 44, left: 52 };
  const width = 800;
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;

  const maxX = Math.max(...validas.flatMap((s) => s.pontos.map((p) => p.x)), 1);
  const allY = validas.flatMap((s) => s.pontos.map((p) => p.y));
  const minY = 0;
  const maxY = Math.max(...allY, 12);
  const yPad = Math.max(8, Math.ceil(maxY * 0.05));

  const xScale = (x) => pad.left + (x / maxX) * innerW;
  const yScale = (y) => pad.top + innerH - ((y - minY) / (maxY - minY + yPad)) * innerH;

  const yTicks = 5;
  let gridLines = '';
  for (let i = 0; i <= yTicks; i++) {
    const val = minY + ((maxY - minY) / yTicks) * i;
    const y = yScale(val);
    gridLines += `<line class="evolucao-chart__grid" x1="${pad.left}" y1="${y}" x2="${width - pad.right}" y2="${y}"/>`;
    gridLines += `<text class="evolucao-chart__axis-y" x="${pad.left - 8}" y="${y + 4}" text-anchor="end">${Math.round(val)}</text>`;
  }

  let xLabels = '';
  const refPontos = validas[0].pontos;
  const step = maxX > 20 ? Math.ceil(maxX / 12) : 1;
  for (let i = 0; i < refPontos.length; i += step) {
    const p = refPontos[i];
    xLabels += `<text class="evolucao-chart__axis-x" x="${xScale(p.x)}" y="${height - 12}" text-anchor="middle">${escapeHtml(p.codigo || p.label)}</text>`;
  }
  const ultimo = refPontos[refPontos.length - 1];
  if ((refPontos.length - 1) % step !== 0) {
    xLabels += `<text class="evolucao-chart__axis-x" x="${xScale(ultimo.x)}" y="${height - 12}" text-anchor="middle">${escapeHtml(ultimo.codigo || ultimo.label)}</text>`;
  }

  let paths = '';
  let dots = '';
  let legend = '';

  validas.forEach((serie, si) => {
    const cor = serie.color || CORES_SERIE[si % CORES_SERIE.length];
    const pts = serie.pontos;
    let d = `M ${xScale(pts[0].x)} ${yScale(pts[0].y)}`;
    for (let i = 1; i < pts.length; i++) {
      d += ` H ${xScale(pts[i].x)} V ${yScale(pts[i].y)}`;
    }
    paths += `<path class="evolucao-chart__line" d="${d}" stroke="${cor}" fill="none"/>`;
    pts.forEach((p) => {
      dots += `<circle class="evolucao-chart__dot" cx="${xScale(p.x)}" cy="${yScale(p.y)}" r="4" stroke="${cor}" fill="var(--bg-card)"><title>${escapeHtml(serie.label)} — ${escapeHtml(p.codigo || p.label)}: ${p.y} pts</title></circle>`;
    });
    legend += `<span class="evolucao-chart__legend-item"><span class="evolucao-chart__legend-swatch" style="background:${cor}"></span>${escapeHtml(serie.label)}</span>`;
  });

  return `
    <div class="evolucao-chart">
      <div class="evolucao-chart__legend">${legend}</div>
      <svg class="evolucao-chart__svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="Gráfico de evolução de pontos">
        ${gridLines}
        <line class="evolucao-chart__axis" x1="${pad.left}" y1="${pad.top + innerH}" x2="${width - pad.right}" y2="${pad.top + innerH}"/>
        <line class="evolucao-chart__axis" x1="${pad.left}" y1="${pad.top}" x2="${pad.left}" y2="${pad.top + innerH}"/>
        ${paths}
        ${dots}
        ${xLabels}
        <text class="evolucao-chart__axis-title" x="${pad.left + innerW / 2}" y="${height - 2}" text-anchor="middle">Jogos (ordem da copa)</text>
        <text class="evolucao-chart__axis-title" transform="translate(14 ${pad.top + innerH / 2}) rotate(-90)" text-anchor="middle">Pontos acumulados</text>
      </svg>
    </div>`;
}
