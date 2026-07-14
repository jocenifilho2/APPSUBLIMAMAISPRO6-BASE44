import React, { useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Star, DollarSign, TrendingUp, AlertTriangle, Package, Users, ShoppingBag, Zap } from 'lucide-react';

export default function ErpCentralDono() {
  const { data: pedidos = [] } = useQuery({ queryKey: ['pedidos'], queryFn: () => base44.entities.Pedido.list('-created_date', 500) });
  const { data: produtos = [] } = useQuery({ queryKey: ['produtos'], queryFn: () => base44.entities.Produto.list() });
  const { data: movimentacoes = [] } = useQuery({ queryKey: ['movimentacoes'], queryFn: () => base44.entities.MovimentacaoEstoque.list('-created_date', 200) });
  const { data: contas = [] } = useQuery({ queryKey: ['contas_fin'], queryFn: () => base44.entities.ContaFinanceira.list('-created_date', 200) });
  const { data: clientes = [] } = useQuery({ queryKey: ['clientes'], queryFn: () => base44.entities.Cliente.list() });

  const hoje = new Date().toISOString().split('T')[0];
  const mesAtual = new Date().toISOString().slice(0, 7);

  const stats = useMemo(() => {
    const pedidosHoje = pedidos.filter(p => p.data === hoje);
    const vendasHoje = pedidosHoje.reduce((s, p) => s + (p.total || 0), 0);
    const pedidosMes = pedidos.filter(p => p.data?.startsWith(mesAtual));
    const vendasMes = pedidosMes.reduce((s, p) => s + (p.total || 0), 0);

    const estoqueMap = {};
    movimentacoes.forEach(m => {
      if (!estoqueMap[m.produto_nome]) estoqueMap[m.produto_nome] = 0;
      if (m.tipo === 'ENTRADA' || m.tipo === 'PRODUCAO') estoqueMap[m.produto_nome] += (m.quantidade || 0);
      else if (m.tipo === 'SAIDA' || m.tipo === 'PERDA') estoqueMap[m.produto_nome] -= (m.quantidade || 0);
      else if (m.tipo === 'AJUSTE') estoqueMap[m.produto_nome] += (m.quantidade || 0);
    });

    const estoqueCritico = produtos.filter(p => (estoqueMap[p.nome] || 0) <= 0);
    const estoqueAtencao = produtos.filter(p => { const q = estoqueMap[p.nome] || 0; return q > 0 && q <= 5; });
    const contasVencidas = contas.filter(c => c.status === 'PENDENTE' && c.data_vencimento < hoje);
    const pedidosAbertos = pedidos.filter(p => !['ENTREGUE', 'CANCELADO'].includes(p.status));

    const vendasPorProduto = {};
    pedidos.forEach(p => p.itens?.forEach(it => {
      vendasPorProduto[it.produto_nome] = (vendasPorProduto[it.produto_nome] || 0) + (it.quantidade || 0);
    }));
    const topProdutos = Object.entries(vendasPorProduto).sort(([, a], [, b]) => b - a).slice(0, 5);

    return { vendasHoje, vendasMes, pedidosHoje: pedidosHoje.length, estoqueCritico, estoqueAtencao, contasVencidas, pedidosAbertos, topProdutos };
  }, [pedidos, produtos, movimentacoes, contas, hoje, mesAtual]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-yellow-400 rounded-xl flex items-center justify-center">
          <Star className="w-5 h-5 text-white" />
        </div>
        <div>
          <h2 className="text-lg font-bold">Central do Dono</h2>
          <p className="text-sm text-muted-foreground">Visão executiva do negócio</p>
        </div>
      </div>

      {/* Alertas urgentes */}
      {(stats.estoqueCritico.length > 0 || stats.contasVencidas.length > 0) && (
        <div className="space-y-2">
          {stats.estoqueCritico.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4">
              <p className="text-sm font-semibold text-red-700 flex items-center gap-2 mb-2">
                <AlertTriangle className="w-4 h-4" />🔴 Estoque ZERADO ({stats.estoqueCritico.length} produtos)
              </p>
              <div className="flex flex-wrap gap-1.5">
                {stats.estoqueCritico.map(p => <Badge key={p.id} className="bg-red-100 text-red-700 text-xs">{p.nome}</Badge>)}
              </div>
            </div>
          )}
          {stats.estoqueAtencao.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <p className="text-sm font-semibold text-amber-700 flex items-center gap-2 mb-2">
                <AlertTriangle className="w-4 h-4" />🟡 Estoque Baixo ({stats.estoqueAtencao.length} produtos)
              </p>
              <div className="flex flex-wrap gap-1.5">
                {stats.estoqueAtencao.map(p => <Badge key={p.id} className="bg-amber-100 text-amber-700 text-xs">{p.nome}</Badge>)}
              </div>
            </div>
          )}
          {stats.contasVencidas.length > 0 && (
            <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
              <p className="text-sm font-semibold text-orange-700 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />⚠️ {stats.contasVencidas.length} conta(s) vencida(s) — Total: R$ {stats.contasVencidas.reduce((s, c) => s + (c.valor || 0), 0).toFixed(2)}
              </p>
            </div>
          )}
        </div>
      )}

      {/* KPIs principais */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="p-4 border-l-4 border-l-green-500">
          <div className="flex items-center gap-2 mb-1"><DollarSign className="w-4 h-4 text-green-600" /><p className="text-xs text-muted-foreground">Vendas Hoje</p></div>
          <p className="text-2xl font-bold text-green-700">R$ {stats.vendasHoje.toFixed(2)}</p>
          <p className="text-xs text-muted-foreground">{stats.pedidosHoje} pedido(s)</p>
        </Card>
        <Card className="p-4 border-l-4 border-l-blue-500">
          <div className="flex items-center gap-2 mb-1"><TrendingUp className="w-4 h-4 text-blue-600" /><p className="text-xs text-muted-foreground">Vendas Mês</p></div>
          <p className="text-2xl font-bold text-blue-700">R$ {stats.vendasMes.toFixed(2)}</p>
        </Card>
        <Card className="p-4 border-l-4 border-l-amber-500">
          <div className="flex items-center gap-2 mb-1"><ShoppingBag className="w-4 h-4 text-amber-600" /><p className="text-xs text-muted-foreground">Pedidos Abertos</p></div>
          <p className="text-2xl font-bold text-amber-700">{stats.pedidosAbertos.length}</p>
        </Card>
        <Card className="p-4 border-l-4 border-l-purple-500">
          <div className="flex items-center gap-2 mb-1"><Users className="w-4 h-4 text-purple-600" /><p className="text-xs text-muted-foreground">Clientes</p></div>
          <p className="text-2xl font-bold text-purple-700">{clientes.length}</p>
        </Card>
      </div>

      {/* Top produtos */}
      <Card className="p-4">
        <h3 className="font-semibold text-sm mb-3 flex items-center gap-2"><Zap className="w-4 h-4 text-yellow-500" />Top 5 Produtos Mais Vendidos</h3>
        {stats.topProdutos.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma venda registrada</p>
        ) : (
          <div className="space-y-2">
            {stats.topProdutos.map(([nome, qtd], i) => {
              const max = stats.topProdutos[0]?.[1] || 1;
              return (
                <div key={nome} className="flex items-center gap-3">
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0 ${i === 0 ? 'bg-yellow-400' : i === 1 ? 'bg-gray-400' : i === 2 ? 'bg-amber-600' : 'bg-blue-400'}`}>{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-sm font-medium truncate">{nome}</span>
                      <span className="text-sm font-bold ml-2">{qtd} un</span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-1.5">
                      <div className="bg-primary h-1.5 rounded-full" style={{ width: `${(qtd / max) * 100}%` }} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Pedidos abertos por status */}
      {stats.pedidosAbertos.length > 0 && (
        <Card className="p-4">
          <h3 className="font-semibold text-sm mb-3">Pedidos em Aberto por Status</h3>
          <div className="flex flex-wrap gap-2">
            {['NOVO', 'AGUARDANDO_PAGAMENTO', 'SEPARACAO', 'PRODUCAO', 'PRONTO'].map(s => {
              const count = stats.pedidosAbertos.filter(p => p.status === s).length;
              if (count === 0) return null;
              return <Badge key={s} variant="outline" className="text-xs">{s}: {count}</Badge>;
            })}
          </div>
        </Card>
      )}
    </div>
  );
}