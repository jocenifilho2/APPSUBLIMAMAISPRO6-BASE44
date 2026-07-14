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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Upload, Link2, CheckCircle, AlertCircle, Download } from 'lucide-react';
import { formatCurrency, formatDate, exportarCSV } from '@/lib/financeiro-helpers';
import { registrarLog } from '@/lib/audit-log';

export default function ConciliacaoPanel({ readOnly = false }) {
  const queryClient = useQueryClient();
  const [conciliarOpen, setConciliarOpen] = useState(false);
  const [extratoSel, setExtratoSel] = useState(null);
  const [contaSelId, setContaSelId] = useState('');

  const { data: extratos = [] } = useQuery({
    queryKey: ['extratos-bancarios'],
    queryFn: () => base44.entities.ExtratoBancario.list('-data', 500),
    refetchInterval: 15000
  });
  const { data: contas = [] } = useQuery({
    queryKey: ['contas-financeiras'],
    queryFn: () => base44.entities.ContaFinanceira.filter({ status: 'PENDENTE' }, '-data_vencimento', 200),
    refetchInterval: 15000
  });

  const conciliarMut = useMutation({
    mutationFn: async ({ extratoId, contaId }) => {
      await base44.entities.ExtratoBancario.update(extratoId, { status_conciliacao: 'CONCILIADO', conta_financeira_id: contaId });
      const conta = contas.find(c => c.id === contaId);
      if (conta) {
        await base44.entities.ContaFinanceira.update(contaId, { status: 'PAGO', data_pagamento: new Date().toISOString().split('T')[0], valor_pago: conta.valor });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['extratos-bancarios'] });
      queryClient.invalidateQueries({ queryKey: ['contas-financeiras'] });
      registrarLog({ acao: 'OUTRO', entidade: 'ExtratoBancario', detalhes: 'Conciliação bancária manual' });
    }
  });

  const ignorarMut = useMutation({
    mutationFn: (id) => base44.entities.ExtratoBancario.update(id, { status_conciliacao: 'IGNORADO' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['extratos-bancarios'] })
  });

  function handleImportarCSV(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (evt) => {
      const texto = evt.target.result;
      const linhas = texto.split('\n').filter(l => l.trim());
      const registros = [];
      for (let i = 1; i < linhas.length; i++) {
        const cols = linhas[i].split(';').map(c => c.replace(/^"|"$/g, '').trim());
        if (cols.length < 3) continue;
        const data = cols[0];
        const descricao = cols[1];
        const valor = parseFloat(cols[2].replace(',', '.'));
        if (!data || !descricao || isNaN(valor)) continue;
        const hash = `${data}|${valor}|${descricao}`.substr(0, 100);
        registros.push({
          data, descricao, valor,
          tipo: valor >= 0 ? 'CREDITO' : 'DEBITO',
          status_conciliacao: 'PENDENTE',
          hash_unico: hash,
          origem_importacao: file.name
        });
      }
      if (registros.length > 0) {
        try {
          await base44.entities.ExtratoBancario.bulkCreate(registros);
          queryClient.invalidateQueries({ queryKey: ['extratos-bancarios'] });
          registrarLog({ acao: 'CRIAR', entidade: 'ExtratoBancario', detalhes: `Importação CSV: ${registros.length} registros` });
        } catch (err) { console.error(err); }
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  const stats = useMemo(() => {
    const conciliado = extratos.filter(e => e.status_conciliacao === 'CONCILIADO').length;
    const pendente = extratos.filter(e => e.status_conciliacao === 'PENDENTE').length;
    const divergente = extratos.filter(e => e.status_conciliacao === 'DIVERGENTE').length;
    return { conciliado, pendente, divergente, total: extratos.length };
  }, [extratos]);

  const STATUS_COLOR = {
    PENDENTE: 'bg-amber-100 text-amber-700',
    CONCILIADO: 'bg-green-100 text-green-700',
    DIVERGENTE: 'bg-red-100 text-red-700',
    IGNORADO: 'bg-gray-100 text-gray-500',
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Conciliação Bancária Manual</h3>
        {!readOnly && (
          <label>
            <Button size="sm" asChild><span><Upload className="w-4 h-4 mr-1" />Importar CSV/OFX</span></Button>
            <input type="file" accept=".csv,.ofx,.txt" className="hidden" onChange={handleImportarCSV} />
          </label>
        )}
      </div>

      <div className="grid grid-cols-4 gap-3">
        <Card className="p-3"><p className="text-xs text-muted-foreground">Total</p><p className="text-lg font-bold">{stats.total}</p></Card>
        <Card className="p-3"><p className="text-xs text-muted-foreground">Conciliado</p><p className="text-lg font-bold text-green-600">{stats.conciliado}</p></Card>
        <Card className="p-3"><p className="text-xs text-muted-foreground">Pendente</p><p className="text-lg font-bold text-amber-600">{stats.pendente}</p></Card>
        <Card className="p-3"><p className="text-xs text-muted-foreground">Divergente</p><p className="text-lg font-bold text-red-600">{stats.divergente}</p></Card>
      </div>

      <Card>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader><TableRow className="bg-muted/50">
              <TableHead>Data</TableHead><TableHead>Descrição</TableHead><TableHead className="text-right">Valor</TableHead>
              <TableHead>Status</TableHead><TableHead>Conta Vinculada</TableHead>{!readOnly && <TableHead className="w-24">Ações</TableHead>}
            </TableRow></TableHeader>
            <TableBody>
              {extratos.slice(0, 100).map(ex => (
                <TableRow key={ex.id}>
                  <TableCell className="text-xs">{formatDate(ex.data)}</TableCell>
                  <TableCell className="text-sm">{ex.descricao}</TableCell>
                  <TableCell className={`text-right text-sm font-medium ${(ex.valor || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatCurrency(ex.valor)}</TableCell>
                  <TableCell><Badge className={`text-xs ${STATUS_COLOR[ex.status_conciliacao] || ''}`}>{ex.status_conciliacao}</Badge></TableCell>
                  <TableCell className="text-xs">{ex.conta_financeira_id ? 'Vinculada' : '—'}</TableCell>
                  {!readOnly && <TableCell>
                    {ex.status_conciliacao === 'PENDENTE' && (
                      <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => { setExtratoSel(ex); setContaSelId(''); setConciliarOpen(true); }}><Link2 className="w-3 h-3 mr-1" />Vincular</Button>
                    )}
                    {ex.status_conciliacao !== 'IGNORADO' && ex.status_conciliacao !== 'CONCILIADO' && (
                      <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground" onClick={() => ignorarMut.mutate(ex.id)}>Ignorar</Button>
                    )}
                  </TableCell>}
                </TableRow>
              ))}
              {extratos.length === 0 && <TableRow><TableCell colSpan={readOnly ? 5 : 6} className="text-center py-8 text-muted-foreground">Nenhum lançamento importado.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </div>
      </Card>

      <Dialog open={conciliarOpen} onOpenChange={setConciliarOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Vincular a Conta do Sistema</DialogTitle></DialogHeader>
          {extratoSel && (
            <div className="bg-muted/50 rounded-lg p-3 mb-3 text-sm space-y-1">
              <div><span className="text-muted-foreground">Data:</span> {formatDate(extratoSel.data)}</div>
              <div><span className="text-muted-foreground">Descrição:</span> {extratoSel.descricao}</div>
              <div><span className="text-muted-foreground">Valor:</span> <span className="font-bold">{formatCurrency(extratoSel.valor)}</span></div>
            </div>
          )}
          <div className="space-y-3">
            <div><Label>Conta do Sistema</Label>
              <Select value={contaSelId} onValueChange={setContaSelId}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {contas.filter(c => Math.abs((c.valor || 0) - Math.abs(extratoSel?.valor || 0)) < 1 || true).slice(0, 50).map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.descricao} — {formatCurrency(c.valor)} ({formatDate(c.data_vencimento)})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setConciliarOpen(false)}>Cancelar</Button>
              <Button disabled={!contaSelId} onClick={() => { conciliarMut.mutate({ extratoId: extratoSel.id, contaId: contaSelId }); setConciliarOpen(false); }}>Confirmar Conciliação</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}