-- ============================================================
-- Migração: Fase Mata-mata (confronto direto)
-- Execute no SQL Editor do Supabase se o schema já existir.
--
-- Os jogos do mata-mata ficam na MESMA tabela `jogos` (reutilizando
-- `palpites` e toda a lógica de pontuação), diferenciados por `fase`.
-- A pontuação do mata-mata começa do zero nos 16-avos e NÃO se acumula
-- com a fase de grupos (o app filtra por fase ao montar os rankings).
-- ============================================================

-- 1) Novas colunas em jogos -----------------------------------
ALTER TABLE jogos
  ADD COLUMN IF NOT EXISTS fase     TEXT NOT NULL DEFAULT 'grupos',
  ADD COLUMN IF NOT EXISTS etapa    TEXT,
  ADD COLUMN IF NOT EXISTS liberado BOOLEAN NOT NULL DEFAULT FALSE;

-- A fase de grupos continua sempre liberada para consulta/edição.
UPDATE jogos SET liberado = TRUE WHERE fase = 'grupos';

-- 2) Relaxar restrições para suportar jogos sem grupo/rodada ---
ALTER TABLE jogos ALTER COLUMN grupo  DROP NOT NULL;
ALTER TABLE jogos ALTER COLUMN rodada DROP NOT NULL;
ALTER TABLE jogos DROP CONSTRAINT IF EXISTS jogos_rodada_check;

CREATE INDEX IF NOT EXISTS idx_jogos_fase ON jogos(fase);
CREATE INDEX IF NOT EXISTS idx_jogos_etapa ON jogos(etapa);

-- 3) Seed dos confrontos do mata-mata -------------------------
-- Etapas: 16avos, oitavas, quartas, semi, terceiro, final.
-- 16-avos já vêm liberados (times conhecidos da imagem).
-- Demais etapas começam bloqueadas e com times "A definir";
-- o admin define os times e libera cada etapa quando chegar a hora.
-- Datas/horários em horário de Brasília (-03).

