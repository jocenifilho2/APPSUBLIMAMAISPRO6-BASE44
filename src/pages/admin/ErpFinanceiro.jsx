import React, { useState, useMemo, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  DollarSign, Plus, TrendingUp, TrendingDown, AlertTriangle, CheckCircle,
  Medal, Package, ShoppingBag, Printer, FileText, Truck, Building2, BarChart3, Users, Download,
  Wallet, ListTree, Repeat, Target, Bell, UserCheck, Calculator, Calendar, Split, Link2, User, Layers, AlertCircle
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts';
import DREPanel from '@/components/financeiro/DREPanel';
import { GRUPO_DRE_LABEL } from '@/lib/dre-helpers';
import { registrarLog } from '@/lib/audit-log';
import { processarRecorrentes } from '@/lib/financeiro-helpers';
import CentroCustoPanel from '@/components/financeiro/CentroCustoPanel';
import PlanoContasPanel from '@/components/financeiro/PlanoContasPanel';
import CaixaDiarioPanel from '@/components/financeiro/CaixaDiarioPanel';
import ContaRecorrentePanel from '@/components/financeiro/ContaRecorrentePanel';
import FluxoCaixaProjetadoPanel from '@/components/financeiro/FluxoCaixaProjetadoPanel';
import MetasPanel from '@/components/financeiro/MetasPanel';
import DashboardExecutivo from '@/components/financeiro/DashboardExecutivo';
import AlertasPanel from '@/components/financeiro/AlertasPanel';
import RentabilidadePanel from '@/components/financeiro/RentabilidadePanel';
import ComissaoPanel from '@/components/financeiro/ComissaoPanel';
import SimuladorPreco from '@/components/financeiro/SimuladorPreco';
import CalendarioFinanceiro from '@/components/financeiro/CalendarioFinanceiro';
import RateioPanel from '@/components/financeiro/RateioPanel';
import ConciliacaoPanel from '@/components/financeiro/ConciliacaoPanel';
import ContasAvancadasPanel from '@/components/financeiro/ContasAvancadasPanel';
import HistoricoClientePanel from '@/components/financeiro/HistoricoClientePanel';
import HistoricoFornecedorPanel from '@/components/financeiro/HistoricoFornecedorPanel';

const COLORS = ['#e53e3e', '#f6ad55', '#68d391', '#63b3ed', '#b794f4', '#fc8181', '#4fd1c5', '#f687b3'];
const CATEGORIAS_DESP = ['Fornecedor', 'Aluguel', 'Energia', 'Internet', 'Salário', 'Marketing', 'Outros'];
const STATUS_CONTAS = ['PENDENTE', 'PAGO', 'VENCIDO', 'CANCELADO'];
const STATUS_COMPRA = ['PEDIDO', 'CONFIRMADO', 'EM_TRANSITO', 'RECEBIDO', 'CANCELADO'];
const DIAS_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

// ─── Normalização de nomes de produto (mescla variações do mesmo produto) ───
// Para tratar duas ou mais variações de nome como o MESMO produto nos rankings,
// adicione uma entrada aqui: chave = nome canônico exibido, valor = lista de
// todas as variações conhecidas (incluindo o próprio nome canônico).
const PRODUTO_ALIASES = {
  'CANECA DE PORCELANA BRANCA 325 ML': [
    'CANECA DE PORCELANA BRANCA 325 ML AION',
    'CANECA DE PORCELANA BRANCA 325 ML',
  ],
};

function normalizarNomeProduto(str) {
  return (str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function canonicalProdutoNome(nomeOriginal) {
  const norm = normalizarNomeProduto(nomeOriginal);
  for (const [canonico, variantes] of Object.entries(PRODUTO_ALIASES)) {
    if (variantes.some(v => normalizarNomeProduto(v) === norm)) return canonico;
  }
  return nomeOriginal;
}

// Converte 'AAAA-MM-DD' (formato armazenado) para exibição 'DD-MM-AAAA'
function formatarDataBR(dataStr) {
  if (!dataStr) return '—';
  const partes = String(dataStr).slice(0, 10).split('-');
  if (partes.length !== 3) return dataStr;
  const [ano, mes, dia] = partes;
  return `${dia}-${mes}-${ano}`;
}

function moda(arr) {
  if (!arr.length) return '—';
  const freq = {};
  arr.forEach(v => { if (v) freq[v] = (freq[v] || 0) + 1; });
  return Object.entries(freq).sort((a, b) => b[1] - a[1])[0]?.[0] || '—';
}

const statusColor = {
  PENDENTE: 'bg-amber-100 text-amber-700',
  PAGO: 'bg-green-100 text-green-700',
  VENCIDO: 'bg-red-100 text-red-700',
  CANCELADO: 'bg-gray-100 text-gray-600',
};

export default function ErpFinanceiro({ readOnly = false }) {
  const queryClient = useQueryClient();
  const hoje = new Date().toISOString().split('T')[0];
  const mesAtual = new Date().toISOString().slice(0, 7);
  const trinta = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString().split('T')[0];

  // ─── State ───────────────────────────────────────────
  const [despesaOpen, setDespesaOpen] = useState(false);
  const [despForm, setDespForm] = useState({ descricao: '', valor: 0, data_vencimento: hoje, categoria: 'Outros', observacoes: '', grupo_dre: '' });
  const [nfFilter, setNfFilter] = useState('A_EMITIR');
  const [nfSelecionados, setNfSelecionados] = useState([]);
  const [nfPedidoOpen, setNfPedidoOpen] = useState(false);
  const [nfPedidoSelecionado, setNfPedidoSelecionado] = useState(null);
  const [clientePedidoOpen, setClientePedidoOpen] = useState(false);
  const [clientePedidosData, setClientePedidosData] = useState({ nome: '', pedidos: [] });
  const [compraOpen, setCompraOpen] = useState(false);
  const [fornecedorOpen, setFornecedorOpen] = useState(false);
  const [compraForm, setCompraForm] = useState({ fornecedor_nome: '', status: 'PEDIDO', data_pedido: hoje, data_previsao: '', observacoes: '', valor_total: 0 });
  const [fornForm, setFornForm] = useState({ nome: '', cnpj: '', telefone: '', email: '', cidade: '' });

  // ─── Queries ──────────────────────────────────────────
  const { data: contas = [] } = useQuery({ queryKey: ['contas_fin'], queryFn: () => base44.entities.ContaFinanceira.list('-created_date', 500), refetchInterval: 10000 });
  const { data: pedidos = [] } = useQuery({ queryKey: ['pedidos'], queryFn: () => base44.entities.Pedido.list('-created_date', 9999), refetchInterval: 10000 });
  const { data: impressoes = [] } = useQuery({ queryKey: ['pedidos_impressao'], queryFn: () => base44.entities.PedidoImpressao.list('-created_date', 9999), refetchInterval: 10000 });
  const { data: compras = [] } = useQuery({ queryKey: ['compras'], queryFn: () => base44.entities.Compra.list('-created_date', 200) });
  const { data: fornecedores = [] } = useQuery({ queryKey: ['fornecedores'], queryFn: () => base44.entities.Fornecedor.list() });
  const { data: clientes = [] } = useQuery({ queryKey: ['clientes'], queryFn: () => base44.entities.Cliente.list() });
  const { data: notasFiscais = [] } = useQuery({ queryKey: ['nf_pedidos'], queryFn: () => base44.entities.NotaFiscal.list('-created_date', 9999), refetchInterval: 10000 });
  const { data: centrosCusto = [] } = useQuery({ queryKey: ['centros-custo'], queryFn: () => base44.entities.CentroCusto.list(), refetchInterval: 30000 });
  const { data: planoContas = [] } = useQuery({ queryKey: ['plano-contas'], queryFn: () => base44.entities.PlanoContas.list(), refetchInterval: 30000 });
  const { data: recorrentes = [] } = useQuery({ queryKey: ['contas-recorrentes'], queryFn: () => base44.entities.ContaRecorrente.list(), refetchInterval: 30000 });

  // Processa contas recorrentes vencidas ao carregar o módulo
  useEffect(() => {
    if (recorrentes.length > 0) {
      processarRecorrentes(recorrentes).then(qtd => {
        if (qtd > 0) queryClient.invalidateQueries({ queryKey: ['contas_fin'] });
      });
    }
  }, [recorrentes]);

  // Map de Notas Fiscais por pedido_id (persistido)
  const nfMap = useMemo(() => {
    const m = {};
    notasFiscais.forEach(nf => { if (nf.pedido_id) m[nf.pedido_id] = nf; });
    return m;
  }, [notasFiscais]);

  // ─── Mutations ────────────────────────────────────────
  const createDespMut = useMutation({
    mutationFn: (data) => base44.entities.ContaFinanceira.create({ ...data, tipo: 'DESPESA', status: 'PENDENTE' }),
    onSuccess: (_d, variables) => { queryClient.invalidateQueries({ queryKey: ['contas_fin'] }); setDespesaOpen(false); setDespForm({ descricao: '', valor: 0, data_vencimento: hoje, categoria: 'Outros', observacoes: '', grupo_dre: '' }); registrarLog({ acao: 'CRIAR', entidade: 'ContaFinanceira', detalhes: `Despesa: ${variables?.descricao || ''} — R$ ${(variables?.valor || 0).toFixed(2)}` }); },
  });
  const updateContaMut = useMutation({
    mutationFn: ({ id, data }) => base44.entities.ContaFinanceira.update(id, data),
    onSuccess: (_d, variables) => { queryClient.invalidateQueries({ queryKey: ['contas_fin'] }); registrarLog({ acao: 'EDITAR', entidade: 'ContaFinanceira', entidade_id: variables?.id, detalhes: `Conta atualizada — ${variables?.data?.status || ''}` }); },
  });
  const createCompraMut = useMutation({
    mutationFn: (data) => base44.entities.Compra.create(data),
    onSuccess: (_d, variables) => { queryClient.invalidateQueries({ queryKey: ['compras'] }); setCompraOpen(false); registrarLog({ acao: 'CRIAR', entidade: 'Compra', detalhes: `Compra: ${variables?.fornecedor_nome || ''} — R$ ${(variables?.valor_total || 0).toFixed(2)}` }); },
  });
  const updateCompraMut = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Compra.update(id, data),
    onSuccess: (_d, variables) => { queryClient.invalidateQueries({ queryKey: ['compras'] }); registrarLog({ acao: 'EDITAR', entidade: 'Compra', entidade_id: variables?.id, detalhes: `Compra atualizada — ${variables?.data?.status || ''}` }); },
  });
  const createFornMut = useMutation({
    mutationFn: (data) => base44.entities.Fornecedor.create(data),
    onSuccess: (_d, variables) => { queryClient.invalidateQueries({ queryKey: ['fornecedores'] }); setFornecedorOpen(false); setFornForm({ nome: '', cnpj: '', telefone: '', email: '', cidade: '' }); registrarLog({ acao: 'CRIAR', entidade: 'Fornecedor', detalhes: `Fornecedor: ${variables?.nome || ''}` }); },
  });
  const marcarNfEmitidaMut = useMutation({
    mutationFn: async (pedido) => {
      const existing = nfMap[pedido.id];
      if (existing) {
        await base44.entities.NotaFiscal.update(existing.id, { status_nfe: 'EMITIDA' });
      } else {
        await base44.entities.NotaFiscal.create({
          pedido_id: pedido.id,
          numero_pedido: pedido.numero || pedido.numero_pedido || '',
          cliente: pedido.cliente || '',
          valor_total: pedido.total || 0,
          status_nfe: 'EMITIDA',
          ambiente: 'PRODUCAO',
        });
      }
    },
    onSuccess: (_d, variables) => { queryClient.invalidateQueries({ queryKey: ['nf_pedidos'] }); registrarLog({ acao: 'EMITIR', entidade: 'NotaFiscal', entidade_id: variables?.id, detalhes: `NF emitida — ${variables?.numero || variables?.numero_pedido || ''} — ${variables?.cliente || ''}` }); },
  });
  const excluirNfMut = useMutation({
    mutationFn: async (pedido) => {
      const existing = nfMap[pedido.id];
      if (existing) {
        await base44.entities.NotaFiscal.update(existing.id, { status_nfe: 'CANCELADA' });
      } else {
        await base44.entities.NotaFiscal.create({
          pedido_id: pedido.id,
          numero_pedido: pedido.numero || pedido.numero_pedido || '',
          cliente: pedido.cliente || '',
          valor_total: pedido.total || 0,
          status_nfe: 'CANCELADA',
          ambiente: 'PRODUCAO',
        });
      }
    },
    onSuccess: (_d, variables) => { queryClient.invalidateQueries({ queryKey: ['nf_pedidos'] }); registrarLog({ acao: 'CANCELAR', entidade: 'NotaFiscal', entidade_id: variables?.id, detalhes: `NF cancelada — ${variables?.numero || variables?.numero_pedido || ''} — ${variables?.cliente || ''}` }); },
  });

  // ─── COMPUTED ─────────────────────────────────────────
  const todosOsPedidos = useMemo(() => {
    const p = pedidos.map(x => ({ ...x, _tipo: 'PRODUTO', numero: x.numero_pedido }));
    const i = impressoes.map(x => ({ ...x, _tipo: 'IMPRESSAO' }));
    return [...p, ...i];
  }, [pedidos, impressoes]);

  // Pedidos ativos = todos exceto CANCELADO; ENTREGUE é tratado como PAGO para receita
  const STATUS_RECEITA = ['PAGO', 'ENTREGUE', 'PRONTO'];
  const pedidosAtivos = useMemo(() => todosOsPedidos.filter(p => p.status !== 'CANCELADO'), [todosOsPedidos]);
  const receitaTotal = useMemo(() => pedidosAtivos.filter(p => STATUS_RECEITA.includes(p.status)).reduce((s, p) => s + (p.total || 0), 0), [pedidosAtivos]);
  const despesasTotal = useMemo(() => contas.filter(c => c.tipo === 'DESPESA' && c.status === 'PAGO').reduce((s, c) => s + (c.valor || 0), 0), [contas]);
  const lucroTotal = receitaTotal - despesasTotal;
  const totalPedidos = pedidosAtivos.length;
  const ticketMedio = totalPedidos > 0 ? (receitaTotal / totalPedidos) : 0;
  const totalLoja = pedidos.filter(p => p.origem === 'LOJA' && p.status !== 'CANCELADO').length;
  const totalWhatsapp = pedidos.filter(p => p.origem === 'WHATSAPP' && p.status !== 'CANCELADO').length;

  // Receita/Lucro mensal (últimos 6 meses)
  const receitaMensal = useMemo(() => {
    const map = {};
    pedidosAtivos.forEach(p => {
      const m = p.data?.slice(0, 7);
      if (!m) return;
      if (!map[m]) map[m] = { mes: m, receita: 0 };
      if (STATUS_RECEITA.includes(p.status)) map[m].receita += p.total || 0;
    });
    const despMap = {};
    contas.filter(c => c.tipo === 'DESPESA' && c.status === 'PAGO').forEach(c => {
      const m = c.data_vencimento?.slice(0, 7);
      if (!m) return;
      if (!despMap[m]) despMap[m] = 0;
      despMap[m] += c.valor || 0;
    });
    return Object.values(map).sort((a, b) => a.mes.localeCompare(b.mes)).slice(-6).map(m => ({
      label: new Date(m.mes + '-01').toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }),
      receita: parseFloat(m.receita.toFixed(2)),
      lucro: parseFloat(Math.max(0, m.receita - (despMap[m.mes] || 0)).toFixed(2)),
    }));
  }, [todosOsPedidos, contas]);

  // % pagamento
  const pagamentoDist = useMemo(() => {
    const map = {};
    pedidos.forEach(p => { const k = p.forma_pagamento || 'Outro'; map[k] = (map[k] || 0) + 1; });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [pedidos]);

  // pedidos por dia da semana — produtos + impressões, exceto CANCELADO (sincronizado com os cards de totais)
  const pedidosDiaSemana = useMemo(() => {
    const arr = [0, 0, 0, 0, 0, 0, 0];
    pedidosAtivos.forEach(p => {
      if (!p.data) return;
      const d = new Date(p.data + 'T12:00:00').getDay();
      arr[d]++;
    });
    return arr.map((count, i) => ({ dia: DIAS_SEMANA[i], count }));
  }, [pedidosAtivos]);

  // logística %
  const logisticaDist = useMemo(() => {
    const map = {};
    [...pedidos, ...impressoes].forEach(p => {
      const k = p.forma_retirada || 'RETIRADA EM LOJA';
      map[k] = (map[k] || 0) + 1;
    });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [pedidos, impressoes]);

  // pedidos por atendente
  const pedidosAtendente = useMemo(() => {
    const map = {};
    pedidos.forEach(p => { const k = p.vendedor || 'Desconhecido'; map[k] = (map[k] || 0) + 1; });
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [pedidos]);

  // Helper genérico para construir ranking de clientes a partir de uma lista de pedidos
  function construirRankingClientes(lista) {
    const map = {};
    lista.forEach(p => {
      const key = p.cliente?.toUpperCase() || '?';
      if (!map[key]) map[key] = { nome: key, telefone: p.telefone || '—', pedidos: 0, receita: 0, pagamentos: [], retiradas: [] };
      map[key].pedidos++;
      map[key].receita += p.total || 0;
      map[key].pagamentos.push(p.forma_pagamento);
      map[key].retiradas.push(p.forma_retirada);
    });
    return Object.values(map)
      .map(c => ({ ...c, principal_pagamento: moda(c.pagamentos), principal_retirada: moda(c.retiradas) }))
      .sort((a, b) => b.receita - a.receita)
      .slice(0, 10);
  }

  // Ranking clientes (30 dias) — apenas pedidos de PRODUTO, exceto CANCELADO
  const rankingClientes30Produtos = useMemo(() => {
    return construirRankingClientes(pedidos.filter(p => p.data >= trinta && p.status !== 'CANCELADO'));
  }, [pedidos, trinta]);

  // Ranking clientes (30 dias) — apenas pedidos de IMPRESSÃO, exceto CANCELADO
  const rankingClientes30Impressoes = useMemo(() => {
    return construirRankingClientes(impressoes.filter(p => p.data >= trinta && p.status !== 'CANCELADO'));
  }, [impressoes, trinta]);

  // Ranking produtos — apenas pedidos de produto (exclui impressões), exceto CANCELADO
  const rankingProdutos = useMemo(() => {
    const map = {};
    pedidos.filter(p => p.status !== 'CANCELADO').forEach(p => p.itens?.forEach(it => {
      const nomeOriginal = it.produto_nome;
      if (!nomeOriginal) return;
      const nome = canonicalProdutoNome(nomeOriginal);
      if (!map[nome]) map[nome] = { nome, quantidade: 0, receita: 0 };
      map[nome].quantidade += it.quantidade || 0;
      map[nome].receita += (it.quantidade || 0) * (it.preco_unitario_pix || 0);
    }));
    const sortedDesc = Object.values(map).sort((a, b) => b.quantidade - a.quantidade);
    const sortedAsc = Object.values(map).sort((a, b) => a.quantidade - b.quantidade || a.nome.localeCompare(b.nome));
    return { top10: sortedDesc.slice(0, 10), bottom10: sortedAsc.slice(0, 10) };
  }, [pedidos]);

  // Melhor dia da semana
  const melhorDia = useMemo(() => {
    const max = pedidosDiaSemana.reduce((a, b) => b.count > a.count ? b : a, { dia: '—', count: 0 });
    return max;
  }, [pedidosDiaSemana]);

  // Melhor horário — apenas pedidos de PRODUTO (único tipo com campo "horario"), exceto CANCELADO
  const melhorHorario = useMemo(() => {
    const map = {};
    pedidos.filter(p => p.status !== 'CANCELADO').forEach(p => {
      const h = p.horario?.split(':')[0];
      if (!h) return;
      map[h] = (map[h] || 0) + 1;
    });
    const sorted = Object.entries(map).sort((a, b) => b[1] - a[1]);
    return sorted[0] ? { horario: `${sorted[0][0]}h`, total: sorted[0][1] } : { horario: '—', total: 0 };
  }, [pedidos]);

  // Fluxo de caixa
  const fluxo = useMemo(() => {
    const entradas = contas.filter(c => c.tipo === 'RECEITA' && c.status === 'PAGO').reduce((s, c) => s + (c.valor || 0), 0);
    const saidas = contas.filter(c => c.tipo === 'DESPESA' && c.status === 'PAGO').reduce((s, c) => s + (c.valor || 0), 0);
    const despPendentes = contas.filter(c => c.tipo === 'DESPESA' && c.status === 'PENDENTE').reduce((s, c) => s + (c.valor || 0), 0);
    return { entradas, saidas, saldo: entradas - saidas, despPendentes };
  }, [contas]);

  // Notas Fiscais persistidas (EMITIDA / CANCELADA)
  const nfEmitidas = useMemo(() => new Set(notasFiscais.filter(nf => nf.status_nfe === 'EMITIDA' && nf.pedido_id).map(nf => nf.pedido_id)), [notasFiscais]);
  const nfExcluidos = useMemo(() => new Set(notasFiscais.filter(nf => nf.status_nfe === 'CANCELADA' && nf.pedido_id).map(nf => nf.pedido_id)), [notasFiscais]);

  // NF-e (pedidos > 500) — ordenado por data do pedido, da mais antiga para a mais recente
  const pedidosNF = useMemo(() => {
    return todosOsPedidos
      .filter(p => (p.total || 0) >= 500 && !nfExcluidos.has(p.id))
      .sort((a, b) => (a.data || '').localeCompare(b.data || ''));
  }, [todosOsPedidos, nfExcluidos]);

  const clienteMap = useMemo(() => {
    const m = {};
    clientes.forEach(c => { m[c.nome?.toUpperCase()] = c; });
    return m;
  }, [clientes]);

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-bold flex items-center gap-2"><DollarSign className="w-5 h-5 text-primary" />Financeiro</h2>
        <p className="text-sm text-muted-foreground">Visão completa do negócio — sincronizado em tempo real</p>
      </div>

      {/* Cards principais */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <Card className="p-4 col-span-1">
          <p className="text-xs text-muted-foreground">Receita Total</p>
          <p className="text-lg font-bold text-green-700">R$ {receitaTotal.toFixed(2)}</p>
        </Card>
        <Card className="p-4 col-span-1">
          <p className="text-xs text-muted-foreground">Lucro Total</p>
          <p className={`text-lg font-bold ${lucroTotal >= 0 ? 'text-blue-700' : 'text-red-600'}`}>R$ {lucroTotal.toFixed(2)}</p>
        </Card>
        <Card className="p-4 col-span-1">
          <p className="text-xs text-muted-foreground">Total Pedidos</p>
          <p className="text-lg font-bold">{totalPedidos}</p>
        </Card>
        <Card className="p-4 col-span-1">
          <p className="text-xs text-muted-foreground">Ticket Médio</p>
          <p className="text-lg font-bold text-purple-700">R$ {ticketMedio.toFixed(2)}</p>
        </Card>
        <Card className="p-4 col-span-1">
          <p className="text-xs text-muted-foreground">🏪 Pedidos Loja</p>
          <p className="text-lg font-bold text-blue-700">{totalLoja}</p>
        </Card>
        <Card className="p-4 col-span-1">
          <p className="text-xs text-muted-foreground">💬 Pedidos WA</p>
          <p className="text-lg font-bold text-emerald-700">{totalWhatsapp}</p>
        </Card>
      </div>

      <Tabs defaultValue="analytics">
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="analytics"><BarChart3 className="w-3.5 h-3.5 mr-1" />Analytics</TabsTrigger>
          <TabsTrigger value="dre"><BarChart3 className="w-3.5 h-3.5 mr-1" />DRE</TabsTrigger>
          <TabsTrigger value="fluxo"><TrendingUp className="w-3.5 h-3.5 mr-1" />Fluxo de Caixa</TabsTrigger>
          <TabsTrigger value="pedidos_fin"><ShoppingBag className="w-3.5 h-3.5 mr-1" />Pedidos</TabsTrigger>
          <TabsTrigger value="nf"><FileText className="w-3.5 h-3.5 mr-1" />Notas Fiscais</TabsTrigger>
          <TabsTrigger value="compras"><Truck className="w-3.5 h-3.5 mr-1" />Compras</TabsTrigger>
          <TabsTrigger value="exec"><BarChart3 className="w-3.5 h-3.5 mr-1" />Executivo</TabsTrigger>
          <TabsTrigger value="contas"><DollarSign className="w-3.5 h-3.5 mr-1" />Contas</TabsTrigger>
          <TabsTrigger value="caixa"><Wallet className="w-3.5 h-3.5 mr-1" />Caixa</TabsTrigger>
          <TabsTrigger value="centros"><Building2 className="w-3.5 h-3.5 mr-1" />Centros</TabsTrigger>
          <TabsTrigger value="plano"><ListTree className="w-3.5 h-3.5 mr-1" />Plano</TabsTrigger>
          <TabsTrigger value="recorrentes"><Repeat className="w-3.5 h-3.5 mr-1" />Recorrentes</TabsTrigger>
          <TabsTrigger value="projecao"><TrendingUp className="w-3.5 h-3.5 mr-1" />Projeção</TabsTrigger>
          <TabsTrigger value="metas"><Target className="w-3.5 h-3.5 mr-1" />Metas</TabsTrigger>
          <TabsTrigger value="alertas"><Bell className="w-3.5 h-3.5 mr-1" />Alertas</TabsTrigger>
          <TabsTrigger value="rentab"><TrendingUp className="w-3.5 h-3.5 mr-1" />Rentab.</TabsTrigger>
          <TabsTrigger value="comissoes"><UserCheck className="w-3.5 h-3.5 mr-1" />Comissões</TabsTrigger>
          <TabsTrigger value="simulador"><Calculator className="w-3.5 h-3.5 mr-1" />Simulador</TabsTrigger>
          <TabsTrigger value="calendario"><Calendar className="w-3.5 h-3.5 mr-1" />Calendário</TabsTrigger>
          <TabsTrigger value="rateio"><Split className="w-3.5 h-3.5 mr-1" />Rateio</TabsTrigger>
          <TabsTrigger value="conciliacao"><Link2 className="w-3.5 h-3.5 mr-1" />Conciliação</TabsTrigger>
          <TabsTrigger value="hist_cliente"><User className="w-3.5 h-3.5 mr-1" />Clientes</TabsTrigger>
          <TabsTrigger value="hist_forn"><Truck className="w-3.5 h-3.5 mr-1" />Fornecedores</TabsTrigger>
        </TabsList>

        {/* ─── ANALYTICS ─────────────────────────────────── */}
        <TabsContent value="analytics" className="mt-4 space-y-6">
          {/* Gráficos */}
          <div className="grid lg:grid-cols-2 gap-4">
            <Card className="p-4">
              <h3 className="font-semibold text-sm mb-3">Receita e Lucro Mensal</h3>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={receitaMensal}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip formatter={v => `R$ ${Number(v).toFixed(2)}`} />
                  <Legend />
                  <Bar dataKey="receita" fill="#68d391" name="Receita" radius={[4,4,0,0]} />
                  <Bar dataKey="lucro" fill="#63b3ed" name="Lucro" radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </Card>
            <Card className="p-4">
              <h3 className="font-semibold text-sm mb-3">Formas de Pagamento</h3>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={pagamentoDist} cx="50%" cy="50%" outerRadius={70} dataKey="value" label={({ name, percent }) => `${name} ${(percent*100).toFixed(0)}%`} labelLine={false}>
                    {pagamentoDist.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </Card>
            <Card className="p-4">
              <h3 className="font-semibold text-sm mb-3">Pedidos por Dia da Semana</h3>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={pedidosDiaSemana}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="dia" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Bar dataKey="count" fill="hsl(var(--primary))" name="Pedidos" radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </Card>
            <Card className="p-4">
              <h3 className="font-semibold text-sm mb-3">Logística (Retirada vs Entrega)</h3>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={logisticaDist} cx="50%" cy="50%" outerRadius={70} dataKey="value" label={({ name, percent }) => `${(percent*100).toFixed(0)}%`}>
                    {logisticaDist.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </Card>
            <Card className="p-4 lg:col-span-2">
              <h3 className="font-semibold text-sm mb-3">Pedidos por Atendente</h3>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={pedidosAtendente} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" tick={{ fontSize: 10 }} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={80} />
                  <Tooltip />
                  <Bar dataKey="value" fill="#b794f4" name="Pedidos" radius={[0,4,4,0]} />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </div>

          {/* Rankings informativos */}
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-3">
            <Card className="p-4 text-center border-2 border-yellow-200">
              <p className="text-xs text-muted-foreground mb-1">📅 Melhor Dia da Semana</p>
              <p className="text-2xl font-black text-yellow-600">{melhorDia.dia}</p>
              <p className="text-xs text-muted-foreground">{melhorDia.count} pedidos</p>
            </Card>
            <Card className="p-4 text-center border-2 border-blue-200">
              <p className="text-xs text-muted-foreground mb-1">🕐 Melhor Horário</p>
              <p className="text-2xl font-black text-blue-600">{melhorHorario.horario}</p>
              <p className="text-xs text-muted-foreground">{melhorHorario.total} pedidos</p>
            </Card>
            <Card className="p-4 text-center border-2 border-green-200">
              <p className="text-xs text-muted-foreground mb-1">💰 Receita Total</p>
              <p className="text-xl font-black text-green-600">R$ {receitaTotal.toFixed(0)}</p>
            </Card>
            <Card className="p-4 text-center border-2 border-purple-200">
              <p className="text-xs text-muted-foreground mb-1">🎯 Ticket Médio</p>
              <p className="text-xl font-black text-purple-600">R$ {ticketMedio.toFixed(2)}</p>
            </Card>
          </div>

          {/* Ranking clientes 30 dias — separado em Produtos e Impressões */}
          <div className="grid lg:grid-cols-2 gap-4">
            <Card className="p-4">
              <h3 className="font-semibold text-sm mb-1 flex items-center gap-2"><Medal className="w-4 h-4 text-primary" />Ranking de Clientes — Produtos (Top 10, últimos 30 dias)</h3>
              <div className="rounded-xl border overflow-x-auto mt-3">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead>#</TableHead><TableHead>Nome</TableHead><TableHead>Contato</TableHead>
                      <TableHead>Pedidos</TableHead><TableHead>Pagamento</TableHead><TableHead>Logística</TableHead><TableHead>Receita</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rankingClientes30Produtos.map((c, i) => (
                      <TableRow key={c.nome}>
                        <TableCell><Badge className={`text-xs ${i===0?'bg-yellow-100 text-yellow-700':i===1?'bg-gray-100 text-gray-600':i===2?'bg-amber-100 text-amber-700':'bg-muted text-muted-foreground'}`}>{i+1}</Badge></TableCell>
                        <TableCell className="font-semibold text-sm">
                          <button className="hover:underline hover:text-primary transition-colors text-left" onClick={() => {
                            const pedidosDoCliente = pedidos.filter(p => p.cliente?.toUpperCase() === c.nome && p.data >= trinta && p.status !== 'CANCELADO').map(p => ({ ...p, _tipo: 'PRODUTO' }));
                            setClientePedidosData({ nome: c.nome, pedidos: pedidosDoCliente });
                            setClientePedidoOpen(true);
                          }}>{c.nome}</button>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{c.telefone}</TableCell>
                        <TableCell className="font-bold text-center">{c.pedidos}</TableCell>
                        <TableCell className="text-xs">{c.principal_pagamento}</TableCell>
                        <TableCell className="text-xs">{c.principal_retirada}</TableCell>
                        <TableCell className="font-bold text-green-700">R$ {c.receita.toFixed(2)}</TableCell>
                      </TableRow>
                    ))}
                    {rankingClientes30Produtos.length === 0 && <TableRow><TableCell colSpan={7} className="text-center py-6 text-muted-foreground">Sem dados</TableCell></TableRow>}
                  </TableBody>
                </Table>
              </div>
            </Card>
            <Card className="p-4">
              <h3 className="font-semibold text-sm mb-1 flex items-center gap-2"><Medal className="w-4 h-4 text-primary" />Ranking de Clientes — Impressões (Top 10, últimos 30 dias)</h3>
              <div className="rounded-xl border overflow-x-auto mt-3">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead>#</TableHead><TableHead>Nome</TableHead><TableHead>Contato</TableHead>
                      <TableHead>Pedidos</TableHead><TableHead>Pagamento</TableHead><TableHead>Logística</TableHead><TableHead>Receita</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rankingClientes30Impressoes.map((c, i) => (
                      <TableRow key={c.nome}>
                        <TableCell><Badge className={`text-xs ${i===0?'bg-yellow-100 text-yellow-700':i===1?'bg-gray-100 text-gray-600':i===2?'bg-amber-100 text-amber-700':'bg-muted text-muted-foreground'}`}>{i+1}</Badge></TableCell>
                        <TableCell className="font-semibold text-sm">
                          <button className="hover:underline hover:text-primary transition-colors text-left" onClick={() => {
                            const pedidosDoCliente = impressoes.filter(p => p.cliente?.toUpperCase() === c.nome && p.data >= trinta && p.status !== 'CANCELADO').map(p => ({ ...p, _tipo: 'IMPRESSAO' }));
                            setClientePedidosData({ nome: c.nome, pedidos: pedidosDoCliente });
                            setClientePedidoOpen(true);
                          }}>{c.nome}</button>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{c.telefone}</TableCell>
                        <TableCell className="font-bold text-center">{c.pedidos}</TableCell>
                        <TableCell className="text-xs">{c.principal_pagamento}</TableCell>
                        <TableCell className="text-xs">{c.principal_retirada}</TableCell>
                        <TableCell className="font-bold text-green-700">R$ {c.receita.toFixed(2)}</TableCell>
                      </TableRow>
                    ))}
                    {rankingClientes30Impressoes.length === 0 && <TableRow><TableCell colSpan={7} className="text-center py-6 text-muted-foreground">Sem dados</TableCell></TableRow>}
                  </TableBody>
                </Table>
              </div>
            </Card>
          </div>

          {/* Ranking produtos */}
          <div className="grid lg:grid-cols-2 gap-4">
            <Card className="p-4">
              <h3 className="font-semibold text-sm mb-3 flex items-center gap-2"><TrendingUp className="w-4 h-4 text-green-600" />Top 10 Mais Vendidos</h3>
              <div className="rounded-xl border overflow-x-auto">
                <Table>
                  <TableHeader><TableRow className="bg-muted/50"><TableHead>#</TableHead><TableHead>Produto</TableHead><TableHead>Qtd</TableHead><TableHead>Receita</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {rankingProdutos.top10.map((p, i) => (
                      <TableRow key={p.nome}><TableCell className="text-xs font-bold">{i+1}</TableCell><TableCell className="text-xs">{p.nome}</TableCell><TableCell className="font-bold">{p.quantidade}</TableCell><TableCell className="text-green-700 font-bold text-xs">R$ {p.receita.toFixed(2)}</TableCell></TableRow>
                    ))}
                    {rankingProdutos.top10.length === 0 && <TableRow><TableCell colSpan={4} className="text-center py-4 text-muted-foreground text-xs">Sem dados</TableCell></TableRow>}
                  </TableBody>
                </Table>
              </div>
            </Card>
            <Card className="p-4">
              <h3 className="font-semibold text-sm mb-3 flex items-center gap-2"><TrendingDown className="w-4 h-4 text-red-500" />Top 10 Menos Vendidos</h3>
              <div className="rounded-xl border overflow-x-auto">
                <Table>
                  <TableHeader><TableRow className="bg-muted/50"><TableHead>#</TableHead><TableHead>Produto</TableHead><TableHead>Qtd</TableHead><TableHead>Receita</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {rankingProdutos.bottom10.map((p, i) => (
                      <TableRow key={p.nome}><TableCell className="text-xs font-bold">{i+1}</TableCell><TableCell className="text-xs">{p.nome}</TableCell><TableCell className="font-bold">{p.quantidade}</TableCell><TableCell className="text-red-600 font-bold text-xs">R$ {p.receita.toFixed(2)}</TableCell></TableRow>
                    ))}
                    {rankingProdutos.bottom10.length === 0 && <TableRow><TableCell colSpan={4} className="text-center py-4 text-muted-foreground text-xs">Sem dados</TableCell></TableRow>}
                  </TableBody>
                </Table>
              </div>
            </Card>
          </div>
        </TabsContent>

        {/* ─── FLUXO DE CAIXA ────────────────────────────── */}
        <TabsContent value="dre" className="mt-4">
          <DREPanel />
        </TabsContent>

        <TabsContent value="fluxo" className="mt-4 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Fluxo de Caixa</h3>
            {!readOnly && <Button size="sm" onClick={() => setDespesaOpen(true)}><Plus className="w-4 h-4 mr-1" />Nova Despesa</Button>}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card className="p-4"><p className="text-xs text-muted-foreground">Entradas</p><p className="text-xl font-bold text-green-600">R$ {fluxo.entradas.toFixed(2)}</p></Card>
            <Card className="p-4"><p className="text-xs text-muted-foreground">Saídas</p><p className="text-xl font-bold text-red-600">R$ {fluxo.saidas.toFixed(2)}</p></Card>
            <Card className="p-4"><p className="text-xs text-muted-foreground">Saldo</p><p className={`text-xl font-bold ${fluxo.saldo >= 0 ? 'text-blue-700' : 'text-red-600'}`}>R$ {fluxo.saldo.toFixed(2)}</p></Card>
            <Card className="p-4"><p className="text-xs text-muted-foreground">Despesas Pendentes</p><p className="text-xl font-bold text-amber-600">R$ {fluxo.despPendentes.toFixed(2)}</p></Card>
          </div>
          <div className="rounded-xl border bg-card overflow-x-auto">
            <Table>
              <TableHeader><TableRow className="bg-muted/50">
                <TableHead>Descrição</TableHead><TableHead>Categoria</TableHead><TableHead>Vencimento</TableHead>
                <TableHead>Valor</TableHead><TableHead>Status</TableHead><TableHead>Ação</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {contas.filter(c => c.tipo === 'DESPESA').map(c => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium text-sm">{c.descricao}</TableCell>
                    <TableCell className="text-xs">{c.categoria || '—'}</TableCell>
                    <TableCell className={`text-sm ${c.status === 'PENDENTE' && c.data_vencimento < hoje ? 'text-red-600 font-bold' : ''}`}>{c.data_vencimento || '—'}</TableCell>
                    <TableCell className="font-bold text-red-600">R$ {(c.valor || 0).toFixed(2)}</TableCell>
                    <TableCell><Badge className={`text-xs ${statusColor[c.status] || ''}`}>{c.status}</Badge></TableCell>
                    <TableCell>{c.status === 'PENDENTE' && !readOnly && <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => updateContaMut.mutate({ id: c.id, data: { status: 'PAGO' } })}><CheckCircle className="w-3 h-3 mr-1" />Pagar</Button>}</TableCell>
                  </TableRow>
                ))}
                {contas.filter(c => c.tipo === 'DESPESA').length === 0 && <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Nenhuma despesa</TableCell></TableRow>}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* ─── PEDIDOS (financeiro) ───────────────────────── */}
        <TabsContent value="pedidos_fin" className="mt-4">
          <div className="rounded-xl border bg-card overflow-x-auto">
            <Table>
              <TableHeader><TableRow className="bg-muted/50">
                <TableHead>Nº</TableHead><TableHead>Cliente</TableHead><TableHead>Tipo</TableHead>
                <TableHead>Pagamento</TableHead><TableHead>Receita</TableHead><TableHead>Status</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {todosOsPedidos.map(p => (
                  <TableRow key={p.id}>
                    <TableCell className="font-mono text-xs font-bold">{p.numero || p.numero_pedido || '—'}</TableCell>
                    <TableCell className="font-medium text-sm">{p.cliente}</TableCell>
                    <TableCell><Badge className={`text-xs ${p._tipo === 'PRODUTO' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>{p._tipo === 'PRODUTO' ? '🛒 Produto' : '🖨️ Impressão'}</Badge></TableCell>
                    <TableCell className="text-xs">{p.forma_pagamento || '—'}</TableCell>
                    <TableCell className="font-bold text-green-700">R$ {(p.total || 0).toFixed(2)}</TableCell>
                    <TableCell><span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                      p.status === 'PAGO' || p.status === 'ENTREGUE' ? 'bg-green-100 text-green-700' :
                      p.status === 'AGUARDANDO_PAGAMENTO' ? 'bg-orange-100 text-orange-700' :
                      p.status === 'CANCELADO' ? 'bg-red-100 text-red-700' :
                      'bg-amber-100 text-amber-700'
                    }`}>{p.status}</span></TableCell>
                  </TableRow>
                ))}
                {todosOsPedidos.length === 0 && <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Nenhum pedido</TableCell></TableRow>}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* ─── NOTAS FISCAIS ───────────────────────────────── */}
        <TabsContent value="nf" className="mt-4 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <h3 className="font-semibold">Notas Fiscais — Pedidos acima de R$ 500,00</h3>
              <p className="text-xs text-muted-foreground">Clientes com dados cadastrais disponíveis para emissão</p>
            </div>
            <div className="flex gap-2 flex-wrap items-center">
              <button onClick={() => setNfFilter('A_EMITIR')} className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${nfFilter === 'A_EMITIR' ? 'bg-primary text-white' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}>A Emitir</button>
              <button onClick={() => setNfFilter('EMITIDA')} className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${nfFilter === 'EMITIDA' ? 'bg-green-600 text-white' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}>Emitida</button>
              <Button variant="outline" size="sm" onClick={() => {
                const visiveis = pedidosNF.filter(p => nfFilter === 'EMITIDA' ? nfEmitidas.has(p.id) : !nfEmitidas.has(p.id));
                const header = ['Nº Pedido', 'Cliente', 'Valor', 'Data', 'CPF/CNPJ', 'Endereço', 'Status'];
                const rows = visiveis.map(p => {
                  const cli = clienteMap[p.cliente?.toUpperCase()];
                  const endereco = cli?.endereco ? `${cli.endereco}, ${cli.cidade || ''} - ${cli.uf || ''}` : '';
                  return [
                    p.numero || p.numero_pedido || '',
                    p.cliente || '',
                    (p.total || 0).toFixed(2),
                    formatarDataBR(p.data),
                    cli?.cpf || '',
                    endereco,
                    nfEmitidas.has(p.id) ? 'Emitida' : 'A Emitir',
                  ];
                });
                const csv = [header, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
                const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url; a.download = `notas_fiscais_${nfFilter.toLowerCase()}.csv`; a.click();
                URL.revokeObjectURL(url);
              }}>
                <Download className="w-3.5 h-3.5 mr-1" />Exportar Excel
              </Button>
            </div>
          </div>

          {/* Barra de ações em lote */}
          {nfSelecionados.length > 0 && !readOnly && (
            <div className="flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-xl px-4 py-2.5">
              <span className="text-sm font-semibold text-blue-700">{nfSelecionados.length} selecionado(s)</span>
              <Button size="sm" variant="outline" className="h-7 text-xs border-green-400 text-green-700 hover:bg-green-50"
                onClick={() => {
                  nfSelecionados.forEach(id => { const p = pedidosNF.find(x => x.id === id); if (p) marcarNfEmitidaMut.mutate(p); });
                  setNfSelecionados([]);
                }}>
                <CheckCircle className="w-3 h-3 mr-1" />Marcar como Emitida
              </Button>
              <Button size="sm" variant="outline" className="h-7 text-xs border-red-400 text-red-700 hover:bg-red-50"
                onClick={() => {
                  nfSelecionados.forEach(id => { const p = pedidosNF.find(x => x.id === id); if (p) excluirNfMut.mutate(p); });
                  setNfSelecionados([]);
                }}>
                <AlertTriangle className="w-3 h-3 mr-1" />Excluir
              </Button>
              <button className="ml-auto text-xs text-muted-foreground hover:text-foreground" onClick={() => setNfSelecionados([])}>Limpar seleção</button>
            </div>
          )}

          <div className="rounded-xl border bg-card overflow-x-auto">
            <Table>
              <TableHeader><TableRow className="bg-muted/50">
                <TableHead className="w-8">
                  {!readOnly && <input type="checkbox" className="rounded"
                    checked={pedidosNF.filter(p => nfFilter === 'EMITIDA' ? nfEmitidas.has(p.id) : !nfEmitidas.has(p.id)).length > 0 &&
                      pedidosNF.filter(p => nfFilter === 'EMITIDA' ? nfEmitidas.has(p.id) : !nfEmitidas.has(p.id)).every(p => nfSelecionados.includes(p.id))}
                    onChange={e => {
                      const visiveis = pedidosNF.filter(p => nfFilter === 'EMITIDA' ? nfEmitidas.has(p.id) : !nfEmitidas.has(p.id)).map(p => p.id);
                      setNfSelecionados(e.target.checked ? visiveis : []);
                    }}
                  />}
                </TableHead>
                <TableHead>Nº Pedido</TableHead><TableHead>Cliente</TableHead><TableHead>Valor</TableHead>
                <TableHead>Data</TableHead><TableHead>CPF/CNPJ</TableHead><TableHead>Endereço</TableHead><TableHead>Status</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {pedidosNF.map(p => {
                  const dadosCliente = clienteMap[p.cliente?.toUpperCase()];
                  const emitida = nfEmitidas.has(p.id);
                  if (nfFilter === 'EMITIDA' && !emitida) return null;
                  if (nfFilter === 'A_EMITIR' && emitida) return null;
                  const selecionado = nfSelecionados.includes(p.id);
                  return (
                    <TableRow key={p.id} className={selecionado ? 'bg-blue-50' : ''}>
                      <TableCell>
                        {!readOnly && <input type="checkbox" className="rounded" checked={selecionado}
                          onChange={e => setNfSelecionados(prev => e.target.checked ? [...prev, p.id] : prev.filter(id => id !== p.id))}
                        />}
                      </TableCell>
                      <TableCell className="font-mono text-xs font-bold">
                        <button className="hover:underline hover:text-primary transition-colors" onClick={() => { setNfPedidoSelecionado(p); setNfPedidoOpen(true); }}>
                          {p.numero || p.numero_pedido || '—'}
                        </button>
                      </TableCell>
                      <TableCell className="font-medium text-sm">
                        <button className="hover:underline hover:text-primary transition-colors text-left" onClick={() => { setNfPedidoSelecionado(p); setNfPedidoOpen(true); }}>
                          {p.cliente}
                        </button>
                      </TableCell>
                      <TableCell className="font-bold text-green-700">R$ {(p.total || 0).toFixed(2)}</TableCell>
                      <TableCell className="text-sm">{formatarDataBR(p.data)}</TableCell>
                      <TableCell className="text-xs">{dadosCliente?.cpf || '—'}</TableCell>
                      <TableCell className="text-xs max-w-[160px] truncate">{dadosCliente?.endereco ? `${dadosCliente.endereco}, ${dadosCliente.cidade || ''} - ${dadosCliente.uf || ''}` : '—'}</TableCell>
                      <TableCell>
                        {emitida
                          ? <Badge className="text-xs bg-green-100 text-green-700">Emitida</Badge>
                          : <Badge className="text-xs bg-amber-100 text-amber-700">A Emitir</Badge>}
                      </TableCell>
                    </TableRow>
                  );
                })}
                {pedidosNF.filter(p => nfFilter === 'EMITIDA' ? nfEmitidas.has(p.id) : !nfEmitidas.has(p.id)).length === 0 &&
                  <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Nenhum registro</TableCell></TableRow>}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* ─── COMPRAS ─────────────────────────────────────── */}
        <TabsContent value="compras" className="mt-4 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold flex items-center gap-2"><Truck className="w-4 h-4" />Compras e Fornecedores</h3>
            <div className="flex gap-2">
              {!readOnly && <Button variant="outline" size="sm" onClick={() => setFornecedorOpen(true)}><Building2 className="w-4 h-4 mr-1" />Fornecedor</Button>}
              {!readOnly && <Button size="sm" onClick={() => setCompraOpen(true)}><Plus className="w-4 h-4 mr-1" />Nova Compra</Button>}
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Card className="p-3"><p className="text-xs text-muted-foreground">Total Investido</p><p className="text-lg font-bold text-red-600">R$ {compras.filter(c => c.status !== 'CANCELADO').reduce((s, c) => s + (c.valor_total || 0), 0).toFixed(2)}</p></Card>
            <Card className="p-3"><p className="text-xs text-muted-foreground">Em Trânsito</p><p className="text-lg font-bold text-amber-600">{compras.filter(c => c.status === 'EM_TRANSITO').length}</p></Card>
            <Card className="p-3"><p className="text-xs text-muted-foreground">Pendentes</p><p className="text-lg font-bold text-blue-600">{compras.filter(c => ['PEDIDO','CONFIRMADO'].includes(c.status)).length}</p></Card>
          </div>
          <Tabs defaultValue="lista_compras">
            <TabsList>
              <TabsTrigger value="lista_compras"><Package className="w-4 h-4 mr-1" />Compras ({compras.length})</TabsTrigger>
              <TabsTrigger value="lista_forn"><Building2 className="w-4 h-4 mr-1" />Fornecedores ({fornecedores.length})</TabsTrigger>
            </TabsList>
            <TabsContent value="lista_compras" className="mt-3">
              <div className="rounded-xl border bg-card overflow-x-auto">
                <Table>
                  <TableHeader><TableRow className="bg-muted/50"><TableHead>Fornecedor</TableHead><TableHead>Data Pedido</TableHead><TableHead>Previsão</TableHead><TableHead>Valor</TableHead><TableHead>Status</TableHead><TableHead>Ação</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {compras.map(c => (
                      <TableRow key={c.id}>
                        <TableCell className="font-medium text-sm">{c.fornecedor_nome}</TableCell>
                        <TableCell className="text-sm">{c.data_pedido || '—'}</TableCell>
                        <TableCell className="text-sm">{c.data_previsao || '—'}</TableCell>
                        <TableCell className="font-bold text-red-600">R$ {(c.valor_total || 0).toFixed(2)}</TableCell>
                        <TableCell>
                          <Select value={c.status} onValueChange={v => updateCompraMut.mutate({ id: c.id, data: { status: v } })} disabled={readOnly}>
                            <SelectTrigger className="h-7 text-xs w-32"><SelectValue /></SelectTrigger>
                            <SelectContent>{STATUS_COMPRA.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>{c.status === 'EM_TRANSITO' && !readOnly && <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => updateCompraMut.mutate({ id: c.id, data: { status: 'RECEBIDO' } })}><CheckCircle className="w-3 h-3 mr-1" />Receber</Button>}</TableCell>
                      </TableRow>
                    ))}
                    {compras.length === 0 && <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Nenhuma compra</TableCell></TableRow>}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>
            <TabsContent value="lista_forn" className="mt-3">
              <div className="rounded-xl border bg-card overflow-x-auto">
                <Table>
                  <TableHeader><TableRow className="bg-muted/50"><TableHead>Nome</TableHead><TableHead>CNPJ</TableHead><TableHead>Telefone</TableHead><TableHead>Email</TableHead><TableHead>Cidade</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {fornecedores.map(f => (
                      <TableRow key={f.id}><TableCell className="font-medium">{f.nome}</TableCell><TableCell className="text-sm">{f.cnpj || '—'}</TableCell><TableCell className="text-sm">{f.telefone || '—'}</TableCell><TableCell className="text-sm">{f.email || '—'}</TableCell><TableCell className="text-sm">{f.cidade || '—'}</TableCell></TableRow>
                    ))}
                    {fornecedores.length === 0 && <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Nenhum fornecedor</TableCell></TableRow>}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>
          </Tabs>
        </TabsContent>

        {/* ─── DASHBOARD EXECUTIVO ──────────────────────── */}
        <TabsContent value="exec" className="mt-4"><DashboardExecutivo /></TabsContent>

        {/* ─── CONTAS AVANÇADAS ─────────────────────────── */}
        <TabsContent value="contas" className="mt-4"><ContasAvancadasPanel readOnly={readOnly} centros={centrosCusto} planoContas={planoContas} /></TabsContent>

        {/* ─── CAIXA DIÁRIO ─────────────────────────────── */}
        <TabsContent value="caixa" className="mt-4"><CaixaDiarioPanel readOnly={readOnly} /></TabsContent>

        {/* ─── CENTROS DE CUSTO ─────────────────────────── */}
        <TabsContent value="centros" className="mt-4"><CentroCustoPanel readOnly={readOnly} contas={contas} /></TabsContent>

        {/* ─── PLANO DE CONTAS ──────────────────────────── */}
        <TabsContent value="plano" className="mt-4"><PlanoContasPanel readOnly={readOnly} /></TabsContent>

        {/* ─── CONTAS RECORRENTES ───────────────────────── */}
        <TabsContent value="recorrentes" className="mt-4"><ContaRecorrentePanel readOnly={readOnly} centros={centrosCusto} /></TabsContent>

        {/* ─── FLUXO DE CAIXA PROJETADO ─────────────────── */}
        <TabsContent value="projecao" className="mt-4"><FluxoCaixaProjetadoPanel /></TabsContent>

        {/* ─── METAS ────────────────────────────────────── */}
        <TabsContent value="metas" className="mt-4"><MetasPanel readOnly={readOnly} receitaPeriodo={receitaTotal} lucroPeriodo={lucroTotal} /></TabsContent>

        {/* ─── ALERTAS ──────────────────────────────────── */}
        <TabsContent value="alertas" className="mt-4"><AlertasPanel /></TabsContent>

        {/* ─── RENTABILIDADE ────────────────────────────── */}
        <TabsContent value="rentab" className="mt-4"><RentabilidadePanel readOnly={readOnly} /></TabsContent>

        {/* ─── COMISSÕES ────────────────────────────────── */}
        <TabsContent value="comissoes" className="mt-4"><ComissaoPanel readOnly={readOnly} pedidos={pedidos} /></TabsContent>

        {/* ─── SIMULADOR DE PREÇO ───────────────────────── */}
        <TabsContent value="simulador" className="mt-4"><SimuladorPreco /></TabsContent>

        {/* ─── CALENDÁRIO FINANCEIRO ────────────────────── */}
        <TabsContent value="calendario" className="mt-4"><CalendarioFinanceiro /></TabsContent>

        {/* ─── RATEIO DE DESPESAS ───────────────────────── */}
        <TabsContent value="rateio" className="mt-4"><RateioPanel readOnly={readOnly} centros={centrosCusto} /></TabsContent>

        {/* ─── CONCILIAÇÃO BANCÁRIA ─────────────────────── */}
        <TabsContent value="conciliacao" className="mt-4"><ConciliacaoPanel readOnly={readOnly} /></TabsContent>

        {/* ─── HISTÓRICO CLIENTES ───────────────────────── */}
        <TabsContent value="hist_cliente" className="mt-4"><HistoricoClientePanel /></TabsContent>

        {/* ─── HISTÓRICO FORNECEDORES ───────────────────── */}
        <TabsContent value="hist_forn" className="mt-4"><HistoricoFornecedorPanel /></TabsContent>
      </Tabs>

      {/* Dialog Detalhes Pedido NF */}
      <Dialog open={nfPedidoOpen} onOpenChange={setNfPedidoOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-primary" />
              Pedido {nfPedidoSelecionado?.numero || nfPedidoSelecionado?.numero_pedido || '—'} — {nfPedidoSelecionado?.cliente}
            </DialogTitle>
          </DialogHeader>
          {nfPedidoSelecionado && (() => {
            const p = nfPedidoSelecionado;
            const dadosCli = clienteMap[p.cliente?.toUpperCase()];
            const itens = p.itens || [];
            const isProduto = p._tipo === 'PRODUTO';
            return (
              <div className="space-y-4">
                {/* Info geral */}
                <div className="grid grid-cols-2 gap-3 bg-muted/40 rounded-xl p-3 text-sm">
                  <div><span className="text-muted-foreground text-xs">Cliente</span><p className="font-semibold">{p.cliente}</p></div>
                  <div><span className="text-muted-foreground text-xs">Telefone</span><p>{p.telefone || dadosCli?.telefone || '—'}</p></div>
                  <div><span className="text-muted-foreground text-xs">Data</span><p>{formatarDataBR(p.data)}</p></div>
                  <div><span className="text-muted-foreground text-xs">Pagamento</span><p>{p.forma_pagamento || '—'}</p></div>
                  <div><span className="text-muted-foreground text-xs">CPF/CNPJ</span><p>{dadosCli?.cpf || '—'}</p></div>
                  <div><span className="text-muted-foreground text-xs">Endereço</span><p className="truncate">{dadosCli?.endereco ? `${dadosCli.endereco}, ${dadosCli.cidade || ''} - ${dadosCli.uf || ''}` : '—'}</p></div>
                </div>

                {/* Itens */}
                <div>
                  <h4 className="font-semibold text-sm mb-2">Itens do Pedido</h4>
                  <div className="rounded-xl border overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/50">
                          <TableHead>Descrição</TableHead>
                          <TableHead className="text-right">Qtd</TableHead>
                          <TableHead className="text-right">Preço Unit.</TableHead>
                          <TableHead className="text-right">Total</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {itens.length > 0 ? itens.map((item, i) => {
                          const nome = isProduto ? item.produto_nome : (item.descricao || item.tipo || '—');
                          const qtd = item.quantidade || 1;
                          const preco = isProduto
                            ? (item.preco_unitario_pix || item.preco_unitario_cartao || 0)
                            : (item.preco_unitario || 0);
                          const total = isProduto
                            ? (item.total || qtd * preco)
                            : (item.total || qtd * preco);
                          return (
                            <TableRow key={i}>
                              <TableCell className="text-sm font-medium">{nome}</TableCell>
                              <TableCell className="text-right text-sm">{qtd}</TableCell>
                              <TableCell className="text-right text-sm">R$ {preco.toFixed(2)}</TableCell>
                              <TableCell className="text-right font-bold text-green-700">R$ {total.toFixed(2)}</TableCell>
                            </TableRow>
                          );
                        }) : (
                          <TableRow><TableCell colSpan={4} className="text-center py-6 text-muted-foreground text-sm">Sem itens detalhados neste pedido</TableCell></TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </div>

                {/* Totais */}
                <div className="flex flex-col items-end gap-1 border-t pt-3 text-sm">
                  {p.desconto > 0 && <div className="flex gap-8"><span className="text-muted-foreground">Desconto</span><span className="text-red-600 font-semibold">- R$ {(p.desconto || 0).toFixed(2)}</span></div>}
                  <div className="flex gap-8"><span className="text-muted-foreground">Total NF</span><span className="text-xl font-black text-green-700">R$ {(p.total || 0).toFixed(2)}</span></div>
                </div>

                {/* Status */}
                <div className="flex items-center justify-between pt-1">
                  <Badge className={`text-xs ${nfEmitidas.has(p.id) ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                    {nfEmitidas.has(p.id) ? 'NF Emitida' : 'A Emitir'}
                  </Badge>
                  {!nfEmitidas.has(p.id) && (
                    <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white" onClick={() => {
                      marcarNfEmitidaMut.mutate(p);
                      setNfPedidoOpen(false);
                    }}>
                      <CheckCircle className="w-4 h-4 mr-1" />Marcar NF como Emitida
                    </Button>
                  )}
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Dialog Pedidos do Cliente (Ranking) */}
      <Dialog open={clientePedidoOpen} onOpenChange={setClientePedidoOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="w-4 h-4 text-primary" />
              Pedidos de {clientePedidosData.nome}
            </DialogTitle>
          </DialogHeader>
          <div className="rounded-xl border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Nº</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Pagamento</TableHead>
                  <TableHead>Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clientePedidosData.pedidos.length > 0 ? clientePedidosData.pedidos.map(p => (
                  <TableRow key={p.id}>
                    <TableCell className="font-mono text-xs font-bold">{p.numero || p.numero_pedido || '—'}</TableCell>
                    <TableCell><Badge className={`text-xs ${p._tipo === 'IMPRESSAO' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>{p._tipo === 'IMPRESSAO' ? '🖨️ Impressão' : '🛒 Produto'}</Badge></TableCell>
                    <TableCell className="text-sm">{p.data || '—'}</TableCell>
                    <TableCell><span className="text-xs font-bold">{p.status}</span></TableCell>
                    <TableCell className="text-xs">{p.forma_pagamento || '—'}</TableCell>
                    <TableCell className="font-bold text-green-700">R$ {(p.total || 0).toFixed(2)}</TableCell>
                  </TableRow>
                )) : <TableRow><TableCell colSpan={6} className="text-center py-6 text-muted-foreground">Nenhum pedido no período</TableCell></TableRow>}
              </TableBody>
            </Table>
          </div>
          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={() => setClientePedidoOpen(false)}>Fechar</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog Nova Despesa */}
      <Dialog open={despesaOpen} onOpenChange={setDespesaOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Nova Despesa</DialogTitle></DialogHeader>
          <form onSubmit={e => { e.preventDefault(); createDespMut.mutate(despForm); }} className="space-y-3">
            <div className="space-y-1.5"><Label>Descrição *</Label><Input value={despForm.descricao} onChange={e => setDespForm({ ...despForm, descricao: e.target.value })} required /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Valor (R$) *</Label><Input type="number" step="0.01" value={despForm.valor} onChange={e => setDespForm({ ...despForm, valor: parseFloat(e.target.value) || 0 })} required /></div>
              <div className="space-y-1.5"><Label>Vencimento</Label><Input type="date" value={despForm.data_vencimento} onChange={e => setDespForm({ ...despForm, data_vencimento: e.target.value })} /></div>
            </div>
            <div className="space-y-1.5"><Label>Categoria</Label>
              <Select value={despForm.categoria} onValueChange={v => setDespForm({ ...despForm, categoria: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{CATEGORIAS_DESP.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Classificação no DRE (opcional)</Label>
              <Select value={despForm.grupo_dre || '__auto__'} onValueChange={v => setDespForm({ ...despForm, grupo_dre: v === '__auto__' ? '' : v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__auto__">Automático (pela categoria)</SelectItem>
                  {Object.entries(GRUPO_DRE_LABEL).filter(([k]) => k !== 'OUTRAS_RECEITAS').map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label>Notas</Label><Input value={despForm.observacoes} onChange={e => setDespForm({ ...despForm, observacoes: e.target.value })} /></div>
            <div className="flex justify-end gap-3"><Button type="button" variant="outline" onClick={() => setDespesaOpen(false)}>Cancelar</Button><Button type="submit">Criar</Button></div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog Nova Compra */}
      <Dialog open={compraOpen} onOpenChange={setCompraOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Nova Ordem de Compra</DialogTitle></DialogHeader>
          <form onSubmit={e => { e.preventDefault(); createCompraMut.mutate(compraForm); }} className="space-y-3">
            <div className="space-y-1.5"><Label>Fornecedor *</Label>
              <Select value={compraForm.fornecedor_nome} onValueChange={v => setCompraForm({ ...compraForm, fornecedor_nome: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>{fornecedores.map(f => <SelectItem key={f.id} value={f.nome}>{f.nome}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Data Pedido</Label><Input type="date" value={compraForm.data_pedido} onChange={e => setCompraForm({ ...compraForm, data_pedido: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>Previsão</Label><Input type="date" value={compraForm.data_previsao} onChange={e => setCompraForm({ ...compraForm, data_previsao: e.target.value })} /></div>
            </div>
            <div className="space-y-1.5"><Label>Valor Total (R$)</Label><Input type="number" step="0.01" value={compraForm.valor_total} onChange={e => setCompraForm({ ...compraForm, valor_total: parseFloat(e.target.value) || 0 })} /></div>
            <div className="space-y-1.5"><Label>Observações</Label><Input value={compraForm.observacoes} onChange={e => setCompraForm({ ...compraForm, observacoes: e.target.value })} /></div>
            <div className="flex justify-end gap-3"><Button type="button" variant="outline" onClick={() => setCompraOpen(false)}>Cancelar</Button><Button type="submit">Criar</Button></div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog Novo Fornecedor */}
      <Dialog open={fornecedorOpen} onOpenChange={setFornecedorOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Novo Fornecedor</DialogTitle></DialogHeader>
          <form onSubmit={e => { e.preventDefault(); createFornMut.mutate(fornForm); }} className="space-y-3">
            <div className="space-y-1.5"><Label>Nome *</Label><Input value={fornForm.nome} onChange={e => setFornForm({ ...fornForm, nome: e.target.value })} required /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>CNPJ</Label><Input value={fornForm.cnpj} onChange={e => setFornForm({ ...fornForm, cnpj: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>Telefone</Label><Input value={fornForm.telefone} onChange={e => setFornForm({ ...fornForm, telefone: e.target.value })} /></div>
            </div>
            <div className="space-y-1.5"><Label>Email</Label><Input type="email" value={fornForm.email} onChange={e => setFornForm({ ...fornForm, email: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Cidade</Label><Input value={fornForm.cidade} onChange={e => setFornForm({ ...fornForm, cidade: e.target.value })} /></div>
            <div className="flex justify-end gap-3"><Button type="button" variant="outline" onClick={() => setFornecedorOpen(false)}>Cancelar</Button><Button type="submit">Criar</Button></div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}