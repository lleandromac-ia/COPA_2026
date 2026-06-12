import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const configText = readFileSync(join(__dirname, '..', 'js', 'config.js'), 'utf8');
const url = configText.match(/SUPABASE_URL\s*=\s*['"]([^'"]+)['"]/)[1];
const key = configText.match(/SUPABASE_ANON_KEY\s*=\s*['"]([^'"]+)['"]/)[1];

const supabase = createClient(url, key);

const [{ data: participantes }, { data: jogos }, { data: palpites }] = await Promise.all([
  supabase.from('participantes').select('*'),
  supabase.from('jogos').select('*'),
  supabase.from('palpites').select('*'),
]);

function calcularPontos(pa, pb, ra, rb) {
  if (ra === null || rb === null) return 0;
  if (pa === ra && pb === rb) return 12;
  const vr = ra > rb ? 'A' : rb > ra ? 'B' : 'E';
  const vp = pa > pb ? 'A' : pb > pa ? 'B' : 'E';
  if (vr === vp) {
    if (vr === 'A' && pa === ra) return 9;
    if (vr === 'B' && pb === rb) return 9;
    if (vr === 'E') return 7;
    return 5;
  }
  return 0;
}

const palpitesMap = new Map(palpites.map((p) => [`${p.participante_id}:${p.jogo_id}`, p]));
const ranking = participantes.map((p) => {
  let pts = 0;
  for (const j of jogos) {
    if (j.gols_a === null) continue;
    const pal = palpitesMap.get(`${p.id}:${j.id}`);
    if (pal) pts += calcularPontos(pal.gols_a, pal.gols_b, j.gols_a, j.gols_b);
  }
  return { nome: p.nome, pts };
}).sort((a, b) => b.pts - a.pts);

console.log('=== Ranking (jogos com resultado) ===');
ranking.slice(0, 5).forEach((r, i) => console.log(`${i + 1}. ${r.nome}: ${r.pts} pts`));
console.log(`\nTotal participantes com palpites: ${participantes.length}`);
