import {
  importarJogos,
  importarParticipantes,
  importarPalpites,
  resolverPalpitesParaImport,
} from './db.js';
import {
  parseCSV,
  validarJogos,
  validarParticipantes,
  validarPalpitesLongo,
  validarPalpitesLargo,
  detectarFormatoPalpites,
} from './csv-import.js';
import { $, showToast, escapeHtml } from './utils.js';

let importDraft = {
  jogos: [],
  participantes: [],
  palpites: [],
  erros: [],
};

export function setupImportacao() {
  $('#btn-preview-import').addEventListener('click', () => previewImportacao());
  $('#btn-executar-import').addEventListener('click', () => executarImportacao());
  $('#import-planilha-unica').addEventListener('change', (e) => {
    if (e.target.files[0]) carregarPlanilhaUnica(e.target.files[0]);
  });
}

async function lerArquivoTexto(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsText(file, 'UTF-8');
  });
}

async function lerCSV(file) {
  const text = await lerArquivoTexto(file);
  return parseCSV(text);
}

async function carregarPlanilhaUnica(file) {
  try {
    const XLSX = await import('https://cdn.jsdelivr.net/npm/xlsx@0.18.5/+esm');

    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array' });

    const sheetJogos = workbook.Sheets['jogos'] || workbook.Sheets['Jogos'];
    const sheetParticipantes =
      workbook.Sheets['participantes'] || workbook.Sheets['Participantes'];
    const sheetPalpites =
      workbook.Sheets['palpites'] || workbook.Sheets['Palpites'];

    if (!sheetJogos && !sheetParticipantes && !sheetPalpites) {
      showToast('Planilha precisa ter abas: jogos, participantes, palpites', 'error');
      return;
    }

    if (sheetJogos) {
      const csv = XLSX.utils.sheet_to_csv(sheetJogos);
      processarJogos(parseCSV(csv));
    }
    if (sheetParticipantes) {
      const csv = XLSX.utils.sheet_to_csv(sheetParticipantes);
      processarParticipantes(parseCSV(csv));
    }
    if (sheetPalpites) {
      const csv = XLSX.utils.sheet_to_csv(sheetPalpites);
      processarPalpites(parseCSV(csv));
    }

    showToast('Planilha carregada. Clique em Pré-visualizar.', 'success');
  } catch (err) {
    showToast(`Erro ao ler Excel: ${err.message}`, 'error');
  }
}

function processarJogos(parsed) {
  const { jogos, erros } = validarJogos(parsed.rows);
  importDraft.jogos = jogos;
  importDraft.erros.push(...erros);
}

function processarParticipantes(parsed) {
  const { participantes, erros } = validarParticipantes(parsed.rows);
  importDraft.participantes = participantes;
  importDraft.erros.push(...erros);
}

function processarPalpites(parsed) {
  const formato = detectarFormatoPalpites(parsed.headers);
  let result;

  if (formato === 'longo') {
    result = validarPalpitesLongo(parsed.rows);
  } else if (formato === 'largo') {
    result = validarPalpitesLargo(parsed.headers, parsed.rows);
  } else {
    importDraft.erros.push(
      'Formato de palpites não reconhecido. Use colunas nome+codigo_jogo+gols ou nome+A01..L06'
    );
    return;
  }

  importDraft.palpites = result.palpites;
  importDraft.erros.push(...result.erros);
}

async function previewImportacao() {
  importDraft = { jogos: [], participantes: [], palpites: [], erros: [] };

  const fileJogos = $('#import-jogos').files[0];
  const fileParticipantes = $('#import-participantes').files[0];
  const filePalpites = $('#import-palpites').files[0];
  const fileUnica = $('#import-planilha-unica').files[0];

  if (fileUnica && !fileJogos && !fileParticipantes && !filePalpites) {
    await carregarPlanilhaUnica(fileUnica);
  } else {
    try {
      if (fileJogos) processarJogos(await lerCSV(fileJogos));
      if (fileParticipantes) processarParticipantes(await lerCSV(fileParticipantes));
      if (filePalpites) processarPalpites(await lerCSV(filePalpites));
    } catch (err) {
      showToast(err.message, 'error');
      return;
    }
  }

  if (
    !importDraft.jogos.length &&
    !importDraft.participantes.length &&
    !importDraft.palpites.length
  ) {
    showToast('Selecione ao menos um arquivo para importar.', 'error');
    return;
  }

  renderPreview();
}

