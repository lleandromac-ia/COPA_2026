import XLSX from 'xlsx';
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const SUPABASE_URL = 'https://oflszgbbsfyavbjqtdcp.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9mbHN6Z2Jic2Z5YXZianF0ZGNwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAzNTM2NTMsImV4cCI6MjA5NTkyOTY1M30.YdiRvRw2E47Hvgj0hVH15pXezRLCgKT_NJ2EjJou93o';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

function parseDataJogo(val) {
  if (!val) return null;
  const s = String(val).trim();
  if (!s) return null;
  const normalized = s.replace(' ', 'T');
  const d = new Date(normalized.includes('T') ? normalized + ':00' : normalized);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function parseGols(val) {
  if (val === '' || val === null || val === undefined) return null;
  const n = parseInt(val, 10);
  return Number.isNaN(n) ? null : n;
}

async function upsertBatch(table, rows, onConflict, chunkSize = 100) {
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const { error } = await supabase.from(table).upsert(chunk, { onConflict });
    if (error) throw new Error(`${table} lote ${Math.floor(i / chunkSize) + 1}: ${error.message}`);
    process.stdout.write(`  ${table}: ${Math.min(i + chunkSize, rows.length)}/${rows.length}\r`);
  }
  console.log();
}

async function main() {
  const wb = XLSX.read(readFileSync(join(__dirname, '..', 'carga.xlsx')), { type: 'buffer' });

  const participantesRaw = XLSX.utils.sheet_to_json(wb.Sheets['participantes'], { defval: '' });
  const jogosRaw = XLSX.utils.sheet_to_json(wb.Sheets['jogos'], { defval: '' });
  let palpitesRaw = XLSX.utils.sheet_to_json(wb.Sheets['palpites'], { defval: '' });

  palpitesRaw = palpitesRaw.filter(
    (p) => p.participante_id !== 'participante_id' && p.jogo_id !== 'jogo_id'
  );

  console.log('=== Validação ===');
  console.log(`Participantes: ${participantesRaw.length}`);
  console.log(`Jogos: ${jogosRaw.length}`);
  console.log(`Palpites: ${palpitesRaw.length}`);

  const jogos = jogosRaw.map((j) => ({
    codigo: String(j.codigo).toUpperCase(),
    grupo: String(j.grupo).toUpperCase(),
    rodada: parseInt(j.rodada, 10),
    time_a: String(j.time_a).trim(),
    time_b: String(j.time_b).trim(),
    gols_a: parseGols(j.gols_a),
    gols_b: parseGols(j.gols_b),
    data_jogo: parseDataJogo(j.data_jogo),
    ordem: parseInt(j.ordem, 10) || 0,
  }));

  const participantes = participantesRaw.map((p) => ({
    nome: String(p.nome).trim(),
    cidade: String(p.cidade || '').trim() || null,
  }));

  console.log('\n=== Atualizando jogos ===');
  for (let i = 0; i < jogos.length; i++) {
    const j = jogos[i];
    const { error } = await supabase
      .from('jogos')
      .update({
        grupo: j.grupo,
        rodada: j.rodada,
        time_a: j.time_a,
        time_b: j.time_b,
        gols_a: j.gols_a,
        gols_b: j.gols_b,
        data_jogo: j.data_jogo,
        ordem: j.ordem,
      })
      .eq('codigo', j.codigo);
    if (error) throw new Error(`jogo ${j.codigo}: ${error.message}`);
  }
  console.log(`  ${jogos.length} jogos atualizados`);

  console.log('=== Importando participantes ===');
  const { data: existentes } = await supabase.from('participantes').select('id, nome');
  if (existentes?.length) {
    console.log(`  Limpando ${existentes.length} participante(s) existente(s)...`);
    await supabase.from('participantes').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  }

  for (let i = 0; i < participantes.length; i += 50) {
    const chunk = participantes.slice(i, i + 50);
    const { error } = await supabase.from('participantes').insert(chunk);
    if (error) throw new Error(`participantes: ${error.message}`);
  }
  console.log(`  ${participantes.length} participantes inseridos`);

  console.log('=== Carregando IDs ===');
  const [{ data: dbJogos, error: ej }, { data: dbParticipantes, error: ep }] =
    await Promise.all([
      supabase.from('jogos').select('id, codigo'),
      supabase.from('participantes').select('id, nome'),
    ]);
  if (ej) throw ej;
  if (ep) throw ep;

  const codigoToDbId = new Map(dbJogos.map((j) => [j.codigo, j.id]));
  const sheetJogoIdToCodigo = new Map(
    jogosRaw.map((j) => [String(j.id), String(j.codigo).toUpperCase()])
  );
  const sheetParticipanteIdToNome = new Map(
    participantesRaw.map((p) => [Number(p.id), String(p.nome).trim()])
  );
  const nomeToDbId = new Map(dbParticipantes.map((p) => [p.nome, p.id]));

  const erros = [];
  const palpites = [];

  for (const p of palpitesRaw) {
    const nome = sheetParticipanteIdToNome.get(Number(p.participante_id));
    const participante_id = nome ? nomeToDbId.get(nome) : null;
    const codigo = sheetJogoIdToCodigo.get(String(p.jogo_id));
    const jogo_id = codigo ? codigoToDbId.get(codigo) : null;

    if (!participante_id) {
      erros.push(`Participante id ${p.participante_id} (${nome}) não mapeado`);
      continue;
    }
    if (!jogo_id) {
      erros.push(`Jogo id ${p.jogo_id} não mapeado`);
      continue;
    }

    palpites.push({
      participante_id,
      jogo_id,
      gols_a: parseInt(p.gols_a, 10),
      gols_b: parseInt(p.gols_b, 10),
      updated_at: new Date().toISOString(),
    });
  }

  console.log(`Palpites mapeados: ${palpites.length}, erros: ${erros.length}`);
  if (erros.length) {
    console.log('Primeiros erros:', erros.slice(0, 5));
    throw new Error('Erros de mapeamento — importação de palpites abortada');
  }

  console.log('=== Importando palpites ===');
  const { data: palpitesExistentes } = await supabase.from('palpites').select('id').limit(1);
  if (palpitesExistentes?.length) {
    await supabase.from('palpites').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  }

  await upsertBatch('palpites', palpites, 'participante_id,jogo_id', 200);

  const { count: cPart } = await supabase.from('participantes').select('*', { count: 'exact', head: true });
  const { count: cJogos } = await supabase.from('jogos').select('*', { count: 'exact', head: true });
  const { count: cPal } = await supabase.from('palpites').select('*', { count: 'exact', head: true });
  const { count: cRes } = await supabase
    .from('jogos')
    .select('*', { count: 'exact', head: true })
    .not('gols_a', 'is', null)
    .not('gols_b', 'is', null);

  console.log('\n=== Carga concluída ===');
  console.log(`✓ Participantes no banco: ${cPart}`);
  console.log(`✓ Jogos no banco: ${cJogos}`);
  console.log(`✓ Palpites no banco: ${cPal}`);
  console.log(`✓ Jogos com resultado: ${cRes}`);
}

main().catch((err) => {
  console.error('\n❌ Erro:', err.message);
  process.exit(1);
});
