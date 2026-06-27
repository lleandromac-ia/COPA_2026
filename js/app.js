import { ADMIN_PIN } from './config.js';
import {
  carregarDados,
  criarParticipante,
  excluirParticipante,
  salvarPalpite,
  salvarResultadoJogo,
  excluirResultadoJogo,
  atualizarConfiguracao,
} from './db.js';
import {
  calcularRanking,
  compararParticipantes,
  calcularEstatisticasParticipante,
  calcularPontos,
  formatarPlacar,
  jogoFinalizado,
} from './scoring.js';
import {
  $,
  $$,
  showToast,
  formatDate,
  escapeHtml,
  isAdmin,
  setAdmin,
  exportTableToCSV,
  GRUPOS,
  getNomeParticipante,
  formatarDataJogo,
  formatarHoraJogo,
  numeroJogo,
  isJogoDiaAnterior,
} from './utils.js';
import { renderBandeira } from './flags.js';
import {
  buildEvolucaoPontos,
  buildEvolucaoPosicao,
  renderGraficoEvolucao,
  renderGraficoEvolucaoPosicao,
  setupEvolucaoCharts,
} from './charts.js';
import { setupImportacao } from './import-ui.js';
import {
  TIPOS_ANALISE,
  getAnalisesHabilitadas,
  getTodosJogosAnalise,
  getJogoPadraoAnalise,
  analisarPalpitesJogo,
  simularRankingComPlacar,
  calcularPossibilidadesVencer,
  calcularSimulacaoPalpitesProprios,
  calcularAnalisePlacarFavorito,
  corHeatmap,
  PLACAR_FAVORITO_ID,
  PLACAR_FAVORITO_NOME,
} from './analise.js';

let state = {
  config: {
    cadastro_bloqueado: false,
    analise_palpites_jogo: true,
    analise_possibilidades_vencer: false,
    analise_possibilidades_exaustivas: false,
    analise_placar_favorito: false,
  },
  participantes: [],
  jogos: [],
  palpites: [],
};

const analiseState = {
  tipo: null,
  simulacao: null,
  simulacaoPalpitesOrdenacao: 'pontos',
};

const adminUi = {
  ocultarJogosAnteriores: true,
};

const palpitesPendentes = new Map();

async function init() {
  setupNavigation();
  setupForms();

  try {
    await refreshData();
    $('#loading').style.display = 'none';
    navigateTo('dashboard');
  } catch (err) {
    $('#loading').innerHTML = `
      <div class="empty-state">
        <div class="empty-state__icon">⚠️</div>
        <p><strong>Erro ao conectar com o Supabase</strong></p>
        <p style="margin-top: 0.5rem; font-size: 0.85rem;">${escapeHtml(err.message)}</p>
        <p style="margin-top: 0.75rem; font-size: 0.82rem; color: var(--text-muted);">
          Configure js/config.js e execute supabase/schema.sql no seu projeto.
        </p>
      </div>`;
  }
}

async function refreshData() {
  const dados = await carregarDados();
  state = dados;
  populateSelects();
  updateNavVisibility();
  updateAdminUI();
  renderCurrentView();
}

function setupNavigation() {
  $$('[data-nav]').forEach((el) => {
    el.addEventListener('click', (e) => {
      e.preventDefault();
      navigateTo(el.dataset.nav);
    });
  });
}

function navigateTo(view) {
  if (view === 'participantes' && state.config.cadastro_bloqueado) {
    view = 'dashboard';
  }

  if (view === 'analise' && !getAnalisesHabilitadas(state.config).length) {
    view = 'dashboard';
  }

  const activeView = $('.view--active');
  const viewAnterior = activeView?.id?.replace('view-', '');
  if (viewAnterior === 'admin' && view !== 'admin' && isAdmin()) {
    encerrarModoAdmin(false);
  }

  $$('.view').forEach((v) => v.classList.remove('view--active'));
  $$('.nav__link').forEach((l) => l.classList.remove('nav__link--active'));

  const viewEl = $(`#view-${view}`);
  const navEl = $(`[data-nav="${view}"]`);
  if (viewEl) viewEl.classList.add('view--active');
  if (navEl) navEl.classList.add('nav__link--active');

  renderView(view);
}

function renderCurrentView() {
  const active = $('.view--active');
  if (active) renderView(active.id.replace('view-', ''));
}

function renderView(view) {
  switch (view) {
    case 'dashboard': renderDashboard(); break;
    case 'participantes': renderParticipantes(); break;
    case 'palpites': renderPalpites(); break;
    case 'analise':
      ensureAnaliseTipo();
      if (analiseState.tipo === 'palpites_jogo') definirJogoPadraoAnalise();
      renderAnalise();
      break;
    case 'ranking': renderRanking(); break;
    case 'comparacao': renderComparacao(); break;
    case 'perfil': renderPerfil(); break;
    case 'admin': renderAdmin(); break;
  }
}

function populateSelects() {
  const options = state.participantes
    .map((p) => `<option value="${p.id}">${escapeHtml(getNomeParticipante(p))}</option>`)
    .join('');

  ['palpite-participante', 'comp-p1', 'comp-p2', 'perfil-select'].forEach((id) => {
    const sel = $(`#${id}`);
    if (!sel) return;
    const placeholder =
      id === 'comp-p2'
        ? '<option value="">Selecione...</option>'
        : '<option value="">Selecione um participante</option>';
    sel.innerHTML = placeholder + options;
  });

  ['filtro-grupo-palpites', 'filtro-grupo-admin'].forEach((id) => {
    const sel = $(`#${id}`);
    if (!sel) return;
    const current = sel.value;
    sel.innerHTML =
      '<option value="">Todos</option>' +
      GRUPOS.map((g) => `<option value="${g}">Grupo ${g}</option>`).join('');
    sel.value = current;
  });

  populateAnaliseSelect();
  updateAnaliseNavVisibility();
}

function getAnalisesAtivas() {
  return getAnalisesHabilitadas(state.config);
}

function ensureAnaliseTipo() {
  const ativas = getAnalisesAtivas();
  if (!ativas.length) {
    analiseState.tipo = null;
    return;
  }
  if (!ativas.some((t) => t.id === analiseState.tipo)) {
    analiseState.tipo = ativas[0].id;
  }
}

function updateAnaliseNavVisibility() {
  const navAnalise = $('[data-nav="analise"]');
  if (!navAnalise) return;
  const ativas = getAnalisesAtivas();
  navAnalise.style.display = ativas.length ? '' : 'none';
  if (!ativas.length && $('#view-analise')?.classList.contains('view--active')) {
    navigateTo('dashboard');
  }
}

function populateAnaliseSelect() {
  const sel = $('#analise-jogo');
  if (!sel) return;

  const current = sel.value;
  const todos = getTodosJogosAnalise(state.jogos);
  const padrao = getJogoPadraoAnalise(state.jogos);

  if (!todos.length) {
    sel.innerHTML = '<option value="">Nenhuma partida cadastrada</option>';
    return;
  }

  sel.innerHTML = todos
    .map((j) => {
      const status = jogoFinalizado(j) ? ' ✓' : '';
      const label = `${j.codigo} — ${j.time_a} x ${j.time_b} (${formatarDataJogo(j.data_jogo)} ${formatarHoraJogo(j.data_jogo)})${status}`;
      return `<option value="${j.id}">${escapeHtml(label)}</option>`;
    })
    .join('');

  if (current && todos.some((j) => j.id === current)) {
    sel.value = current;
  } else if (padrao) {
    sel.value = padrao.id;
  }
}

function definirJogoPadraoAnalise() {
  const padrao = getJogoPadraoAnalise(state.jogos);
  const sel = $('#analise-jogo');
  if (padrao && sel && sel.options.length) {
    sel.value = padrao.id;
  }
}

function updateNavVisibility() {
  const navParticipantes = $('#nav-participantes');
  if (!navParticipantes) return;

  const ocultar = state.config.cadastro_bloqueado;
  navParticipantes.style.display = ocultar ? 'none' : '';

  updateAnaliseNavVisibility();

  if (ocultar && $('#view-participantes')?.classList.contains('view--active')) {
    navigateTo('dashboard');
  }
}

function getRanking() {
  return calcularRanking(state.participantes, state.jogos, state.palpites);
}

