import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Search, User, Download } from 'lucide-react';
import { formatCurrency, formatDate, exportarCSV } from '@/lib/financeiro-helpers';

export default function HistoricoClientePanel() {
  const [busca, setBusca] = useState('');
  const [clienteSel, setClienteSel] = useState(null);

  const { data: pedidos = [] } = useQuery({
    queryKey: ['pedidos'],
    queryFn: () => base44.entities.Pedido.list('-created_date', 9999),
    refetchInterval: 15000
  });
  const { data: impressoes = [] } = useQuery({
    queryKey: ['pedidos-impressao'],
    queryFn: () => base44.entities.PedidoImpressao.list('-created_date', 9999),
    refetchInterval: 15000
  });
  const { data: contas = [] } = useQuery({
    queryKey: ['contas-financeiras'],
    queryFn: () => base44.entities.ContaFinanceira.list('-data_vencimento', 500),
    refetchInterval: 15000
  });

  const clientesData = useMemo(() => {
    const todosPedidos = [...(pedidos || []), ...(impressoes || [])].filter(p => p.status !== 'CANCELADO' && p.cliente);
    const mapa = {};
    todosPedidos.forEach(p => {
      const nome = p.cliente;
      if (!mapa[nome]) mapa[nome] = { nome, telefone: p.telefone || '', pedidos: [], totalGasto: 0 };
      mapa[nome].pedidos.push(p);
      mapa[nome].totalGasto += p.total || 0;
    });
    return Object.values(mapa).map(c => {
      const pedidosOrd = c.pedidos.sort((a, b) => new Date(b.data || b.created_date) - new Date(a.data || a.created_date));
      const contasCliente = contas.filter(ct => ct.cliente === c.nome);
      const pendencias = contasCliente.filter(ct => ct.status === 'PENDENTE' || ct.status === 'VENCIDO' || ct.status === 'PAGO_PARCIAL');
      return {
        ...c,
        qtdPedidos: c.pedidos.length,
        ticketMedio: c.pedidos.length > 0 ? c.totalGasto / c.pedidos.length : 0,
        ultimaCompra: pedidosOrd[0]?.data || pedidosOrd[0]?.created_date || '',
        maiorCompra: Math.max(...c.pedidos.map(p => p.total || 0), 0),
        pendencias,
        valorPendencias: pendencias.reduce((s, p) => s + (p.valor || 0) - (p.valor_pago || 0), 0),
        contas: contasCliente
      };
    }).filter(c => !busca || c.nome.toLowerCase().includes(busca.toLowerCase())).sort((a, b) => b.totalGasto - a.totalGasto);
  }, [pedidos, impressoes, contas, busca]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold flex items-center gap-2"><User className="w-4 h-4" />Histórico Financeiro de Clientes</h3>
        <Button variant="outline" size="sm" onClick={() => exportarCSV(clientesData, [
          { label: 'Cliente', key: 'nome' }, { label: 'Telefone', key: 'telefone' },
          { label: 'Pedidos', key: 'qtdPedidos' }, { label: 'Total Gasto', key: c => c.totalGasto?.toFixed(2) },
          { label: 'Ticket Médio', key: c => c.ticketMedio?.toFixed(2) }, { label: 'Última Compra', key: 'ultimaCompra' },
          { label: 'Maior Compra', key: c => c.maiorCompra?.toFixed(2) }, { label: 'Pendências', key: c => c.valorPendencias?.toFixed(2) }
        ], 'historico-clientes.csv')}><Download className="w-3.5 h-3.5 mr-1" />CSV</Button>
      </div>

      <div className="relative max-w-xs">
        <Search className="absolute left-2 top-2.5 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Buscar cliente..." value={busca} onChange={e => setBusca(e.target.value)} className="pl-8" />
      </div>

      <Card>
        <Table>
          <TableHeader><TableRow className="bg-muted/50">
            <TableHead>Cliente</TableHead><TableHead className="text-center">Pedidos</TableHead>
            <TableHead className="text-right">Total Gasto</TableHead><TableHead className="text-right">Ticket Médio</TableHead>
            <TableHead>Última Compra</TableHead><TableHead className="text-right">Maior Compra</TableHead>
            <TableHead className="text-right">Pendências</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {clientesData.slice(0, 100).map((c, i) => (
              <TableRow key={i} className="cursor-pointer hover:bg-muted/30" onClick={() => setClienteSel(c)}>
                <TableCell className="text-sm font-medium">{c.nome}</TableCell>
                <TableCell className="text-center text-sm">{c.qtdPedidos}</TableCell>
                <TableCell className="text-right text-sm font-bold text-green-600">{formatCurrency(c.totalGasto)}</TableCell>
                <TableCell className="text-right text-xs">{formatCurrency(c.ticketMedio)}</TableCell>
                <TableCell className="text-xs">{formatDate(c.ultimaCompra)}</TableCell>
                <TableCell className="text-right text-xs">{formatCurrency(c.maiorCompra)}</TableCell>
                <TableCell className="text-right">{c.valorPendencias > 0 ? <Badge className="bg-red-100 text-red-700 text-xs">{formatCurrency(c.valorPendencias)}</Badge> : <Badge className="bg-green-100 text-green-700 text-xs">OK</Badge>}</TableCell>
              </TableRow>
            ))}
            {clientesData.length === 0 && <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Nenhum cliente.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={!!clienteSel} onOpenChange={() => setClienteSel(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{clienteSel?.nome}</DialogTitle></DialogHeader>
          {clienteSel && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <Card className="p-3"><p className="text-xs text-muted-foreground">Total Gasto</p><p className="text-sm font-bold text-green-600">{formatCurrency(clienteSel.totalGasto)}</p></Card>
                <Card className="p-3"><p className="text-xs text-muted-foreground">Pedidos</p><p className="text-sm font-bold">{clienteSel.qtdPedidos}</p></Card>
                <Card className="p-3"><p className="text-xs text-muted-foreground">Ticket Médio</p><p className="text-sm font-bold">{formatCurrency(clienteSel.ticketMedio)}</p></Card>
              </div>
              {clienteSel.pendencias.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium mb-2 text-red-600">Pendências ({formatCurrency(clienteSel.valorPendencias)})</h4>
                  <div className="space-y-1">
                    {clienteSel.pendencias.map(p => (
                      <div key={p.id} className="flex justify-between text-xs bg-red-50 rounded p-2">
                        <span>{p.descricao} — {formatDate(p.data_vencimento)}</span>
                        <span className="font-medium text-red-600">{formatCurrency(p.valor - (p.valor_pago || 0))}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div>
                <h4 className="text-sm font-medium mb-2">Últimos Pedidos</h4>
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {clienteSel.pedidos.slice(0, 10).map(p => (
                    <div key={p.id} className="flex justify-between text-xs border-b pb-1">
                      <span>{formatDate(p.data || p.created_date)} — {p.numero_pedido || p.numero || ''}</span>
                      <span className="font-medium">{formatCurrency(p.total)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}