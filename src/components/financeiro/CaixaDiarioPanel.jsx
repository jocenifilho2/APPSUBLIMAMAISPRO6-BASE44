import React, { useState } from 'react';
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
import { Wallet, Plus, Lock, ArrowDownCircle, ArrowUpCircle, Download } from 'lucide-react';
import { formatCurrency, formatDate, exportarCSV } from '@/lib/financeiro-helpers';
import { registrarLog } from '@/lib/audit-log';

const TIPO_MOV = {
  ENTRADA: { label: 'Entrada', icon: ArrowUpCircle, color: 'text-green-600' },
  SAIDA: { label: 'Saída', icon: ArrowDownCircle, color: 'text-red-600' },
  SANGRIA: { label: 'Sangria', icon: ArrowDownCircle, color: 'text-orange-600' },
  SUPRIMENTO: { label: 'Suprimento', icon: ArrowUpCircle, color: 'text-blue-600' },
};

export default function CaixaDiarioPanel({ readOnly = false }) {
  const queryClient = useQueryClient();
  const [movOpen, setMovOpen] = useState(false);
  const [fecharOpen, setFecharOpen] = useState(false);
  const [valorInicial, setValorInicial] = useState(0);
  const [movForm, setMovForm] = useState({ tipo: 'ENTRADA', valor: 0, descricao: '' });
  const [fecharValor, setFecharValor] = useState(0);

  const { data: caixas = [] } = useQuery({
    queryKey: ['caixas-diario'],
    queryFn: () => base44.entities.CaixaDiario.list('-data', 30),
    refetchInterval: 10000
  });

  const caixaAberto = caixas.find(c => c.status === 'ABERTO');

  const { data: movimentos = [] } = useQuery({
    queryKey: ['movimentos-caixa', caixaAberto?.id],
    queryFn: () => caixaAberto ? base44.entities.MovimentoCaixa.filter({ caixa_id: caixaAberto.id }) : [],
    enabled: !!caixaAberto,
    refetchInterval: 5000
  });

  const abrirCaixaMut = useMutation({
    mutationFn: (data) => base44.entities.CaixaDiario.create(data),
    onSuccess: (_res, data) => { queryClient.invalidateQueries({ queryKey: ['caixas-diario'] }); registrarLog({ acao: 'ABRIR_CAIXA', entidade: 'CaixaDiario', detalhes: `Caixa aberto: ${formatCurrency(data.valor_inicial)}` }); }
  });

  const fecharCaixaMut = useMutation({
    mutationFn: ({ id, data }) => base44.entities.CaixaDiario.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['caixas-diario'] }); registrarLog({ acao: 'FECHAR_CAIXA', entidade: 'CaixaDiario', detalhes: `Caixa fechado` }); }
  });

  const addMovMut = useMutation({
    mutationFn: (data) => base44.entities.MovimentoCaixa.create(data),
    onSuccess: (_res, data) => { queryClient.invalidateQueries({ queryKey: ['movimentos-caixa'] }); registrarLog({ acao: 'CRIAR', entidade: 'MovimentoCaixa', detalhes: `${data.tipo}: ${formatCurrency(data.valor)}` }); }
  });

  const totalEntradas = movimentos.filter(m => m.tipo === 'ENTRADA' || m.tipo === 'SUPRIMENTO').reduce((s, m) => s + (m.valor || 0), 0);
  const totalSaidas = movimentos.filter(m => m.tipo === 'SAIDA' || m.tipo === 'SANGRIA').reduce((s, m) => s + (m.valor || 0), 0);
  const saldoCalculado = (caixaAberto?.valor_inicial || 0) + totalEntradas - totalSaidas;

  function handleAbrirCaixa(e) {
    e.preventDefault();
    abrirCaixaMut.mutate({
      data: new Date().toISOString().split('T')[0],
      valor_inicial: Number(valorInicial),
      status: 'ABERTO',
      data_abertura: new Date().toISOString(),
      usuario_abertura: ''
    });
    setValorInicial(0);
  }

  function handleAddMov(e) {
    e.preventDefault();
    if (!caixaAberto || !movForm.valor) return;
    addMovMut.mutate({
      ...movForm,
      valor: Number(movForm.valor),
      caixa_id: caixaAberto.id,
      hora: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    });
    setMovForm({ tipo: 'ENTRADA', valor: 0, descricao: '' });
    setMovOpen(false);
  }

  function handleFecharCaixa(e) {
    e.preventDefault();
    const diferenca = Number(fecharValor) - saldoCalculado;
    fecharCaixaMut.mutate({
      id: caixaAberto.id,
      data: {
        status: 'FECHADO',
        valor_fechamento: Number(fecharValor),
        valor_calculado: saldoCalculado,
        diferenca,
        data_fechamento: new Date().toISOString(),
        usuario_fechamento: ''
      }
    });
    setFecharOpen(false); setFecharValor(0);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold flex items-center gap-2"><Wallet className="w-4 h-4" />Caixa Diário</h3>
        {caixaAberto && !readOnly && (
          <Button size="sm" variant="destructive" onClick={() => { setFecharValor(saldoCalculado); setFecharOpen(true); }}><Lock className="w-4 h-4 mr-1" />Fechar Caixa</Button>
        )}
        {!caixaAberto && !readOnly && (
          <Button size="sm" onClick={() => setValorInicial(0)}><Plus className="w-4 h-4 mr-1" />Abrir Caixa</Button>
        )}
      </div>

      {caixaAberto ? (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card className="p-3"><p className="text-xs text-muted-foreground">Valor Inicial</p><p className="text-lg font-bold">{formatCurrency(caixaAberto.valor_inicial)}</p></Card>
            <Card className="p-3"><p className="text-xs text-muted-foreground">Entradas</p><p className="text-lg font-bold text-green-600">{formatCurrency(totalEntradas)}</p></Card>
            <Card className="p-3"><p className="text-xs text-muted-foreground">Saídas</p><p className="text-lg font-bold text-red-600">{formatCurrency(totalSaidas)}</p></Card>
            <Card className="p-3"><p className="text-xs text-muted-foreground">Saldo Atual</p><p className={`text-lg font-bold ${saldoCalculado >= 0 ? 'text-blue-600' : 'text-red-600'}`}>{formatCurrency(saldoCalculado)}</p></Card>
          </div>

          {!readOnly && (
            <Button size="sm" variant="outline" onClick={() => setMovOpen(true)}><Plus className="w-4 h-4 mr-1" />Nova Movimentação</Button>
          )}

          <Card>
            <Table>
              <TableHeader><TableRow className="bg-muted/50">
                <TableHead>Hora</TableHead><TableHead>Tipo</TableHead><TableHead>Descrição</TableHead><TableHead className="text-right">Valor</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {movimentos.map(m => {
                  const cfg = TIPO_MOV[m.tipo] || TIPO_MOV.SAIDA;
                  return (
                    <TableRow key={m.id}>
                      <TableCell className="text-xs">{m.hora}</TableCell>
                      <TableCell><span className={`text-xs font-medium ${cfg.color}`}>{cfg.label}</span></TableCell>
                      <TableCell className="text-sm">{m.descricao || '—'}</TableCell>
                      <TableCell className={`text-right font-medium ${(m.tipo === 'ENTRADA' || m.tipo === 'SUPRIMENTO') ? 'text-green-600' : 'text-red-600'}`}>{formatCurrency(m.valor)}</TableCell>
                    </TableRow>
                  );
                })}
                {movimentos.length === 0 && <TableRow><TableCell colSpan={4} className="text-center py-6 text-muted-foreground">Nenhuma movimentação.</TableCell></TableRow>}
              </TableBody>
            </Table>
          </Card>
        </>
      ) : (
        <Card className="p-6 text-center">
          <Wallet className="w-10 h-10 mx-auto text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground mb-4">Nenhum caixa aberto.</p>
          {!readOnly && <form onSubmit={handleAbrirCaixa} className="flex items-center justify-center gap-2">
            <Input type="number" step="0.01" placeholder="Valor inicial" value={valorInicial} onChange={e => setValorInicial(e.target.value)} className="max-w-[160px]" />
            <Button type="submit">Abrir Caixa</Button>
          </form>}
        </Card>
      )}

      {/* Histórico de caixas */}
      <div>
        <h4 className="text-sm font-medium mb-2">Histórico (últimos 30 dias)</h4>
        <Card>
          <Table>
            <TableHeader><TableRow className="bg-muted/50">
              <TableHead>Data</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Inicial</TableHead><TableHead className="text-right">Calculado</TableHead><TableHead className="text-right">Fechado</TableHead><TableHead className="text-right">Diferença</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {caixas.slice(0, 10).map(c => (
                <TableRow key={c.id}>
                  <TableCell className="text-xs">{formatDate(c.data)}</TableCell>
                  <TableCell><Badge variant={c.status === 'ABERTO' ? 'default' : 'secondary'} className="text-xs">{c.status}</Badge></TableCell>
                  <TableCell className="text-right text-xs">{formatCurrency(c.valor_inicial)}</TableCell>
                  <TableCell className="text-right text-xs">{formatCurrency(c.valor_calculado)}</TableCell>
                  <TableCell className="text-right text-xs">{formatCurrency(c.valor_fechamento)}</TableCell>
                  <TableCell className={`text-right text-xs font-medium ${(c.diferenca || 0) === 0 ? 'text-muted-foreground' : (c.diferenca || 0) > 0 ? 'text-green-600' : 'text-red-600'}`}>{formatCurrency(c.diferenca)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </div>

      {/* Dialog nova movimentação */}
      <Dialog open={movOpen} onOpenChange={setMovOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Nova Movimentação</DialogTitle></DialogHeader>
          <form onSubmit={handleAddMov} className="space-y-3">
            <div><Label>Tipo</Label>
              <Select value={movForm.tipo} onValueChange={v => setMovForm({ ...movForm, tipo: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(TIPO_MOV).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Valor *</Label><Input type="number" step="0.01" value={movForm.valor} onChange={e => setMovForm({ ...movForm, valor: e.target.value })} required /></div>
            <div><Label>Descrição</Label><Input value={movForm.descricao} onChange={e => setMovForm({ ...movForm, descricao: e.target.value })} /></div>
            <div className="flex justify-end gap-2 pt-2"><Button type="button" variant="outline" onClick={() => setMovOpen(false)}>Cancelar</Button><Button type="submit">Registrar</Button></div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog fechar caixa */}
      <Dialog open={fecharOpen} onOpenChange={setFecharOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Fechamento de Caixa</DialogTitle></DialogHeader>
          <form onSubmit={handleFecharCaixa} className="space-y-3">
            <div className="bg-muted/50 rounded-lg p-3 space-y-1 text-sm">
              <div className="flex justify-between"><span>Saldo calculado:</span><span className="font-bold">{formatCurrency(saldoCalculado)}</span></div>
            </div>
            <div><Label>Valor físico contado *</Label><Input type="number" step="0.01" value={fecharValor} onChange={e => setFecharValor(e.target.value)} required /></div>
            <p className="text-xs text-muted-foreground">Diferença: <span className={`font-medium ${Number(fecharValor) - saldoCalculado === 0 ? '' : Number(fecharValor) - saldoCalculado > 0 ? 'text-green-600' : 'text-red-600'}`}>{formatCurrency(Number(fecharValor) - saldoCalculado)}</span></p>
            <div className="flex justify-end gap-2 pt-2"><Button type="button" variant="outline" onClick={() => setFecharOpen(false)}>Cancelar</Button><Button type="submit" variant="destructive">Confirmar Fechamento</Button></div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}