function renderDashboard() {
  const ranking = getRanking();
  const jogosRealizados = state.jogos.filter(jogoFinalizado).length;
  const jogosRestantes = state.jogos.length - jogosRealizados;
  const maiorPontuacao = ranking.length ? ranking[0].pontosTotal : 0;
  const lider = ranking.length ? getNomeParticipante(ranking[0].participante) : '—';
  const mediaGeral =
    ranking.length > 0
      ? Math.round(ranking.reduce((s, r) => s + r.pontosTotal, 0) / ranking.length)
      : 0;

  $('#dashboard-cards').innerHTML = `
    <div class="stat-card"><div class="stat-card__label">Participantes</div><div class="stat-card__value">${state.participantes.length}</div></div>
    <div class="stat-card"><div class="stat-card__label">Jogos Realizados</div><div class="stat-card__value">${jogosRealizados}</div></div>
    <div class="stat-card"><div class="stat-card__label">Jogos Restantes</div><div class="stat-card__value">${jogosRestantes}</div></div>
    <div class="stat-card"><div class="stat-card__label">Maior Pontuação</div><div class="stat-card__value stat-card__value--gold">${maiorPontuacao}</div></div>
    <div class="stat-card"><div class="stat-card__label">Líder Atual</div><div class="stat-card__value" style="font-size:1.2rem;color:var(--gold)">${escapeHtml(lider)}</div></div>
    <div class="stat-card"><div class="stat-card__label">Média Geral</div><div class="stat-card__value">${mediaGeral}</div></div>`;

  if (!ranking.length) {
    $('#dashboard-ranking').innerHTML = '<div class="empty-state"><div class="empty-state__icon">🏆</div><p>Nenhum participante cadastrado ainda.</p></div>';
    return;
  }

  $('#dashboard-ranking').innerHTML = `
    <table>
      <thead><tr><th>Pos.</th><th>Participante</th><th>Pontos</th><th>Exatos</th><th>Vencedores</th></tr></thead>
      <tbody>${ranking.slice(0, 10).map((r) => `
        <tr>
          <td>${posBadge(r.posicao)}</td>
          <td>${escapeHtml(getNomeParticipante(r.participante))}</td>
          <td><strong>${r.pontosTotal}</strong></td>
          <td>${r.placaresExatos}</td>
          <td>${r.acertosVencedor}</td>
        </tr>`).join('')}
      </tbody>
    </table>`;
}

function posBadge(pos) {
  const cls = pos <= 3 ? `pos-badge--${pos}` : 'pos-badge--other';
  return `<span class="pos-badge ${cls}">${pos}</span>`;
}

function renderJogoComBandeiras(jogo, { showCodigo = true } = {}) {
  const codigo = showCodigo
    ? `<span class="jogo-match__codigo">${escapeHtml(jogo.codigo)}</span>`
    : '';
  return `
    <div class="jogo-match">
      ${codigo}
      <div class="jogo-match__teams">
        <span class="jogo-match__team">
          ${renderBandeira(jogo.time_a)}
          <span>${escapeHtml(jogo.time_a)}</span>
        </span>
        <span class="jogo-match__vs">x</span>
        <span class="jogo-match__team">
          ${renderBandeira(jogo.time_b)}
          <span>${escapeHtml(jogo.time_b)}</span>
        </span>
      </div>
    </div>`;
}

function pontosBadgeClass(pontos) {
  if (pontos === 12) return 'pontos-badge--12';
  if (pontos === 9) return 'pontos-badge--9';
  if (pontos === 7) return 'pontos-badge--7';
  if (pontos === 5) return 'pontos-badge--5';
  return 'pontos-badge--0';
}

function renderParticipantes() {
  const bloqueado = state.config.cadastro_bloqueado && !isAdmin();
  $('#form-participante-panel').style.display = bloqueado ? 'none' : 'block';

  const avisoEl = $('#aviso-bloqueio');
  if (avisoEl) avisoEl.remove();
  if (bloqueado) {
    const aviso = document.createElement('p');
    aviso.id = 'aviso-bloqueio';
    aviso.style.cssText = 'color:var(--warning);margin-bottom:1rem;font-size:0.85rem;';
    aviso.textContent = '⚠️ Cadastro de novos participantes está bloqueado pelo administrador.';
    $('#lista-participantes').parentElement.insertBefore(aviso, $('#lista-participantes'));
  }

  if (!state.participantes.length) {
    $('#lista-participantes').innerHTML = '<div class="empty-state"><div class="empty-state__icon">👥</div><p>Nenhum participante cadastrado.</p></div>';
    return;
  }

  $('#lista-participantes').innerHTML = `
    <table>
      <thead><tr><th>Nome</th><th>Cidade</th><th>Cadastro</th><th></th></tr></thead>
      <tbody>${state.participantes.map((p) => `
        <tr>
          <td><strong>${escapeHtml(p.nome)}</strong></td>
          <td>${escapeHtml(p.cidade || '—')}</td>
          <td>${formatDate(p.created_at)}</td>
          <td>${isAdmin() ? `<button class="btn btn--danger btn--sm" data-delete="${p.id}">Excluir</button>` : ''}</td>
        </tr>`).join('')}
      </tbody>
    </table>`;

  $$('[data-delete]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      if (!confirm('Excluir este participante e todos os seus palpites?')) return;
      try {
        await excluirParticipante(btn.dataset.delete);
        showToast('Participante excluído.', 'success');
        await refreshData();
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
  });
}

function palpitesSomenteConsulta() {
  return state.config.cadastro_bloqueado;
}

function renderPalpites() {
  const participanteId = $('#palpite-participante').value;
  const grupoFiltro = $('#filtro-grupo-palpites').value;
  const container = $('#palpites-container');
  const somenteConsulta = palpitesSomenteConsulta();

  $('#btn-salvar-palpites').style.display = somenteConsulta ? 'none' : '';
  $('#palpites-page-desc').textContent = somenteConsulta
    ? 'Consulta dos palpites registrados. O cadastro está bloqueado pelo administrador.'
    : 'Registre os palpites para os 72 jogos da fase de grupos.';

  const avisoConsulta = $('#aviso-palpites-consulta');
  if (somenteConsulta) {
    avisoConsulta.style.display = 'block';
    avisoConsulta.textContent =
      'ℹ️ Modo consulta: os palpites não podem ser alterados enquanto novos cadastros estiverem bloqueados.';
  } else {
    avisoConsulta.style.display = 'none';
  }

  if (!participanteId) {
    container.innerHTML = `<div class="empty-state"><div class="empty-state__icon">🎯</div><p>Selecione um participante para ${somenteConsulta ? 'consultar os' : 'registrar'} palpites.</p></div>`;
    return;
  }

  const palpitesMap = new Map(
    state.palpites
      .filter((p) => p.participante_id === participanteId)
      .map((p) => [p.jogo_id, p])
  );

  const jogosFiltrados = state.jogos.filter(
    (j) => !grupoFiltro || j.grupo === grupoFiltro
  );

  const gruposPresentes = [...new Set(jogosFiltrados.map((j) => j.grupo))].sort();

  container.innerHTML = gruposPresentes
    .map((grupo) => renderGrupoPalpitesTable(grupo, jogosFiltrados, palpitesMap, somenteConsulta))
    .join('');
}

function renderGrupoPalpitesTable(grupo, jogosFiltrados, palpitesMap, somenteConsulta) {
  const jogosGrupo = jogosFiltrados
    .filter((j) => j.grupo === grupo)
    .sort((a, b) => (a.ordem || 0) - (b.ordem || 0) || a.codigo.localeCompare(b.codigo));

  const linhas = jogosGrupo
    .map((jogo, idx) =>
      renderJogoPalpiteRow(jogo, palpitesMap.get(jogo.id), somenteConsulta, idx === 0, jogosGrupo.length)
    )
    .join('');

  return `
    <div class="panel palpites-grupo">
      <div class="table-wrap">
        <table class="palpites-table">
          <thead>
            <tr>
              <th class="palpites-th-grupo">Grupo</th>
              <th class="palpites-th-num">Nº</th>
              <th class="palpites-th-data">Data</th>
              <th class="palpites-th-hora">Hora</th>
              <th class="palpites-th-jogo">Jogo</th>
            </tr>
          </thead>
          <tbody>${linhas}</tbody>
        </table>
      </div>
    </div>`;
}

