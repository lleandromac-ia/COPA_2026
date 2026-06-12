import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.49.1/+esm';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

let client = null;

export function getSupabase() {
  if (!client) {
    if (
      SUPABASE_URL === 'SUA_URL_DO_SUPABASE' ||
      SUPABASE_ANON_KEY === 'SUA_ANON_KEY_DO_SUPABASE'
    ) {
      throw new Error(
        'Configure SUPABASE_URL e SUPABASE_ANON_KEY em js/config.js'
      );
    }
    client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
  return client;
}

export async function carregarDados() {
  const supabase = getSupabase();

  const [configRes, participantesRes, jogosRes, palpitesRes] = await Promise.all([
    supabase.from('configuracao').select('*').single(),
    supabase.from('participantes').select('*').order('nome'),
    supabase.from('jogos').select('*').order('ordem'),
    supabase.from('palpites').select('*'),
  ]);

  if (configRes.error && configRes.error.code !== 'PGRST116') {
    throw configRes.error;
  }
  if (participantesRes.error) throw participantesRes.error;
  if (jogosRes.error) throw jogosRes.error;
  if (palpitesRes.error) throw palpitesRes.error;

  return {
    config: configRes.data || { cadastro_bloqueado: false },
    participantes: participantesRes.data || [],
    jogos: jogosRes.data || [],
    palpites: palpitesRes.data || [],
  };
}

export async function criarParticipante({ nome, cidade }) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('participantes')
    .insert({ nome, cidade: cidade || null })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function excluirParticipante(id) {
  const supabase = getSupabase();
  const { error } = await supabase.from('participantes').delete().eq('id', id);
  if (error) throw error;
}

export async function salvarPalpite({ participante_id, jogo_id, gols_a, gols_b }) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('palpites')
    .upsert(
      {
        participante_id,
        jogo_id,
        gols_a,
        gols_b,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'participante_id,jogo_id' }
    )
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function salvarResultadoJogo(jogoId, gols_a, gols_b) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('jogos')
    .update({ gols_a, gols_b })
    .eq('id', jogoId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function atualizarConfiguracao(cadastro_bloqueado) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('configuracao')
    .update({ cadastro_bloqueado, updated_at: new Date().toISOString() })
    .eq('id', 1)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function atualizarNomesTimes(jogoId, time_a, time_b) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('jogos')
    .update({ time_a, time_b })
    .eq('id', jogoId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function importarJogos(jogos) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('jogos')
    .upsert(jogos, { onConflict: 'codigo' })
    .select();
  if (error) throw error;
  return data;
}

export async function importarParticipantes(participantes) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('participantes')
    .upsert(participantes, { onConflict: 'nome' })
    .select();
  if (error) throw error;
  return data;
}

export async function importarPalpites(palpites) {
  const supabase = getSupabase();
  const chunkSize = 100;
  const results = [];

  for (let i = 0; i < palpites.length; i += chunkSize) {
    const chunk = palpites.slice(i, i + chunkSize);
    const { data, error } = await supabase
      .from('palpites')
      .upsert(chunk, { onConflict: 'participante_id,jogo_id' })
      .select();
    if (error) throw error;
    results.push(...(data || []));
  }

  return results;
}

export async function resolverPalpitesParaImport(palpitesRaw) {
  const supabase = getSupabase();

  const [{ data: participantes }, { data: jogos }] = await Promise.all([
    supabase.from('participantes').select('id, nome'),
    supabase.from('jogos').select('id, codigo'),
  ]);

  const mapParticipante = new Map(
    (participantes || []).map((p) => [p.nome.toLowerCase(), p.id])
  );
  const mapJogo = new Map(
    (jogos || []).map((j) => [j.codigo.toUpperCase(), j.id])
  );

  const erros = [];
  const palpites = [];

  for (const p of palpitesRaw) {
    const pid = mapParticipante.get(p.nome.toLowerCase());
    const jid = mapJogo.get(p.codigo_jogo.toUpperCase());

    if (!pid) {
      erros.push(`Participante não encontrado: "${p.nome}"`);
      continue;
    }
    if (!jid) {
      erros.push(`Jogo não encontrado: "${p.codigo_jogo}"`);
      continue;
    }

    palpites.push({
      participante_id: pid,
      jogo_id: jid,
      gols_a: p.gols_a,
      gols_b: p.gols_b,
      updated_at: new Date().toISOString(),
    });
  }

  return { palpites, erros };
}
