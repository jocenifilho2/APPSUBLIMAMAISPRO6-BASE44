import React, { useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, LineChart, Line, Legend
} from 'recharts';
import { DollarSign, ShoppingBag, Package, AlertTriangle, TrendingUp, Users, Clock, CreditCard } from 'lucide-react';

export default function ErpDashboard() {
  const { data: pedidos = [] } = useQuery({ queryKey: ['pedidos'], queryFn: () => base44.entities.Pedido.list('-created_date', 500) });
  const { data: produtos = [] } = useQuery({ queryKey: ['produtos'], queryFn: () => base44.entities.Produto.list() });
  const { data: movimentacoes = [] } = useQuery({ queryKey: ['movimentacoes'], queryFn: () => base44.entities.MovimentacaoEstoque.list('-created_date', 200) });
  const { data: contas = [] } = useQuery({ queryKey: ['contas_fin'], queryFn: () => base44.entities.ContaFinanceira.list('-created_date', 200) });

  const hoje = new Date().toISOString().split('T')[0];
  const mesAtual = new Date().toISOString().slice(0, 7);

  const stats = useMemo(() => {
    const pedidosHoje = pedidos.filter(p => p.data === hoje);
    const faturamentoHoje = pedidosHoje.reduce((s, p) => s + (p.total || 0), 0);
    const pedidosMes = pedidos.filter(p => p.data?.startsWith(mesAtual));
    const faturamentoMes = pedidosMes.reduce((s, p) => s + (p.total || 0), 0);
    const pedidosAbertos = pedidos.filter(p => !['ENTREGUE', 'CANCELADO'].includes(p.status)).length;

    const estoqueMap = {};
    movimentacoes.forEach(m => {
      if (!estoqueMap[m.produto_nome]) estoqueMap[m.produto_nome] = 0;
      if (m.tipo === 'ENTRADA' || m.tipo === 'PRODUCAO') estoqueMap[m.produto_nome] += (m.quantidade || 0);
      else if (m.tipo === 'SAIDA' || m.tipo === 'PERDA') estoqueMap[m.produto_nome] -= (m.quantidade || 0);
      else if (m.tipo === 'AJUSTE') estoqueMap[m.produto_nome] += (m.quantidade || 0);
    });
    const estoqueBaixo = produtos.filter(p => (estoqueMap[p.nome] || 0) <= (p.estoque_minimo || 5)).length;

    const contasVencidas = contas.filter(c => c.status === 'PENDENTE' && c.data_vencimento < hoje && c.tipo === 'DESPESA').length;
    const ticketMedio = pedidosMes.length > 0 ? faturamentoMes / pedidosMes.length : 0;

    const lucroMes = pedidosMes.reduce((s, p) => {
      const custoItens = p.itens?.reduce((cs, it) => cs + (it.quantidade || 0) * (it.custo_unitario || 0), 0) || 0;
      return s + (p.total || 0) - custoItens;
    }, 0);

    return { faturamentoHoje, faturamentoMes, pedidosAbertos, estoqueBaixo, contasVencidas, ticketMedio, lucroMes };
  }, [pedidos, produtos, movimentacoes, contas, hoje, mesAtual]);

  const vendasDia = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(); d.setDate(d.getDate() - (6 - i));
      const dateStr = d.toISOString().split('T')[0];
      const total = pedidos.filter(p => p.data === dateStr).reduce((s, p) => s + (p.total || 0), 0);
      return { dia: d.toLocaleDateString('pt-BR', { weekday: 'short' }), total };
    });
  }, [pedidos]);

  const fluxo = useMemo(() => {
    return Array.from({ length: 6 }, (_, i) => {
      const d = new Date(); d.setMonth(d.getMonth() - (5 - i));
      const m = d.toISOString().slice(0, 7);
      const rec = contas.filter(c => c.tipo === 'RECEITA' && c.data_vencimento?.startsWith(m)).reduce((s, c) => s + (c.valor || 0), 0);
      const desp = contas.filter(c => c.tipo === 'DESPESA' && c.data_vencimento?.startsWith(m)).reduce((s, c) => s + (c.valor || 0), 0);
      return { mes: d.toLocaleDateString('pt-BR', { month: 'short' }), receitas: rec, despesas: desp };
    });
  }, [contas]);

  const cards = [
    { label: 'Faturamento Hoje', value: `R$ ${stats.faturamentoHoje.toFixed(2)}`, icon: DollarSign, color: 'text-green-600', bg: 'bg-green-50' },
    { label: 'Faturamento Mês', value: `R$ ${stats.faturamentoMes.toFixed(2)}`, icon: TrendingUp, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Lucro Mês (est.)', value: `R$ ${stats.lucroMes.toFixed(2)}`, icon: CreditCard, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: 'Pedidos Abertos', value: stats.pedidosAbertos, icon: ShoppingBag, color: 'text-amber-600', bg: 'bg-amber-50' },
    { label: 'Estoque Baixo', value: stats.estoqueBaixo, icon: Package, color: 'text-red-600', bg: 'bg-red-50' },
    { label: 'Contas Vencidas', value: stats.contasVencidas, icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-50' },
    { label: 'Ticket Médio', value: `R$ ${stats.ticketMedio.toFixed(2)}`, icon: Users, color: 'text-purple-600', bg: 'bg-purple-50' },
    { label: 'Total Produtos', value: produtos.length, icon: Clock, color: 'text-slate-600', bg: 'bg-slate-50' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold">Dashboard</h2>
        <p className="text-sm text-muted-foreground">Visão geral em tempo real</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {cards.map(c => (
          <Card key={c.label} className="p-4">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${c.bg}`}>
                <c.icon className={`w-5 h-5 ${c.color}`} />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground font-medium truncate">{c.label}</p>
                <p className="text-lg font-bold leading-tight">{c.value}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card className="p-4">
          <h3 className="font-semibold mb-4 text-sm">Vendas — Últimos 7 Dias</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={vendasDia} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="dia" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v) => `R$ ${Number(v).toFixed(2)}`} />
              <Bar dataKey="total" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card className="p-4">
          <h3 className="font-semibold mb-4 text-sm">Fluxo de Caixa — 6 Meses</h3>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={fluxo} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v) => `R$ ${Number(v).toFixed(2)}`} />
              <Legend />
              <Line type="monotone" dataKey="receitas" stroke="#22c55e" strokeWidth={2} dot={false} name="Receitas" />
              <Line type="monotone" dataKey="despesas" stroke="#ef4444" strokeWidth={2} dot={false} name="Despesas" />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      </div>
    </div>
  );
}