function renderJogoPalpiteRow(jogo, palpite, somenteConsulta = false, primeiraLinha = false, totalLinhas = 1) {
  const golsA = palpite?.gols_a ?? '';
  const golsB = palpite?.gols_b ?? '';
  const finalizado = jogoFinalizado(jogo);
  const somenteLeitura = somenteConsulta || finalizado;
  const pontos =
    finalizado && palpite
      ? calcularPontos(golsA, golsB, jogo.gols_a, jogo.gols_b)
      : null;

  const grupoCell = primeiraLinha
    ? `<td class="palpites-grupo-cell" rowspan="${totalLinhas}">${jogo.grupo}</td>`
    : '';

  const metaResultado = finalizado
    ? `<div class="palpites-meta">
        <span class="resultado-badge resultado-badge--ok">Oficial: ${formatarPlacar(jogo.gols_a, jogo.gols_b)}</span>
        ${pontos !== null ? `<span class="pontos-badge ${pontosBadgeClass(pontos)}">${pontos} pts</span>` : ''}
      </div>`
    : '';

  return `
    <tr class="palpites-row" data-jogo-id="${jogo.id}">
      ${grupoCell}
      <td class="palpites-num">${numeroJogo(jogo.codigo)}</td>
      <td class="palpites-data">${formatarDataJogo(jogo.data_jogo)}</td>
      <td class="palpites-hora">${formatarHoraJogo(jogo.data_jogo)}</td>
      <td class="palpites-jogo-cell">
        <div class="palpites-match">
          <div class="palpites-team palpites-team--home">
            <span class="palpites-team-name">${escapeHtml(jogo.time_a)}</span>
            ${renderBandeira(jogo.time_a)}
          </div>
          <div class="palpites-placar placar-inputs">
            <input type="number" min="0" max="20" value="${golsA}" data-gols="a" ${somenteLeitura ? 'disabled' : ''} aria-label="Gols ${escapeHtml(jogo.time_a)}">
            <span class="palpites-x">x</span>
            <input type="number" min="0" max="20" value="${golsB}" data-gols="b" ${somenteLeitura ? 'disabled' : ''} aria-label="Gols ${escapeHtml(jogo.time_b)}">
          </div>
          <div class="palpites-team palpites-team--away">
            ${renderBandeira(jogo.time_b)}
            <span class="palpites-team-name">${escapeHtml(jogo.time_b)}</span>
          </div>
        </div>
        ${metaResultado}
      </td>
    </tr>`;
}

function renderAnalise() {
  const ativas = getAnalisesAtivas();
  const subnav = $('#analise-subnav');
  const filtros = $('#analise-filtros');
  const container = $('#analise-conteudo');

  if (!ativas.length) {
    subnav.innerHTML = '';
    filtros.innerHTML = '';
    container.innerHTML =
      '<div class="empty-state"><div class="empty-state__icon">🔒</div><p>Nenhuma análise liberada pelo administrador.</p></div>';
    return;
  }

  ensureAnaliseTipo();

  subnav.innerHTML = ativas
    .map(
      (t) =>
        `<button type="button" class="analise-subnav__btn ${analiseState.tipo === t.id ? 'analise-subnav__btn--active' : ''}" data-analise-tipo="${t.id}">${escapeHtml(t.label)}</button>`
    )
    .join('');

  subnav.querySelectorAll('[data-analise-tipo]').forEach((btn) => {
    btn.addEventListener('click', () => {
      analiseState.tipo = btn.dataset.analiseTipo;
      analiseState.simulacao = null;
      renderAnalise();
    });
  });

  if (analiseState.tipo === 'palpites_jogo') {
    filtros.innerHTML = `
      <div class="filters">
        <div class="form-group" style="flex:1;min-width:280px;">
          <label for="analise-jogo">Partida</label>
          <select id="analise-jogo"></select>
        </div>
      </div>`;
    populateAnaliseSelect();
    $('#analise-jogo')?.addEventListener('change', () => {
      analiseState.simulacao = null;
      renderAnaliseConteudo();
    });
    renderAnaliseConteudo();
    return;
  }

  if (analiseState.tipo === 'possibilidades_exaustivas') {
    filtros.innerHTML = `
      <div class="filters">
        <div class="form-group" style="min-width:240px;">
          <label for="analise-sim-ordenacao">Ordenar por</label>
          <select id="analise-sim-ordenacao">
            <option value="pontos"${analiseState.simulacaoPalpitesOrdenacao === 'pontos' ? ' selected' : ''}>Pontos alcançados</option>
            <option value="distancia"${analiseState.simulacaoPalpitesOrdenacao === 'distancia' ? ' selected' : ''}>Distância de pontos (abaixo)</option>
          </select>
        </div>
      </div>`;
    $('#analise-sim-ordenacao')?.addEventListener('change', (e) => {
      analiseState.simulacaoPalpitesOrdenacao = e.target.value;
      renderAnalisePossibilidadesExaustivas(container);
    });
    renderAnalisePossibilidadesExaustivas(container);
    return;
  }

  filtros.innerHTML = '';
  if (analiseState.tipo === 'possibilidades_vencer') {
    renderAnalisePossibilidades(container);
  } else if (analiseState.tipo === 'placar_favorito') {
    renderAnalisePlacarFavorito(container);
  }
}

function renderAnaliseConteudo() {
  const container = $('#analise-conteudo');
  if (analiseState.tipo !== 'palpites_jogo') return;
  renderAnalisePalpitesJogo(container);
}

function renderAnalisePalpitesJogo(container) {
  const jogoId = $('#analise-jogo')?.value;

  if (!state.jogos.length) {
    container.innerHTML =
      '<div class="empty-state"><div class="empty-state__icon">📊</div><p>Nenhuma partida cadastrada.</p></div>';
    return;
  }

  if (!jogoId) {
    container.innerHTML =
      '<div class="empty-state"><div class="empty-state__icon">📊</div><p>Selecione uma partida.</p></div>';
    return;
  }

  if (analiseState.simulacao?.jogoId !== jogoId) {
    analiseState.simulacao = null;
  }

  const jogo = state.jogos.find((j) => j.id === jogoId);
  if (!jogo) return;

  const ranking = getRanking();
  const analise = analisarPalpitesJogo(jogo, state.palpites, ranking);
  const statusJogo = jogoFinalizado(jogo)
    ? ` · Resultado: ${formatarPlacar(jogo.gols_a, jogo.gols_b)}`
    : '';

  const sim = analiseState.simulacao;
  const rankingSim =
    sim && sim.jogoId === jogoId
      ? simularRankingComPlacar(
          state.participantes,
          state.jogos,
          state.palpites,
          jogoId,
          sim.golsA,
          sim.golsB
        )
      : null;

  container.innerHTML = `
    <div class="panel analise-header-panel">
      <div class="analise-match-title">
        <span class="analise-team analise-team--home">
          <span>${escapeHtml(jogo.time_a)}</span>
          ${renderBandeira(jogo.time_a)}
        </span>
        <span class="analise-vs">X</span>
        <span class="analise-team analise-team--away">
          ${renderBandeira(jogo.time_b)}
          <span>${escapeHtml(jogo.time_b)}</span>
        </span>
      </div>
      <p class="analise-meta">${jogo.codigo} · Grupo ${jogo.grupo} · ${formatarDataJogo(jogo.data_jogo)} · ${formatarHoraJogo(jogo.data_jogo)}${statusJogo} · ${analise.total} palpite(s)</p>
    </div>

    <div class="panel">
      <h2 class="panel__title">Probabilidade dos palpites</h2>
      <div class="table-wrap">
        <table class="analise-outcome-table">
          <thead>
            <tr>
              <th class="analise-outcome-corner">${escapeHtml(jogo.time_a)} X ${escapeHtml(jogo.time_b)}</th>
              <th>vit. A</th>
              <th>empate</th>
              <th>vit. B</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td class="analise-outcome-label">Palpites</td>
              <td>${analise.vitA}</td>
              <td>${analise.empate}</td>
              <td>${analise.vitB}</td>
            </tr>
            <tr>
              <td class="analise-outcome-label">%</td>
              <td>${analise.pctA}%</td>
              <td>${analise.pctEmpate}%</td>
              <td>${analise.pctB}%</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div class="panel">
      <h2 class="panel__title">Mapa de calor — placares palpitados</h2>
      <p class="heatmap-hint">Clique em um placar para simular como resultado oficial desta partida e ver o ranking atualizado.</p>
      ${renderHeatmap(jogo, analise, sim)}
      ${sim && sim.jogoId === jogoId ? renderSimulacaoRanking(jogo, sim, rankingSim, ranking) : ''}
    </div>

    <div class="panel">
      <h2 class="panel__title">Palpites por participante (ordem do ranking)</h2>
      <div class="table-wrap">${renderListaPalpitesAnalise(analise, rankingSim)}</div>
    </div>`;

  container.querySelectorAll('[data-heatmap-cell]').forEach((cell) => {
    cell.addEventListener('click', () => {
      const golsA = parseInt(cell.dataset.golsA, 10);
      const golsB = parseInt(cell.dataset.golsB, 10);
      analiseState.simulacao = { jogoId, golsA, golsB };
      renderAnaliseConteudo();
    });
  });

  $('#btn-limpar-simulacao')?.addEventListener('click', () => {
    analiseState.simulacao = null;
    renderAnaliseConteudo();
  });
}

