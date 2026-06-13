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
} from './utils.js';
import { renderBandeira } from './flags.js';
import { setupImportacao } from './import-ui.js';
import {
  getJogosPendentes,
  getJogoPadraoAnalise,
  analisarPalpitesJogo,
  corHeatmap,
} from './analise.js';

let state = {
  config: { cadastro_bloqueado: false },
  participantes: [],
  jogos: [],
  palpites: [],
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
    case 'analise': renderAnalise(); break;
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
}

function populateAnaliseSelect() {
  const sel = $('#analise-jogo');
  if (!sel) return;

  const current = sel.value;
  const pendentes = getJogosPendentes(state.jogos);
  const padrao = getJogoPadraoAnalise(state.jogos);

  if (!pendentes.length) {
    sel.innerHTML = '<option value="">Nenhuma partida pendente</option>';
    return;
  }

  sel.innerHTML = pendentes
    .map((j) => {
      const label = `${j.codigo} — ${j.time_a} x ${j.time_b} (${formatarDataJogo(j.data_jogo)} ${formatarHoraJogo(j.data_jogo)})`;
      return `<option value="${j.id}">${escapeHtml(label)}</option>`;
    })
    .join('');

  if (current && pendentes.some((j) => j.id === current)) {
    sel.value = current;
  } else if (padrao) {
    sel.value = padrao.id;
  }
}