INSERT INTO jogos (codigo, grupo, rodada, fase, etapa, liberado, time_a, time_b, data_jogo, ordem) VALUES
  -- 16-avos de final (lado esquerdo da chave)
  ('MM16-01', NULL, NULL, 'mata_mata', '16avos', TRUE, 'Alemanha',      'Paraguai',              '2026-06-29 13:30:00-03', 101),
  ('MM16-02', NULL, NULL, 'mata_mata', '16avos', TRUE, 'França',        'Suécia',                '2026-06-30 14:00:00-03', 102),
  ('MM16-03', NULL, NULL, 'mata_mata', '16avos', TRUE, 'África do Sul', 'Canadá',                '2026-06-28 12:00:00-03', 103),
  ('MM16-04', NULL, NULL, 'mata_mata', '16avos', TRUE, 'Holanda',       'Marrocos',              '2026-06-29 18:00:00-03', 104),
  ('MM16-05', NULL, NULL, 'mata_mata', '16avos', TRUE, 'Portugal',      'Croácia',               '2026-07-02 16:00:00-03', 105),
  ('MM16-06', NULL, NULL, 'mata_mata', '16avos', TRUE, 'Espanha',       'Áustria',               '2026-07-02 12:00:00-03', 106),
  ('MM16-07', NULL, NULL, 'mata_mata', '16avos', TRUE, 'USA',           'Bósnia e Herzegovina',  '2026-07-01 17:00:00-03', 107),
  ('MM16-08', NULL, NULL, 'mata_mata', '16avos', TRUE, 'Bélgica',       'Senegal',               '2026-07-01 13:00:00-03', 108),
  -- 16-avos de final (lado direito da chave)
  ('MM16-09', NULL, NULL, 'mata_mata', '16avos', TRUE, 'Brasil',        'Japão',                 '2026-06-29 10:00:00-03', 109),
  ('MM16-10', NULL, NULL, 'mata_mata', '16avos', TRUE, 'Costa do Marfim', 'Noruega',             '2026-06-30 10:00:00-03', 110),
  ('MM16-11', NULL, NULL, 'mata_mata', '16avos', TRUE, 'México',        'Equador',               '2026-06-30 18:00:00-03', 111),
  ('MM16-12', NULL, NULL, 'mata_mata', '16avos', TRUE, 'Inglaterra',    'Congo',                 '2026-07-01 09:00:00-03', 112),
  ('MM16-13', NULL, NULL, 'mata_mata', '16avos', TRUE, 'Argentina',     'Cabo Verde',            '2026-07-03 15:00:00-03', 113),
  ('MM16-14', NULL, NULL, 'mata_mata', '16avos', TRUE, 'Austrália',     'Egito',                 '2026-07-03 11:00:00-03', 114),
  ('MM16-15', NULL, NULL, 'mata_mata', '16avos', TRUE, 'Suíça',         'Argélia',               '2026-07-02 20:00:00-03', 115),
  ('MM16-16', NULL, NULL, 'mata_mata', '16avos', TRUE, 'Colômbia',      'Gana',                  '2026-07-03 18:30:00-03', 116),

  -- Oitavas de final (esquerda)
  ('MMOI-01', NULL, NULL, 'mata_mata', 'oitavas', FALSE, 'A definir', 'A definir', '2026-07-04 18:00:00-03', 121),
  ('MMOI-02', NULL, NULL, 'mata_mata', 'oitavas', FALSE, 'A definir', 'A definir', '2026-07-04 14:00:00-03', 122),
  ('MMOI-03', NULL, NULL, 'mata_mata', 'oitavas', FALSE, 'A definir', 'A definir', '2026-07-06 16:00:00-03', 123),
  ('MMOI-04', NULL, NULL, 'mata_mata', 'oitavas', FALSE, 'A definir', 'A definir', '2026-07-06 21:00:00-03', 124),
  -- Oitavas de final (direita)
  ('MMOI-05', NULL, NULL, 'mata_mata', 'oitavas', FALSE, 'A definir', 'A definir', '2026-07-05 17:00:00-03', 125),
  ('MMOI-06', NULL, NULL, 'mata_mata', 'oitavas', FALSE, 'A definir', 'A definir', '2026-07-05 21:00:00-03', 126),
  ('MMOI-07', NULL, NULL, 'mata_mata', 'oitavas', FALSE, 'A definir', 'A definir', '2026-07-07 17:00:00-03', 127),
  ('MMOI-08', NULL, NULL, 'mata_mata', 'oitavas', FALSE, 'A definir', 'A definir', '2026-07-07 21:00:00-03', 128),

  -- Quartas de final (esquerda)
  ('MMQF-01', NULL, NULL, 'mata_mata', 'quartas', FALSE, 'A definir', 'A definir', '2026-07-09 17:00:00-03', 131),
  ('MMQF-02', NULL, NULL, 'mata_mata', 'quartas', FALSE, 'A definir', 'A definir', '2026-07-10 16:00:00-03', 132),
  -- Quartas de final (direita)
  ('MMQF-03', NULL, NULL, 'mata_mata', 'quartas', FALSE, 'A definir', 'A definir', '2026-07-11 18:00:00-03', 133),
  ('MMQF-04', NULL, NULL, 'mata_mata', 'quartas', FALSE, 'A definir', 'A definir', '2026-07-11 22:00:00-03', 134),

  -- Semifinais
  ('MMSF-01', NULL, NULL, 'mata_mata', 'semi', FALSE, 'A definir', 'A definir', '2026-07-14 16:00:00-03', 141),
  ('MMSF-02', NULL, NULL, 'mata_mata', 'semi', FALSE, 'A definir', 'A definir', '2026-07-15 16:00:00-03', 142),

  -- Disputa de 3º lugar
  ('MM3L-01', NULL, NULL, 'mata_mata', 'terceiro', FALSE, 'A definir', 'A definir', '2026-07-18 18:00:00-03', 151),

  -- Final
  ('MMFN-01', NULL, NULL, 'mata_mata', 'final', FALSE, 'A definir', 'A definir', '2026-07-19 16:00:00-03', 161)
ON CONFLICT (codigo) DO NOTHING;

-- 4) Correções de dados já existentes -------------------------
-- Confronto MM16-10 era "Camarões", o correto é "Costa do Marfim".
UPDATE jogos SET time_a = 'Costa do Marfim'
WHERE codigo = 'MM16-10' AND time_a = 'Camarões';

