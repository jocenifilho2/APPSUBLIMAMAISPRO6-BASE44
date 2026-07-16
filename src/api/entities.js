import { supabase } from '@/lib/supabaseClient';

// Converte "PedidoImpressao" -> "pedido_impressoes" (nome real da tabela no Supabase)
function nomeParaTabela(nomeEntidade) {
  const MAPA_ESPECIAIS = {
    Pedido: 'pedidos',
    Cliente: 'clientes',
    User: 'usuarios',
    PedidoImpressao: 'pedido_impressoes',
    LinkAcompanhamento: 'link_acompanhamentos',
    // Conforme formos criando as tabelas das outras entidades,
    // adicionamos o mapeamento aqui.
  };
  if (MAPA_ESPECIAIS[nomeEntidade]) return MAPA_ESPECIAIS[nomeEntidade];

  // Fallback genérico: PascalCase -> snake_case + "s"
  return nomeEntidade
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .toLowerCase() + 's';
}

// Converte "-created_date" (padrão Base44) em algo que o Supabase entende
function parseOrdenacao(ordenacao) {
  if (!ordenacao) return { coluna: 'created_at', ascendente: true };
  const descendente = ordenacao.startsWith('-');
  const campo = descendente ? ordenacao.slice(1) : ordenacao;
  // Base44 usava "created_date"/"updated_date"; no Supabase é "created_at"/"updated_at"
  const coluna = campo === 'created_date' ? 'created_at'
    : campo === 'updated_date' ? 'updated_at'
    : campo;
  return { coluna, ascendente: !descendente };
}

function criarEntidade(nomeEntidade) {
  const tabela = nomeParaTabela(nomeEntidade);

  return {
    // list('-created_date', 100) — igual ao Base44
    async list(ordenacao, limite) {
      const { coluna, ascendente } = parseOrdenacao(ordenacao);
      let query = supabase.from(tabela).select('*').order(coluna, { ascending: ascendente });
      if (limite) query = query.limit(limite);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },

    // filter({ pedido_id: id }) — igual ao Base44
    async filter(condicoes = {}) {
      let query = supabase.from(tabela).select('*');
      for (const [campo, valor] of Object.entries(condicoes)) {
        query = query.eq(campo, valor);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },

    async get(id) {
      const { data, error } = await supabase.from(tabela).select('*').eq('id', id).single();
      if (error) throw error;
      return data;
    },

    async create(dados) {
      const { data, error } = await supabase.from(tabela).insert(dados).select().single();
      if (error) throw error;
      return data;
    },

    async update(id, dados) {
      const { data, error } = await supabase
        .from(tabela)
        .update({ ...dados, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },

    async delete(id) {
      const { error } = await supabase.from(tabela).delete().eq('id', id);
      if (error) throw error;
      return true;
    }
  };
}

// Proxy: qualquer entidade acessada (entities.Pedido, entities.Cliente, entities.NovaCoisa...)
// gera automaticamente o objeto CRUD acima, sem precisar listar cada uma na mão.
export const entities = new Proxy({}, {
  get(_target, nomeEntidade) {
    return criarEntidade(nomeEntidade);
  }
});
