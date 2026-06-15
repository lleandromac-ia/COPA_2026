-- Migração: painel de análises (liberar/bloquear tipos)
-- Execute no SQL Editor do Supabase se o schema já existir

ALTER TABLE configuracao
  ADD COLUMN IF NOT EXISTS analise_palpites_jogo BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS analise_possibilidades_vencer BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS analise_possibilidades_exaustivas BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS analise_placar_favorito BOOLEAN NOT NULL DEFAULT FALSE;