-- Horários (horário de Brasília, -03) conforme a lista oficial.
UPDATE jogos SET data_jogo = '2026-06-28 12:00:00-03' WHERE codigo = 'MM16-03';
UPDATE jogos SET data_jogo = '2026-06-29 10:00:00-03' WHERE codigo = 'MM16-09';
UPDATE jogos SET data_jogo = '2026-06-29 13:30:00-03' WHERE codigo = 'MM16-01';
UPDATE jogos SET data_jogo = '2026-06-29 18:00:00-03' WHERE codigo = 'MM16-04';
UPDATE jogos SET data_jogo = '2026-06-30 10:00:00-03' WHERE codigo = 'MM16-10';
UPDATE jogos SET data_jogo = '2026-06-30 14:00:00-03' WHERE codigo = 'MM16-02';
UPDATE jogos SET data_jogo = '2026-06-30 18:00:00-03' WHERE codigo = 'MM16-11';
UPDATE jogos SET data_jogo = '2026-07-01 09:00:00-03' WHERE codigo = 'MM16-12';
UPDATE jogos SET data_jogo = '2026-07-01 13:00:00-03' WHERE codigo = 'MM16-08';
UPDATE jogos SET data_jogo = '2026-07-01 17:00:00-03' WHERE codigo = 'MM16-07';
UPDATE jogos SET data_jogo = '2026-07-02 12:00:00-03' WHERE codigo = 'MM16-06';
UPDATE jogos SET data_jogo = '2026-07-02 16:00:00-03' WHERE codigo = 'MM16-05';
UPDATE jogos SET data_jogo = '2026-07-02 20:00:00-03' WHERE codigo = 'MM16-15';
UPDATE jogos SET data_jogo = '2026-07-03 11:00:00-03' WHERE codigo = 'MM16-14';
UPDATE jogos SET data_jogo = '2026-07-03 15:00:00-03' WHERE codigo = 'MM16-13';
UPDATE jogos SET data_jogo = '2026-07-03 18:30:00-03' WHERE codigo = 'MM16-16';
UPDATE jogos SET data_jogo = '2026-07-04 14:00:00-03' WHERE codigo = 'MMOI-02';
UPDATE jogos SET data_jogo = '2026-07-04 18:00:00-03' WHERE codigo = 'MMOI-01';
UPDATE jogos SET data_jogo = '2026-07-05 17:00:00-03' WHERE codigo = 'MMOI-05';
UPDATE jogos SET data_jogo = '2026-07-05 21:00:00-03' WHERE codigo = 'MMOI-06';
UPDATE jogos SET data_jogo = '2026-07-06 16:00:00-03' WHERE codigo = 'MMOI-03';
UPDATE jogos SET data_jogo = '2026-07-06 21:00:00-03' WHERE codigo = 'MMOI-04';
UPDATE jogos SET data_jogo = '2026-07-07 17:00:00-03' WHERE codigo = 'MMOI-07';
UPDATE jogos SET data_jogo = '2026-07-07 21:00:00-03' WHERE codigo = 'MMOI-08';
UPDATE jogos SET data_jogo = '2026-07-09 17:00:00-03' WHERE codigo = 'MMQF-01';
UPDATE jogos SET data_jogo = '2026-07-10 16:00:00-03' WHERE codigo = 'MMQF-02';
UPDATE jogos SET data_jogo = '2026-07-11 18:00:00-03' WHERE codigo = 'MMQF-03';
UPDATE jogos SET data_jogo = '2026-07-11 22:00:00-03' WHERE codigo = 'MMQF-04';
UPDATE jogos SET data_jogo = '2026-07-14 16:00:00-03' WHERE codigo = 'MMSF-01';
UPDATE jogos SET data_jogo = '2026-07-15 16:00:00-03' WHERE codigo = 'MMSF-02';
UPDATE jogos SET data_jogo = '2026-07-18 18:00:00-03' WHERE codigo = 'MM3L-01';
UPDATE jogos SET data_jogo = '2026-07-19 16:00:00-03' WHERE codigo = 'MMFN-01';
