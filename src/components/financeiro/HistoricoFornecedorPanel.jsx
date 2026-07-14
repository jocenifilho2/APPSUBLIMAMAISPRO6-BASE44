import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Search, Truck, Download } from 'lucide-react';
import { formatCurrency, formatDate, exportarCSV } from '@/lib/financeiro-helpers';

export default function HistoricoFornecedorPanel() {
  const [busca, setBusca] = useState('');
  const [fornSel, setFornSel] = useState(null);

  const { data: compras = [] } = useQuery({
    queryKey: ['compras'],
    queryFn: () => base44.entities.Compra.list('-created_date', 500),
    refetchInterval: 15000
  });
  const { data: fornecedores = [] } = useQuery({
    queryKey: ['fornecedores'],
    queryFn: () => base44.entities.Fornecedor.list(),
    refetchInterval: 30000
  });
  const { data: contas = [] } = useQuery({
    queryKey: ['contas-financeiras'],
    queryFn: () => base44.entities.ContaFinanceira.list('-data_vencimento', 500),
    refetchInterval: 15000
  });

  const dados = useMemo(() => {
    return fornecedores.filter(f => !busca || (f.nome || '').toLowerCase().includes(busca.toLowerCase())).map(f => {
      const comprasForn = compras.filter(c => c.fornecedor_nome === f.nome);
      const contasForn = contas.filter(c => c.fornecedor === f.nome);
      const contasAbertas = contasForn.filter(c => c.status === 'PENDENTE' || c.status === 'VENCIDO' || c.status === 'PAGO_PARCIAL');
      const contasPagas = contasForn.filter(c => c.status === 'PAGO');
      const valorTotal = comprasForn.reduce((s, c) => s + (c.valor_total || 0), 0);
      const ultimaCompra = comprasForn.sort((a, b) => new Date(b.data_pedido || b.created_date) - new Date(a.data_pedido || a.created_date))[0];
      return {
        ...f,
        qtdCompras: comprasForn.length,
        valorTotal,
        ultimaCompra: ultimaCompra?.data_pedido || ultimaCompra?.created_date || '',
        contasAbertas,
        contasPagas,
        valorAberto: contasAbertas.reduce((s, c) => s + (c.valor || 0) - (c.valor_pago || 0), 0),
        valorPago: contasPagas.reduce((s, c) => s + (c.valor || 0), 0),
        compras: comprasForn.sort((a, b) => new Date(b.data_pedido || b.created_date) - new Date(a.data_pedido || a.created_date))
      };
    }).sort((a, b) => b.valorTotal - a.valorTotal);
  }, [fornecedores, compras, contas, busca]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold flex items-center gap-2"><Truck className="w-4 h-4" />Histórico Financeiro de Fornecedores</h3>
        <Button variant="outline" size="sm" onClick={() => exportarCSV(dados, [
          { label: 'Fornecedor', key: 'nome' }, { label: 'Compras', key: 'qtdCompras' },
          { label: 'Valor Total', key: d => d.valorTotal?.toFixed(2) }, { label: 'Última Compra', key: 'ultimaCompra' },
          { label: 'Valor Aberto', key: d => d.valorAberto?.toFixed(2) }, { label: 'Valor Pago', key: d => d.valorPago?.toFixed(2) }
        ], 'historico-fornecedores.csv')}><Download className="w-3.5 h-3.5 mr-1" />CSV</Button>
      </div>

      <div className="relative max-w-xs">
        <Search className="absolute left-2 top-2.5 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Buscar fornecedor..." value={busca} onChange={e => setBusca(e.target.value)} className="pl-8" />
      </div>

      <Card>
        <Table>
          <TableHeader><TableRow className="bg-muted/50">
            <TableHead>Fornecedor</TableHead><TableHead className="text-center">Compras</TableHead>
            <TableHead className="text-right">Valor Total</TableHead><TableHead>Última Compra</TableHead>
            <TableHead className="text-right">Em Aberto</TableHead><TableHead className="text-right">Pago</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {dados.map((f, i) => (
              <TableRow key={f.id || i} className="cursor-pointer hover:bg-muted/30" onClick={() => setFornSel(f)}>
                <TableCell className="text-sm font-medium">{f.nome}</TableCell>
                <TableCell className="text-center text-sm">{f.qtdCompras}</TableCell>
                <TableCell className="text-right text-sm font-bold">{formatCurrency(f.valorTotal)}</TableCell>
                <TableCell className="text-xs">{formatDate(f.ultimaCompra)}</TableCell>
                <TableCell className="text-right">{f.valorAberto > 0 ? <Badge className="bg-red-100 text-red-700 text-xs">{formatCurrency(f.valorAberto)}</Badge> : <Badge className="bg-green-100 text-green-700 text-xs">OK</Badge>}</TableCell>
                <TableCell className="text-right text-xs text-green-600">{formatCurrency(f.valorPago)}</TableCell>
              </TableRow>
            ))}
            {dados.length === 0 && <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Nenhum fornecedor.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={!!fornSel} onOpenChange={() => setFornSel(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{fornSel?.nome}</DialogTitle></DialogHeader>
          {fornSel && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <Card className="p-3"><p className="text-xs text-muted-foreground">Total Compras</p><p className="text-sm font-bold">{formatCurrency(fornSel.valorTotal)}</p></Card>
                <Card className="p-3"><p className="text-xs text-muted-foreground">Qtd Compras</p><p className="text-sm font-bold">{fornSel.qtdCompras}</p></Card>
                <Card className="p-3"><p className="text-xs text-muted-foreground">Em Aberto</p><p className="text-sm font-bold text-red-600">{formatCurrency(fornSel.valorAberto)}</p></Card>
                <Card className="p-3"><p className="text-xs text-muted-foreground">Pago</p><p className="text-sm font-bold text-green-600">{formatCurrency(fornSel.valorPago)}</p></Card>
              </div>
              {fornSel.contasAbertas.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium mb-2 text-red-600">Contas em Aberto</h4>
                  <div className="space-y-1">
                    {fornSel.contasAbertas.map(c => (
                      <div key={c.id} className="flex justify-between text-xs bg-red-50 rounded p-2">
                        <span>{c.descricao} — {formatDate(c.data_vencimento)}</span>
                        <span className="font-medium text-red-600">{formatCurrency(c.valor - (c.valor_pago || 0))}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div>
                <h4 className="text-sm font-medium mb-2">Compras</h4>
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {fornSel.compras.slice(0, 10).map(c => (
                    <div key={c.id} className="flex justify-between text-xs border-b pb-1">
                      <span>{formatDate(c.data_pedido)} — <Badge variant="outline" className="text-xs">{c.status}</Badge></span>
                      <span className="font-medium">{formatCurrency(c.valor_total)}</span>
                    </div>
                  ))}
                  {fornSel.compras.length === 0 && <p className="text-xs text-muted-foreground">Nenhuma compra.</p>}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}