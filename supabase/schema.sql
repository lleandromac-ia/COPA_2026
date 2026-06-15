-- ============================================================
-- Bolão dos Amigos 2026 - Schema Supabase (PostgreSQL)
-- Execute no SQL Editor do Supabase
-- ============================================================

-- Configurações do sistema (bloqueio de cadastro, etc.)
CREATE TABLE IF NOT EXISTS configuracao (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  cadastro_bloqueado BOOLEAN NOT NULL DEFAULT FALSE,
  analise_palpites_jogo BOOLEAN NOT NULL DEFAULT TRUE,
  analise_possibilidades_vencer BOOLEAN NOT NULL DEFAULT FALSE,
  analise_placar_favorito BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO configuracao (id, cadastro_bloqueado)
VALUES (1, FALSE)
ON CONFLICT (id) DO NOTHING;

-- Participantes
CREATE TABLE IF NOT EXISTS participantes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL UNIQUE,
  cidade TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Jogos da fase de grupos (72 jogos = 12 grupos x 6 jogos)
CREATE TABLE IF NOT EXISTS jogos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo TEXT NOT NULL UNIQUE,
  grupo TEXT NOT NULL,
  rodada SMALLINT NOT NULL CHECK (rodada BETWEEN 1 AND 3),
  time_a TEXT NOT NULL,
  time_b TEXT NOT NULL,
  gols_a SMALLINT CHECK (gols_a IS NULL OR gols_a >= 0),
  gols_b SMALLINT CHECK (gols_b IS NULL OR gols_b >= 0),
  data_jogo TIMESTAMPTZ,
  ordem SMALLINT NOT NULL DEFAULT 0
);

