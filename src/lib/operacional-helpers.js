// =====================================================================
// Helpers operacionais — pipeline, status, prioridades, métricas
// Toda a lógica é interna ao ERP, sem APIs externas.
// =====================================================================

// --- Pipeline de status do pedido (fluxo operacional completo) ---
export const PIPELINE_STATUS = [
  { value: 'NOVO', label: 'Pedido Recebido', cor: 'bg-slate-100 text-slate-700 border-slate-300', ordem: 0 },
  { value: 'RECEBIDO', label: 'Recebido', cor: 'bg-slate-100 text-slate-700 border-slate-300', ordem: 1 },
  { value: 'AGUARDANDO_PAGAMENTO', label: 'Aguardando Pagamento', cor: 'bg-orange-100 text-orange-700 border-orange-300', ordem: 2 },
  { value: 'PAGO', label: 'Pagamento Confirmado', cor: 'bg-green-100 text-green-700 border-green-300', ordem: 3 },
  { value: 'AGUARDANDO_SEPARACAO', label: 'Aguardando Separação', cor: 'bg-cyan-100 text-cyan-700 border-cyan-300', ordem: 4 },
  { value: 'SEPARACAO', label: 'Em Separação', cor: 'bg-cyan-100 text-cyan-700 border-cyan-300', ordem: 5 },
  { value: 'EM_SEPARACAO', label: 'Separação em Andamento', cor: 'bg-cyan-100 text-cyan-700 border-cyan-300', ordem: 6 },
  { value: 'AGUARDANDO_PRODUCAO', label: 'Aguardando Produção', cor: 'bg-indigo-100 text-indigo-700 border-indigo-300', ordem: 7 },
  { value: 'PRODUCAO', label: 'Em Produção', cor: 'bg-indigo-100 text-indigo-700 border-indigo-300', ordem: 8 },
  { value: 'AGUARDANDO_CONFERENCIA', label: 'Aguardando Conferência', cor: 'bg-purple-100 text-purple-700 border-purple-300', ordem: 9 },
  { value: 'EM_CONFERENCIA', label: 'Em Conferência', cor: 'bg-purple-100 text-purple-700 border-purple-300', ordem: 10 },
  { value: 'EMBALAGEM', label: 'Embalagem', cor: 'bg-amber-100 text-amber-700 border-amber-300', ordem: 11 },
  { value: 'EXPEDICAO', label: 'Expedição', cor: 'bg-blue-100 text-blue-700 border-blue-300', ordem: 12 },
  { value: 'ENVIADO', label: 'Enviado', cor: 'bg-blue-100 text-blue-700 border-blue-300', ordem: 13 },
  { value: 'PRONTO', label: 'Pronto p/ Retirada', cor: 'bg-blue-100 text-blue-700 border-blue-300', ordem: 14 },
  { value: 'ENTREGUE', label: 'Entregue', cor: 'bg-emerald-100 text-emerald-700 border-emerald-300', ordem: 15 },
  { value: 'FINALIZADO', label: 'Finalizado', cor: 'bg-green-100 text-green-700 border-green-300', ordem: 16 },
  { value: 'CANCELADO', label: 'Cancelado', cor: 'bg-red-100 text-red-700 border-red-300', ordem: 99 },
];

export const STATUS_MAP = PIPELINE_STATUS.reduce((acc, s) => { acc[s.value] = s; return acc; }, {});

export function statusInfo(status) {
  return STATUS_MAP[status] || { value: status, label: status, cor: 'bg-gray-100 text-gray-700 border-gray-300', ordem: 0 };
}

export function statusLabel(status) {
  return statusInfo(status).label;
}

export function statusCor(status) {
  return statusInfo(status).cor;
}

// --- Prioridades ---
export const PRIORIDADES = [
  { value: 'BAIXA', label: 'Baixa', cor: 'bg-gray-100 text-gray-600', border: 'border-l-gray-400' },
  { value: 'NORMAL', label: 'Normal', cor: 'bg-blue-100 text-blue-700', border: 'border-l-blue-400' },
  { value: 'ALTA', label: 'Alta', cor: 'bg-orange-100 text-orange-700', border: 'border-l-orange-400' },
  { value: 'URGENTE', label: 'Urgente', cor: 'bg-red-100 text-red-700', border: 'border-l-red-500' },
  { value: 'VIP', label: 'Cliente VIP', cor: 'bg-amber-100 text-amber-800', border: 'border-l-amber-500' },
];

export const PRIORIDADE_MAP = PRIORIDADES.reduce((acc, p) => { acc[p.value] = p; return acc; }, {});

export function prioridadeInfo(p) {
  return PRIORIDADE_MAP[p] || PRIORIDADES[1];
}

// --- Origens ---
// Sincronizado com o menu "Pedidos Loja / WhatsApp" (src/pages/Pedidos.jsx),
// que só reconhece as origens LOJA e WHATSAPP.
export const ORIGENS = [
  { value: 'LOJA', label: 'Loja', cor: 'bg-blue-100 text-blue-700' },
  { value: 'WHATSAPP', label: 'WhatsApp', cor: 'bg-green-100 text-green-700' },
];

