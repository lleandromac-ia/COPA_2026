import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { carregarTabelaPaginada } from './lib/fetch-all.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));

const configText = readFileSync(join(__dirname, '..', 'js', 'config.js'), 'utf8');
const urlMatch = configText.match(/SUPABASE_URL\s*=\s*['"]([^'"]+)['"]/);
const keyMatch = configText.match(/SUPABASE_ANON_KEY\s*=\s*['"]([^'"]+)['"]/);

const SUPABASE_URL = urlMatch?.[1];
const SUPABASE_ANON_KEY = keyMatch?.[1];

const results = [];
let failed = 0;

function ok(name, detail) {
  results.push({ status: 'OK', name, detail });
  console.log(`✓ ${name}: ${detail}`);
}

function fail(name, detail) {
  results.push({ status: 'FAIL', name, detail });
  console.log(`✗ ${name}: ${detail}`);
  failed++;
}

function warn(name, detail) {
  results.push({ status: 'WARN', name, detail });
  console.log(`⚠ ${name}: ${detail}`);
}

console.log('=== Teste de conexão Supabase ===\n');

if (!SUPABASE_URL || SUPABASE_URL.includes('SUA_URL')) {
  fail('Config', 'SUPABASE_URL não configurada em js/config.js');
  process.exit(1);
}
if (!SUPABASE_ANON_KEY || SUPABASE_ANON_KEY.includes('SUA_ANON')) {
  fail('Config', 'SUPABASE_ANON_KEY não configurada em js/config.js');
  process.exit(1);
}
ok('Config', `URL ${SUPABASE_URL}`);

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Teste 1: configuracao
{
  const { data, error } = await supabase.from('configuracao').select('*').single();
  if (error && error.code !== 'PGRST116') fail('Tabela configuracao', error.message);
  else ok('Tabela configuracao', data ? 'acessível' : 'vazia (ok)');
}

// Teste 2: participantes
let participantes = [];
{
  const { data, error, count } = await supabase
    .from('participantes')
    .select('*', { count: 'exact' });
  if (error) fail('Tabela participantes', error.message);
  else {
    participantes = data || [];
    ok('Tabela participantes', `${count} registro(s)`);
    if (count === 0) warn('Dados', 'Nenhum participante — importação pendente?');
  }
}

// Teste 3: jogos
let jogos = [];
{
  const { data, error, count } = await supabase
    .from('jogos')
    .select('codigo, time_a, time_b, gols_a, gols_b', { count: 'exact' });
  if (error) fail('Tabela jogos', error.message);
  else {
    jogos = data || [];
    ok('Tabela jogos', `${count} registro(s)`);
    if (count !== 72) warn('Jogos', `Esperado 72, encontrado ${count}`);
  }
}

// Teste 4: palpites
{
  const { error, count } = await supabase
    .from('palpites')
    .select('*', { count: 'exact', head: true });
  if (error) fail('Tabela palpites', error.message);
  else {
    ok('Tabela palpites', `${count} registro(s)`);
    const esperado = participantes.length * jogos.length;
    if (esperado > 0 && count < esperado) {
      warn('Palpites', `${count}/${esperado} (${participantes.length}×${jogos.length})`);
    }
  }
}

// Teste 5: escrita (insert + delete participante teste)
{
  const { data, error } = await supabase
    .from('participantes')
    .insert({ nome: '__teste_conexao__', cidade: 'test' })
    .select()
    .single();
  if (error) fail('Permissão INSERT participantes', error.message);
  else {
    await supabase.from('participantes').delete().eq('id', data.id);
    ok('Permissão INSERT/DELETE', 'participantes OK');
  }
}

// Teste 6: update jogos
{
  const jogo = jogos[0];
  if (jogo) {
    const { error } = await supabase
      .from('jogos')
      .update({ ordem: jogo.ordem ?? 1 })
      .eq('codigo', jogo.codigo);
    if (error) fail('Permissão UPDATE jogos', error.message);
    else ok('Permissão UPDATE jogos', 'OK');
  }
}

// Teste 7: leitura paginada de palpites
if (participantes.length && jogos.length) {
  const { count: totalPalpites } = await supabase
    .from('palpites')
    .select('*', { count: 'exact', head: true });
  const palpites = await carregarTabelaPaginada(supabase, 'palpites', { order: 'id' });
  if (palpites.length === totalPalpites) {
    ok('Leitura paginada palpites', `${palpites.length} registros (completo)`);
  } else {
    fail(
      'Leitura paginada palpites',
      `carregados ${palpites.length}, esperado ${totalPalpites}`
    );
  }
}

// Teste 8: CDN supabase-js (simula browser)
{
  const r = await fetch(
    'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.49.1/+esm',
    { method: 'HEAD' }
  );
  if (r.ok) ok('CDN supabase-js', 'acessível (necessário no browser)');
  else warn('CDN supabase-js', `status ${r.status}`);
}

console.log('\n=== Resumo ===');
console.log(`Sucesso: ${results.filter((r) => r.status === 'OK').length}`);
console.log(`Avisos:  ${results.filter((r) => r.status === 'WARN').length}`);
console.log(`Falhas:  ${failed}`);

process.exit(failed > 0 ? 1 : 0);
