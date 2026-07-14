import React, { useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { BarChart3, TrendingUp, Package, Activity, Medal, Printer } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

const COLORS = ['#e53e3e', '#f6ad55', '#68d391', '#63b3ed', '#b794f4', '#fc8181'];

function moda(arr) {
  if (!arr.length) return '—';
  const freq = {};
  arr.forEach(v => { if (v) freq[v] = (freq[v] || 0) + 1; });
  return Object.entries(freq).sort((a, b) => b[1] - a[1])[0]?.[0] || '—';
}

export default function ErpRelatorios() {
  const { data: pedidos = [] } = useQuery({ queryKey: ['pedidos'], queryFn: () => base44.entities.Pedido.list('-created_date', 500) });
  const { data: impressoes = [] } = useQuery({ queryKey: ['pedidos_impressao'], queryFn: () => base44.entities.PedidoImpressao.list('-created_date', 500) });
  const { data: movimentacoes = [] } = useQuery({ queryKey: ['movimentacoes'], queryFn: () => base44.entities.MovimentacaoEstoque.list('-created_date', 300) });
  const { data: produtos = [] } = useQuery({ queryKey: ['produtos'], queryFn: () => base44.entities.Produto.list() });

  const produtosVendidos = useMemo(() => {
    const map = {};
    pedidos.forEach(p => p.itens?.forEach(it => {
      const nome = it.produto_nome;
      if (!map[nome]) map[nome] = { nome, quantidade: 0, receita: 0 };
      map[nome].quantidade += it.quantidade || 0;
      map[nome].receita += (it.quantidade || 0) * (it.preco_unitario_pix || 0);
    }));
    return Object.values(map).sort((a, b) => b.quantidade - a.quantidade);
  }, [pedidos]);

  const vendasMensais = useMemo(() => {
    const map = {};
    pedidos.forEach(p => {
      const m = p.data?.slice(0, 7);
      if (!m) return;
      if (!map[m]) map[m] = { mes: m, total: 0, count: 0 };
      map[m].total += p.total || 0;
      map[m].count++;
    });
    return Object.values(map).sort((a, b) => a.mes.localeCompare(b.mes)).slice(-6).map(m => ({
      ...m,
      label: new Date(m.mes + '-01').toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }),
    }));
  }, [pedidos]);

  const pagamentosDist = useMemo(() => {
    const map = {};
    pedidos.forEach(p => {
      const pg = p.forma_pagamento || 'OUTRO';
      map[pg] = (map[pg] || 0) + (p.total || 0);
    });
    return Object.entries(map).map(([name, value]) => ({ name, value: parseFloat(value.toFixed(2)) }));
  }, [pedidos]);

  const statusDist = useMemo(() => {
    const map = {};
    pedidos.forEach(p => { map[p.status] = (map[p.status] || 0) + 1; });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [pedidos]);

  const rankingImpressoes = useMemo(() => {
    const map = {};
    impressoes.forEach(p => {
      const key = p.cliente?.toUpperCase() || '?';
      if (!map[key]) map[key] = { nome: key, telefone: p.telefone || '—', pedidos: 0, metros: 0, receita: 0, papeis: [], pagamentos: [], retiradas: [] };
      map[key].pedidos++;
      map[key].receita += p.total || 0;
      map[key].pagamentos.push(p.forma_pagamento);
      map[key].retiradas.push(p.forma_retirada);
      (p.itens || []).forEach(it => {
        map[key].metros += it.metros || 0;
        if (it.tipo) map[key].papeis.push(it.tipo);
      });
    });
    return Object.values(map)
      .map(c => ({ ...c, principal_papel: moda(c.papeis), principal_pagamento: moda(c.pagamentos), principal_retirada: moda(c.retiradas) }))
      .sort((a, b) => b.metros - a.metros)
      .slice(0, 10);
  }, [impressoes]);

  const rankingPedidos = useMemo(() => {
    const map = {};
    pedidos.forEach(p => {
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
  }, [pedidos]);

  const custosTotais = useMemo(() => {
    const map = {};
    movimentacoes.filter(m => m.tipo === 'ENTRADA' && m.custo_unitario > 0).forEach(m => {
      if (!map[m.produto_nome]) map[m.produto_nome] = 0;
      map[m.produto_nome] += m.quantidade * m.custo_unitario;
    });
    return Object.entries(map).map(([nome, custo]) => ({ nome, custo: parseFloat(custo.toFixed(2)) })).sort((a, b) => b.custo - a.custo).slice(0, 10);
  }, [movimentacoes]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold flex items-center gap-2"><BarChart3 className="w-5 h-5 text-primary" />Relatórios</h2>
        <p className="text-sm text-muted-foreground">Análises e insights do negócio</p>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card className="p-4">
          <h3 className="font-semibold text-sm mb-4 flex items-center gap-2"><TrendingUp className="w-4 h-4" />Vendas Mensais (6 meses)</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={vendasMensais} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v) => `R$ ${Number(v).toFixed(2)}`} />
              <Bar dataKey="total" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Total" />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card className="p-4">
          <h3 className="font-semibold text-sm mb-4">Distribuição por Pagamento</h3>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={pagamentosDist} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                {pagamentosDist.map((entry, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip formatter={(v) => `R$ ${Number(v).toFixed(2)}`} />
            </PieChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <Card className="p-4">
        <h3 className="font-semibold text-sm mb-4 flex items-center gap-2"><Package className="w-4 h-4" />Top Produtos por Vendas</h3>
        <div className="rounded-xl border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead>#</TableHead>
                <TableHead>Produto</TableHead>
                <TableHead>Qtd Vendida</TableHead>
                <TableHead>Receita Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {produtosVendidos.slice(0, 10).map((p, i) => (
                <TableRow key={p.nome}>
                  <TableCell><Badge className={`text-xs ${i === 0 ? 'bg-yellow-100 text-yellow-700' : i === 1 ? 'bg-gray-100 text-gray-600' : i === 2 ? 'bg-amber-100 text-amber-700' : 'bg-blue-50 text-blue-600'}`}>{i + 1}</Badge></TableCell>
                  <TableCell className="font-medium text-sm">{p.nome}</TableCell>
                  <TableCell className="font-bold">{p.quantidade}</TableCell>
                  <TableCell className="text-green-700 font-bold">R$ {p.receita.toFixed(2)}</TableCell>
                </TableRow>
              ))}
              {produtosVendidos.length === 0 && <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">Sem dados de vendas</TableCell></TableRow>}
            </TableBody>
          </Table>
        </div>
      </Card>

      <Card className="p-4">
        <h3 className="font-semibold text-sm mb-4 flex items-center gap-2"><Activity className="w-4 h-4" />Custo Total por Produto (Entradas)</h3>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={custosTotais} layout="vertical" margin={{ top: 5, right: 20, bottom: 5, left: 80 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis type="number" tick={{ fontSize: 10 }} />
            <YAxis type="category" dataKey="nome" tick={{ fontSize: 10 }} width={80} />
            <Tooltip formatter={(v) => `R$ ${Number(v).toFixed(2)}`} />
            <Bar dataKey="custo" fill="#e53e3e" radius={[0, 4, 4, 0]} name="Custo" />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      {/* Ranking de Impressões */}
      <Card className="p-4">
        <h3 className="font-semibold text-sm mb-1 flex items-center gap-2"><Printer className="w-4 h-4 text-amber-600" />Ranking de Impressões — Top 10 Clientes por Metragem</h3>
        <p className="text-xs text-muted-foreground mb-4">Sincronizado em tempo real com o módulo Produção (DTF e Sublimação)</p>
        <div className="rounded-xl border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead>#</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>Contato</TableHead>
                <TableHead>Pedidos</TableHead>
                <TableHead>Principal Papel</TableHead>
                <TableHead>Pagamento</TableHead>
                <TableHead>Logística</TableHead>
                <TableHead>Metragem Total</TableHead>
                <TableHead>Receita Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rankingImpressoes.map((c, i) => (
                <TableRow key={c.nome}>
                  <TableCell><Badge className={`text-xs ${i === 0 ? 'bg-yellow-100 text-yellow-700' : i === 1 ? 'bg-gray-100 text-gray-600' : i === 2 ? 'bg-amber-100 text-amber-700' : 'bg-muted text-muted-foreground'}`}>{i + 1}</Badge></TableCell>
                  <TableCell className="font-semibold text-sm">{c.nome}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{c.telefone}</TableCell>
                  <TableCell className="font-bold text-center">{c.pedidos}</TableCell>
                  <TableCell className="text-xs">{c.principal_papel}</TableCell>
                  <TableCell className="text-xs">{c.principal_pagamento}</TableCell>
                  <TableCell className="text-xs">{c.principal_retirada || '—'}</TableCell>
                  <TableCell className="font-bold text-blue-700">{c.metros.toFixed(2)}m</TableCell>
                  <TableCell className="font-bold text-green-700">R$ {c.receita.toFixed(2)}</TableCell>
                </TableRow>
              ))}
              {rankingImpressoes.length === 0 && <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Sem dados de impressões</TableCell></TableRow>}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* Ranking de Pedidos */}
      <Card className="p-4">
        <h3 className="font-semibold text-sm mb-1 flex items-center gap-2"><Medal className="w-4 h-4 text-primary" />Ranking de Pedidos — Top 10 Clientes por Receita</h3>
        <p className="text-xs text-muted-foreground mb-4">Sincronizado em tempo real com o módulo Pedidos Loja / WhatsApp</p>
        <div className="rounded-xl border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead>#</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>Contato</TableHead>
                <TableHead>Pedidos</TableHead>
                <TableHead>Pagamento</TableHead>
                <TableHead>Logística</TableHead>
                <TableHead>Receita Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rankingPedidos.map((c, i) => (
                <TableRow key={c.nome}>
                  <TableCell><Badge className={`text-xs ${i === 0 ? 'bg-yellow-100 text-yellow-700' : i === 1 ? 'bg-gray-100 text-gray-600' : i === 2 ? 'bg-amber-100 text-amber-700' : 'bg-muted text-muted-foreground'}`}>{i + 1}</Badge></TableCell>
                  <TableCell className="font-semibold text-sm">{c.nome}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{c.telefone}</TableCell>
                  <TableCell className="font-bold text-center">{c.pedidos}</TableCell>
                  <TableCell className="text-xs">{c.principal_pagamento}</TableCell>
                  <TableCell className="text-xs">{c.principal_retirada || '—'}</TableCell>
                  <TableCell className="font-bold text-green-700">R$ {c.receita.toFixed(2)}</TableCell>
                </TableRow>
              ))}
              {rankingPedidos.length === 0 && <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Sem dados de pedidos</TableCell></TableRow>}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}