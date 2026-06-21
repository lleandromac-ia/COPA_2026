import { renderBandeira } from './flags.js';
import {
  calcularPontos,
  calcularRanking,
  formatarPlacar,
  jogoFinalizado,
} from './scoring.js';
import { escapeHtml } from './utils.js';

function compararJogosEvolucao(a, b) {
  return (
    (a.ordem || 0) - (b.ordem || 0) ||
    new Date(a.data_jogo || 0) - new Date(b.data_jogo || 0) ||
    a.codigo.localeCompare(b.codigo)
  );
}

function getJogosEvolucaoParticipante(participanteId, jogos, palpites) {
  const palpitesMap = new Map(
    palpites.filter((p) => p.participante_id === participanteId).map((p) => [p.jogo_id, p])
  );

  return jogos
    .filter((j) => jogoFinalizado(j) && palpitesMap.has(j.id))
    .sort(compararJogosEvolucao);
}

function jogosSnapshotAte(jogos, jogoLimite) {
  return jogos.map((j) => {
    if (!jogoFinalizado(j)) return j;
    if (compararJogosEvolucao(j, jogoLimite) <= 0) return j;
    return { ...j, gols_a: null, gols_b: null };
  });
}

function criarPontoJogo(jogo, x, y, label) {
  return {
    x,
    y,
    label,
    codigo: jogo?.codigo || '',
    jogo: jogo
      ? {
          codigo: jogo.codigo,
          time_a: jogo.time_a,
          time_b: jogo.time_b,
          gols_a: jogo.gols_a,
          gols_b: jogo.gols_b,
        }
      : null,
  };
}

/**
 * Série cumulativa de pontos jogo a jogo (apenas jogos finalizados com palpite).
 */
export function buildEvolucaoPontos(participanteId, jogos, palpites) {
  const palpitesMap = new Map(
    palpites.filter((p) => p.participante_id === participanteId).map((p) => [p.jogo_id, p])
  );

  const jogosOrd = getJogosEvolucaoParticipante(participanteId, jogos, palpites);
  const pontos = [criarPontoJogo(null, 0, 0, 'Início')];
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
    pontos.push(criarPontoJogo(jogo, i + 1, acum, `J${i + 1}`));
  });

  return pontos;
}

/**
 * Posição no ranking após cada jogo finalizado (considera todos os jogos até aquele momento).
 */
export function buildEvolucaoPosicao(participanteId, participantes, jogos, palpites) {
  const jogosOrd = getJogosEvolucaoParticipante(participanteId, jogos, palpites);
  const posicoes = [criarPontoJogo(null, 0, 1, 'Início')];

  jogosOrd.forEach((jogo, i) => {
    const snapshot = jogosSnapshotAte(jogos, jogo);
    const ranking = calcularRanking(participantes, snapshot, palpites);
    const item = ranking.find((r) => r.participante.id === participanteId);
    posicoes.push(criarPontoJogo(jogo, i + 1, item?.posicao ?? null, `J${i + 1}`));
  });

  return posicoes;
}

const CORES_SERIE = ['#29b6f6', '#00c853', '#ffd700', '#ff5252'];

function renderTooltipJogo(p, modo) {
  if (!p.jogo) {
    return `<div class="evolucao-chart__tooltip-meta">${modo === 'posicao' ? 'Antes dos jogos · 1º lugar' : 'Início · 0 pts'}</div>`;
  }

  const { time_a, time_b, gols_a, gols_b, codigo } = p.jogo;
  const valor =
    modo === 'posicao'
      ? `<strong>${p.y}º</strong> lugar`
      : `<strong>${p.y}</strong> pts acumulados`;

  return `
    <div class="evolucao-chart__tooltip-codigo">${escapeHtml(codigo)}</div>
    <div class="evolucao-chart__tooltip-match">
      <span class="evolucao-chart__tooltip-team">${renderBandeira(time_a, 'team-flag team-flag--tooltip')}${escapeHtml(time_a)}</span>
      <span class="evolucao-chart__tooltip-placar">${formatarPlacar(gols_a, gols_b)}</span>
      <span class="evolucao-chart__tooltip-team">${renderBandeira(time_b, 'team-flag team-flag--tooltip')}${escapeHtml(time_b)}</span>
    </div>
    <div class="evolucao-chart__tooltip-meta">${valor}</div>`;
}

