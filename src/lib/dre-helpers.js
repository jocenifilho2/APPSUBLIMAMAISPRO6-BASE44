// Regras determinísticas para o DRE — sem chamadas externas/IA.

// Fallback de classificação contábil quando o lançamento não tem grupo_dre definido.
// Baseado na categoria livre já usada no financeiro atual.
export const GRUPO_DRE_POR_CATEGORIA = {
  'Fornecedor': 'CUSTO_VARIAVEL',
  'Aluguel': 'DESPESA_FIXA',
  'Energia': 'DESPESA_FIXA',
  'Internet': 'DESPESA_FIXA',
  'Salário': 'DESPESA_FIXA',
  'Marketing': 'DESPESA_VARIAVEL',
  'Outros': 'DESPESA_VARIAVEL',
};

export const GRUPO_DRE_LABEL = {
  DEDUCAO_RECEITA: 'Deduções sobre a Receita',
  CUSTO_VARIAVEL: 'Custo de Mercadoria/Serviço (CMV)',
  DESPESA_FIXA: 'Despesas Fixas',
  DESPESA_VARIAVEL: 'Despesas Variáveis',
  DESPESA_FINANCEIRA: 'Despesas Financeiras',
  OUTRAS_RECEITAS: 'Outras Receitas',
  OUTRAS_DESPESAS: 'Outras Despesas',
};

export function inferirGrupoDre(conta) {
  if (conta.grupo_dre) return conta.grupo_dre;
  if (conta.tipo === 'RECEITA') return 'OUTRAS_RECEITAS';
  return GRUPO_DRE_POR_CATEGORIA[conta.categoria] || 'DESPESA_VARIAVEL';
}

// Custo médio ponderado por produto a partir das movimentações de estoque.
// Entradas/Produção alimentam o custo médio; Saídas consomem ao custo médio vigente.
// Retorna { custoMedioPorProduto, cmvNoPeriodo, temDados }
export function calcularCMV(movimentacoes, dataInicio, dataFim) {
  const porProduto = {}; // nome -> { qtd, custoTotal, custoMedio }
  const ordenadas = [...movimentacoes]
    .filter(m => m.produto_nome)
    .sort((a, b) => new Date(a.created_date || 0) - new Date(b.created_date || 0));

  let cmvNoPeriodo = 0;
  let temDados = false;

  for (const m of ordenadas) {
    const nome = m.produto_nome;
    if (!porProduto[nome]) porProduto[nome] = { qtd: 0, custoTotal: 0, custoMedio: 0 };
    const p = porProduto[nome];
    const qtd = Number(m.quantidade) || 0;
    const dataMov = m.created_date ? m.created_date.slice(0, 10) : null;
    const noPeriodo = dataMov && (!dataInicio || dataMov >= dataInicio) && (!dataFim || dataMov <= dataFim);

    if (['ENTRADA', 'PRODUCAO', 'AJUSTE'].includes(m.tipo) && m.custo_unitario) {
      // Atualiza custo médio ponderado
      const custoTotalAnterior = p.custoMedio * p.qtd;
      const custoNovo = Number(m.custo_unitario) * qtd;
      p.qtd += qtd;
      p.custoTotal = custoTotalAnterior + custoNovo;
      p.custoMedio = p.qtd > 0 ? p.custoTotal / p.qtd : 0;
      temDados = true;
    } else if (['SAIDA', 'PRODUCAO', 'PERDA'].includes(m.tipo) && p.custoMedio > 0) {
      const custoBaixa = p.custoMedio * qtd;
      p.qtd = Math.max(0, p.qtd - qtd);
      if (noPeriodo) cmvNoPeriodo += custoBaixa;
    }
  }

  return { porProduto, cmvNoPeriodo, temDados };
}

// Monta a estrutura completa do DRE para um período.
export function montarDRE({ pedidosPeriodo, contasPeriodo, cmvNoPeriodo, aliquotaImpostoPct = 0 }) {
  const STATUS_RECEITA = ['PAGO', 'ENTREGUE', 'PRONTO'];
  const receitaBruta = pedidosPeriodo
    .filter(p => p.status !== 'CANCELADO' && STATUS_RECEITA.includes(p.status))
    .reduce((s, p) => s + (p.total || 0), 0);

  const deducaoImpostos = receitaBruta * (aliquotaImpostoPct / 100);

  const deducaoManual = contasPeriodo
    .filter(c => c.status === 'PAGO' && inferirGrupoDre(c) === 'DEDUCAO_RECEITA')
    .reduce((s, c) => s + (c.valor || 0), 0);

  const receitaLiquida = receitaBruta - deducaoImpostos - deducaoManual;

  const cmv = cmvNoPeriodo || 0;
  const custoVariavelLancado = contasPeriodo
    .filter(c => c.status === 'PAGO' && c.tipo === 'DESPESA' && inferirGrupoDre(c) === 'CUSTO_VARIAVEL')
    .reduce((s, c) => s + (c.valor || 0), 0);
  const custoTotal = cmv + custoVariavelLancado;

  const lucroBruto = receitaLiquida - custoTotal;

  const grupos = ['DESPESA_FIXA', 'DESPESA_VARIAVEL'];
  const despesasOperacionais = {};
  grupos.forEach(g => {
    despesasOperacionais[g] = contasPeriodo
      .filter(c => c.status === 'PAGO' && c.tipo === 'DESPESA' && inferirGrupoDre(c) === g)
      .reduce((s, c) => s + (c.valor || 0), 0);
  });
  const totalDespesasOperacionais = Object.values(despesasOperacionais).reduce((a, b) => a + b, 0);

  const ebitda = lucroBruto - totalDespesasOperacionais;

  const despesasFinanceiras = contasPeriodo
    .filter(c => c.status === 'PAGO' && c.tipo === 'DESPESA' && inferirGrupoDre(c) === 'DESPESA_FINANCEIRA')
    .reduce((s, c) => s + (c.valor || 0), 0);

  const outrasReceitas = contasPeriodo
    .filter(c => c.status === 'PAGO' && c.tipo === 'RECEITA' && inferirGrupoDre(c) === 'OUTRAS_RECEITAS')
    .reduce((s, c) => s + (c.valor || 0), 0);

  const outrasDespesas = contasPeriodo
    .filter(c => c.status === 'PAGO' && c.tipo === 'DESPESA' && inferirGrupoDre(c) === 'OUTRAS_DESPESAS')
    .reduce((s, c) => s + (c.valor || 0), 0);

  const resultadoLiquido = ebitda - despesasFinanceiras + outrasReceitas - outrasDespesas;

  const margemBruta = receitaLiquida > 0 ? (lucroBruto / receitaLiquida) * 100 : 0;
  const margemLiquida = receitaLiquida > 0 ? (resultadoLiquido / receitaLiquida) * 100 : 0;

  return {
    receitaBruta, deducaoImpostos, deducaoManual, receitaLiquida,
    cmv, custoVariavelLancado, custoTotal, lucroBruto,
    despesasOperacionais, totalDespesasOperacionais, ebitda,
    despesasFinanceiras, outrasReceitas, outrasDespesas, resultadoLiquido,
    margemBruta, margemLiquida,
  };
}

export function fmtMoeda(v) {
  return (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
