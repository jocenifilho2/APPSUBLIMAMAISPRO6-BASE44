import { base44 } from '@/api/base44Client';

// ═══════════════════════════════════════════════════════════
//  FORMATAÇÃO
// ═══════════════════════════════════════════════════════════

export function formatCurrency(value) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
}

export function formatPercent(value) {
  return `${(value || 0).toFixed(1)}%`;
}

export function formatDate(date) {
  if (!date) return '—';
  const d = new Date(date);
  if (isNaN(d)) return '—';
  return d.toLocaleDateString('pt-BR');
}

export function formatDateTime(date) {
  if (!date) return '—';
  const d = new Date(date);
  if (isNaN(d)) return '—';
  return d.toLocaleString('pt-BR');
}

// ═══════════════════════════════════════════════════════════
//  DATA HELPERS
// ═══════════════════════════════════════════════════════════

export function adicionarDias(data, dias) {
  const d = new Date(data);
  d.setDate(d.getDate() + dias);
  return d;
}

export function adicionarMeses(data, meses) {
  const d = new Date(data);
  d.setMonth(d.getMonth() + meses);
  return d;
}

export function toISODate(date) {
  return new Date(date).toISOString().split('T')[0];
}

export function hoje() {
  return toISODate(new Date());
}

export function diasEntre(data1, data2) {
  const diff = new Date(data2) - new Date(data1);
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

// ═══════════════════════════════════════════════════════════
//  PARCELAMENTO
// ═══════════════════════════════════════════════════════════

export function gerarParcelaGrupo() {
  return 'par_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

export function calcularParcelas(valorTotal, numParcelas, primeiraData, intervaloDias = 30) {
  if (numParcelas < 1) numParcelas = 1;
  const parcelas = [];
  const valorBase = valorTotal / numParcelas;
  let acumulado = 0;
  for (let i = 0; i < numParcelas; i++) {
    let valor = Math.round(valorBase * 100) / 100;
    if (i === numParcelas - 1) {
      valor = Math.round((valorTotal - acumulado) * 100) / 100;
    }
    acumulado += valor;
    parcelas.push({
      numero: i + 1,
      total: numParcelas,
      valor,
      vencimento: toISODate(adicionarDias(primeiraData, i * intervaloDias)),
      status: 'PENDENTE',
      valor_pago: 0
    });
  }
  return parcelas;
}

// ═══════════════════════════════════════════════════════════
//  PAGAMENTOS PARCIAIS
// ═══════════════════════════════════════════════════════════

export function calcularSaldoRestante(conta) {
  const valor = conta.valor || 0;
  const pago = conta.valor_pago || 0;
  return Math.round((valor - pago) * 100) / 100;
}

export function calcularStatusPagamento(conta) {
  const saldo = calcularSaldoRestante(conta);
  if (saldo <= 0.01) return 'PAGO';
  if (conta.valor_pago > 0) return 'PAGO_PARCIAL';
  return conta.status || 'PENDENTE';
}

// ═══════════════════════════════════════════════════════════
//  FLUXO DE CAIXA PROJETADO
// ═══════════════════════════════════════════════════════════

export function calcularFluxoProjetado(contas, pagamentosParciais = [], saldoAtual = 0, periodoDias = 30) {
  const agora = new Date();
  const dataLimite = adicionarDias(agora, periodoDias);

  // Calcular valor_pago efetivo por conta
  const pagoPorConta = {};
  pagamentosParciais.forEach(p => {
    pagoPorConta[p.conta_financeira_id] = (pagoPorConta[p.conta_financeira_id] || 0) + (p.valor || 0);
  });

  const contasReceber = contas.filter(c =>
    c.tipo === 'RECEITA' &&
    c.status !== 'CANCELADO' &&
    c.status !== 'PAGO' &&
    c.data_vencimento &&
    new Date(c.data_vencimento) <= dataLimite
  );
  const contasPagar = contas.filter(c =>
    c.tipo === 'DESPESA' &&
    c.status !== 'CANCELADO' &&
    c.status !== 'PAGO' &&
    c.data_vencimento &&
    new Date(c.data_vencimento) <= dataLimite
  );

  const receber = contasReceber.reduce((s, c) => {
    const saldo = (c.valor || 0) - (pagoPorConta[c.id] || c.valor_pago || 0);
    return s + Math.max(0, saldo);
  }, 0);

  const pagar = contasPagar.reduce((s, c) => {
    const saldo = (c.valor || 0) - (pagoPorConta[c.id] || c.valor_pago || 0);
    return s + Math.max(0, saldo);
  }, 0);

  const vencidoReceber = contasReceber.filter(c => new Date(c.data_vencimento) < agora)
    .reduce((s, c) => s + Math.max(0, (c.valor || 0) - (pagoPorConta[c.id] || c.valor_pago || 0)), 0);
  const vencidoPagar = contasPagar.filter(c => new Date(c.data_vencimento) < agora)
    .reduce((s, c) => s + Math.max(0, (c.valor || 0) - (pagoPorConta[c.id] || c.valor_pago || 0)), 0);

  return {
    saldoAtual,
    receber,
    pagar,
    projetado: saldoAtual + receber - pagar,
    vencidoReceber,
    vencidoPagar,
    periodoDias
  };
}

export function gerarSerieProjecao(contas, pagamentosParciais = [], saldoAtual = 0) {
  const periodos = [
    { label: 'Hoje', dias: 0 },
    { label: '7 dias', dias: 7 },
    { label: '15 dias', dias: 15 },
    { label: '30 dias', dias: 30 },
    { label: '60 dias', dias: 60 },
    { label: '90 dias', dias: 90 }
  ];
  return periodos.map(p => {
    const fluxo = calcularFluxoProjetado(contas, pagamentosParciais, saldoAtual, p.dias);
    return { label: p.label, saldo: fluxo.projetado, receber: fluxo.receber, pagar: fluxo.pagar };
  });
}

// ═══════════════════════════════════════════════════════════
//  RENTABILIDADE
// ═══════════════════════════════════════════════════════════

export function calcularRentabilidade(custo, precoVenda) {
  const lucroBruto = (precoVenda || 0) - (custo || 0);
  const margem = precoVenda > 0 ? (lucroBruto / precoVenda) * 100 : 0;
  const rentabilidade = margem > 30 ? 'ALTA' : margem > 15 ? 'MEDIA' : margem > 0 ? 'BAIXA' : 'NEGATIVA';
  return { lucroBruto, margem: Math.round(margem * 100) / 100, rentabilidade };
}

export function calcularRentabilidadeProduto(produto) {
  const custo = produto.custo || 0;
  const precoPix = produto.preco_pix || 0;
  const precoCartao = produto.preco_cartao || 0;
  const rentPix = calcularRentabilidade(custo, precoPix);
  const rentCartao = calcularRentabilidade(custo, precoCartao);
  return { rentPix, rentCartao, custo, precoPix, precoCartao };
}

// ═══════════════════════════════════════════════════════════
//  PONTO DE EQUILÍBRIO
// ═══════════════════════════════════════════════════════════

export function calcularPontoEquilibrio(custosFixos, faturamento, custosVariaveis) {
  const margemContribuicao = faturamento > 0 ? (faturamento - custosVariaveis) / faturamento : 0;
  const pontoEquilibrio = margemContribuicao > 0 ? custosFixos / margemContribuicao : 0;
  return {
    margemContribuicao: Math.round(margemContribuicao * 10000) / 100,
    pontoEquilibrio: Math.round(pontoEquilibrio * 100) / 100,
    acima: faturamento > pontoEquilibrio
  };
}

// ═══════════════════════════════════════════════════════════
//  METAS
// ═══════════════════════════════════════════════════════════

export function calcularMetaProgresso(valorMeta, valorRealizado) {
  const percentual = valorMeta > 0 ? (valorRealizado / valorMeta) * 100 : 0;
  const faltante = valorMeta - valorRealizado;
  return {
    percentual: Math.round(percentual * 100) / 100,
    faltante: Math.round(faltante * 100) / 100,
    atingida: valorRealizado >= valorMeta
  };
}

// ═══════════════════════════════════════════════════════════
//  RECORRÊNCIA
// ═══════════════════════════════════════════════════════════

export function calcularProximaData(dataBase, periodicidade) {
  const d = new Date(dataBase);
  switch (periodicidade) {
    case 'SEMANAL': return adicionarDias(d, 7);
    case 'QUINZENAL': return adicionarDias(d, 15);
    case 'MENSAL': return adicionarMeses(d, 1);
    case 'BIMESTRAL': return adicionarMeses(d, 2);
    case 'TRIMESTRAL': return adicionarMeses(d, 3);
    case 'SEMESTRAL': return adicionarMeses(d, 6);
    case 'ANUAL': return adicionarMeses(d, 12);
    default: return adicionarMeses(d, 1);
  }
}

// Gera contas recorrentes vencidas — chamado ao carregar o módulo
export async function processarRecorrentes(recorrentes) {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const aGerar = [];
  for (const r of recorrentes) {
    if (!r.ativo || !r.proxima_data) continue;
    let proxima = new Date(r.proxima_data);
    proxima.setHours(0, 0, 0, 0);
    while (proxima <= hoje) {
      aGerar.push({
        recorrente: r,
        dataVencimento: toISODate(proxima)
      });
      proxima = calcularProximaData(proxima, r.periodicidade);
    }
  }
  if (aGerar.length === 0) return 0;

  const contas = aGerar.map(({ recorrente, dataVencimento }) => ({
    tipo: recorrente.tipo,
    descricao: recorrente.descricao,
    valor: recorrente.valor,
    data_vencimento: dataVencimento,
    status: 'PENDENTE',
    categoria: recorrente.categoria || '',
    centro_custo_id: recorrente.centro_custo_id || '',
    centro_custo_nome: recorrente.centro_custo_nome || '',
    plano_conta_id: recorrente.plano_conta_id || '',
    plano_conta_nome: recorrente.plano_conta_nome || '',
    classificacao: recorrente.classificacao || 'FIXA',
    conta_recorrente_id: recorrente.id,
    valor_pago: 0,
    observacoes: `Gerado automaticamente de conta recorrente`
  }));

  try {
    await base44.entities.ContaFinanceira.bulkCreate(contas);
    // Atualizar próximas datas
    for (const r of recorrentes) {
      if (!aGerar.some(g => g.recorrente.id === r.id)) continue;
      const ultimaGeracao = aGerar.filter(g => g.recorrente.id === r.id).pop().dataVencimento;
      const novaProxima = toISODate(calcularProximaData(ultimaGeracao, r.periodicidade));
      await base44.entities.ContaRecorrente.update(r.id, {
        proxima_data: novaProxima,
        ultima_geracao: new Date().toISOString()
      });
    }
    return contas.length;
  } catch (e) {
    console.error('Erro ao processar recorrentes:', e);
    return 0;
  }
}

// ═══════════════════════════════════════════════════════════
//  RATEIO
// ═══════════════════════════════════════════════════════════

export function aplicarRateio(valor, itens) {
  if (!itens || !itens.length) return [{ centro_custo_nome: 'Sem rateio', valor, percentual: 100 }];
  return itens.map(item => ({
    centro_custo_id: item.centro_custo_id,
    centro_custo_nome: item.centro_custo_nome,
    percentual: item.percentual,
    valor: Math.round((valor * item.percentual / 100) * 100) / 100
  }));
}

// ═══════════════════════════════════════════════════════════
//  SIMULADOR DE PREÇO
// ═══════════════════════════════════════════════════════════

export function simularPreco({
  material = 0, tinta = 0, papel = 0, filme = 0, energia = 0,
  tempoMinutos = 0, custoMaoObraHora = 0, embalagem = 0, frete = 0,
  margemDesejada = 30, impostos = 0, quantidade = 1
}) {
  const maoObra = (tempoMinutos / 60) * custoMaoObraHora;
  const custoUnitario = material + tinta + papel + filme + energia + maoObra + embalagem + frete;
  const custoTotal = custoUnitario * quantidade;
  // preço sugerido = custo / (1 - margem% - impostos%)
  const fatorMargem = 1 - (margemDesejada / 100) - (impostos / 100);
  const precoSugerido = fatorMargem > 0 ? custoUnitario / fatorMargem : custoUnitario * 1.3;
  const lucro = precoSugerido - custoUnitario - (precoSugerido * impostos / 100);
  const margemReal = precoSugerido > 0 ? (lucro / precoSugerido) * 100 : 0;
  return {
    custoUnitario: Math.round(custoUnitario * 100) / 100,
    custoTotal: Math.round(custoTotal * 100) / 100,
    maoObra: Math.round(maoObra * 100) / 100,
    precoSugerido: Math.round(precoSugerido * 100) / 100,
    lucro: Math.round(lucro * 100) / 100,
    margemReal: Math.round(margemReal * 100) / 100,
    rentabilidade: margemReal > 30 ? 'ALTA' : margemReal > 15 ? 'MEDIA' : margemReal > 0 ? 'BAIXA' : 'NEGATIVA'
  };
}

// ═══════════════════════════════════════════════════════════
//  ALERTAS
// ═══════════════════════════════════════════════════════════

export function gerarAlertas({ contas, saldoCaixa, metas, produtos }) {
  const alertas = [];
  const agora = new Date();

  // Contas vencidas
  const vencidasPagar = contas.filter(c => c.tipo === 'DESPESA' && c.status === 'VENCIDO');
  const vencidasReceber = contas.filter(c => c.tipo === 'RECEITA' && c.status === 'VENCIDO');
  if (vencidasPagar.length > 0) {
    const total = vencidasPagar.reduce((s, c) => s + (c.valor || 0), 0);
    alertas.push({ nivel: 'VERMELHO', titulo: 'Contas a Pagar Vencidas', detalhe: `${vencidasPagar.length} conta(s) — ${formatCurrency(total)}` });
  }
  if (vencidasReceber.length > 0) {
    const total = vencidasReceber.reduce((s, c) => s + (c.valor || 0), 0);
    alertas.push({ nivel: 'VERMELHO', titulo: 'Contas a Receber Vencidas', detalhe: `${vencidasReceber.length} conta(s) — ${formatCurrency(total)}` });
  }

  // Fluxo negativo
  if (saldoCaixa < 0) {
    alertas.push({ nivel: 'VERMELHO', titulo: 'Fluxo de Caixa Negativo', detalhe: `Saldo: ${formatCurrency(saldoCaixa)}` });
  }

  // Metas não atingidas
  if (metas && metas.faturamento) {
    if (metas.faturamento.realizado < metas.faturamento.meta * 0.8) {
      alertas.push({ nivel: 'AMARELO', titulo: 'Meta de Faturamento Abaixo do Esperado', detalhe: `${formatPercent((metas.faturamento.realizado / metas.faturamento.meta) * 100)} da meta` });
    }
  }

  // Produtos sem margem
  if (produtos) {
    const semMargem = produtos.filter(p => (p.custo || 0) >= (p.preco_pix || 0));
    if (semMargem.length > 0) {
      alertas.push({ nivel: 'AMARELO', titulo: 'Produtos Sem Margem de Lucro', detalhe: `${semMargem.length} produto(s) com custo >= preço` });
    }
  }

  // Contas vencendo hoje
  const hojeStr = hoje();
  const vencendoHoje = contas.filter(c => c.status === 'PENDENTE' && c.data_vencimento === hojeStr);
  if (vencendoHoje.length > 0) {
    alertas.push({ nivel: 'AMARELO', titulo: 'Vencimentos Hoje', detalhe: `${vencendoHoje.length} conta(s) vencem hoje` });
  }

  // Tudo OK
  if (alertas.length === 0) {
    alertas.push({ nivel: 'VERDE', titulo: 'Tudo em Dia', detalhe: 'Nenhum alerta financeiro no momento' });
  }

  return alertas;
}

// ═══════════════════════════════════════════════════════════
//  INDICADORES DE SEGMENTO
// ═══════════════════════════════════════════════════════════

export function calcularIndicadoresSegmento(pedidos, impressoes) {
  let metrosDTF = 0, folhasImpressas = 0, canecas = 0, camisetas = 0, gravacoesLaser = 0;

  (impressoes || []).forEach(ped => {
    (ped.itens || []).forEach(item => {
      const desc = (item.descricao || item.tipo || '').toLowerCase();
      const qtd = item.quantidade || 1;
      if (desc.includes('dtf')) metrosDTF += item.metros || 0;
      if (desc.includes('folha') || desc.includes('sublima')) folhasImpressas += qtd;
      if (desc.includes('caneca')) canecas += qtd;
      if (desc.includes('camiseta') || desc.includes('shirt')) camisetas += qtd;
      if (desc.includes('laser')) gravacoesLaser += qtd;
    });
  });

  (pedidos || []).forEach(ped => {
    (ped.itens || []).forEach(item => {
      const nome = (item.produto_nome || '').toLowerCase();
      const qtd = item.quantidade || 1;
      if (nome.includes('caneca')) canecas += qtd;
      if (nome.includes('camiseta') || nome.includes('shirt')) camisetas += qtd;
    });
  });

  return { metrosDTF, folhasImpressas, canecas, camisetas, gravacoesLaser };
}

// ═══════════════════════════════════════════════════════════
//  EXPORTAÇÃO
// ═══════════════════════════════════════════════════════════

export function exportarCSV(dados, colunas, nomeArquivo = 'export.csv') {
  if (!dados || !dados.length) return;
  const header = colunas.map(c => c.label).join(';');
  const rows = dados.map(d =>
    colunas.map(c => {
      const val = typeof c.key === 'function' ? c.key(d) : d[c.key];
      return `"${String(val ?? '').replace(/"/g, '""')}"`;
    }).join(';')
  );
  const csv = '\uFEFF' + [header, ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nomeArquivo;
  a.click();
  URL.revokeObjectURL(url);
}

export function imprimirRelatorio(titulo, htmlConteudo) {
  const win = window.open('', '_blank', 'width=900,height=700');
  if (!win) return;
  win.document.write(`
    <html><head><title>${titulo}</title>
    <style>
      body { font-family: Arial, sans-serif; margin: 20px; color: #222; }
      h1 { font-size: 18px; margin-bottom: 8px; }
      h2 { font-size: 14px; margin-top: 16px; margin-bottom: 6px; }
      table { width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 8px; }
      th, td { border: 1px solid #ddd; padding: 6px 8px; text-align: left; }
      th { background: #f5f5f5; font-weight: 600; }
      .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #e53e3e; padding-bottom: 8px; margin-bottom: 12px; }
      .footer { margin-top: 20px; font-size: 10px; color: #999; text-align: center; }
      @media print { .no-print { display: none; } }
    </style></head><body>
    <div class="header"><h1>${titulo}</h1><span>${new Date().toLocaleString('pt-BR')}</span></div>
    ${htmlConteudo}
    <div class="footer">Sublima Mais Ultra ERP — Relatório gerado em ${new Date().toLocaleString('pt-BR')}</div>
    </body></html>
  `);
  win.document.close();
  setTimeout(() => win.print(), 500);
}

// ═══════════════════════════════════════════════════════════
//  STATUS COLORS
// ═══════════════════════════════════════════════════════════

export const STATUS_CONTA_COLOR = {
  PENDENTE: 'bg-amber-100 text-amber-700',
  PAGO: 'bg-green-100 text-green-700',
  PAGO_PARCIAL: 'bg-blue-100 text-blue-700',
  VENCIDO: 'bg-red-100 text-red-700',
  CANCELADO: 'bg-gray-100 text-gray-500',
};

export const ALERTA_COLOR = {
  VERDE: 'bg-green-50 border-green-300 text-green-800',
  AMARELO: 'bg-amber-50 border-amber-300 text-amber-800',
  VERMELHO: 'bg-red-50 border-red-300 text-red-800',
};

export const RENTABILIDADE_COLOR = {
  ALTA: 'bg-green-100 text-green-700',
  MEDIA: 'bg-blue-100 text-blue-700',
  BAIXA: 'bg-amber-100 text-amber-700',
  NEGATIVA: 'bg-red-100 text-red-700',
};

// ═══════════════════════════════════════════════════════════
//  AUDITORIA EXPANDIDA
// ═══════════════════════════════════════════════════════════

export function registrarAuditoria({ acao, entidade, entidade_id, detalhes, antes, depois }) {
  const campos = {};
  if (antes && depois) {
    campos.valor_anterior = antes.valor != null ? String(antes.valor) : '';
    campos.valor_novo = depois.valor != null ? String(depois.valor) : '';
    campos.categoria_anterior = antes.categoria || '';
    campos.categoria_nova = depois.categoria || '';
    campos.centro_custo_anterior = antes.centro_custo_nome || '';
    campos.centro_custo_novo = depois.centro_custo_nome || '';
    campos.status_anterior = antes.status || '';
    campos.status_novo = depois.status || '';
  }
  return registrarLogOriginal({ acao, entidade, entidade_id, detalhes, ...campos });
}

// Importação tardia para evitar dependência circular
import { registrarLog as registrarLogOriginal } from '@/lib/audit-log';