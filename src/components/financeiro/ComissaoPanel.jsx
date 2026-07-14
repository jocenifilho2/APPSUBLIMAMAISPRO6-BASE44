import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, Trash2, UserCheck, Download } from 'lucide-react';
import { formatCurrency, exportarCSV } from '@/lib/financeiro-helpers';
import { registrarLog } from '@/lib/audit-log';

export default function ComissaoPanel({ readOnly = false, pedidos = [] }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ vendedor: '', percentual: 5, data_inicio: new Date().toISOString().split('T')[0], data_fim: '', ativo: true });

  const { data: comissoes = [] } = useQuery({
    queryKey: ['comissoes'],
    queryFn: () => base44.entities.Comissao.list(),
    refetchInterval: 30000
  });

  const createMut = useMutation({
    mutationFn: (data) => base44.entities.Comissao.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['comissoes'] }); registrarLog({ acao: 'CRIAR', entidade: 'Comissao', detalhes: `Comissão: ${form.vendedor} ${form.percentual}%` }); }
  });
  const deleteMut = useMutation({
    mutationFn: (id) => base44.entities.Comissao.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['comissoes'] })
  });

  function salvar(e) {
    e.preventDefault();
    createMut.mutate({ ...form, percentual: Number(form.percentual) });
    setOpen(false);
    setForm({ vendedor: '', percentual: 5, data_inicio: new Date().toISOString().split('T')[0], data_fim: '', ativo: true });
  }

  // Calcular vendas por vendedor
  const vendasPorVendedor = useMemo(() => {
    const mapa = {};
    (pedidos || []).filter(p => p.status !== 'CANCELADO' && p.vendedor).forEach(p => {
      const v = p.vendedor;
      if (!mapa[v]) mapa[v] = { vendedor: v, vendas: 0, valor: 0 };
      mapa[v].vendas++;
      mapa[v].valor += p.total || 0;
    });
    return Object.values(mapa);
  }, [pedidos]);

  const dadosComissao = vendasPorVendedor.map(v => {
    const comissao = comissoes.find(c => c.ativo && c.vendedor.toLowerCase() === v.vendedor.toLowerCase());
    const percentual = comissao?.percentual || 0;
    return { ...v, percentual, comissaoValor: (v.valor * percentual) / 100 };
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold flex items-center gap-2"><UserCheck className="w-4 h-4" />Comissão de Vendedores</h3>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => exportarCSV(dadosComissao, [
            { label: 'Vendedor', key: 'vendedor' }, { label: 'Vendas', key: 'vendas' },
            { label: 'Valor Total', key: d => d.valor?.toFixed(2) }, { label: 'Comissão %', key: 'percentual' },
            { label: 'Comissão R$', key: d => d.comissaoValor?.toFixed(2) }
          ], 'comissoes.csv')}><Download className="w-3.5 h-3.5 mr-1" />CSV</Button>
          {!readOnly && <Button size="sm" onClick={() => setOpen(true)}><Plus className="w-4 h-4 mr-1" />Nova Comissão</Button>}
        </div>
      </div>

      <Card>
        <Table>
          <TableHeader><TableRow className="bg-muted/50">
            <TableHead>Vendedor</TableHead><TableHead className="text-center">Vendas</TableHead>
            <TableHead className="text-right">Valor Vendido</TableHead><TableHead className="text-center">Comissão %</TableHead>
            <TableHead className="text-right">Comissão R$</TableHead>{!readOnly && <TableHead className="w-12"></TableHead>}
          </TableRow></TableHeader>
          <TableBody>
            {dadosComissao.map((d, i) => (
              <TableRow key={i}>
                <TableCell className="text-sm font-medium">{d.vendedor}</TableCell>
                <TableCell className="text-center text-sm">{d.vendas}</TableCell>
                <TableCell className="text-right text-sm">{formatCurrency(d.valor)}</TableCell>
                <TableCell className="text-center"><Badge variant="outline">{d.percentual}%</Badge></TableCell>
                <TableCell className="text-right text-sm font-bold text-green-600">{formatCurrency(d.comissaoValor)}</TableCell>
                {!readOnly && <TableCell></TableCell>}
              </TableRow>
            ))}
            {dadosComissao.length === 0 && <TableRow><TableCell colSpan={readOnly ? 5 : 6} className="text-center py-8 text-muted-foreground">Nenhuma venda registrada.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </Card>

      {/* Cadastro de comissões */}
      <div>
        <h4 className="text-sm font-medium mb-2">Tabela de Comissões</h4>
        <div className="flex flex-wrap gap-2">
          {comissoes.map(c => (
            <Card key={c.id} className="p-2 px-3 flex items-center gap-2">
              <span className="text-sm">{c.vendedor}</span>
              <Badge variant="outline">{c.percentual}%</Badge>
              {!c.ativo && <Badge variant="secondary" className="text-xs">Inativo</Badge>}
              {!readOnly && <Button variant="ghost" size="icon" className="h-5 w-5 text-red-500" onClick={() => deleteMut.mutate(c.id)}><Trash2 className="w-3 h-3" /></Button>}
            </Card>
          ))}
          {comissoes.length === 0 && <p className="text-xs text-muted-foreground">Nenhuma comissão cadastrada.</p>}
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Nova Comissão</DialogTitle></DialogHeader>
          <form onSubmit={salvar} className="space-y-3">
            <div><Label>Vendedor *</Label><Input value={form.vendedor} onChange={e => setForm({ ...form, vendedor: e.target.value })} required /></div>
            <div><Label>Percentual (%) *</Label><Input type="number" step="0.1" value={form.percentual} onChange={e => setForm({ ...form, percentual: e.target.value })} required /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Início</Label><Input type="date" value={form.data_inicio} onChange={e => setForm({ ...form, data_inicio: e.target.value })} /></div>
              <div><Label>Fim</Label><Input type="date" value={form.data_fim} onChange={e => setForm({ ...form, data_fim: e.target.value })} /></div>
            </div>
            <div className="flex justify-end gap-2 pt-2"><Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button><Button type="submit">Salvar</Button></div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}