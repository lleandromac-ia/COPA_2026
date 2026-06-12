/**
 * Parser e importação de CSV/planilha para o bolão
 */

export function parseCSV(text) {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  const rows = [];
  let current = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (let j = 0; j < line.length; j++) {
      const ch = line[j];
      if (inQuotes) {
        if (ch === '"') {
          if (line[j + 1] === '"') {
            field += '"';
            j++;
          } else {
            inQuotes = false;
          }
        } else {
          field += ch;
        }
      } else if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        current.push(field.trim());
        field = '';
      } else {
        field += ch;
      }
    }

    if (inQuotes) {
      field += '\n';
    } else {
      current.push(field.trim());
      field = '';
      if (current.some((c) => c !== '')) rows.push(current);
      current = [];
    }
  }

  if (current.length) {
    current.push(field.trim());
    if (current.some((c) => c !== '')) rows.push(current);
  }

  if (!rows.length) return { headers: [], rows: [] };

  const headers = rows[0].map(normalizeHeader);
  const dataRows = rows.slice(1).map((row) => {
    const obj = {};
    headers.forEach((h, idx) => {
      obj[h] = row[idx] ?? '';
    });
    return obj;
  });

  return { headers, rows: dataRows };
}

function normalizeHeader(h) {
  return h
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '_');
}

function nomeParticipante(row) {
  return (row.nome || row.participante || row.apelido || '').trim();
}

export function parsePlacar(valor) {
  if (valor === null || valor === undefined || valor === '') return null;

  const s = String(valor).trim();
  const match = s.match(/^(\d+)\s*[xX:\-;,/\\]\s*(\d+)$/);
  if (match) {
    return { gols_a: parseInt(match[1], 10), gols_b: parseInt(match[2], 10) };
  }

  const parts = s.split(/\s+/).filter(Boolean);
  if (parts.length === 2 && /^\d+$/.test(parts[0]) && /^\d+$/.test(parts[1])) {
    return { gols_a: parseInt(parts[0], 10), gols_b: parseInt(parts[1], 10) };
  }

  throw new Error(`Placar inválido: "${valor}" (use formato 2x1)`);
}

export function validarJogos(rows) {
  const erros = [];
  const jogos = [];

  rows.forEach((row, i) => {
    const codigo = (row.codigo || '').toUpperCase();
    if (!codigo) {
      erros.push(`Linha ${i + 2}: código do jogo vazio`);
      return;
    }

    jogos.push({
      codigo,
      grupo: (row.grupo || codigo[0]).toUpperCase(),
      rodada: parseInt(row.rodada, 10) || 1,
      time_a: row.time_a || row.time1 || row.time_1 || '',
      time_b: row.time_b || row.time2 || row.time_2 || '',
      gols_a: row.gols_a !== '' && row.gols_a != null ? parseInt(row.gols_a, 10) : null,
      gols_b: row.gols_b !== '' && row.gols_b != null ? parseInt(row.gols_b, 10) : null,
      data_jogo: row.data_jogo || row.data || null,
      ordem: row.ordem !== '' && row.ordem != null ? parseInt(row.ordem, 10) : i + 1,
    });
  });

  return { jogos, erros };
}

export function validarParticipantes(rows) {
  const erros = [];
  const participantes = [];

  rows.forEach((row, i) => {
    const nome = nomeParticipante(row);
    if (!nome) {
      erros.push(`Linha ${i + 2}: nome é obrigatório`);
      return;
    }
    participantes.push({
      nome,
      cidade: row.cidade?.trim() || null,
    });
  });

  return { participantes, erros };
}

/** Formato longo: nome, codigo_jogo, gols_a, gols_b (ou placar) */
export function validarPalpitesLongo(rows) {
  const erros = [];
  const palpites = [];

  rows.forEach((row, i) => {
    const nome = nomeParticipante(row);
    const codigo = (row.codigo_jogo || row.codigo || row.jogo || '').toUpperCase();
    if (!nome || !codigo) {
      erros.push(`Linha ${i + 2}: nome e codigo_jogo são obrigatórios`);
      return;
    }

    let gols_a, gols_b;
    if (row.placar) {
      try {
        ({ gols_a, gols_b } = parsePlacar(row.placar));
      } catch (e) {
        erros.push(`Linha ${i + 2}: ${e.message}`);
        return;
      }
    } else {
      gols_a = parseInt(row.gols_a, 10);
      gols_b = parseInt(row.gols_b, 10);
      if (Number.isNaN(gols_a) || Number.isNaN(gols_b)) {
        erros.push(`Linha ${i + 2}: informe gols_a/gols_b ou placar`);
        return;
      }
    }

    palpites.push({ nome, codigo_jogo: codigo, gols_a, gols_b });
  });

  return { palpites, erros };
}

/** Formato largo: coluna nome + colunas A01, A02, ... L06 com placares */
export function validarPalpitesLargo(headers, rows) {
  const erros = [];
  const palpites = [];
  const codigos = headers.filter((h) => /^[a-l]\d{2}$/i.test(h));

  if (!codigos.length) {
    erros.push('Nenhuma coluna de jogo encontrada (ex.: A01, B02, L06)');
    return { palpites, erros };
  }

  rows.forEach((row, i) => {
    const nome = nomeParticipante(row);
    if (!nome) {
      erros.push(`Linha ${i + 2}: nome vazio`);
      return;
    }

    for (const codigo of codigos) {
      const valor = row[codigo];
      if (valor === '' || valor == null) continue;

      try {
        const { gols_a, gols_b } = parsePlacar(valor);
        palpites.push({
          nome,
          codigo_jogo: codigo.toUpperCase(),
          gols_a,
          gols_b,
        });
      } catch (e) {
        erros.push(`Linha ${i + 2}, jogo ${codigo.toUpperCase()}: ${e.message}`);
      }
    }
  });

  return { palpites, erros };
}

export function detectarFormatoPalpites(headers) {
  if (headers.includes('codigo_jogo') || headers.includes('codigo') || headers.includes('jogo')) {
    return 'longo';
  }
  if (headers.some((h) => /^[a-l]\d{2}$/i.test(h))) {
    return 'largo';
  }
  return 'desconhecido';
}