-- Palpites dos participantes
CREATE TABLE IF NOT EXISTS palpites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  participante_id UUID NOT NULL REFERENCES participantes(id) ON DELETE CASCADE,
  jogo_id UUID NOT NULL REFERENCES jogos(id) ON DELETE CASCADE,
  gols_a SMALLINT NOT NULL CHECK (gols_a >= 0),
  gols_b SMALLINT NOT NULL CHECK (gols_b >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (participante_id, jogo_id)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_jogos_grupo ON jogos(grupo);
CREATE INDEX IF NOT EXISTS idx_palpites_participante ON palpites(participante_id);
CREATE INDEX IF NOT EXISTS idx_palpites_jogo ON palpites(jogo_id);

-- Row Level Security (ajuste conforme sua autenticação)
ALTER TABLE configuracao ENABLE ROW LEVEL SECURITY;
ALTER TABLE participantes ENABLE ROW LEVEL SECURITY;
ALTER TABLE jogos ENABLE ROW LEVEL SECURITY;
ALTER TABLE palpites ENABLE ROW LEVEL SECURITY;

-- Políticas permissivas para desenvolvimento (anon key)
-- Em produção, restrinja com auth e roles de admin
CREATE POLICY "Leitura pública configuracao" ON configuracao FOR SELECT USING (true);
CREATE POLICY "Atualização configuracao" ON configuracao FOR UPDATE USING (true);

CREATE POLICY "Leitura participantes" ON participantes FOR SELECT USING (true);
CREATE POLICY "Inserção participantes" ON participantes FOR INSERT WITH CHECK (true);
CREATE POLICY "Atualização participantes" ON participantes FOR UPDATE USING (true);
CREATE POLICY "Exclusão participantes" ON participantes FOR DELETE USING (true);

CREATE POLICY "Leitura jogos" ON jogos FOR SELECT USING (true);
CREATE POLICY "Inserção jogos" ON jogos FOR INSERT WITH CHECK (true);
CREATE POLICY "Atualização jogos" ON jogos FOR UPDATE USING (true);

CREATE POLICY "Leitura palpites" ON palpites FOR SELECT USING (true);
CREATE POLICY "Inserção palpites" ON palpites FOR INSERT WITH CHECK (true);
CREATE POLICY "Atualização palpites" ON palpites FOR UPDATE USING (true);
CREATE POLICY "Exclusão palpites" ON palpites FOR DELETE USING (true);

-- ============================================================
-- Seed: 72 jogos (Grupos A a L, 6 jogos cada)
-- ============================================================
INSERT INTO jogos (codigo, grupo, rodada, time_a, time_b, ordem) VALUES
  ('A01', 'A', 1, 'Equipe A1', 'Equipe A2', 1),
  ('A02', 'A', 1, 'Equipe A3', 'Equipe A4', 2),
  ('A03', 'A', 2, 'Equipe A1', 'Equipe A3', 3),
  ('A04', 'A', 2, 'Equipe A2', 'Equipe A4', 4),
  ('A05', 'A', 3, 'Equipe A1', 'Equipe A4', 5),
  ('A06', 'A', 3, 'Equipe A2', 'Equipe A3', 6),
  ('B01', 'B', 1, 'Equipe B1', 'Equipe B2', 7),
  ('B02', 'B', 1, 'Equipe B3', 'Equipe B4', 8),
  ('B03', 'B', 2, 'Equipe B1', 'Equipe B3', 9),
  ('B04', 'B', 2, 'Equipe B2', 'Equipe B4', 10),
  ('B05', 'B', 3, 'Equipe B1', 'Equipe B4', 11),
  ('B06', 'B', 3, 'Equipe B2', 'Equipe B3', 12),
  ('C01', 'C', 1, 'Equipe C1', 'Equipe C2', 13),
  ('C02', 'C', 1, 'Equipe C3', 'Equipe C4', 14),
  ('C03', 'C', 2, 'Equipe C1', 'Equipe C3', 15),
  ('C04', 'C', 2, 'Equipe C2', 'Equipe C4', 16),
  ('C05', 'C', 3, 'Equipe C1', 'Equipe C4', 17),
  ('C06', 'C', 3, 'Equipe C2', 'Equipe C3', 18),
  ('D01', 'D', 1, 'Equipe D1', 'Equipe D2', 19),
  ('D02', 'D', 1, 'Equipe D3', 'Equipe D4', 20),
  ('D03', 'D', 2, 'Equipe D1', 'Equipe D3', 21),
  ('D04', 'D', 2, 'Equipe D2', 'Equipe D4', 22),
  ('D05', 'D', 3, 'Equipe D1', 'Equipe D4', 23),
  ('D06', 'D', 3, 'Equipe D2', 'Equipe D3', 24),
  ('E01', 'E', 1, 'Equipe E1', 'Equipe E2', 25),
  ('E02', 'E', 1, 'Equipe E3', 'Equipe E4', 26),
  ('E03', 'E', 2, 'Equipe E1', 'Equipe E3', 27),
  ('E04', 'E', 2, 'Equipe E2', 'Equipe E4', 28),
  ('E05', 'E', 3, 'Equipe E1', 'Equipe E4', 29),
  ('E06', 'E', 3, 'Equipe E2', 'Equipe E3', 30),
  ('F01', 'F', 1, 'Equipe F1', 'Equipe F2', 31),
  ('F02', 'F', 1, 'Equipe F3', 'Equipe F4', 32),
  ('F03', 'F', 2, 'Equipe F1', 'Equipe F3', 33),
  ('F04', 'F', 2, 'Equipe F2', 'Equipe F4', 34),
  ('F05', 'F', 3, 'Equipe F1', 'Equipe F4', 35),
  ('F06', 'F', 3, 'Equipe F2', 'Equipe F3', 36),
  ('G01', 'G', 1, 'Equipe G1', 'Equipe G2', 37),
  ('G02', 'G', 1, 'Equipe G3', 'Equipe G4', 38),
  ('G03', 'G', 2, 'Equipe G1', 'Equipe G3', 39),
  ('G04', 'G', 2, 'Equipe G2', 'Equipe G4', 40),
  ('G05', 'G', 3, 'Equipe G1', 'Equipe G4', 41),
  ('G06', 'G', 3, 'Equipe G2', 'Equipe G3', 42),
  ('H01', 'H', 1, 'Equipe H1', 'Equipe H2', 43),
  ('H02', 'H', 1, 'Equipe H3', 'Equipe H4', 44),
  ('H03', 'H', 2, 'Equipe H1', 'Equipe H3', 45),
  ('H04', 'H', 2, 'Equipe H2', 'Equipe H4', 46),
  ('H05', 'H', 3, 'Equipe H1', 'Equipe H4', 47),
  ('H06', 'H', 3, 'Equipe H2', 'Equipe H3', 48),
  ('I01', 'I', 1, 'Equipe I1', 'Equipe I2', 49),
  ('I02', 'I', 1, 'Equipe I3', 'Equipe I4', 50),
  ('I03', 'I', 2, 'Equipe I1', 'Equipe I3', 51),
  ('I04', 'I', 2, 'Equipe I2', 'Equipe I4', 52),
  ('I05', 'I', 3, 'Equipe I1', 'Equipe I4', 53),
  ('I06', 'I', 3, 'Equipe I2', 'Equipe I3', 54),
  ('J01', 'J', 1, 'Equipe J1', 'Equipe J2', 55),
  ('J02', 'J', 1, 'Equipe J3', 'Equipe J4', 56),
  ('J03', 'J', 2, 'Equipe J1', 'Equipe J3', 57),
  ('J04', 'J', 2, 'Equipe J2', 'Equipe J4', 58),
  ('J05', 'J', 3, 'Equipe J1', 'Equipe J4', 59),
  ('J06', 'J', 3, 'Equipe J2', 'Equipe J3', 60),
  ('K01', 'K', 1, 'Equipe K1', 'Equipe K2', 61),
  ('K02', 'K', 1, 'Equipe K3', 'Equipe K4', 62),
  ('K03', 'K', 2, 'Equipe K1', 'Equipe K3', 63),
  ('K04', 'K', 2, 'Equipe K2', 'Equipe K4', 64),
  ('K05', 'K', 3, 'Equipe K1', 'Equipe K4', 65),
  ('K06', 'K', 3, 'Equipe K2', 'Equipe K3', 66),
  ('L01', 'L', 1, 'Equipe L1', 'Equipe L2', 67),
  ('L02', 'L', 1, 'Equipe L3', 'Equipe L4', 68),
  ('L03', 'L', 2, 'Equipe L1', 'Equipe L3', 69),
  ('L04', 'L', 2, 'Equipe L2', 'Equipe L4', 70),
  ('L05', 'L', 3, 'Equipe L1', 'Equipe L4', 71),
  ('L06', 'L', 3, 'Equipe L2', 'Equipe L3', 72)
ON CONFLICT (codigo) DO NOTHING;
