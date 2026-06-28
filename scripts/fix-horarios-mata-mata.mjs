/**
 * Aplica horários oficiais do mata-mata (horário de Brasília).
 * Uso: node scripts/fix-horarios-mata-mata.mjs
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

/** DD/MM/YYYY HH:MM → ISO UTC (horário de Brasília, -03). */
function brasiliaParaIso(dataHora) {
  const [data, hora] = dataHora.split(' ');
  const [dd, mm, yyyy] = data.split('/');
  const [hh, min] = hora.split(':');
  const d = new Date(`${yyyy}-${mm}-${dd}T${hh.padStart(2, '0')}:${min}:00-03:00`);
  return d.toISOString();
}

const HORARIOS = {
  'MM16-03': '28/06/2026 16:00',
  'MM16-09': '29/06/2026 14:00',
  'MM16-01': '29/06/2026 17:30',
  'MM16-04': '29/06/2026 22:00',
  'MM16-10': '30/06/2026 14:00',
  'MM16-02': '30/06/2026 18:00',
  'MM16-11': '30/06/2026 22:00',
  'MM16-12': '01/07/2026 13:00',
  'MM16-08': '01/07/2026 17:00',
  'MM16-07': '01/07/2026 21:00',
  'MM16-06': '02/07/2026 16:00',
  'MM16-05': '02/07/2026 20:00',
  'MM16-15': '03/07/2026 00:00',
  'MM16-14': '03/07/2026 15:00',
  'MM16-13': '03/07/2026 19:00',
  'MM16-16': '03/07/2026 22:30',
  'MMOI-02': '04/07/2026 18:00',
  'MMOI-01': '04/07/2026 14:00',
  'MMOI-05': '05/07/2026 17:00',
  'MMOI-06': '05/07/2026 21:00',
  'MMOI-03': '06/07/2026 16:00',
  'MMOI-04': '06/07/2026 21:00',
  'MMOI-07': '07/07/2026 13:00',
  'MMOI-08': '07/07/2026 17:00',
  'MMQF-01': '09/07/2026 17:00',
  'MMQF-02': '10/07/2026 16:00',
  'MMQF-03': '11/07/2026 18:00',
  'MMQF-04': '11/07/2026 22:00',
  'MMSF-01': '14/07/2026 16:00',
  'MMSF-02': '15/07/2026 16:00',
  'MM3L-01': '18/07/2026 18:00',
  'MMFN-01': '19/07/2026 16:00',
};

function formatarBr(iso) {
  const d = new Date(iso);
  const data = d.toLocaleDateString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  const hora = d.toLocaleTimeString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  return `${data} ${hora}`;
}

let ok = 0;
for (const [codigo, alvo] of Object.entries(HORARIOS)) {
  const data_jogo = brasiliaParaIso(alvo);
  const { error } = await supabase.from('jogos').update({ data_jogo }).eq('codigo', codigo);
  if (error) {
    console.error(`✗ ${codigo}: ${error.message}`);
  } else {
    ok++;
    const exibido = formatarBr(data_jogo);
    const status = exibido === alvo.replace(/\//g, '/').replace(/^(\d{2})\/(\d{2})\/(\d{4})/, (_, d, m, y) => `${d.padStart(2,'0')}/${m.padStart(2,'0')}/${y}`) ? '✓' : '?';
    console.log(`${status} ${codigo}: ${alvo} → exibido ${exibido}`);
  }
}

console.log(`\n${ok}/${Object.keys(HORARIOS).length} confrontos atualizados.`);