function renderSimulacaoRanking(jogo, sim, rankingSim, rankingAtual) {
  if (!rankingSim) return '';

  const mapAtual = new Map(rankingAtual.map((r) => [r.participante.id, r.posicao]));

  return `
    <div class="panel simulacao-panel" style="margin-top:1rem;">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:1rem;flex-wrap:wrap;margin-bottom:0.75rem;">
        <h3 class="panel__title simulacao-panel__title" style="margin:0;">
          Ranking simulado — ${escapeHtml(jogo.codigo)}: ${formatarPlacar(sim.golsA, sim.golsB)}
        </h3>
        <button type="button" class="btn btn--secondary btn--sm" id="btn-limpar-simulacao">Limpar simulação</button>
      </div>
      <p style="font-size:0.82rem;color:var(--text-muted);margin-bottom:0.75rem;">
        Simulação hipotética: demais resultados oficiais permanecem inalterados.
      </p>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Pos.</th>
              <th>Δ</th>
              <th>Participante</th>
              <th>Pontos</th>
              <th>Exatos</th>
            </tr>
          </thead>
          <tbody>
            ${rankingSim.slice(0, 15).map((r) => {
              const posAnt = mapAtual.get(r.participante.id);
              const delta = posAnt != null ? posAnt - r.posicao : 0;
              const deltaHtml =
                delta > 0
                  ? `<span style="color:var(--accent);">▲${delta}</span>`
                  : delta < 0
                    ? `<span style="color:var(--danger);">▼${Math.abs(delta)}</span>`
                    : '—';
              return `
              <tr>
                <td>${posBadge(r.posicao)}</td>
                <td>${deltaHtml}</td>
                <td>${escapeHtml(getNomeParticipante(r.participante))}</td>
                <td><strong>${r.pontosTotal}</strong></td>
                <td>${r.placaresExatos}</td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>`;
}

function renderAnalisePossibilidades(container) {
  if (!state.participantes.length) {
    container.innerHTML =
      '<div class="empty-state"><div class="empty-state__icon">📈</div><p>Cadastre participantes para calcular probabilidades.</p></div>';
    return;
  }

  container.innerHTML =
    '<div class="empty-state"><div class="spinner"></div><p>Calculando cenários...</p></div>';

  setTimeout(() => {
    const dados = calcularPossibilidadesVencer(
      state.participantes,
      state.jogos,
      state.palpites
    );

    const metodo = dados.encerrado
      ? 'Bolão encerrado — probabilidades baseadas no ranking final.'
      : `Simulação Monte Carlo (${dados.iteracoes.toLocaleString('pt-BR')} cenários): cada jogo pendente sorteia um placar conforme a distribuição empírica dos palpites do bolão.`;

    container.innerHTML = `
      <div class="panel">
        <h2 class="panel__title">Possibilidades de vencer o bolão</h2>
        <p style="font-size:0.85rem;color:var(--text-muted);margin-bottom:1rem;">${metodo}</p>
        <p style="font-size:0.82rem;color:var(--text-muted);margin-bottom:1rem;">
          Jogos pendentes: <strong>${dados.jogosPendentes}</strong> ·
          Critério de vitória: maior pontuação (desempate por exatos, vencedores, erros e nome).
          Empates na liderança dividem a probabilidade.
        </p>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Participante</th>
                <th>Pos. atual</th>
                <th>Pontos</th>
                <th>P(vencer)</th>
                <th>P(2º lugar)</th>
                <th>P(top 10)</th>
              </tr>
            </thead>
            <tbody>
              ${dados.resultados.map((r) => `
                <tr>
                  <td>${escapeHtml(getNomeParticipante(r.participante))}</td>
                  <td>${r.posicaoAtual != null ? posBadge(r.posicaoAtual) : '—'}</td>
                  <td><strong>${r.pontosAtual}</strong></td>
                  <td>${renderProbBar(r.probVencer, true)}</td>
                  <td>${renderProbBar(r.probPodio)}</td>
                  <td>${renderProbBar(r.probTop10)}</td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>`;
  }, 30);
}

function ordenarResultadosSimulacaoPalpites(resultados, criterio) {
  const lista = [...resultados];

  if (criterio === 'distancia') {
    lista.sort((a, b) => {
      const distA = a.distPontosAbaixo;
      const distB = b.distPontosAbaixo;
      if (distA == null && distB == null) {
        return (a.posicaoFinal ?? 999) - (b.posicaoFinal ?? 999);
      }
      if (distA == null) return 1;
      if (distB == null) return -1;
      if (distA !== distB) return distB - distA;
      return (a.posicaoFinal ?? 999) - (b.posicaoFinal ?? 999);
    });
    return lista;
  }

  lista.sort(
    (a, b) =>
      b.pontosFinal - a.pontosFinal ||
      (a.posicaoFinal ?? 999) - (b.posicaoFinal ?? 999) ||
      String(getNomeParticipante(a.participante)).localeCompare(
        String(getNomeParticipante(b.participante)),
        'pt-BR'
      )
  );
  return lista;
}