function renderGraficoEvolucaoInterno(series, { height = 300, modo = 'pontos', maxPosicao } = {}) {
  const validas = series.filter((s) => s.pontos?.length > 1);
  if (!validas.length) {
    return `<div class="evolucao-chart evolucao-chart--empty"><p>Nenhum jogo finalizado com palpite para exibir evolução.</p></div>`;
  }

  const invertido = modo === 'posicao';
  const pad = invertido
    ? { top: 44, right: 24, bottom: 24, left: 52 }
    : { top: 24, right: 24, bottom: 44, left: 52 };
  const width = 800;
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;

  const maxX = Math.max(...validas.flatMap((s) => s.pontos.map((p) => p.x)), 1);
  const allY = validas.flatMap((s) => s.pontos.map((p) => p.y).filter((y) => y != null));
  const minY = invertido ? 1 : 0;
  const maxValorY = allY.length ? Math.max(...allY) : minY;
  const maxY = invertido
    ? Math.max(maxValorY, maxPosicao || 5)
    : Math.max(maxValorY, 12);
  const yPad = invertido ? 0 : Math.max(8, Math.ceil(maxY * 0.05));
  const yRange = maxY - minY + (invertido ? 0 : yPad);

  const xScale = (x) => pad.left + (x / maxX) * innerW;
  const yScale = (y) => {
    if (invertido) {
      return pad.top + ((y - minY) / Math.max(yRange, 1)) * innerH;
    }
    return pad.top + innerH - ((y - minY) / yRange) * innerH;
  };

  const yTicks = invertido ? Math.min(6, maxY - minY + 1) : 5;
  let gridLines = '';
  for (let i = 0; i <= yTicks; i++) {
    const val = invertido
      ? Math.round(minY + ((maxY - minY) / yTicks) * i)
      : minY + ((maxY - minY) / yTicks) * i;
    const y = yScale(val);
    gridLines += `<line class="evolucao-chart__grid" x1="${pad.left}" y1="${y}" x2="${width - pad.right}" y2="${y}"/>`;
    gridLines += `<text class="evolucao-chart__axis-y" x="${pad.left - 8}" y="${y + 4}" text-anchor="end">${Math.round(val)}</text>`;
  }

  let xLabels = '';
  const refPontos = validas[0].pontos;
  const step = maxX > 20 ? Math.ceil(maxX / 12) : 1;
  const xLabelY = invertido ? pad.top - 10 : height - 12;
  const xTitleY = invertido ? 12 : height - 2;

  for (let i = 0; i < refPontos.length; i += step) {
    const p = refPontos[i];
    xLabels += `<text class="evolucao-chart__axis-x" x="${xScale(p.x)}" y="${xLabelY}" text-anchor="middle">${escapeHtml(p.codigo || p.label)}</text>`;
  }
  const ultimo = refPontos[refPontos.length - 1];
  if ((refPontos.length - 1) % step !== 0) {
    xLabels += `<text class="evolucao-chart__axis-x" x="${xScale(ultimo.x)}" y="${xLabelY}" text-anchor="middle">${escapeHtml(ultimo.codigo || ultimo.label)}</text>`;
  }

  let paths = '';
  let dots = '';
  let legend = '';

  validas.forEach((serie, si) => {
    const cor = serie.color || CORES_SERIE[si % CORES_SERIE.length];
    const pts = serie.pontos.filter((p) => p.y != null);
    if (pts.length < 2) return;

    let d = `M ${xScale(pts[0].x)} ${yScale(pts[0].y)}`;
    for (let i = 1; i < pts.length; i++) {
      d += ` H ${xScale(pts[i].x)} V ${yScale(pts[i].y)}`;
    }
    paths += `<path class="evolucao-chart__line" d="${d}" stroke="${cor}" fill="none"/>`;

    pts.forEach((p, pi) => {
      const cx = xScale(p.x);
      const cy = yScale(p.y);
      const tooltipId = `evolucao-tip-${modo}-${si}-${pi}`;
      dots += `
        <g class="evolucao-chart__point" data-chart-point tabindex="0" role="button" aria-describedby="${tooltipId}">
          <circle class="evolucao-chart__hit" cx="${cx}" cy="${cy}" r="14"/>
          <circle class="evolucao-chart__dot" cx="${cx}" cy="${cy}" r="4" stroke="${cor}" fill="var(--bg-card)"/>
        </g>`;
    });

    legend += `<span class="evolucao-chart__legend-item"><span class="evolucao-chart__legend-swatch" style="background:${cor}"></span>${escapeHtml(serie.label)}</span>`;
  });

  const eixoX = invertido ? pad.top : pad.top + innerH;
  const eixoYTop = pad.top;
  const eixoYBottom = pad.top + innerH;
  const tituloY = invertido ? 'Posição no ranking' : 'Pontos acumulados';
  const ariaLabel =
    modo === 'posicao'
      ? 'Gráfico de evolução de posição no ranking'
      : 'Gráfico de evolução de pontos';

  const tooltipsHtml = validas
    .flatMap((serie, si) =>
      serie.pontos
        .filter((p) => p.y != null)
        .map(
          (p, pi) => `
            <div class="evolucao-chart__tooltip" id="evolucao-tip-${modo}-${si}-${pi}" hidden>
              ${renderTooltipJogo(p, modo)}
            </div>`
        )
    )
    .join('');

  return `
    <div class="evolucao-chart" data-evolucao-modo="${modo}">
      <div class="evolucao-chart__legend">${legend}</div>
      <div class="evolucao-chart__stage">
        <svg class="evolucao-chart__svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="${ariaLabel}">
          ${gridLines}
          <line class="evolucao-chart__axis" x1="${pad.left}" y1="${eixoX}" x2="${width - pad.right}" y2="${eixoX}"/>
          <line class="evolucao-chart__axis" x1="${pad.left}" y1="${eixoYTop}" x2="${pad.left}" y2="${eixoYBottom}"/>
          ${paths}
          ${dots}
          ${xLabels}
          <text class="evolucao-chart__axis-title" x="${pad.left + innerW / 2}" y="${xTitleY}" text-anchor="middle">Jogos (ordem da copa)</text>
          <text class="evolucao-chart__axis-title" transform="translate(14 ${pad.top + innerH / 2}) rotate(-90)" text-anchor="middle">${tituloY}</text>
        </svg>
        <div class="evolucao-chart__tooltip-layer" aria-live="polite">${tooltipsHtml}</div>
      </div>
    </div>`;
}

