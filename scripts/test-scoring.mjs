/**
 * Testes unitários das regras de pontuação
 * Executar: node scripts/test-scoring.mjs
 */

function calcularPontos(palpiteA, palpiteB, resultadoA, resultadoB) {
  if (resultadoA === null || resultadoB === null) return null;
  if (palpiteA === null || palpiteB === null) return 0;
  if (palpiteA === resultadoA && palpiteB === resultadoB) return 12;

  const vencedor = (a, b) => (a > b ? 'A' : b > a ? 'B' : 'E');
  const vr = vencedor(resultadoA, resultadoB);
  const vp = vencedor(palpiteA, palpiteB);

  if (vr !== vp) return 0;
  if (vr === 'E') return 7;
  if (vr === 'A' && palpiteA === resultadoA) return 9;
  if (vr === 'B' && palpiteB === resultadoB) return 9;
  return 5;
}

const casos = [
  { pa: 3, pb: 1, ra: 3, rb: 1, pts: 12, desc: 'placar exato (vitória A)' },
  { pa: 1, pb: 3, ra: 1, rb: 3, pts: 12, desc: 'placar exato (vitória B)' },
  { pa: 2, pb: 2, ra: 2, rb: 2, pts: 12, desc: 'placar exato (empate)' },
  { pa: 3, pb: 0, ra: 3, rb: 1, pts: 9, desc: 'vencedor A + gols do vencedor' },
  { pa: 0, pb: 2, ra: 1, rb: 2, pts: 9, desc: 'vencedor B + gols do vencedor' },
  { pa: 2, pb: 1, ra: 3, rb: 1, pts: 5, desc: 'apenas vencedor A' },
  { pa: 0, pb: 2, ra: 2, rb: 3, pts: 5, desc: 'apenas vencedor B' },
  { pa: 1, pb: 1, ra: 2, rb: 2, pts: 7, desc: 'empate com gols diferentes' },
  { pa: 0, pb: 0, ra: 1, rb: 1, pts: 7, desc: 'empate 0x0 vs 1x1' },
  { pa: 1, pb: 2, ra: 3, rb: 1, pts: 0, desc: 'vencedor errado' },
  { pa: 2, pb: 0, ra: 1, rb: 1, pts: 0, desc: 'vitória vs empate' },
];

let failed = 0;
for (const { pa, pb, ra, rb, pts, desc } of casos) {
  const got = calcularPontos(pa, pb, ra, rb);
  if (got !== pts) {
    console.log(`✗ ${desc}: esperado ${pts}, obtido ${got} (${pa}x${pb} vs ${ra}x${rb})`);
    failed++;
  } else {
    console.log(`✓ ${desc}: ${pts} pts`);
  }
}

if (failed > 0) {
  console.log(`\n${failed} falha(s)`);
  process.exit(1);
}

console.log(`\nTodos os ${casos.length} casos passaram.`);
