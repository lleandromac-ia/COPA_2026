/**
 * Mapeamento seleções → código ISO para bandeiras (flagcdn.com)
 */
const PAIS_PARA_ISO = {
  'Alemanha': 'de',
  'Argentina': 'ar',
  'Argélia': 'dz',
  'Arábia Saudita': 'sa',
  'Austrália': 'au',
  'Brasil': 'br',
  'Bélgica': 'be',
  'Bósnia e Herzegovina': 'ba',
  'Cabo Verde': 'cv',
  'Canadá': 'ca',
  'Catar': 'qa',
  'Colômbia': 'co',
  'Congo': 'cd',
  'Coréia do Sul': 'kr',
  'Costa do Marfim': 'ci',
  'Croácia': 'hr',
  'Curaçau': 'cw',
  'Egito': 'eg',
  'Equador': 'ec',
  'Escócia': 'gb-sct',
  'Espanha': 'es',
  'França': 'fr',
  'Gana': 'gh',
  'Haiti': 'ht',
  'Holanda': 'nl',
  'Inglaterra': 'gb-eng',
  'Iraque': 'iq',
  'Irã': 'ir',
  'Japão': 'jp',
  'Jordânia': 'jo',
  'Marrocos': 'ma',
  'México': 'mx',
  'Noruega': 'no',
  'Nova Zelândia': 'nz',
  'Panamá': 'pa',
  'Paraguai': 'py',
  'Portugal': 'pt',
  'República Tcheca': 'cz',
  'Senegal': 'sn',
  'Suécia': 'se',
  'Suíça': 'ch',
  'Tunísia': 'tn',
  'Turquia': 'tr',
  'USA': 'us',
  'Uruguai': 'uy',
  'Uzbequistão': 'uz',
  'África do Sul': 'za',
  'Áustria': 'at',
};

export function renderBandeira(nomePais, classe = 'team-flag') {
  const iso = PAIS_PARA_ISO[nomePais];
  if (!iso) return '';
  return `<img class="${classe}" src="https://flagcdn.com/w40/${iso}.png" srcset="https://flagcdn.com/w80/${iso}.png 2x" width="20" height="15" alt="" loading="lazy" title="${nomePais}">`;
}
