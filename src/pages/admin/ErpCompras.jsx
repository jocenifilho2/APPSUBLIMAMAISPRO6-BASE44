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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Truck, Plus, Package, Building2, Trash2, CheckCircle } from 'lucide-react';
import { useMutation as useM } from '@tanstack/react-query';
import { useToast } from '@/components/ui/use-toast';

const STATUS_COMPRA = ['PEDIDO', 'CONFIRMADO', 'EM_TRANSITO', 'RECEBIDO', 'CANCELADO'];

export default function ErpCompras() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [compraOpen, setCompraOpen] = useState(false);
  const [fornecedorOpen, setFornecedorOpen] = useState(false);
  const [compraForm, setCompraForm] = useState({ fornecedor_nome: '', status: 'PEDIDO', data_pedido: new Date().toISOString().split('T')[0], data_previsao: '', observacoes: '', valor_total: 0 });
  const [fornForm, setFornForm] = useState({ nome: '', cnpj: '', telefone: '', email: '', cidade: '' });

  const { data: compras = [] } = useQuery({ queryKey: ['compras'], queryFn: () => base44.entities.Compra.list('-created_date', 200) });
  const { data: fornecedores = [] } = useQuery({ queryKey: ['fornecedores'], queryFn: () => base44.entities.Fornecedor.list() });
  const { data: produtos = [] } = useQuery({ queryKey: ['produtos'], queryFn: () => base44.entities.Produto.list() });

  const createCompraMut = useMutation({
    mutationFn: (data) => base44.entities.Compra.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['compras'] }); setCompraOpen(false); },
  });

  const createFornMut = useMutation({
    mutationFn: (data) => base44.entities.Fornecedor.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['fornecedores'] }); setFornecedorOpen(false); setFornForm({ nome: '', cnpj: '', telefone: '', email: '', cidade: '' }); },
  });

  const updateCompraMut = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Compra.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['compras'] }),
  });

  const handleCompraSubmit = (e) => { e.preventDefault(); createCompraMut.mutate(compraForm); };
  const handleFornSubmit = (e) => { e.preventDefault(); createFornMut.mutate(fornForm); };

  const receberCompra = (compra) => {
    updateCompraMut.mutate({ id: compra.id, data: { status: 'RECEBIDO' } });
    toast({ title: 'Compra recebida!', description: 'Estoque será atualizado via movimentação manual.' });
  };

  const statusColor = {
    PEDIDO: 'bg-blue-100 text-blue-700',
    CONFIRMADO: 'bg-purple-100 text-purple-700',
    EM_TRANSITO: 'bg-amber-100 text-amber-700',
    RECEBIDO: 'bg-green-100 text-green-700',
    CANCELADO: 'bg-red-100 text-red-700',
  };

  const totalPedidos = compras.filter(c => c.status !== 'CANCELADO').reduce((s, c) => s + (c.valor_total || 0), 0);
  const emTransito = compras.filter(c => c.status === 'EM_TRANSITO').length;
  const pendentes = compras.filter(c => ['PEDIDO', 'CONFIRMADO'].includes(c.status)).length;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2"><Truck className="w-5 h-5 text-primary" />Compras e Fornecedores</h2>
          <p className="text-sm text-muted-foreground">Gestão de pedidos de compra e fornecedores</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setFornecedorOpen(true)}><Building2 className="w-4 h-4 mr-1" />Fornecedor</Button>
          <Button size="sm" onClick={() => setCompraOpen(true)}><Plus className="w-4 h-4 mr-1" />Nova Compra</Button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Card className="p-4"><p className="text-xs text-muted-foreground">Total Investido</p><p className="text-xl font-bold text-red-600">R$ {totalPedidos.toFixed(2)}</p></Card>
        <Card className="p-4"><p className="text-xs text-muted-foreground">Em Trânsito</p><p className="text-xl font-bold text-amber-600">{emTransito}</p></Card>
        <Card className="p-4"><p className="text-xs text-muted-foreground">Pendentes</p><p className="text-xl font-bold text-blue-600">{pendentes}</p></Card>
      </div>

      <Tabs defaultValue="compras">
        <TabsList>
          <TabsTrigger value="compras"><Package className="w-4 h-4 mr-1" />Compras ({compras.length})</TabsTrigger>
          <TabsTrigger value="fornecedores"><Building2 className="w-4 h-4 mr-1" />Fornecedores ({fornecedores.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="compras" className="mt-4">
          <div className="rounded-xl border bg-card overflow-x-auto">
            <Table>
              <TableHeader><TableRow className="bg-muted/50">
                <TableHead>Fornecedor</TableHead>
                <TableHead>Data Pedido</TableHead>
                <TableHead>Previsão</TableHead>
                <TableHead>Valor Total</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Ações</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {compras.map(c => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium text-sm">{c.fornecedor_nome}</TableCell>
                    <TableCell className="text-sm">{c.data_pedido || '—'}</TableCell>
                    <TableCell className="text-sm">{c.data_previsao || '—'}</TableCell>
                    <TableCell className="font-bold text-red-600">R$ {(c.valor_total || 0).toFixed(2)}</TableCell>
                    <TableCell>
                      <Select value={c.status} onValueChange={v => updateCompraMut.mutate({ id: c.id, data: { status: v } })}>
                        <SelectTrigger className="h-7 text-xs w-32"><SelectValue /></SelectTrigger>
                        <SelectContent>{STATUS_COMPRA.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      {c.status === 'EM_TRANSITO' && (
                        <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => receberCompra(c)}>
                          <CheckCircle className="w-3 h-3 mr-1" />Receber
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {compras.length === 0 && <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Nenhuma compra registrada</TableCell></TableRow>}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="fornecedores" className="mt-4">
          <div className="rounded-xl border bg-card overflow-x-auto">
            <Table>
              <TableHeader><TableRow className="bg-muted/50">
                <TableHead>Nome</TableHead>
                <TableHead>CNPJ</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Cidade</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {fornecedores.map(f => (
                  <TableRow key={f.id}>
                    <TableCell className="font-medium">{f.nome}</TableCell>
                    <TableCell className="text-sm">{f.cnpj || '—'}</TableCell>
                    <TableCell className="text-sm">{f.telefone || '—'}</TableCell>
                    <TableCell className="text-sm">{f.email || '—'}</TableCell>
                    <TableCell className="text-sm">{f.cidade || '—'}</TableCell>
                  </TableRow>
                ))}
                {fornecedores.length === 0 && <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Nenhum fornecedor cadastrado</TableCell></TableRow>}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>

      {/* Nova Compra */}
      <Dialog open={compraOpen} onOpenChange={setCompraOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Nova Ordem de Compra</DialogTitle></DialogHeader>
          <form onSubmit={handleCompraSubmit} className="space-y-3">
            <div className="space-y-1.5"><Label>Fornecedor *</Label>
              <Select value={compraForm.fornecedor_nome} onValueChange={v => setCompraForm({ ...compraForm, fornecedor_nome: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>{fornecedores.map(f => <SelectItem key={f.id} value={f.nome}>{f.nome}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Data Pedido</Label><Input type="date" value={compraForm.data_pedido} onChange={e => setCompraForm({ ...compraForm, data_pedido: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>Previsão Chegada</Label><Input type="date" value={compraForm.data_previsao} onChange={e => setCompraForm({ ...compraForm, data_previsao: e.target.value })} /></div>
            </div>
            <div className="space-y-1.5"><Label>Valor Total (R$)</Label><Input type="number" step="0.01" value={compraForm.valor_total} onChange={e => setCompraForm({ ...compraForm, valor_total: parseFloat(e.target.value) || 0 })} /></div>
            <div className="space-y-1.5"><Label>Observações</Label><Input value={compraForm.observacoes} onChange={e => setCompraForm({ ...compraForm, observacoes: e.target.value })} /></div>
            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => setCompraOpen(false)}>Cancelar</Button>
              <Button type="submit">Criar Pedido</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Novo Fornecedor */}
      <Dialog open={fornecedorOpen} onOpenChange={setFornecedorOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Novo Fornecedor</DialogTitle></DialogHeader>
          <form onSubmit={handleFornSubmit} className="space-y-3">
            <div className="space-y-1.5"><Label>Nome *</Label><Input value={fornForm.nome} onChange={e => setFornForm({ ...fornForm, nome: e.target.value })} required /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>CNPJ</Label><Input value={fornForm.cnpj} onChange={e => setFornForm({ ...fornForm, cnpj: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>Telefone</Label><Input value={fornForm.telefone} onChange={e => setFornForm({ ...fornForm, telefone: e.target.value })} /></div>
            </div>
            <div className="space-y-1.5"><Label>Email</Label><Input type="email" value={fornForm.email} onChange={e => setFornForm({ ...fornForm, email: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Cidade</Label><Input value={fornForm.cidade} onChange={e => setFornForm({ ...fornForm, cidade: e.target.value })} /></div>
            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => setFornecedorOpen(false)}>Cancelar</Button>
              <Button type="submit">Criar</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}