function renderPreview() {
  const preview = $('#import-preview');
  const errosUnicos = [...new Set(importDraft.erros)];

  preview.innerHTML = `
    <div class="stats-grid" style="margin-bottom:1rem;">
      <div class="stat-mini"><div class="stat-mini__val">${importDraft.jogos.length}</div><div class="stat-mini__lbl">Jogos</div></div>
      <div class="stat-mini"><div class="stat-mini__val">${importDraft.participantes.length}</div><div class="stat-mini__lbl">Participantes</div></div>
      <div class="stat-mini"><div class="stat-mini__val">${importDraft.palpites.length}</div><div class="stat-mini__lbl">Palpites</div></div>
      <div class="stat-mini"><div class="stat-mini__val" style="color:${errosUnicos.length ? 'var(--danger)' : 'var(--accent)'}">${errosUnicos.length}</div><div class="stat-mini__lbl">Erros</div></div>
    </div>
    ${
      errosUnicos.length
        ? `<div style="background:rgba(255,82,82,0.1);border:1px solid var(--danger);border-radius:8px;padding:0.75rem;margin-bottom:1rem;max-height:200px;overflow-y:auto;">
            <strong style="color:var(--danger);">Erros encontrados:</strong>
            <ul style="margin-top:0.5rem;padding-left:1.25rem;font-size:0.82rem;">
              ${errosUnicos.slice(0, 20).map((e) => `<li>${escapeHtml(e)}</li>`).join('')}
              ${errosUnicos.length > 20 ? `<li>... e mais ${errosUnicos.length - 20} erros</li>` : ''}
            </ul>
          </div>`
        : '<p style="color:var(--accent);font-size:0.85rem;">✓ Dados válidos. Pronto para importar.</p>'
    }
    <p style="font-size:0.78rem;color:var(--text-muted);">
      Ordem de importação: <strong>1. Jogos</strong> → <strong>2. Participantes</strong> → <strong>3. Palpites</strong>
    </p>`;

  $('#btn-executar-import').disabled =
    errosUnicos.length > 0 ||
    (!importDraft.jogos.length &&
      !importDraft.participantes.length &&
      !importDraft.palpites.length);
}

async function executarImportacao() {
  const log = $('#import-log');
  log.innerHTML = 'Importando...';
  $('#btn-executar-import').disabled = true;

  const resumo = [];

  try {
    if (importDraft.jogos.length) {
      const data = await importarJogos(importDraft.jogos);
      resumo.push(`✓ ${data.length} jogos importados/atualizados`);
    }

    if (importDraft.participantes.length) {
      const data = await importarParticipantes(importDraft.participantes);
      resumo.push(`✓ ${data.length} participantes importados/atualizados`);
    }

    if (importDraft.palpites.length) {
      const { palpites, erros } = await resolverPalpitesParaImport(importDraft.palpites);
      if (erros.length) {
        resumo.push(`⚠ ${erros.length} palpites ignorados (participante/jogo não encontrado)`);
      }
      if (palpites.length) {
        const data = await importarPalpites(palpites);
        resumo.push(`✓ ${data.length} palpites importados/atualizados`);
      }
    }

    log.innerHTML = resumo.map((r) => `<div>${escapeHtml(r)}</div>`).join('');
    showToast('Importação concluída!', 'success');
    importDraft = { jogos: [], participantes: [], palpites: [], erros: [] };
    $('#btn-executar-import').disabled = true;
    $('#import-preview').innerHTML =
      '<p style="color:var(--accent);">Importação concluída.</p>';

    window.dispatchEvent(new CustomEvent('bolao:imported'));
    return true;
  } catch (err) {
    log.innerHTML = `<span style="color:var(--danger)">Erro: ${escapeHtml(err.message)}</span>`;
    showToast(err.message, 'error');
    $('#btn-executar-import').disabled = false;
    return false;
  }
}
