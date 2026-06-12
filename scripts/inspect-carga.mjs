import XLSX from 'xlsx';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const filePath = join(__dirname, '..', 'carga.xlsx');

const buf = readFileSync(filePath);
const wb = XLSX.read(buf, { type: 'buffer' });

console.log('Abas:', wb.SheetNames);

for (const name of wb.SheetNames) {
  const sheet = wb.Sheets[name];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
  console.log(`\n=== ${name} (${rows.length} linhas) ===`);
  if (rows.length) {
    console.log('Colunas:', Object.keys(rows[0]));
    console.log('Primeiras 3 linhas:', JSON.stringify(rows.slice(0, 3), null, 2));
  }
}
