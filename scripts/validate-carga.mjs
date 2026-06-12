import XLSX from 'xlsx';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const wb = XLSX.read(readFileSync(join(__dirname, '..', 'carga.xlsx')), { type: 'buffer' });

const participantes = XLSX.utils.sheet_to_json(wb.Sheets['participantes'], { defval: '' });
const jogos = XLSX.utils.sheet_to_json(wb.Sheets['jogos'], { defval: '' });
let palpites = XLSX.utils.sheet_to_json(wb.Sheets['palpites'], { defval: '' });

// remove duplicate header row
palpites = palpites.filter(
  (p) => p.participante_id !== 'participante_id' && p.jogo_id !== 'jogo_id'
);

const pIds = new Set(palpites.map((p) => p.participante_id));
const jIds = new Set(palpites.map((p) => p.jogo_id));

console.log('Participantes:', participantes.length);
console.log('Jogos:', jogos.length);
console.log('Palpites (sem header dup):', palpites.length);
console.log('Participante IDs nos palpites:', pIds.size, [...pIds].slice(0, 5));
console.log('Jogo IDs nos palpites:', jIds.size);

const jogosComResultado = jogos.filter((j) => j.gols_a !== '' && j.gols_b !== '');
console.log('Jogos com resultado:', jogosComResultado.length);

const codigos = jogos.map((j) => j.codigo);
console.log('Codigos jogos unicos:', new Set(codigos).size);

// check participante id range
const pIdNums = [...pIds].map(Number).filter((n) => !Number.isNaN(n));
console.log('Participante id min/max:', Math.min(...pIdNums), Math.max(...pIdNums));

// missing palpites?
const expected = participantes.length * jogos.length;
console.log('Esperado palpites:', expected, 'Actual:', palpites.length);

// sample palpite with invalid gols
const invalid = palpites.filter(
  (p) => p.gols_a === '' || p.gols_b === '' || p.gols_a == null || p.gols_b == null
);
console.log('Palpites sem gols:', invalid.length);

// first names for apelido
function firstName(nome) {
  return String(nome).trim().split(/\s+/)[0];
}
const apelidos = participantes.map((p) => firstName(p.nome));
const dup = apelidos.filter((a, i) => apelidos.indexOf(a) !== i);
console.log('Apelidos duplicados (primeiro nome):', [...new Set(dup)]);