function renderAnalisePossibilidadesExaustivas(container) {
  if (!state.participantes.length) {
    container.innerHTML =
      '<div class="empty-state"><div class="empty-state__icon">📈</div><p>Cadastre participantes para calcular simulações.</p></div>';
    return;
  }

  const dados = calcularSimulacaoPalpitesProprios(
    state.participantes,
    state.jogos,
    state.palpites
  );
  const criterio = analiseState.simulacaoPalpitesOrdenacao || 'pontos';
  const resultados = ordenarResultadosSimulacaoPalpites(dados.resultados, criterio);

  const metodo = dados.encerrado
    ? 'Bolão encerrado — posição e pontuação já são as finais.'
    : `Para cada participante, simula-se que <strong>todos os ${dados.jogosPendentes} jogos pendentes</strong> terminem exatamente com os placares que ele palpitou. Os demais participantes pontuam conforme seus palpites nesses mesmos resultados.`;

  container.innerHTML = `
    <div class="panel">
      <h2 class="panel__title">Simulação pelos palpites próprios</h2>
      <p style="font-size:0.85rem;color:var(--text-muted);margin-bottom:1rem;">${metodo}</p>
      <p style="font-size:0.82rem;color:var(--text-muted);margin-bottom:1rem;">
        Ex.: se os resultados oficiais coincidirem com os palpites de um jogador, ele faria a pontuação da coluna <strong>Final</strong> e ficaria na posição simulada.
        À medida que os jogos reais divergem dos palpites, essa projeção deixa de se aplicar.
        Posições empatadas na mesma pontuação compartilham a colocação.
      </p>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Participante</th>
              <th>Pos. atual</th>
              <th>Pontos atuais</th>
              <th>Pos. simulada</th>
              <th>Pontos finais</th>
              <th>Δ pos.</th>
              <th>Imediatamente acima</th>
              <th>Participante abaixo</th>
              <th>Dist. pontos</th>
            </tr>
          </thead>
          <tbody>
            ${resultados.map((r) => `
              <tr>
                <td>${escapeHtml(getNomeParticipante(r.participante))}</td>
                <td>${r.posicaoAtual != null ? posBadge(r.posicaoAtual) : '—'}</td>
                <td>${r.pontosAtual}</td>
                <td>${r.posicaoFinal != null ? posBadge(r.posicaoFinal) : '—'}</td>
                <td><strong>${r.pontosFinal}</strong></td>
                <td>${renderDeltaPosicao(r.deltaPosicao)}</td>
                <td>${renderVizinhoSimulacao(r.vizinhoAcima, r.distPontosAcima, 'acima')}</td>
                <td>${renderVizinhoAbaixoNome(r.vizinhoAbaixo)}</td>
                <td>${renderDistanciaPontosAbaixo(r.distPontosAbaixo)}</td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>`;
}

function renderDeltaPosicao(delta) {
  if (delta == null || delta === 0) return '—';
  if (delta > 0) return `<span style="color:var(--accent);">▲ ${delta}</span>`;
  return `<span style="color:var(--danger);">▼ ${Math.abs(delta)}</span>`;
}

function renderVizinhoSimulacao(vizinho, distancia, tipo) {
  if (!vizinho) {
    return tipo === 'acima'
      ? '<span style="color:var(--text-muted);">No topo</span>'
      : '<span style="color:var(--text-muted);">No fim</span>';
  }
  return `${escapeHtml(getNomeParticipante(vizinho.participante))} · ${vizinho.pontosTotal} pts · <strong>${distancia} pts</strong> de distância`;
}

function renderVizinhoAbaixoNome(vizinho) {
  if (!vizinho) {
    return '<span style="color:var(--text-muted);">No fim</span>';
  }
  return escapeHtml(getNomeParticipante(vizinho.participante));
}

function renderDistanciaPontosAbaixo(distancia) {
  if (distancia == null) {
    return '<span style="color:var(--text-muted);">—</span>';
  }
  return `<strong>${distancia}</strong> pts`;
}

function renderProbBar(pct, gold = false) {
  const val = pct.toFixed(1);
  return `
    <div class="prob-bar-wrap">
      <span style="min-width:3.5rem;text-align:right;font-weight:600;">${val}%</span>
      <div class="prob-bar">
        <div class="prob-bar__fill ${gold ? 'prob-bar__fill--gold' : ''}" style="width:${Math.min(pct, 100)}%;"></div>
      </div>
    </div>`;
}

function renderAnalisePlacarFavorito(container) {
  const dados = calcularAnalisePlacarFavorito(
    state.participantes,
    state.jogos,
    state.palpites
  );
  const v = dados.statsVirtual;

  container.innerHTML = `
    <div class="panel">
      <h2 class="panel__title">Participante virtual — ${escapeHtml(PLACAR_FAVORITO_NOME)}</h2>
      <p style="font-size:0.85rem;color:var(--text-muted);margin-bottom:1rem;">
        Em cada jogo, adota o placar mais palpitado pelo grupo (moda estatística).
        Desempate: menor soma de gols, depois menor gols do mandante.
      </p>
      ${
        v
          ? `<div class="stats-grid" style="margin-bottom:1rem;">
        <div class="stat-mini"><div class="stat-mini__val">${v.pontosTotal}</div><div class="stat-mini__lbl">Pontos</div></div>
        <div class="stat-mini"><div class="stat-mini__val">${v.placaresExatos}</div><div class="stat-mini__lbl">Exatos</div></div>
        <div class="stat-mini"><div class="stat-mini__val">${posBadge(dados.posicaoEntreHumanos)}</div><div class="stat-mini__lbl">Posição entre humanos</div></div>
        <div class="stat-mini"><div class="stat-mini__val">${dados.resumo.aproveitamento}%</div><div class="stat-mini__lbl">Aproveitamento</div></div>
      </div>`
          : '<p>Nenhum palpite registrado.</p>'
      }
    </div>

    <div class="panel">
      <h2 class="panel__title">Ranking com ${escapeHtml(PLACAR_FAVORITO_NOME)}</h2>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Pos.</th><th>Participante</th><th>Pontos</th><th>Exatos</th><th>Vencedores</th>
            </tr>
          </thead>
          <tbody>
            ${dados.rankingComVirtual.slice(0, 20).map((r) => `
              <tr class="${r.participante.id === PLACAR_FAVORITO_ID ? 'participante-virtual-row' : ''}">
                <td>${posBadge(r.posicao)}</td>
                <td><strong>${escapeHtml(getNomeParticipante(r.participante))}</strong></td>
                <td><strong>${r.pontosTotal}</strong></td>
                <td>${r.placaresExatos}</td>
                <td>${r.acertosVencedor}</td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>

    <div class="panel">
      <h2 class="panel__title">Placar favorito por jogo</h2>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Jogo</th><th>Partida</th><th>Favorito</th><th>Votos</th><th>%</th><th>Oficial</th><th>Pts</th>
            </tr>
          </thead>
          <tbody>
            ${dados.favoritos.map(({ jogo, gols_a, gols_b, votos, pct, pontos }) => `
              <tr>
                <td>${jogo.codigo}</td>
                <td>${escapeHtml(jogo.time_a)} x ${escapeHtml(jogo.time_b)}</td>
                <td><strong>${gols_a != null ? formatarPlacar(gols_a, gols_b) : '—'}</strong></td>
                <td>${votos}</td>
                <td>${pct}%</td>
                <td>${jogoFinalizado(jogo) ? formatarPlacar(jogo.gols_a, jogo.gols_b) : '—'}</td>
                <td>${pontos != null ? `<span class="pontos-badge ${pontosBadgeClass(pontos)}">${pontos}</span>` : '—'}</td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>`;
}

function renderHeatmap(jogo, analise, simSelecionado) {
  const { matriz, maxGols, maxContagem } = analise;

  let colHeads = '';
  for (let b = 0; b <= maxGols; b++) {
    colHeads += `<th class="heatmap-col-head">${b}</th>`;
  }

  let bodyRows = '';
  for (let a = 0; a <= maxGols; a++) {
    const sideLabel =
      a === 0
        ? `<th class="heatmap-axis-side" rowspan="${maxGols + 1}">
            <div class="heatmap-axis-team heatmap-axis-team--side">
              ${renderBandeira(jogo.time_a, 'team-flag team-flag--heatmap')}
              <span class="heatmap-axis-name">${escapeHtml(jogo.time_a)}</span>
            </div>
          </th>`
        : '';
    let cells = sideLabel + `<th class="heatmap-row-head">${a}</th>`;
    for (let b = 0; b <= maxGols; b++) {
      cells += heatmapCell(matriz, a, b, maxContagem, simSelecionado);
    }
    bodyRows += `<tr>${cells}</tr>`;
  }

  return `
    <div class="heatmap-wrap">
      <table class="heatmap-table heatmap-table--square">
        <thead>
          <tr>
            <th class="heatmap-corner" colspan="2"></th>
            <th class="heatmap-axis-label" colspan="${maxGols + 1}">
              <div class="heatmap-axis-team">
                ${renderBandeira(jogo.time_b, 'team-flag team-flag--heatmap')}
                <span class="heatmap-axis-name">${escapeHtml(jogo.time_b)}</span>
              </div>
            </th>
          </tr>
          <tr>
            <th class="heatmap-corner" colspan="2"></th>
            ${colHeads}
          </tr>
        </thead>
        <tbody>${bodyRows}</tbody>
      </table>
    </div>`;
}

function heatmapCell(matriz, a, b, maxContagem, simSelecionado) {
  const count = matriz[`${a}-${b}`] || 0;
  const bg = corHeatmap(count, maxContagem);
  const style = bg ? `background:${bg};color:#1a1a1a;font-weight:700;` : '';
  const content = count === 0 ? '—' : count;
  const selected =
    simSelecionado &&
    simSelecionado.golsA === a &&
    simSelecionado.golsB === b;
  return `<td class="heatmap-cell heatmap-cell--clickable ${count === 0 ? 'heatmap-cell--empty' : 'heatmap-cell--filled'} ${selected ? 'heatmap-cell--selected' : ''}" style="${style}" data-heatmap-cell data-gols-a="${a}" data-gols-b="${b}">${content}</td>`;
}

function renderListaPalpitesAnalise(analise, rankingSim) {
  if (!analise.listaRanking.length) {
    return '<p style="color:var(--text-muted);font-size:0.85rem;">Nenhum palpite registrado para esta partida.</p>';
  }

  const mapSim = rankingSim
    ? new Map(rankingSim.map((r) => [r.participante.id, r]))
    : null;

  return `
    <table>
      <thead>
        <tr>
          <th>Pos.</th>
          <th>Participante</th>
          <th>Cidade</th>
          <th>Palpite</th>
          <th>Pontos no bolão</th>
          ${rankingSim ? '<th>Pos. sim.</th>' : ''}
        </tr>
      </thead>
      <tbody>
        ${analise.listaRanking
          .map(({ posicao, participante, palpite, pontosTotal }) => {
            const sim = mapSim?.get(participante.id);
            return `
          <tr>
            <td>${posBadge(posicao)}</td>
            <td>${escapeHtml(participante.nome)}</td>
            <td>${escapeHtml(participante.cidade || '—')}</td>
            <td><strong>${formatarPlacar(palpite.gols_a, palpite.gols_b)}</strong></td>
            <td>${sim ? sim.pontosTotal : pontosTotal}</td>
            ${rankingSim ? `<td>${sim ? posBadge(sim.posicao) : '—'}</td>` : ''}
          </tr>`;
          })
          .join('')}
      </tbody>
    </table>`;
}

function renderRanking() {
  const ranking = getRanking();

  if (!ranking.length) {
    $('#ranking-table').innerHTML = '<div class="empty-state"><div class="empty-state__icon">🏆</div><p>Ranking indisponível — cadastre participantes primeiro.</p></div>';
    return;
  }

  $('#ranking-table').innerHTML = `
    <table>
      <thead>
        <tr>
          <th>Pos.</th><th>Participante</th><th>Pontos</th>
          <th>Placares Exatos</th><th>Acertos Vencedor</th><th>Erros</th><th>Aproveitamento</th>
        </tr>
      </thead>
      <tbody>${ranking.map((r) => `
        <tr>
          <td>${posBadge(r.posicao)}</td>
          <td>${escapeHtml(getNomeParticipante(r.participante))}</td>
          <td><strong>${r.pontosTotal}</strong></td>
          <td>${r.placaresExatos}</td>
          <td>${r.acertosVencedor}</td>
          <td>${r.erros}</td>
          <td>${r.aproveitamento}%</td>
        </tr>`).join('')}
      </tbody>
    </table>`;
}

function renderTabelaPalpitesParticipante(participanteId, { apenasRealizados = false } = {}) {
  const palpitesMap = new Map(
    state.palpites
      .filter((p) => p.participante_id === participanteId)
      .map((p) => [p.jogo_id, p])
  );

  const jogosComPalpite = state.jogos
    .filter((j) => palpitesMap.has(j.id))
    .filter((j) => !apenasRealizados || jogoFinalizado(j))
    .sort(
      (a, b) =>
        (a.ordem || 0) - (b.ordem || 0) ||
        new Date(a.data_jogo || 0) - new Date(b.data_jogo || 0) ||
        a.codigo.localeCompare(b.codigo)
    );

  if (!jogosComPalpite.length) {
    return '<p style="color:var(--text-muted);font-size:0.85rem;">Nenhum palpite registrado.</p>';
  }

  return `
    <table>
      <thead>
        <tr>
          <th>Partida</th>
          <th>Resultado oficial</th>
          <th>Palpite</th>
          <th>Pontos</th>
        </tr>
      </thead>
      <tbody>
        ${jogosComPalpite
          .map((jogo) => {
            const palpite = palpitesMap.get(jogo.id);
            const finalizado = jogoFinalizado(jogo);
            const pontos = finalizado
              ? calcularPontos(palpite.gols_a, palpite.gols_b, jogo.gols_a, jogo.gols_b)
              : null;
            return `
          <tr class="${finalizado ? '' : 'perfil-row--pendente'}">
            <td>${renderJogoComBandeiras(jogo)}</td>
            <td>${finalizado ? formatarPlacar(jogo.gols_a, jogo.gols_b) : '<span style="color:var(--text-muted)">Pendente</span>'}</td>
            <td><strong>${formatarPlacar(palpite.gols_a, palpite.gols_b)}</strong></td>
            <td>${pontos !== null ? `<span class="pontos-badge ${pontosBadgeClass(pontos)}">${pontos}</span>` : '—'}</td>
          </tr>`;
          })
          .join('')}
      </tbody>
    </table>`;
}

function renderComparacao() {
  const container = $('#comparacao-resultado');
  const id1 = $('#comp-p1').value;
  const id2 = $('#comp-p2').value;

  if (!id1 || !id2) {
    container.innerHTML = '<div class="empty-state"><div class="empty-state__icon">⚖️</div><p>Selecione dois participantes e clique em Comparar.</p></div>';
    return;
  }

  if (id1 === id2) {
    container.innerHTML = '<div class="empty-state"><p>Selecione participantes diferentes.</p></div>';
    return;
  }

  const p1 = state.participantes.find((p) => p.id === id1);
  const p2 = state.participantes.find((p) => p.id === id2);
  const comp = compararParticipantes(id1, id2, state.jogos, state.palpites);

  const evolucaoSeries = [
    {
      label: getNomeParticipante(p1),
      color: '#29b6f6',
      pontos: buildEvolucaoPontos(id1, state.jogos, state.palpites),
    },
    {
      label: getNomeParticipante(p2),
      color: '#00c853',
      pontos: buildEvolucaoPontos(id2, state.jogos, state.palpites),
    },
  ];
  const posicaoSeries = [
    {
      label: getNomeParticipante(p1),
      color: '#29b6f6',
      pontos: buildEvolucaoPosicao(id1, state.participantes, state.jogos, state.palpites),
    },
    {
      label: getNomeParticipante(p2),
      color: '#00c853',
      pontos: buildEvolucaoPosicao(id2, state.participantes, state.jogos, state.palpites),
    },
  ];

  container.innerHTML = `
    <h3 class="panel__title">Resumo</h3>
    <div class="table-wrap" style="margin-bottom:1.5rem;">
      <table>
        <thead><tr><th>Métrica</th><th>${escapeHtml(getNomeParticipante(p1))}</th><th>${escapeHtml(getNomeParticipante(p2))}</th></tr></thead>
        <tbody>
          <tr><td>Pontuação Total</td><td><strong>${comp.stats1.pontosTotal}</strong></td><td><strong>${comp.stats2.pontosTotal}</strong></td></tr>
          <tr><td>Placares Exatos</td><td>${comp.stats1.placaresExatos}</td><td>${comp.stats2.placaresExatos}</td></tr>
          <tr><td>Acertos de Vencedor</td><td>${comp.stats1.acertosVencedor}</td><td>${comp.stats2.acertosVencedor}</td></tr>
        </tbody>
      </table>
    </div>

    <h3 class="panel__title">Estatísticas da Comparação</h3>
    <div class="stats-grid" style="margin-bottom:1.5rem;">
      <div class="stat-mini"><div class="stat-mini__val">${comp.resumo.palpitesIguais}</div><div class="stat-mini__lbl">Palpites Iguais</div></div>
      <div class="stat-mini"><div class="stat-mini__val">${comp.resumo.palpitesDiferentes}</div><div class="stat-mini__lbl">Palpites Diferentes</div></div>
      <div class="stat-mini"><div class="stat-mini__val">${comp.resumo.maisPontos === 1 ? escapeHtml(getNomeParticipante(p1)) : comp.resumo.maisPontos === 2 ? escapeHtml(getNomeParticipante(p2)) : 'Empate'}</div><div class="stat-mini__lbl">Mais Pontos</div></div>
    </div>

    <div class="panel" style="margin-bottom:1.5rem;">
      <h3 class="panel__title">Evolução de pontos — jogo a jogo</h3>
      ${renderGraficoEvolucao(evolucaoSeries)}
    </div>

    <div class="panel" style="margin-bottom:1.5rem;">
      <h3 class="panel__title">Evolução de posição — jogo a jogo</h3>
      ${renderGraficoEvolucaoPosicao(posicaoSeries, { maxPosicao: state.participantes.length })}
    </div>

    <h3 class="panel__title">Comparação Jogo a Jogo</h3>
    <div class="table-wrap" style="margin-bottom:1.5rem;">
      <table>
        <thead>
          <tr><th>Jogo</th><th>Resultado</th><th>${escapeHtml(getNomeParticipante(p1))}</th><th>Pts</th><th>${escapeHtml(getNomeParticipante(p2))}</th><th>Pts</th></tr>
        </thead>
        <tbody>${comp.jogosComparados.filter((j) => jogoFinalizado(j.jogo)).map(({ jogo, palpite1, palpite2, pontos1, pontos2 }) => `
          <tr>
            <td>${renderJogoComBandeiras(jogo)}</td>
            <td>${formatarPlacar(jogo.gols_a, jogo.gols_b)}</td>
            <td>${formatarPlacar(palpite1.gols_a, palpite1.gols_b)}</td>
            <td><span class="pontos-badge ${pontosBadgeClass(pontos1)}">${pontos1}</span></td>
            <td>${formatarPlacar(palpite2.gols_a, palpite2.gols_b)}</td>
            <td><span class="pontos-badge ${pontosBadgeClass(pontos2)}">${pontos2}</span></td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>

    <h3 class="panel__title">Divergências</h3>
    <div class="table-wrap">
      ${comp.divergencias.length ? `
        <table>
          <thead><tr><th>Jogo</th><th>${escapeHtml(getNomeParticipante(p1))}</th><th>${escapeHtml(getNomeParticipante(p2))}</th></tr></thead>
          <tbody>${comp.divergencias.map(({ jogo, palpite1, palpite2 }) => `
            <tr>
              <td>${renderJogoComBandeiras(jogo)}</td>
              <td>${formatarPlacar(palpite1.gols_a, palpite1.gols_b)}</td>
              <td>${formatarPlacar(palpite2.gols_a, palpite2.gols_b)}</td>
            </tr>`).join('')}
          </tbody>
        </table>` : '<p style="color:var(--text-muted);font-size:0.85rem;">Nenhuma divergência encontrada.</p>'}
    </div>`;

  setupEvolucaoCharts(container);
}

function renderPerfil() {
  const id = $('#perfil-select').value;
  const container = $('#perfil-conteudo');

  if (!id) {
    container.innerHTML = '<div class="empty-state"><div class="empty-state__icon">📊</div><p>Selecione um participante.</p></div>';
    return;
  }

  const participante = state.participantes.find((p) => p.id === id);
  const ranking = getRanking();
  const posicao = ranking.find((r) => r.participante.id === id);
  const palpitesMap = new Map(
    state.palpites.filter((p) => p.participante_id === id).map((p) => [`${id}:${p.jogo_id}`, p])
  );
  const stats = calcularEstatisticasParticipante(id, state.jogos, palpitesMap);
  const evolucao = buildEvolucaoPontos(id, state.jogos, state.palpites);
  const evolucaoPosicao = buildEvolucaoPosicao(
    id,
    state.participantes,
    state.jogos,
    state.palpites
  );

  const jogosRealizados = state.jogos.filter(
    (j) => jogoFinalizado(j) && state.palpites.some((p) => p.participante_id === id && p.jogo_id === j.id)
  ).length;
  const jogosPendentes = state.palpites.filter((p) => p.participante_id === id).length - jogosRealizados;

  container.innerHTML = `
    <div class="panel perfil-panel">
      <div class="perfil-header">
        <div class="perfil-avatar">👤</div>
        <div class="perfil-header__info">
          <h2 class="perfil-header__nome">${escapeHtml(participante.nome)}</h2>
          <p class="perfil-header__cidade">${escapeHtml(participante.cidade || '—')}</p>
        </div>
      </div>

      <div class="perfil-destaque">
        <div class="perfil-destaque-card perfil-destaque-card--pontos">
          <span class="perfil-destaque__lbl">Pontuação atual</span>
          <span class="perfil-destaque__val">${stats.pontosTotal}</span>
          <span class="perfil-destaque__sub">${jogosRealizados} jogo(s) avaliado(s)</span>
        </div>
        <div class="perfil-destaque-card perfil-destaque-card--ranking">
          <span class="perfil-destaque__lbl">Ranking atual</span>
          <span class="perfil-destaque__val">${posicao ? `${posicao.posicao}º` : '—'}</span>
          <span class="perfil-destaque__sub">${state.participantes.length} participantes</span>
        </div>
        <div class="perfil-destaque-card">
          <span class="perfil-destaque__lbl">Placares exatos</span>
          <span class="perfil-destaque__val perfil-destaque__val--sm">${stats.placaresExatos}</span>
          <span class="perfil-destaque__sub">Aproveitamento ${stats.aproveitamento}%</span>
        </div>
      </div>

      <div class="stats-grid perfil-stats-secundarias">
        <div class="stat-mini"><div class="stat-mini__val">${stats.acertosVencedor}</div><div class="stat-mini__lbl">Acertos Vencedor</div></div>
        <div class="stat-mini"><div class="stat-mini__val">${stats.erros}</div><div class="stat-mini__lbl">Erros</div></div>
        <div class="stat-mini"><div class="stat-mini__val">${jogosPendentes}</div><div class="stat-mini__lbl">Jogos pendentes</div></div>
      </div>
    </div>

    <div class="panel">
      <h2 class="panel__title">Evolução de pontos — jogo a jogo</h2>
      ${renderGraficoEvolucao([{ label: getNomeParticipante(participante), color: '#29b6f6', pontos: evolucao }])}
    </div>

    <div class="panel">
      <h2 class="panel__title">Evolução de posição — jogo a jogo</h2>
      ${renderGraficoEvolucaoPosicao([{ label: getNomeParticipante(participante), color: '#29b6f6', pontos: evolucaoPosicao }], { maxPosicao: state.participantes.length })}
    </div>

    <div class="panel">
      <h2 class="panel__title">Palpites — jogos realizados</h2>
      <div class="table-wrap">${renderTabelaPalpitesParticipante(id, { apenasRealizados: true })}</div>
    </div>

    <div class="panel">
      <h2 class="panel__title">Palpites — jogos pendentes</h2>
      <div class="table-wrap">${renderTabelaPalpitesPendentes(id)}</div>
    </div>`;

  setupEvolucaoCharts(container);
}

function renderTabelaPalpitesPendentes(participanteId) {
  const palpitesMap = new Map(
    state.palpites
      .filter((p) => p.participante_id === participanteId)
      .map((p) => [p.jogo_id, p])
  );

  const jogos = state.jogos
    .filter((j) => palpitesMap.has(j.id) && !jogoFinalizado(j))
    .sort(
      (a, b) =>
        (a.ordem || 0) - (b.ordem || 0) ||
        new Date(a.data_jogo || 0) - new Date(b.data_jogo || 0) ||
        a.codigo.localeCompare(b.codigo)
    );

  if (!jogos.length) {
    return '<p style="color:var(--text-muted);font-size:0.85rem;">Nenhum jogo pendente com palpite.</p>';
  }

  return `
    <table>
      <thead>
        <tr><th>Partida</th><th>Data</th><th>Hora</th><th>Palpite</th></tr>
      </thead>
      <tbody>
        ${jogos
          .map((jogo) => {
            const palpite = palpitesMap.get(jogo.id);
            return `
          <tr>
            <td>${renderJogoComBandeiras(jogo)}</td>
            <td>${formatarDataJogo(jogo.data_jogo)}</td>
            <td>${formatarHoraJogo(jogo.data_jogo)}</td>
            <td><strong>${formatarPlacar(palpite.gols_a, palpite.gols_b)}</strong></td>
          </tr>`;
          })
          .join('')}
      </tbody>
    </table>`;
}

function renderAdmin() {
  if (isAdmin()) {
    $('#admin-login-panel').style.display = 'none';
    $('#admin-content').style.display = 'block';
    $('#toggle-bloqueio').checked = state.config.cadastro_bloqueado;
    renderAdminAnalisesToggles();
    renderAdminJogos();
  } else {
    $('#admin-login-panel').style.display = 'block';
    $('#admin-content').style.display = 'none';
  }
}

function renderAdminAnalisesToggles() {
  const container = $('#admin-analises-toggles');
  if (!container) return;

  container.innerHTML = TIPOS_ANALISE.map(
    (t) => `
    <div class="toggle-row admin-analise-toggle">
      <div>
        <strong>${escapeHtml(t.label)}</strong>
        <p style="font-size:0.82rem;color:var(--text-muted);">${escapeHtml(t.desc)}</p>
      </div>
      <label class="toggle">
        <input type="checkbox" id="toggle-${t.id}" data-analise-config="${t.configKey}" ${state.config[t.configKey] !== false ? 'checked' : ''}>
        <span class="toggle__slider"></span>
      </label>
    </div>`
  ).join('');

  container.querySelectorAll('[data-analise-config]').forEach((input) => {
    input.addEventListener('change', async (e) => {
      const key = e.target.dataset.analiseConfig;
      const valor = e.target.checked;

      if (!valor) {
        const outrasAtivas = TIPOS_ANALISE.filter(
          (t) => t.configKey !== key && state.config[t.configKey] !== false
        );
        if (!outrasAtivas.length) {
          showToast('Mantenha pelo menos uma análise liberada.', 'error');
          e.target.checked = true;
          return;
        }
      }

      try {
        await atualizarConfiguracao({ [key]: valor });
        state.config[key] = valor;
        showToast(
          valor ? `${TIPOS_ANALISE.find((t) => t.configKey === key)?.label} liberada.` : `${TIPOS_ANALISE.find((t) => t.configKey === key)?.label} bloqueada.`,
          'success'
        );
        updateAnaliseNavVisibility();
        if ($('#view-analise')?.classList.contains('view--active')) {
          renderAnalise();
        }
      } catch (err) {
        showToast(err.message, 'error');
        e.target.checked = !valor;
      }
    });
  });
}

function renderAdminJogos() {
  const grupoFiltro = $('#filtro-grupo-admin').value;
  const rodadaFiltro = $('#filtro-rodada-admin').value;
  const btnToggle = $('#btn-toggle-jogos-anteriores');
  if (btnToggle) {
    btnToggle.textContent = adminUi.ocultarJogosAnteriores
      ? 'Exibir jogos de dias anteriores'
      : 'Ocultar jogos de dias anteriores';
    btnToggle.classList.toggle('btn--primary', adminUi.ocultarJogosAnteriores);
    btnToggle.classList.toggle('btn--secondary', !adminUi.ocultarJogosAnteriores);
  }

  const jogosFiltrados = state.jogos.filter((j) => {
    if (grupoFiltro && j.grupo !== grupoFiltro) return false;
    if (rodadaFiltro && String(j.rodada) !== rodadaFiltro) return false;
    if (adminUi.ocultarJogosAnteriores && isJogoDiaAnterior(j)) return false;
    return true;
  });

  if (!jogosFiltrados.length) {
    $('#admin-jogos').innerHTML = `
      <div class="empty-state" style="padding:1.5rem 0;">
        <p style="color:var(--text-muted);font-size:0.85rem;">
          Nenhum jogo para exibir com os filtros atuais.
          ${adminUi.ocultarJogosAnteriores ? ' Clique em "Exibir jogos de dias anteriores" para ver partidas passadas.' : ''}
        </p>
      </div>`;
    return;
  }

  $('#admin-jogos').innerHTML = `
    <div class="admin-jogos-list">
      ${jogosFiltrados.map((jogo) => {
        const temResultado = jogo.gols_a !== null && jogo.gols_b !== null;
        return `
        <article class="admin-jogo-card" data-admin-jogo="${jogo.id}">
          <div class="admin-jogo-card__header">
            <strong>${jogo.codigo}</strong>
            <span>Grupo ${jogo.grupo} · Rodada ${jogo.rodada}</span>
            ${temResultado ? '<span class="resultado-badge resultado-badge--ok">Com resultado</span>' : '<span class="resultado-badge resultado-badge--pending">Sem resultado</span>'}
          </div>
          <div class="admin-jogo-card__match">
            <div class="palpites-match">
              <div class="palpites-team palpites-team--home">
                <span class="palpites-team-name">${escapeHtml(jogo.time_a)}</span>
                ${renderBandeira(jogo.time_a)}
              </div>
              <span class="admin-jogo-card__x">x</span>
              <div class="palpites-team palpites-team--away">
                ${renderBandeira(jogo.time_b)}
                <span class="palpites-team-name">${escapeHtml(jogo.time_b)}</span>
              </div>
            </div>
          </div>
          <div class="admin-jogo-card__fields">
            <div class="form-group">
              <label class="admin-team-label">${renderBandeira(jogo.time_a)} ${escapeHtml(jogo.time_a)}</label>
              <input type="text" value="${escapeHtml(jogo.time_a)}" data-field="time_a">
            </div>
            <div class="admin-jogo-card__placar">
              <div class="form-group">
                <label>${renderBandeira(jogo.time_a)} Gols</label>
                <input type="number" min="0" max="20" value="${jogo.gols_a ?? ''}" data-field="gols_a" placeholder="—">
              </div>
              <span class="admin-jogo-card__x">x</span>
              <div class="form-group">
                <label>${renderBandeira(jogo.time_b)} Gols</label>
                <input type="number" min="0" max="20" value="${jogo.gols_b ?? ''}" data-field="gols_b" placeholder="—">
              </div>
            </div>
            <div class="form-group">
              <label class="admin-team-label">${renderBandeira(jogo.time_b)} ${escapeHtml(jogo.time_b)}</label>
              <input type="text" value="${escapeHtml(jogo.time_b)}" data-field="time_b">
            </div>
          </div>
          <div class="admin-jogo-card__actions">
            <button type="button" class="btn btn--primary btn--sm" data-save-jogo="${jogo.id}">Salvar</button>
            <button type="button" class="btn btn--danger btn--sm" data-clear-jogo="${jogo.id}" ${temResultado ? '' : 'disabled'}>Excluir placar</button>
          </div>
        </article>`;
      }).join('')}
    </div>`;

  $$('[data-save-jogo]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const card = btn.closest('.admin-jogo-card');
      const jogoId = btn.dataset.saveJogo;
      const golsA = card.querySelector('[data-field="gols_a"]').value;
      const golsB = card.querySelector('[data-field="gols_b"]').value;

      if (golsA === '' || golsB === '') {
        showToast('Informe os gols de ambos os times.', 'error');
        return;
      }

      try {
        await salvarResultadoJogo(jogoId, parseInt(golsA, 10), parseInt(golsB, 10));
        showToast('Resultado salvo! Ranking atualizado.', 'success');
        await refreshData();
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
  });

  $$('[data-clear-jogo]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      if (btn.disabled) return;
      if (!confirm('Excluir o placar oficial deste jogo? Os gols serão removidos.')) return;

      try {
        await excluirResultadoJogo(btn.dataset.clearJogo);
        showToast('Placar excluído.', 'success');
        await refreshData();
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
  });
}

function updateAdminUI() {
  if (isAdmin()) {
    $('#nav-admin').innerHTML = 'Admin <span class="admin-badge">●</span>';
  } else {
    $('#nav-admin').textContent = 'Admin';
  }
}

function encerrarModoAdmin(mostrarAviso = true) {
  setAdmin(false);
  const pinInput = $('#admin-pin');
  if (pinInput) pinInput.value = '';
  updateAdminUI();
  if ($('#view-admin')?.classList.contains('view--active')) {
    renderAdmin();
  }
  if (mostrarAviso) {
    showToast('Modo admin encerrado.', 'info');
  }
}

function setupForms() {
  $('#form-participante').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (state.config.cadastro_bloqueado && !isAdmin()) {
      showToast('Cadastro bloqueado pelo administrador.', 'error');
      return;
    }

    const nome = $('#p-nome').value.trim();
    const cidade = $('#p-cidade').value.trim();

    try {
      await criarParticipante({ nome, cidade });
      showToast(`${nome} cadastrado com sucesso!`, 'success');
      e.target.reset();
      await refreshData();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  $('#palpite-participante').addEventListener('change', () => renderPalpites());
  $('#filtro-grupo-palpites').addEventListener('change', () => renderPalpites());

  $('#btn-salvar-palpites').addEventListener('click', async () => {
    if (palpitesSomenteConsulta()) {
      showToast('Palpites bloqueados para edição.', 'error');
      return;
    }

    const participanteId = $('#palpite-participante').value;
    if (!participanteId) {
      showToast('Selecione um participante.', 'error');
      return;
    }

    const rows = $$('#palpites-container .palpites-row');
    let salvos = 0;

    try {
      for (const row of rows) {
        const golsA = row.querySelector('[data-gols="a"]');
        const golsB = row.querySelector('[data-gols="b"]');
        if (golsA.disabled) continue;
        if (golsA.value === '' || golsB.value === '') continue;

        await salvarPalpite({
          participante_id: participanteId,
          jogo_id: row.dataset.jogoId,
          gols_a: parseInt(golsA.value, 10),
          gols_b: parseInt(golsB.value, 10),
        });
        salvos++;
      }
      showToast(`${salvos} palpite(s) salvos!`, 'success');
      await refreshData();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  $('#btn-comparar').addEventListener('click', () => renderComparacao());
  $('#perfil-select').addEventListener('change', () => renderPerfil());

  $('#btn-export-ranking').addEventListener('click', () => {
    const ranking = getRanking();
    exportTableToCSV('ranking-bolao-2026.csv', [
      ['Posição', 'Participante', 'Pontos', 'Placares Exatos', 'Acertos Vencedor', 'Erros', 'Aproveitamento'],
      ...ranking.map((r) => [
        r.posicao,
        getNomeParticipante(r.participante),
        r.pontosTotal,
        r.placaresExatos,
        r.acertosVencedor,
        r.erros,
        `${r.aproveitamento}%`,
      ]),
    ]);
    showToast('Ranking exportado!', 'success');
  });

  $('#btn-print-ranking').addEventListener('click', () => window.print());

  $('#form-admin-login').addEventListener('submit', (e) => {
    e.preventDefault();
    const pin = $('#admin-pin').value;
    if (pin === ADMIN_PIN) {
      setAdmin(true);
      $('#admin-pin').value = '';
      showToast('Modo administrador ativado.', 'success');
      updateAdminUI();
      renderAdmin();
    } else {
      showToast('PIN incorreto.', 'error');
    }
  });

  $('#toggle-bloqueio').addEventListener('change', async (e) => {
    try {
      await atualizarConfiguracao(e.target.checked);
      state.config.cadastro_bloqueado = e.target.checked;
      showToast(
        e.target.checked ? 'Cadastro bloqueado.' : 'Cadastro liberado.',
        'success'
      );
      renderParticipantes();
      renderPalpites();
      updateNavVisibility();
    } catch (err) {
      showToast(err.message, 'error');
      e.target.checked = !e.target.checked;
    }
  });

  $('#btn-admin-sair').addEventListener('click', () => {
    encerrarModoAdmin(true);
  });

  $('#filtro-grupo-admin').addEventListener('change', () => renderAdminJogos());
  $('#filtro-rodada-admin').addEventListener('change', () => renderAdminJogos());

  $('#btn-toggle-jogos-anteriores')?.addEventListener('click', () => {
    adminUi.ocultarJogosAnteriores = !adminUi.ocultarJogosAnteriores;
    renderAdminJogos();
  });

  setupImportacao();

  window.addEventListener('bolao:imported', () => refreshData());
}

init();
