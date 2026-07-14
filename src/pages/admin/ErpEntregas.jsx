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
import { MapPin, Plus, Truck, CheckCircle, Clock, XCircle } from 'lucide-react';

const STATUS_ENTREGA = ['AGUARDANDO', 'EM_ROTA', 'ENTREGUE', 'DEVOLVIDO', 'CANCELADO'];

const statusColor = {
  AGUARDANDO: 'bg-amber-100 text-amber-700',
  EM_ROTA: 'bg-blue-100 text-blue-700',
  ENTREGUE: 'bg-green-100 text-green-700',
  DEVOLVIDO: 'bg-orange-100 text-orange-700',
  CANCELADO: 'bg-red-100 text-red-700',
};

const statusIcon = { AGUARDANDO: Clock, EM_ROTA: Truck, ENTREGUE: CheckCircle, DEVOLVIDO: XCircle, CANCELADO: XCircle };

export default function ErpEntregas() {
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState({ cliente: '', endereco: '', status: 'AGUARDANDO', data_saida: '', data_entrega_prevista: '', observacao: '' });
  const queryClient = useQueryClient();

  const { data: entregas = [] } = useQuery({
    queryKey: ['entregas'],
    queryFn: () => base44.entities.Entrega.list('-created_date', 200),
  });

  const { data: pedidos = [] } = useQuery({
    queryKey: ['pedidos'],
    queryFn: () => base44.entities.Pedido.list('-created_date', 200),
  });

  const createMut = useMutation({
    mutationFn: (data) => base44.entities.Entrega.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['entregas'] }); setFormOpen(false); setForm({ cliente: '', endereco: '', status: 'AGUARDANDO', data_saida: '', data_entrega_prevista: '', observacao: '' }); },
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Entrega.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['entregas'] }),
  });

  const aguardando = entregas.filter(e => e.status === 'AGUARDANDO').length;
  const emRota = entregas.filter(e => e.status === 'EM_ROTA').length;
  const entregue = entregas.filter(e => e.status === 'ENTREGUE').length;

  const handleSubmit = (e) => { e.preventDefault(); createMut.mutate(form); };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2"><MapPin className="w-5 h-5 text-primary" />Entregas</h2>
          <p className="text-sm text-muted-foreground">Controle e rastreamento de entregas</p>
        </div>
        <Button size="sm" onClick={() => setFormOpen(true)}><Plus className="w-4 h-4 mr-1" />Nova Entrega</Button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Card className="p-4"><div className="flex items-center gap-2"><Clock className="w-4 h-4 text-amber-500" /><div><p className="text-xs text-muted-foreground">Aguardando</p><p className="text-2xl font-bold text-amber-600">{aguardando}</p></div></div></Card>
        <Card className="p-4"><div className="flex items-center gap-2"><Truck className="w-4 h-4 text-blue-500" /><div><p className="text-xs text-muted-foreground">Em Rota</p><p className="text-2xl font-bold text-blue-600">{emRota}</p></div></div></Card>
        <Card className="p-4"><div className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-green-500" /><div><p className="text-xs text-muted-foreground">Entregues</p><p className="text-2xl font-bold text-green-600">{entregue}</p></div></div></Card>
      </div>

      <div className="rounded-xl border bg-card overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead>Cliente</TableHead>
              <TableHead>Endereço</TableHead>
              <TableHead>Previsão</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entregas.map(e => {
              const Icon = statusIcon[e.status] || Clock;
              return (
                <TableRow key={e.id}>
                  <TableCell className="font-medium text-sm">{e.cliente}</TableCell>
                  <TableCell className="text-sm">{e.endereco || '—'}</TableCell>
                  <TableCell className="text-sm">{e.data_entrega_prevista || '—'}</TableCell>
                  <TableCell>
                    <Badge className={`text-xs flex items-center gap-1 w-fit ${statusColor[e.status] || ''}`}>
                      <Icon className="w-3 h-3" />{e.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Select value={e.status} onValueChange={v => updateMut.mutate({ id: e.id, data: { status: v } })}>
                      <SelectTrigger className="h-7 text-xs w-32"><SelectValue /></SelectTrigger>
                      <SelectContent>{STATUS_ENTREGA.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                    </Select>
                  </TableCell>
                </TableRow>
              );
            })}
            {entregas.length === 0 && <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Nenhuma entrega registrada</TableCell></TableRow>}
          </TableBody>
        </Table>
      </div>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Nova Entrega</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="space-y-1.5"><Label>Cliente *</Label>
              <Select value={form.cliente} onValueChange={v => setForm({ ...form, cliente: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione um pedido..." /></SelectTrigger>
                <SelectContent>
                  {pedidos.filter(p => p.status === 'PRONTO').map(p => (
                    <SelectItem key={p.id} value={p.cliente}>{p.numero_pedido} — {p.cliente}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label>Endereço</Label><Input value={form.endereco} onChange={e => setForm({ ...form, endereco: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Saída</Label><Input type="date" value={form.data_saida} onChange={e => setForm({ ...form, data_saida: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>Previsão</Label><Input type="date" value={form.data_entrega_prevista} onChange={e => setForm({ ...form, data_entrega_prevista: e.target.value })} /></div>
            </div>
            <div className="space-y-1.5"><Label>Observação</Label><Input value={form.observacao} onChange={e => setForm({ ...form, observacao: e.target.value })} /></div>
            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>Cancelar</Button>
              <Button type="submit">Criar</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}