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
import { Plus, Pencil, Trash2, ListTree, Download } from 'lucide-react';
import { exportarCSV } from '@/lib/financeiro-helpers';
import { registrarLog } from '@/lib/audit-log';

export default function PlanoContasPanel({ readOnly = false }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ codigo: '', nome: '', tipo: 'RECEITA', parent_id: '', nivel: 1, ativo: true });

  const { data: contas = [] } = useQuery({
    queryKey: ['plano-contas'],
    queryFn: () => base44.entities.PlanoContas.list(),
    refetchInterval: 15000
  });

  const createMut = useMutation({
    mutationFn: (data) => base44.entities.PlanoContas.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['plano-contas'] }); registrarLog({ acao: 'CRIAR', entidade: 'PlanoContas', detalhes: `Conta criada: ${form.codigo} - ${form.nome}` }); }
  });
  const updateMut = useMutation({
    mutationFn: ({ id, data }) => base44.entities.PlanoContas.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['plano-contas'] }); }
  });
  const deleteMut = useMutation({
    mutationFn: (id) => base44.entities.PlanoContas.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['plano-contas'] }); registrarLog({ acao: 'EXCLUIR', entidade: 'PlanoContas', detalhes: 'Conta excluída' }); }
  });

  function salvar(e) {
    e.preventDefault();
    if (editing) updateMut.mutate({ id: editing.id, data: form });
    else createMut.mutate(form);
    setOpen(false); setEditing(null);
    setForm({ codigo: '', nome: '', tipo: 'RECEITA', parent_id: '', nivel: 1, ativo: true });
  }

  const contasOrdenadas = [...contas].sort((a, b) => (a.codigo || '').localeCompare(b.codigo || ''));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold flex items-center gap-2"><ListTree className="w-4 h-4" />Plano de Contas</h3>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => exportarCSV(contasOrdenadas, [
            { label: 'Código', key: 'codigo' }, { label: 'Nome', key: 'nome' },
            { label: 'Tipo', key: 'tipo' }, { label: 'Nível', key: 'nivel' }
          ], 'plano-contas.csv')}><Download className="w-3.5 h-3.5 mr-1" />CSV</Button>
          {!readOnly && <Button size="sm" onClick={() => { setEditing(null); setForm({ codigo: '', nome: '', tipo: 'RECEITA', parent_id: '', nivel: 1, ativo: true }); setOpen(true); }}><Plus className="w-4 h-4 mr-1" />Nova Conta</Button>}
        </div>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead>Código</TableHead>
              <TableHead>Nome</TableHead>
              <TableHead className="w-24">Tipo</TableHead>
              <TableHead className="w-24">Nível</TableHead>
              {!readOnly && <TableHead className="w-20">Ações</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {contasOrdenadas.map(c => (
              <TableRow key={c.id}>
                <TableCell className="font-mono text-xs">{c.codigo}</TableCell>
                <TableCell className="text-sm">{c.nome}</TableCell>
                <TableCell><Badge variant={c.tipo === 'RECEITA' ? 'default' : 'secondary'} className="text-xs">{c.tipo === 'RECEITA' ? 'Receita' : 'Despesa'}</Badge></TableCell>
                <TableCell className="text-xs text-muted-foreground">{c.nivel || 1}</TableCell>
                {!readOnly && <TableCell><div className="flex gap-1">
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => { setEditing(c); setForm(c); setOpen(true); }}><Pencil className="w-3 h-3" /></Button>
                  <Button variant="ghost" size="icon" className="h-6 w-6 text-red-500" onClick={() => deleteMut.mutate(c.id)}><Trash2 className="w-3 h-3" /></Button>
                </div></TableCell>}
              </TableRow>
            ))}
            {contasOrdenadas.length === 0 && <TableRow><TableCell colSpan={readOnly ? 4 : 5} className="text-center py-8 text-muted-foreground">Nenhuma conta cadastrada.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editing ? 'Editar' : 'Nova'} Conta</DialogTitle></DialogHeader>
          <form onSubmit={salvar} className="space-y-3">
            <div><Label>Código *</Label><Input value={form.codigo} onChange={e => setForm({ ...form, codigo: e.target.value })} placeholder="ex: 1.01.001" required /></div>
            <div><Label>Nome *</Label><Input value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} required /></div>
            <div><Label>Tipo</Label>
              <Select value={form.tipo} onValueChange={v => setForm({ ...form, tipo: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="RECEITA">Receita</SelectItem><SelectItem value="DESPESA">Despesa</SelectItem></SelectContent>
              </Select>
            </div>
            <div><Label>Nível</Label><Input type="number" value={form.nivel} onChange={e => setForm({ ...form, nivel: parseInt(e.target.value) || 1 })} min={1} max={5} /></div>
            <div className="flex justify-end gap-2 pt-2"><Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button><Button type="submit">Salvar</Button></div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}