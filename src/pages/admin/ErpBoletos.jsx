import React, { useMemo, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Receipt, Plus, Printer, CheckCircle2, Ban, AlertTriangle, Search } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { proximoNossoNumero, calcularEncargos, statusEfetivo } from '@/lib/boleto-helpers';
import BoletoDoc from '@/components/financeiro/BoletoDoc';

const statusColor = {
  EMITIDO: 'bg-blue-100 text-blue-700',
  VENCIDO: 'bg-red-100 text-red-700',
  PAGO: 'bg-green-100 text-green-700',
  CANCELADO: 'bg-gray-100 text-gray-600',
};

function hojeISO() {
  return new Date().toISOString().slice(0, 10);
}

function vencimentoPadrao(dias = 7) {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  return d.toISOString().slice(0, 10);
}

const FORM_VAZIO = {
  cliente: '',
  cliente_documento: '',
  valor_original: '',
  data_vencimento: vencimentoPadrao(),
  instrucoes: '',
  observacoes: '',
  pedido_id: '',
};

export default function ErpBoletos() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [novoOpen, setNovoOpen] = useState(false);
  const [form, setForm] = useState(FORM_VAZIO);
  const [statusFilter, setStatusFilter] = useState('TODOS');
  const [busca, setBusca] = useState('');
  const [docBoleto, setDocBoleto] = useState(null);
  const [pagamentoAlvo, setPagamentoAlvo] = useState(null);
  const [valorPago, setValorPago] = useState('');
  const [cancelamentoAlvo, setCancelamentoAlvo] = useState(null);

  const { data: boletos = [] } = useQuery({
    queryKey: ['boletos'],
    queryFn: () => base44.entities.Boleto.list('-data_vencimento', 2000),
  });

  const criarMut = useMutation({
    mutationFn: async (dados) => {
      const valor = Number(dados.valor_original) || 0;
      const nossoNumero = proximoNossoNumero(boletos);

      // Cria a conta a receber correspondente para fechar o ciclo com
      // Conciliação Bancária e DRE (nasce PENDENTE, mesma data de vencimento).
      const conta = await base44.entities.ContaFinanceira.create({
        tipo: 'RECEITA',
        descricao: `Cobrança — ${dados.cliente}`,
        valor,
        data_vencimento: dados.data_vencimento,
        status: 'PENDENTE',
        categoria: 'Boleto/Cobrança',
        referencia: `Boleto ${nossoNumero}`,
        grupo_dre: 'OUTRAS_RECEITAS',
      });

      return base44.entities.Boleto.create({
        ...dados,
        valor_original: valor,
        nosso_numero: nossoNumero,
        data_emissao: hojeISO(),
        status: 'EMITIDO',
        conta_financeira_id: conta.id,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['boletos'] });
      queryClient.invalidateQueries({ queryKey: ['contas_fin'] });
      setNovoOpen(false);
      setForm(FORM_VAZIO);
      toast({ title: 'Cobrança emitida!', description: 'Conta a receber criada e vinculada automaticamente.' });
    },
  });

  const pagarMut = useMutation({
    mutationFn: async ({ boleto, valor }) => {
      const hoje = hojeISO();
      await base44.entities.Boleto.update(boleto.id, {
        status: 'PAGO',
        data_pagamento: hoje,
        valor_pago: valor,
      });
      if (boleto.conta_financeira_id) {
        await base44.entities.ContaFinanceira.update(boleto.conta_financeira_id, {
          status: 'PAGO',
          data_pagamento: hoje,
          valor,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['boletos'] });
      queryClient.invalidateQueries({ queryKey: ['contas_fin'] });
      setPagamentoAlvo(null);
      toast({ title: 'Baixa registrada!', description: 'Boleto e conta financeira atualizados. Pronto para conciliação bancária.' });
    },
  });

  const cancelarMut = useMutation({
    mutationFn: async (boleto) => {
      await base44.entities.Boleto.update(boleto.id, { status: 'CANCELADO' });
      if (boleto.conta_financeira_id) {
        await base44.entities.ContaFinanceira.update(boleto.conta_financeira_id, { status: 'CANCELADO' });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['boletos'] });
      queryClient.invalidateQueries({ queryKey: ['contas_fin'] });
      setCancelamentoAlvo(null);
      toast({ title: 'Cobrança cancelada.' });
    },
  });

  const boletosComStatus = useMemo(
    () => boletos.map(b => ({ ...b, _statusEfetivo: statusEfetivo(b), _encargos: calcularEncargos(b) })),
    [boletos]
  );

  const filtrados = useMemo(() => {
    return boletosComStatus.filter(b => {
      if (statusFilter !== 'TODOS' && b._statusEfetivo !== statusFilter) return false;
      if (busca && !`${b.cliente} ${b.nosso_numero}`.toLowerCase().includes(busca.toLowerCase())) return false;
      return true;
    });
  }, [boletosComStatus, statusFilter, busca]);

  const resumo = useMemo(() => {
    const abertos = boletosComStatus.filter(b => b._statusEfetivo === 'EMITIDO' || b._statusEfetivo === 'VENCIDO');
    const vencidos = boletosComStatus.filter(b => b._statusEfetivo === 'VENCIDO');
    const mesAtual = hojeISO().slice(0, 7);
    const recebidoMes = boletosComStatus
      .filter(b => b.status === 'PAGO' && (b.data_pagamento || '').startsWith(mesAtual))
      .reduce((s, b) => s + (Number(b.valor_pago) || 0), 0);
    return {
      aReceber: abertos.reduce((s, b) => s + b._encargos.valorAtualizado, 0),
      qtdVencidos: vencidos.length,
      valorVencidos: vencidos.reduce((s, b) => s + b._encargos.valorAtualizado, 0),
      recebidoMes,
    };
  }, [boletosComStatus]);

  const abrirPagamento = (boleto) => {
    setPagamentoAlvo(boleto);
    setValorPago(calcularEncargos(boleto).valorAtualizado.toFixed(2));
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-emerald-600 rounded-xl flex items-center justify-center">
            <Receipt className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-bold">Boletos / Cobranças</h2>
            <p className="text-sm text-muted-foreground">Emissão de cobranças, controle de vencimento e baixa</p>
          </div>
        </div>
        <Button onClick={() => setNovoOpen(true)}><Plus className="w-4 h-4 mr-1" />Nova Cobrança</Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-4"><p className="text-xs text-muted-foreground">A Receber (em aberto)</p><p className="text-lg font-bold text-blue-700">R$ {resumo.aReceber.toFixed(2)}</p></Card>
        <Card className="p-4"><p className="text-xs text-muted-foreground">Vencidos</p><p className="text-lg font-bold text-red-600">{resumo.qtdVencidos} · R$ {resumo.valorVencidos.toFixed(2)}</p></Card>
        <Card className="p-4"><p className="text-xs text-muted-foreground">Recebido no Mês</p><p className="text-lg font-bold text-green-700">R$ {resumo.recebidoMes.toFixed(2)}</p></Card>
        <Card className="p-4"><p className="text-xs text-muted-foreground">Total de Cobranças</p><p className="text-lg font-bold">{boletos.length}</p></Card>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-8 w-56" placeholder="Buscar cliente ou número..." value={busca} onChange={e => setBusca(e.target.value)} />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="TODOS">Todos</SelectItem>
            <SelectItem value="EMITIDO">Em aberto</SelectItem>
            <SelectItem value="VENCIDO">Vencidos</SelectItem>
            <SelectItem value="PAGO">Pagos</SelectItem>
            <SelectItem value="CANCELADO">Cancelados</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-xl border bg-card overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead>Nº</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Vencimento</TableHead>
              <TableHead>Valor Original</TableHead>
              <TableHead>Valor Atualizado</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtrados.map(b => (
              <TableRow key={b.id}>
                <TableCell className="font-medium text-xs">{b.nosso_numero}</TableCell>
                <TableCell className="text-sm">{b.cliente}</TableCell>
                <TableCell className="text-xs">{b.data_vencimento}</TableCell>
                <TableCell className="text-xs">R$ {(b.valor_original || 0).toFixed(2)}</TableCell>
                <TableCell className={`font-bold text-sm ${b._encargos.vencido ? 'text-red-600' : ''}`}>
                  R$ {(b.status === 'PAGO' ? (b.valor_pago || 0) : b._encargos.valorAtualizado).toFixed(2)}
                  {b._encargos.vencido && b.status !== 'PAGO' && <span className="block text-[10px] text-red-500 font-normal">{b._encargos.diasAtraso}d atraso</span>}
                </TableCell>
                <TableCell><Badge className={`text-xs ${statusColor[b._statusEfetivo] || ''}`}>{b._statusEfetivo}</Badge></TableCell>
                <TableCell className="text-right space-x-1 whitespace-nowrap">
                  <Button size="sm" variant="outline" onClick={() => setDocBoleto(b)}><Printer className="w-3.5 h-3.5" /></Button>
                  {b.status !== 'PAGO' && b.status !== 'CANCELADO' && (
                    <>
                      <Button size="sm" variant="outline" onClick={() => abrirPagamento(b)}><CheckCircle2 className="w-3.5 h-3.5 mr-1" />Baixar</Button>
                      <Button size="sm" variant="ghost" onClick={() => setCancelamentoAlvo(b)}><Ban className="w-3.5 h-3.5" /></Button>
                    </>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {filtrados.length === 0 && (
              <TableRow><TableCell colSpan={7} className="text-center py-10 text-muted-foreground">
                <AlertTriangle className="w-6 h-6 mx-auto mb-2 opacity-40" />
                Nenhuma cobrança encontrada.
              </TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Nova cobrança */}
      <Dialog open={novoOpen} onOpenChange={setNovoOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Nova Cobrança</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5"><Label>Cliente *</Label><Input value={form.cliente} onChange={e => setForm({ ...form, cliente: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>CPF/CNPJ</Label><Input value={form.cliente_documento} onChange={e => setForm({ ...form, cliente_documento: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Valor *</Label><Input type="number" step="0.01" value={form.valor_original} onChange={e => setForm({ ...form, valor_original: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>Vencimento *</Label><Input type="date" value={form.data_vencimento} onChange={e => setForm({ ...form, data_vencimento: e.target.value })} /></div>
            </div>
            <div className="space-y-1.5"><Label>Instruções de pagamento</Label><Textarea rows={2} placeholder="Ex: Chave PIX 00.000.000/0001-00" value={form.instrucoes} onChange={e => setForm({ ...form, instrucoes: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Observações</Label><Textarea rows={2} value={form.observacoes} onChange={e => setForm({ ...form, observacoes: e.target.value })} /></div>
            <Button
              className="w-full"
              disabled={!form.cliente || !form.valor_original || !form.data_vencimento || criarMut.isPending}
              onClick={() => criarMut.mutate(form)}
            >
              <Plus className="w-4 h-4 mr-1" />Emitir Cobrança
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Baixa de pagamento */}
      <Dialog open={!!pagamentoAlvo} onOpenChange={(v) => !v && setPagamentoAlvo(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Registrar Pagamento</DialogTitle></DialogHeader>
          {pagamentoAlvo && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">{pagamentoAlvo.cliente} — venc. {pagamentoAlvo.data_vencimento}</p>
              <div className="space-y-1.5"><Label>Valor recebido</Label><Input type="number" step="0.01" value={valorPago} onChange={e => setValorPago(e.target.value)} /></div>
              <Button className="w-full" onClick={() => pagarMut.mutate({ boleto: pagamentoAlvo, valor: Number(valorPago) || 0 })} disabled={pagarMut.isPending}>
                <CheckCircle2 className="w-4 h-4 mr-1" />Confirmar Baixa
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Cancelamento */}
      <Dialog open={!!cancelamentoAlvo} onOpenChange={(v) => !v && setCancelamentoAlvo(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Cancelar Cobrança</DialogTitle></DialogHeader>
          {cancelamentoAlvo && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">Cancelar a cobrança de <strong>{cancelamentoAlvo.cliente}</strong> (nº {cancelamentoAlvo.nosso_numero})? A conta a receber vinculada também será cancelada.</p>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setCancelamentoAlvo(null)}>Voltar</Button>
                <Button variant="destructive" className="flex-1" onClick={() => cancelarMut.mutate(cancelamentoAlvo)} disabled={cancelarMut.isPending}>Confirmar</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <BoletoDoc open={!!docBoleto} onOpenChange={(v) => !v && setDocBoleto(null)} boleto={docBoleto} />
    </div>
  );
}