export const ORIGEM_MAP = ORIGENS.reduce((acc, o) => { acc[o.value] = o; return acc; }, {});

export function origemInfo(o) {
  return ORIGEM_MAP[o] || ORIGENS[0];
}

// --- Checklist operacional ---
export const CHECKLIST_ITEMS = [
  { key: 'pagamento', label: 'Pagamento' },
  { key: 'arte_aprovada', label: 'Arte Aprovada' },
  { key: 'separacao', label: 'Separação' },
  { key: 'producao', label: 'Produção' },
  { key: 'conferencia', label: 'Conferência' },
  { key: 'embalagem', label: 'Embalagem' },
  { key: 'etiqueta', label: 'Etiqueta' },
  { key: 'expedicao', label: 'Expedição' },
  { key: 'entrega', label: 'Entrega' },
];

export function checklistProgresso(checklist) {
  if (!checklist) return 0;
  const concluidos = CHECKLIST_ITEMS.filter(item => checklist[item.key]).length;
  return Math.round((concluidos / CHECKLIST_ITEMS.length) * 100);
}

// --- Status finais (para baixa de estoque) ---
export const STATUS_FINAIS = ['PAGO', 'PRONTO', 'ENTREGUE', 'FINALIZADO'];

// --- Cálculo de tempo decorrido em minutos ---
export function minutosDecorridos(dataISO) {
  if (!dataISO) return 0;
  return (Date.now() - new Date(dataISO).getTime()) / 60000;
}

export function formatarTempo(minutos) {
  if (minutos < 1) return '< 1 min';
  if (minutos < 60) return `${Math.round(minutos)} min`;
  const h = Math.floor(minutos / 60);
  const m = Math.round(minutos % 60);
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
}

// --- Métricas do dashboard operacional ---
export function calcularMetricasOperacionais(pedidos, impressoes) {
  const hoje = new Date().toISOString().split('T')[0];
  const todos = [
    ...pedidos.map(p => ({ ...p, _tipo: 'PRODUTO' })),
    ...impressoes.map(i => ({ ...i, _tipo: 'IMPRESSAO' })),
  ];

  const aguardando = todos.filter(p => ['NOVO', 'RECEBIDO', 'AGUARDANDO_PAGAMENTO', 'AGUARDANDO_SEPARACAO', 'AGUARDANDO_PRODUCAO', 'AGUARDANDO_CONFERENCIA'].includes(p.status));
  const emProducao = todos.filter(p => ['PRODUCAO', 'EM_IMPRESSAO'].includes(p.status));
  const emSeparacao = todos.filter(p => ['SEPARACAO', 'EM_SEPARACAO'].includes(p.status));
  const prontos = todos.filter(p => ['PRONTO'].includes(p.status));
  const enviados = todos.filter(p => ['ENVIADO', 'EXPEDICAO'].includes(p.status));
  const atrasados = todos.filter(p => {
    const mins = minutosDecorridos(p.created_date);
    return mins > 120 && !['ENTREGUE', 'FINALIZADO', 'CANCELADO'].includes(p.status);
  });

  const hojeCount = todos.filter(p => (p.data || p.created_date?.split('T')[0]) === hoje).length;

  // Origem das vendas — sincronizado com o menu "Pedidos Loja / WhatsApp".
  // Considera apenas os pedidos dessa origem (não as ordens de impressão/produção),
  // usando a mesma regra de classificação usada em Pedidos.jsx: WHATSAPP ou LOJA.
  const porOrigem = {};
  pedidos.forEach(p => {
    const origem = p.origem === 'WHATSAPP' ? 'WHATSAPP' : 'LOJA';
    porOrigem[origem] = (porOrigem[origem] || 0) + 1;
  });

  return {
    total: todos.length,
    aguardando: aguardando.length,
    emProducao: emProducao.length,
    emSeparacao: emSeparacao.length,
    prontos: prontos.length,
    enviados: enviados.length,
    atrasados: atrasados.length,
    hoje: hojeCount,
    porOrigem,
  };
}

// --- Próximo status no pipeline ---
export const PROXIMO_STATUS = {
  NOVO: 'AGUARDANDO_PAGAMENTO',
  RECEBIDO: 'AGUARDANDO_PAGAMENTO',
  AGUARDANDO_PAGAMENTO: 'PAGO',
  PAGO: 'AGUARDANDO_SEPARACAO',
  AGUARDANDO_SEPARACAO: 'SEPARACAO',
  SEPARACAO: 'AGUARDANDO_PRODUCAO',
  EM_SEPARACAO: 'AGUARDANDO_PRODUCAO',
  AGUARDANDO_PRODUCAO: 'PRODUCAO',
  PRODUCAO: 'AGUARDANDO_CONFERENCIA',
  AGUARDANDO_CONFERENCIA: 'EM_CONFERENCIA',
  EM_CONFERENCIA: 'EMBALAGEM',
  EMBALAGEM: 'EXPEDICAO',
  EXPEDICAO: 'ENVIADO',
  ENVIADO: 'ENTREGUE',
  PRONTO: 'ENTREGUE',
  ENTREGUE: 'FINALIZADO',
};