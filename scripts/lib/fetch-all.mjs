/**
 * Carrega todos os registros de uma tabela Supabase, paginando em lotes de 1000.
 */
const PAGE_SIZE = 1000;

export async function carregarTabelaPaginada(supabase, tabela, { order } = {}) {
  const todos = [];
  let from = 0;

  while (true) {
    let query = supabase
      .from(tabela)
      .select('*')
      .range(from, from + PAGE_SIZE - 1);

    if (order) {
      query = query.order(order);
    }

    const { data, error } = await query;
    if (error) throw error;
    if (!data?.length) break;

    todos.push(...data);
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  return todos;
}
