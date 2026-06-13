-- Corrige horários dos jogos: foram gravados como UTC, mas representam horário de Brasília (UTC-3).
-- Ex.: 16:00 no Excel virou 16:00+00 → exibia 13:00 no Brasil. Soma 3h para corrigir.
--
-- Execute no SQL Editor do Supabase (uma vez):

UPDATE jogos
SET data_jogo = data_jogo + INTERVAL '3 hours'
WHERE data_jogo IS NOT NULL;

-- Verificação (A01 deve exibir ~16:00 no horário de Brasília):
-- SELECT codigo, time_a, time_b, data_jogo,
--        data_jogo AT TIME ZONE 'America/Sao_Paulo' AS horario_brasilia
-- FROM jogos ORDER BY ordem LIMIT 5;