/**
 * Gráfico de linha em degrau (SVG) — uma ou mais séries de pontos acumulados.
 */
export function renderGraficoEvolucao(series, options = {}) {
  return renderGraficoEvolucaoInterno(series, { ...options, modo: 'pontos' });
}

/**
 * Gráfico de linha em degrau (SVG) — evolução da posição no ranking (eixo Y invertido).
 */
export function renderGraficoEvolucaoPosicao(series, options = {}) {
  return renderGraficoEvolucaoInterno(series, { ...options, modo: 'posicao' });
}

function posicionarTooltip(chart, point, tooltip) {
  const stage = chart.querySelector('.evolucao-chart__stage');
  const hit = point.querySelector('.evolucao-chart__hit');
  if (!stage || !hit || !tooltip) return;

  const stageRect = stage.getBoundingClientRect();
  const hitRect = hit.getBoundingClientRect();
  const tipRect = tooltip.getBoundingClientRect();

  const cx = hitRect.left + hitRect.width / 2 - stageRect.left;
  const cy = hitRect.top + hitRect.height / 2 - stageRect.top;

  let left = cx - tipRect.width / 2;
  let top = cy - tipRect.height - 12;

  left = Math.max(8, Math.min(left, stageRect.width - tipRect.width - 8));

  if (top < 8) {
    top = cy + hitRect.height / 2 + 12;
  }
  if (top + tipRect.height > stageRect.height - 8) {
    top = Math.max(8, stageRect.height - tipRect.height - 8);
  }

  tooltip.style.left = `${left}px`;
  tooltip.style.top = `${top}px`;
}

function fecharTooltipsChart(chart, exceto = null) {
  chart.querySelectorAll('.evolucao-chart__tooltip').forEach((tip) => {
    if (tip !== exceto) tip.hidden = true;
  });
  chart.querySelectorAll('.evolucao-chart__point').forEach((point) => {
    if (!exceto || point.querySelector(`#${exceto.id}`) == null) {
      point.classList.remove('evolucao-chart__point--active');
    }
  });
}

function abrirTooltip(chart, point) {
  const tipId = point.getAttribute('aria-describedby');
  const tooltip = tipId ? chart.querySelector(`#${CSS.escape(tipId)}`) : null;
  if (!tooltip) return;

  fecharTooltipsChart(chart, tooltip);
  tooltip.hidden = false;
  point.classList.add('evolucao-chart__point--active');
  posicionarTooltip(chart, point, tooltip);
}

function setupEvolucaoChart(chart) {
  if (chart.dataset.evolucaoReady === '1') return;
  chart.dataset.evolucaoReady = '1';

  chart.querySelectorAll('.evolucao-chart__point').forEach((point) => {
    point.addEventListener('mouseenter', () => abrirTooltip(chart, point));
    point.addEventListener('mouseleave', () => {
      fecharTooltipsChart(chart);
    });
    point.addEventListener('focus', () => abrirTooltip(chart, point));
    point.addEventListener('blur', () => fecharTooltipsChart(chart));
    point.addEventListener('click', (e) => {
      e.stopPropagation();
      const tipId = point.getAttribute('aria-describedby');
      const tooltip = tipId ? chart.querySelector(`#${CSS.escape(tipId)}`) : null;
      if (tooltip?.hidden) {
        abrirTooltip(chart, point);
      } else {
        fecharTooltipsChart(chart);
      }
    });
  });

  chart.addEventListener('click', (e) => {
    if (!e.target.closest('.evolucao-chart__point')) {
      fecharTooltipsChart(chart);
    }
  });
}

/** Ativa tooltips interativos nos gráficos de evolução dentro de um container. */
export function setupEvolucaoCharts(root) {
  if (!root) return;
  root.querySelectorAll('.evolucao-chart[data-evolucao-modo]').forEach(setupEvolucaoChart);
}
