-- Migração: análise de probabilidade exaustiva
ALTER TABLE configuracao
  ADD COLUMN IF NOT EXISTS analise_possibilidades_exaustivas BOOLEAN NOT NULL DEFAULT FALSE;
