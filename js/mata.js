/**
 * Fase de mata-mata (confronto direto) — constantes e helpers.
 *
 * Os jogos do mata-mata vivem na mesma tabela `jogos` (fase = 'mata_mata'),
 * diferenciados por `etapa`. A pontuação reaproveita as regras da fase de
 * grupos (12/9/7/5/0), mas é contabilizada do zero e separada dos grupos.
 */

export const FASE_MATA = 'mata_mata';
export const FASE_GRUPOS = 'grupos';

/** Etapas em ordem de disputa. */
export const ETAPAS_MATA = [
  { key: '16avos', label: '16-avos de final', curto: '16-avos' },
  { key: 'oitavas', label: 'Oitavas de final', curto: 'Oitavas' },
  { key: 'quartas', label: 'Quartas de final', curto: 'Quartas' },
  { key: 'semi', label: 'Semifinais', curto: 'Semi' },
  { key: 'terceiro', label: 'Disputa de 3º lugar', curto: '3º lugar' },
  { key: 'final', label: 'Final', curto: 'Final' },
];

const ETAPA_MAP = new Map(ETAPAS_MATA.map((e) => [e.key, e]));

export function etapaInfo(key) {
  return ETAPA_MAP.get(key) || { key, label: key, curto: key };
}

export function etapaLabel(key) {
  return etapaInfo(key).label;
}

export function ordemEtapa(key) {
  const idx = ETAPAS_MATA.findIndex((e) => e.key === key);
  return idx === -1 ? 99 : idx;
}

export function isJogoMata(jogo) {
  return jogo?.fase === FASE_MATA;
}

/** Jogos do mata-mata, ordenados por etapa e ordem. */
export function getJogosMata(jogos) {
  return (jogos || [])
    .filter(isJogoMata)
    .slice()
    .sort(
      (a, b) =>
        ordemEtapa(a.etapa) - ordemEtapa(b.etapa) ||
        (a.ordem || 0) - (b.ordem || 0) ||
        String(a.codigo).localeCompare(String(b.codigo))
    );
}

/** Apenas jogos da fase de grupos. */
export function getJogosGrupos(jogos) {
  return (jogos || []).filter((j) => !isJogoMata(j));
}

/** Agrupa os jogos de mata-mata por etapa (na ordem de disputa). */
export function agruparPorEtapa(jogosMata) {
  const mapa = new Map(ETAPAS_MATA.map((e) => [e.key, []]));
  for (const jogo of jogosMata) {
    if (!mapa.has(jogo.etapa)) mapa.set(jogo.etapa, []);
    mapa.get(jogo.etapa).push(jogo);
  }
  for (const lista of mapa.values()) {
    lista.sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
  }
  return mapa;
}

/** Uma etapa está liberada se algum de seus jogos estiver liberado. */
export function etapaLiberada(jogosMata, etapaKey) {
  return jogosMata.some((j) => j.etapa === etapaKey && j.liberado);
}

/** Time "definido" (não é um placeholder do tipo "A definir"). */
export function timeDefinido(nome) {
  const n = String(nome || '').trim().toLowerCase();
  return n !== '' && n !== 'a definir';
}

/** Sigla de 3 letras (estilo chaveamento) por nome de seleção. */
const SIGLAS = {
  'Alemanha': 'ALE',
  'Paraguai': 'PAR',
  'França': 'FRA',
  'Suécia': 'SUE',
  'África do Sul': 'AFS',
  'Canadá': 'CAN',
  'Holanda': 'PBA',
  'Marrocos': 'MAR',
  'Portugal': 'POR',
  'Croácia': 'CRO',
  'Espanha': 'ESP',
  'Áustria': 'AUT',
  'USA': 'EUA',
  'Bósnia e Herzegovina': 'BOS',
  'Bélgica': 'BEL',
  'Senegal': 'SEN',
  'Brasil': 'BRA',
  'Japão': 'JAP',
  'Costa do Marfim': 'CMA',
  'Noruega': 'NOR',
  'México': 'MEX',
  'Equador': 'EQU',
  'Inglaterra': 'ING',
  'Congo': 'RDC',
  'Argentina': 'ARG',
  'Cabo Verde': 'CBV',
  'Austrália': 'AUS',
  'Egito': 'EGI',
  'Suíça': 'SUI',
  'Argélia': 'AGL',
  'Colômbia': 'COL',
  'Gana': 'GAN',
};

export function siglaTime(nome) {
  if (!timeDefinido(nome)) return '—';
  if (SIGLAS[nome]) return SIGLAS[nome];
  return String(nome).trim().slice(0, 3).toUpperCase();
}
