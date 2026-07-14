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
import { Plus, Pencil, Trash2, DollarSign, CreditCard, Layers, Download, Search } from 'lucide-react';
import { formatCurrency, formatDate, calcularParcelas, gerarParcelaGrupo, calcularSaldoRestante, calcularStatusPagamento, STATUS_CONTA_COLOR, exportarCSV } from '@/lib/financeiro-helpers';
import { registrarLog } from '@/lib/audit-log';

const TIPOS = ['RECEITA', 'DESPESA'];
const CLASSIFICACOES = ['FIXA', 'VARIAVEL'];
const FORMAS_PAG = ['PIX', 'DINHEIRO', 'CARTAO', 'TRANSFERENCIA', 'BOLETO', 'DUPLICATA', 'MISTO', 'OUTRO'];

export default function ContasAvancadasPanel({ readOnly = false, centros = [], planoContas = [] }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [pagParcialOpen, setPagParcialOpen] = useState(false);
  const [contaSel, setContaSel] = useState(null);
  const [busca, setBusca] = useState('');
  const [filtroTipo, setFiltroTipo] = useState('TODOS');
  const [filtroStatus, setFiltroStatus] = useState('TODOS');
  const [pagForm, setPagForm] = useState({ valor: 0, data_pagamento: new Date().toISOString().split('T')[0], forma_pagamento: 'PIX', observacoes: '' });

  const [form, setForm] = useState({
    tipo: 'DESPESA', descricao: '', valor: 0, data_vencimento: new Date().toISOString().split('T')[0],
    categoria: '', observacoes: '', centro_custo_id: '', centro_custo_nome: '', plano_conta_id: '',
    plano_conta_nome: '', classificacao: 'VARIAVEL', forma_pagamento: 'PIX', parcelar: false, numParcelas: 1,
    cliente: '', fornecedor: '', vendedor: ''
  });

  const { data: contas = [] } = useQuery({
    queryKey: ['contas-financeiras'],
    queryFn: () => base44.entities.ContaFinanceira.list('-data_vencimento', 500),
    refetchInterval: 10000
  });
  const { data: pagamentos = [] } = useQuery({
    queryKey: ['pagamentos-parciais'],
    queryFn: () => base44.entities.PagamentoParcial.list('-data_pagamento', 500),
    refetchInterval: 10000
  });

  const createMut = useMutation({
    mutationFn: (data) => base44.entities.ContaFinanceira.bulkCreate(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['contas-financeiras'] }); registrarLog({ acao: 'CRIAR', entidade: 'ContaFinanceira', detalhes: `Conta: ${form.descricao}` }); }
  });
  const updateMut = useMutation({
    mutationFn: ({ id, data }) => base44.entities.ContaFinanceira.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['contas-financeiras'] }); }
  });
  const deleteMut = useMutation({
    mutationFn: (id) => base44.entities.ContaFinanceira.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['contas-financeiras'] }); registrarLog({ acao: 'EXCLUIR', entidade: 'ContaFinanceira', detalhes: 'Conta excluída' }); }
  });
  const pagarMut = useMutation({
    mutationFn: async (data) => {
      await base44.entities.PagamentoParcial.create(data);
      const conta = contas.find(c => c.id === data.conta_financeira_id);
      if (conta) {
        const novoValorPago = (conta.valor_pago || 0) + data.valor;
        const novoStatus = novoValorPago >= conta.valor ? 'PAGO' : 'PAGO_PARCIAL';
        await base44.entities.ContaFinanceira.update(conta.id, { valor_pago: novoValorPago, status: novoStatus, data_pagamento: novoStatus === 'PAGO' ? data.data_pagamento : '' });
      }
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['contas-financeiras'] }); queryClient.invalidateQueries({ queryKey: ['pagamentos-parciais'] }); registrarLog({ acao: 'PAGAR', entidade: 'ContaFinanceira', detalhes: `Pagamento parcial: ${formatCurrency(pagForm.valor)}` }); }
  });

  function salvar(e) {
    e.preventDefault();
    const centro = centros.find(c => c.id === form.centro_custo_id);
    const plano = planoContas.find(c => c.id === form.plano_conta_id);
    const base = {
      ...form,
      valor: Number(form.valor),
      centro_custo_nome: centro?.nome || '',
      plano_conta_nome: plano?.nome || '',
      status: 'PENDENTE',
      valor_pago: 0
    };
    delete base.parcelar;
    delete base.numParcelas;

    if (form.parcelar && Number(form.numParcelas) > 1) {
      const grupo = gerarParcelaGrupo();
      const parcelas = calcularParcelas(Number(form.valor), Number(form.numParcelas), form.data_vencimento);
      const contas = parcelas.map(p => ({
        ...base,
        valor: p.valor,
        data_vencimento: p.vencimento,
        parcela_numero: `${p.numero}/${p.total}`,
        parcela_grupo: grupo,
        descricao: `${form.descricao} (${p.numero}/${p.total})`
      }));
      createMut.mutate(contas);
      registrarLog({ acao: 'PARCELAR', entidade: 'ContaFinanceira', detalhes: `${form.numParcelas}x de ${formatCurrency(form.valor / form.numParcelas)}` });
    } else {
      createMut.mutate([base]);
    }
    setOpen(false);
    setForm({ tipo: 'DESPESA', descricao: '', valor: 0, data_vencimento: new Date().toISOString().split('T')[0], categoria: '', observacoes: '', centro_custo_id: '', centro_custo_nome: '', plano_conta_id: '', plano_conta_nome: '', classificacao: 'VARIAVEL', forma_pagamento: 'PIX', parcelar: false, numParcelas: 1, cliente: '', fornecedor: '', vendedor: '' });
  }

  function handlePagParcial(e) {
    e.preventDefault();
    pagarMut.mutate({
      conta_financeira_id: contaSel.id,
      valor: Number(pagForm.valor),
      data_pagamento: pagForm.data_pagamento,
      forma_pagamento: pagForm.forma_pagamento,
      observacoes: pagForm.observacoes
    });
    setPagParcialOpen(false);
    setPagForm({ valor: 0, data_pagamento: new Date().toISOString().split('T')[0], forma_pagamento: 'PIX', observacoes: '' });
  }

  const contasFiltradas = useMemo(() => {
    return contas.filter(c => {
      if (busca && !(c.descricao || '').toLowerCase().includes(busca.toLowerCase()) && !(c.cliente || '').toLowerCase().includes(busca.toLowerCase()) && !(c.fornecedor || '').toLowerCase().includes(busca.toLowerCase())) return false;
      if (filtroTipo !== 'TODOS' && c.tipo !== filtroTipo) return false;
      if (filtroStatus !== 'TODOS' && c.status !== filtroStatus) return false;
      return true;
    });
  }, [contas, busca, filtroTipo, filtroStatus]);

  const pagamentosConta = (contaId) => pagamentos.filter(p => p.conta_financeira_id === contaId);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold flex items-center gap-2"><DollarSign className="w-4 h-4" />Contas e Lançamentos</h3>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => exportarCSV(contasFiltradas, [
            { label: 'Descrição', key: 'descricao' }, { label: 'Tipo', key: 'tipo' },
            { label: 'Valor', key: c => c.valor?.toFixed(2) }, { label: 'Vencimento', key: 'data_vencimento' },
            { label: 'Status', key: 'status' }, { label: 'Centro Custo', key: 'centro_custo_nome' },
            { label: 'Classificação', key: 'classificacao' }, { label: 'Parcela', key: 'parcela_numero' },
            { label: 'Valor Pago', key: c => c.valor_pago?.toFixed(2) }
          ], 'contas.csv')}><Download className="w-3.5 h-3.5 mr-1" />CSV</Button>
          {!readOnly && <Button size="sm" onClick={() => { setContaSel(null); setForm({ tipo: 'DESPESA', descricao: '', valor: 0, data_vencimento: new Date().toISOString().split('T')[0], categoria: '', observacoes: '', centro_custo_id: '', centro_custo_nome: '', plano_conta_id: '', plano_conta_nome: '', classificacao: 'VARIAVEL', forma_pagamento: 'PIX', parcelar: false, numParcelas: 1, cliente: '', fornecedor: '', vendedor: '' }); setOpen(true); }}><Plus className="w-4 h-4 mr-1" />Novo Lançamento</Button>}
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        <div className="relative">
          <Search className="absolute left-2 top-2.5 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Buscar..." value={busca} onChange={e => setBusca(e.target.value)} className="pl-8 max-w-[200px]" />
        </div>
        <Select value={filtroTipo} onValueChange={setFiltroTipo}>
          <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="TODOS">Todos</SelectItem><SelectItem value="RECEITA">Receita</SelectItem><SelectItem value="DESPESA">Despesa</SelectItem></SelectContent>
        </Select>
        <Select value={filtroStatus} onValueChange={setFiltroStatus}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="TODOS">Todos</SelectItem><SelectItem value="PENDENTE">Pendente</SelectItem><SelectItem value="PAGO">Pago</SelectItem><SelectItem value="PAGO_PARCIAL">Pago Parcial</SelectItem><SelectItem value="VENCIDO">Vencido</SelectItem><SelectItem value="CANCELADO">Cancelado</SelectItem></SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-3"><p className="text-xs text-muted-foreground">A Receber</p><p className="text-sm font-bold text-green-600">{formatCurrency(contasFiltradas.filter(c => c.tipo === 'RECEITA' && c.status !== 'CANCELADO' && c.status !== 'PAGO').reduce((s, c) => s + calcularSaldoRestante(c), 0))}</p></Card>
        <Card className="p-3"><p className="text-xs text-muted-foreground">A Pagar</p><p className="text-sm font-bold text-red-600">{formatCurrency(contasFiltradas.filter(c => c.tipo === 'DESPESA' && c.status !== 'CANCELADO' && c.status !== 'PAGO').reduce((s, c) => s + calcularSaldoRestante(c), 0))}</p></Card>
        <Card className="p-3"><p className="text-xs text-muted-foreground">Recebido</p><p className="text-sm font-bold text-green-600">{formatCurrency(contasFiltradas.filter(c => c.tipo === 'RECEITA').reduce((s, c) => s + (c.valor_pago || 0), 0))}</p></Card>
        <Card className="p-3"><p className="text-xs text-muted-foreground">Pago</p><p className="text-sm font-bold text-red-600">{formatCurrency(contasFiltradas.filter(c => c.tipo === 'DESPESA').reduce((s, c) => s + (c.valor_pago || 0), 0))}</p></Card>
      </div>

      <Card>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader><TableRow className="bg-muted/50">
              <TableHead>Descrição</TableHead><TableHead>Tipo</TableHead><TableHead className="text-right">Valor</TableHead>
              <TableHead>Vencimento</TableHead><TableHead>Centro</TableHead><TableHead>Classif.</TableHead>
              <TableHead>Parcela</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Pago</TableHead>
              {!readOnly && <TableHead className="w-28">Ações</TableHead>}
            </TableRow></TableHeader>
            <TableBody>
              {contasFiltradas.slice(0, 100).map(c => {
                const saldo = calcularSaldoRestante(c);
                const status = calcularStatusPagamento(c);
                return (
                  <TableRow key={c.id}>
                    <TableCell className="text-sm font-medium">{c.descricao}{c.cliente ? ` — ${c.cliente}` : ''}{c.fornecedor ? ` — ${c.fornecedor}` : ''}</TableCell>
                    <TableCell><Badge variant={c.tipo === 'RECEITA' ? 'default' : 'secondary'} className="text-xs">{c.tipo}</Badge></TableCell>
                    <TableCell className="text-right text-sm">{formatCurrency(c.valor)}</TableCell>
                    <TableCell className="text-xs">{formatDate(c.data_vencimento)}</TableCell>
                    <TableCell className="text-xs">{c.centro_custo_nome || '—'}</TableCell>
                    <TableCell><Badge variant="outline" className="text-xs">{c.classificacao || '—'}</Badge></TableCell>
                    <TableCell className="text-xs">{c.parcela_numero || '—'}</TableCell>
                    <TableCell><Badge className={`text-xs ${STATUS_CONTA_COLOR[status] || ''}`}>{status}</Badge></TableCell>
                    <TableCell className="text-right text-xs">{formatCurrency(c.valor_pago || 0)}{saldo > 0.01 && <span className="text-red-500 block">Saldo: {formatCurrency(saldo)}</span>}</TableCell>
                    {!readOnly && <TableCell>
                      <div className="flex gap-1">
                        {saldo > 0.01 && c.status !== 'CANCELADO' && <Button variant="ghost" size="icon" className="h-6 w-6 text-green-600" title="Pagamento parcial" onClick={() => { setContaSel(c); setPagForm({ ...pagForm, valor: saldo }); setPagParcialOpen(true); }}><CreditCard className="w-3 h-3" /></Button>}
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => { setContaSel(c); setForm(c); setOpen(true); }}><Pencil className="w-3 h-3" /></Button>
                        <Button variant="ghost" size="icon" className="h-6 w-6 text-red-500" onClick={() => deleteMut.mutate(c.id)}><Trash2 className="w-3 h-3" /></Button>
                      </div>
                    </TableCell>}
                  </TableRow>
                );
              })}
              {contasFiltradas.length === 0 && <TableRow><TableCell colSpan={readOnly ? 9 : 10} className="text-center py-8 text-muted-foreground">Nenhum lançamento.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </div>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{contaSel ? 'Editar' : 'Novo'} Lançamento</DialogTitle></DialogHeader>
          <form onSubmit={salvar} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Tipo *</Label>
                <Select value={form.tipo} onValueChange={v => setForm({ ...form, tipo: v })} disabled={!!contaSel}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{TIPOS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Valor *</Label><Input type="number" step="0.01" value={form.valor} onChange={e => setForm({ ...form, valor: e.target.value })} required disabled={!!contaSel} /></div>
            </div>
            <div><Label>Descrição *</Label><Input value={form.descricao} onChange={e => setForm({ ...form, descricao: e.target.value })} required /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Vencimento *</Label><Input type="date" value={form.data_vencimento} onChange={e => setForm({ ...form, data_vencimento: e.target.value })} required /></div>
              <div><Label>Forma Pagamento</Label>
                <Select value={form.forma_pagamento} onValueChange={v => setForm({ ...form, forma_pagamento: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{FORMAS_PAG.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Centro de Custo</Label>
                <Select value={form.centro_custo_id} onValueChange={v => setForm({ ...form, centro_custo_id: v })}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>{centros.map(c => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Plano de Contas</Label>
                <Select value={form.plano_conta_id} onValueChange={v => setForm({ ...form, plano_conta_id: v })}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>{planoContas.map(c => <SelectItem key={c.id} value={c.id}>{c.codigo} - {c.nome}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Classificação</Label>
                <Select value={form.classificacao} onValueChange={v => setForm({ ...form, classificacao: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{CLASSIFICACOES.map(c => <SelectItem key={c} value={c}>{c === 'FIXA' ? 'Fixa' : 'Variável'}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Categoria</Label><Input value={form.categoria} onChange={e => setForm({ ...form, categoria: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Cliente</Label><Input value={form.cliente} onChange={e => setForm({ ...form, cliente: e.target.value })} /></div>
              <div><Label>Fornecedor</Label><Input value={form.fornecedor} onChange={e => setForm({ ...form, fornecedor: e.target.value })} /></div>
            </div>
            {!contaSel && (
              <div className="border rounded-lg p-3 space-y-2 bg-muted/30">
                <label className="flex items-center gap-2 text-sm font-medium">
                  <input type="checkbox" checked={form.parcelar} onChange={e => setForm({ ...form, parcelar: e.target.checked })} className="rounded" />
                  <Layers className="w-4 h-4" /> Parcelar em vezes
                </label>
                {form.parcelar && (
                  <div><Label>Número de Parcelas</Label>
                    <Select value={String(form.numParcelas)} onValueChange={v => setForm({ ...form, numParcelas: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{Array.from({ length: 60 }, (_, i) => i + 1).map(n => <SelectItem key={n} value={String(n)}>{n}x</SelectItem>)}</SelectContent>
                    </Select>
                    {form.valor > 0 && form.numParcelas > 0 && <p className="text-xs text-muted-foreground mt-1">{form.numParcelas}x de {formatCurrency(form.valor / form.numParcelas)}</p>}
                  </div>
                )}
              </div>
            )}
            <div><Label>Observações</Label><Input value={form.observacoes} onChange={e => setForm({ ...form, observacoes: e.target.value })} /></div>
            <div className="flex justify-end gap-2 pt-2"><Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button><Button type="submit">Salvar</Button></div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={pagParcialOpen} onOpenChange={setPagParcialOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Pagamento Parcial</DialogTitle></DialogHeader>
          {contaSel && (
            <div className="bg-muted/50 rounded-lg p-3 mb-3 text-sm space-y-1">
              <div className="flex justify-between"><span className="text-muted-foreground">Conta:</span><span className="font-medium">{contaSel.descricao}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Valor Total:</span><span className="font-medium">{formatCurrency(contaSel.valor)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Já Pago:</span><span className="font-medium">{formatCurrency(contaSel.valor_pago || 0)}</span></div>
              <div className="flex justify-between border-t pt-1"><span className="text-muted-foreground">Saldo:</span><span className="font-bold text-red-600">{formatCurrency(calcularSaldoRestante(contaSel))}</span></div>
            </div>
          )}
          <form onSubmit={handlePagParcial} className="space-y-3">
            <div><Label>Valor do Pagamento *</Label><Input type="number" step="0.01" value={pagForm.valor} onChange={e => setPagForm({ ...pagForm, valor: e.target.value })} required /></div>
            <div><Label>Data *</Label><Input type="date" value={pagForm.data_pagamento} onChange={e => setPagForm({ ...pagForm, data_pagamento: e.target.value })} required /></div>
            <div><Label>Forma</Label>
              <Select value={pagForm.forma_pagamento} onValueChange={v => setPagForm({ ...pagForm, forma_pagamento: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{FORMAS_PAG.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Observações</Label><Input value={pagForm.observacoes} onChange={e => setPagForm({ ...pagForm, observacoes: e.target.value })} /></div>
            {contaSel && pagamentosConta(contaSel.id).length > 0 && (
              <div className="border rounded-lg p-2 max-h-32 overflow-y-auto">
                <p className="text-xs font-medium mb-1">Histórico de Pagamentos</p>
                {pagamentosConta(contaSel.id).map(p => (
                  <div key={p.id} className="flex justify-between text-xs py-0.5">
                    <span>{formatDate(p.data_pagamento)} — {p.forma_pagamento}</span>
                    <span className="font-medium text-green-600">{formatCurrency(p.valor)}</span>
                  </div>
                ))}
              </div>
            )}
            <div className="flex justify-end gap-2 pt-2"><Button type="button" variant="outline" onClick={() => setPagParcialOpen(false)}>Cancelar</Button><Button type="submit">Registrar Pagamento</Button></div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}