/**
 * Soma 3 horas em data_jogo de todos os jogos (correção UTC vs horário de Brasília).
 * Uso: node scripts/fix-horarios-jogos.mjs
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const config = readFileSync(join(__dirname, '..', 'js', 'config.js'), 'utf8');
const url = config.match(/SUPABASE_URL = '([^']+)'/)[1];
const key = config.match(/SUPABASE_ANON_KEY = '([^']+)'/)[1];
const supabase = createClient(url, key);

const { data: jogos, error } = await supabase
  .from('jogos')
  .select('id, codigo, data_jogo')
  .not('data_jogo', 'is', null)
  .order('ordem');

if (error) throw error;

console.log(`Atualizando ${jogos.length} jogos (+3 horas)...\n`);

let ok = 0;
for (const j of jogos) {
  const antes = j.data_jogo;
  const nova = new Date(new Date(antes).getTime() + 3 * 60 * 60 * 1000).toISOString();
  const { error: err } = await supabase.from('jogos').update({ data_jogo: nova }).eq('id', j.id);
  if (err) {
    console.error(`✗ ${j.codigo}: ${err.message}`);
  } else {
    ok++;
    if (ok <= 3) {
      console.log(`${j.codigo}: ${antes} → ${nova}`);
    }
  }
}

console.log(`\n✓ ${ok}/${jogos.length} jogos atualizados.`);

const { data: sample } = await supabase
  .from('jogos')
  .select('codigo, data_jogo')
  .eq('codigo', 'A01')
  .single();

if (sample) {
  const br = new Date(sample.data_jogo).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  console.log(`\nA01 após correção (Brasília): ${br}`);
}