function updateNavVisibility() {
  const navParticipantes = $('#nav-participantes');
  if (!navParticipantes) return;

  const ocultar = state.config.cadastro_bloqueado;
  navParticipantes.style.display = ocultar ? 'none' : '';

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
  const container = $('#analise-conteudo');
  const jogoId = $('#analise-jogo')?.value;
  const pendentes = getJogosPendentes(state.jogos);

  if (!pendentes.length) {
    container.innerHTML =
      '<div class="empty-state"><div class="empty-state__icon">📊</div><p>Todos os jogos já possuem resultado oficial.</p></div>';
    return;
  }

  if (!jogoId) {
    container.innerHTML =
      '<div class="empty-state"><div class="empty-state__icon">📊</div><p>Selecione uma partida.</p></div>';
    return;
  }

  const jogo = state.jogos.find((j) => j.id === jogoId);
  if (!jogo) return;

  const ranking = getRanking();
  const analise = analisarPalpitesJogo(jogo, state.palpites, ranking);

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
      <p class="analise-meta">${jogo.codigo} · Grupo ${jogo.grupo} · ${formatarDataJogo(jogo.data_jogo)} · ${formatarHoraJogo(jogo.data_jogo)} · ${analise.total} palpite(s)</p>
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
      ${renderHeatmap(jogo, analise)}
    </div>

    <div class="panel">
      <h2 class="panel__title">Palpites por participante (ordem do ranking)</h2>
      <div class="table-wrap">${renderListaPalpitesAnalise(analise)}</div>
    </div>`;
}

function renderHeatmap(jogo, analise) {
  const { matriz, maxGolsA, maxGolsB, maxContagem } = analise;

  let colHeads = '';
  for (let b = 0; b <= maxGolsB; b++) {
    colHeads += `<th class="heatmap-col-head">${b}</th>`;
  }

  let bodyRows = '';
  for (let a = 0; a <= maxGolsA; a++) {
    const sideLabel =
      a === 0
        ? `<th class="heatmap-axis-side" rowspan="${maxGolsA + 1}">
            <div class="heatmap-axis-team heatmap-axis-team--side">
              ${renderBandeira(jogo.time_a, 'team-flag team-flag--heatmap')}
              <span class="heatmap-axis-name">${escapeHtml(jogo.time_a)}</span>
            </div>
          </th>`
        : '';
    let cells = sideLabel + `<th class="heatmap-row-head">${a}</th>`;
    for (let b = 0; b <= maxGolsB; b++) {
      cells += heatmapCell(matriz, a, b, maxContagem);
    }
    bodyRows += `<tr>${cells}</tr>`;
  }

  return `
    <div class="heatmap-wrap">
      <table class="heatmap-table">
        <thead>
          <tr>
            <th class="heatmap-corner" colspan="2"></th>
            <th class="heatmap-axis-label" colspan="${maxGolsB + 1}">
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

function heatmapCell(matriz, a, b, maxContagem) {
  const count = matriz[`${a}-${b}`] || 0;
  const bg = corHeatmap(count, maxContagem);
  const style = bg ? `background:${bg};color:#1a1a1a;font-weight:700;` : '';
  const content = count === 0 ? '—' : count;
  return `<td class="heatmap-cell ${count === 0 ? 'heatmap-cell--empty' : 'heatmap-cell--filled'}" style="${style}">${content}</td>`;
}

function renderListaPalpitesAnalise(analise) {
  if (!analise.listaRanking.length) {
    return '<p style="color:var(--text-muted);font-size:0.85rem;">Nenhum palpite registrado para esta partida.</p>';
  }

  return `
    <table>
      <thead>
        <tr>
          <th>Pos.</th>
          <th>Participante</th>
          <th>Cidade</th>
          <th>Palpite</th>
          <th>Pontos no bolão</th>
        </tr>
      </thead>
      <tbody>
        ${analise.listaRanking
          .map(
            ({ posicao, participante, palpite, pontosTotal }) => `
          <tr>
            <td>${posBadge(posicao)}</td>
            <td>${escapeHtml(participante.nome)}</td>
            <td>${escapeHtml(participante.cidade || '—')}</td>
            <td><strong>${formatarPlacar(palpite.gols_a, palpite.gols_b)}</strong></td>
            <td>${pontosTotal}</td>
          </tr>`
          )
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

    <h3 class="panel__title">Comparação Jogo a Jogo</h3>
    <div class="table-wrap" style="margin-bottom:1.5rem;">
      <table>
        <thead>
          <tr><th>Jogo</th><th>Resultado</th><th>${escapeHtml(getNomeParticipante(p1))}</th><th>Pts</th><th>${escapeHtml(getNomeParticipante(p2))}</th><th>Pts</th></tr>
        </thead>
        <tbody>${comp.jogosComparados.filter((j) => jogoFinalizado(j.jogo)).map(({ jogo, palpite1, palpite2, pontos1, pontos2 }) => `
          <tr>
            <td>${jogo.codigo}</td>
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
              <td>${jogo.codigo}</td>
              <td>${formatarPlacar(palpite1.gols_a, palpite1.gols_b)}</td>
              <td>${formatarPlacar(palpite2.gols_a, palpite2.gols_b)}</td>
            </tr>`).join('')}
          </tbody>
        </table>` : '<p style="color:var(--text-muted);font-size:0.85rem;">Nenhuma divergência encontrada.</p>'}
    </div>`;
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

  container.innerHTML = `
    <div class="panel">
      <div class="perfil-header">
        <div class="perfil-avatar">👤</div>
        <div>
          <h2 style="font-size:1.25rem;">${escapeHtml(participante.nome)}</h2>
          <p style="color:var(--text-muted);">${escapeHtml(participante.cidade || '—')}</p>
          ${posicao ? `<p style="margin-top:0.35rem;">${posBadge(posicao.posicao)} <strong>${posicao.pontosTotal} pontos</strong></p>` : ''}
        </div>
      </div>
      <div class="stats-grid">
        <div class="stat-mini"><div class="stat-mini__val">${stats.pontosTotal}</div><div class="stat-mini__lbl">Pontuação Total</div></div>
        <div class="stat-mini"><div class="stat-mini__val">${stats.placaresExatos}</div><div class="stat-mini__lbl">Placares Exatos</div></div>
        <div class="stat-mini"><div class="stat-mini__val">${stats.acertosVencedor}</div><div class="stat-mini__lbl">Acertos Vencedor</div></div>
        <div class="stat-mini"><div class="stat-mini__val">${stats.jogosAvaliados}</div><div class="stat-mini__lbl">Jogos Avaliados</div></div>
        <div class="stat-mini"><div class="stat-mini__val">${stats.aproveitamento}%</div><div class="stat-mini__lbl">Aproveitamento</div></div>
        <div class="stat-mini"><div class="stat-mini__val">${stats.erros}</div><div class="stat-mini__lbl">Erros</div></div>
      </div>
    </div>`;
}

function renderAdmin() {
  if (isAdmin()) {
    $('#admin-login-panel').style.display = 'none';
    $('#admin-content').style.display = 'block';
    $('#toggle-bloqueio').checked = state.config.cadastro_bloqueado;
    renderAdminJogos();
  } else {
    $('#admin-login-panel').style.display = 'block';
    $('#admin-content').style.display = 'none';
  }
}

function renderAdminJogos() {
  const grupoFiltro = $('#filtro-grupo-admin').value;
  const rodadaFiltro = $('#filtro-rodada-admin').value;

  const jogosFiltrados = state.jogos.filter((j) => {
    if (grupoFiltro && j.grupo !== grupoFiltro) return false;
    if (rodadaFiltro && String(j.rodada) !== rodadaFiltro) return false;
    return true;
  });

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
          <div class="admin-jogo-card__fields">
            <div class="form-group">
              <label>Time A</label>
              <input type="text" value="${escapeHtml(jogo.time_a)}" data-field="time_a">
            </div>
            <div class="admin-jogo-card__placar">
              <div class="form-group">
                <label>Gols A</label>
                <input type="number" min="0" max="20" value="${jogo.gols_a ?? ''}" data-field="gols_a" placeholder="—">
              </div>
              <span class="admin-jogo-card__x">x</span>
              <div class="form-group">
                <label>Gols B</label>
                <input type="number" min="0" max="20" value="${jogo.gols_b ?? ''}" data-field="gols_b" placeholder="—">
              </div>
            </div>
            <div class="form-group">
              <label>Time B</label>
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
  $('#analise-jogo').addEventListener('change', () => renderAnalise());

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

  setupImportacao();

  window.addEventListener('bolao:imported', () => refreshData());
}

init();
