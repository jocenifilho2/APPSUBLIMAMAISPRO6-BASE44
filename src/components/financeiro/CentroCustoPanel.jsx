import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, Pencil, Trash2, Building2, Download } from 'lucide-react';
import { formatCurrency, exportarCSV } from '@/lib/financeiro-helpers';
import { registrarLog } from '@/lib/audit-log';

const CORES = ['#e53e3e', '#3182ce', '#38a169', '#d69e2e', '#805ad5', '#dd6b20', '#319795', '#d53f8c'];

export default function CentroCustoPanel({ readOnly = false, contas = [] }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ nome: '', descricao: '', cor: CORES[0], ativo: true });

  const { data: centros = [] } = useQuery({
    queryKey: ['centros-custo'],
    queryFn: () => base44.entities.CentroCusto.list(),
    refetchInterval: 10000
  });

  const createMut = useMutation({
    mutationFn: (data) => base44.entities.CentroCusto.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['centros-custo'] }); registrarLog({ acao: 'CRIAR', entidade: 'CentroCusto', detalhes: `Centro criado: ${form.nome}` }); }
  });
  const updateMut = useMutation({
    mutationFn: ({ id, data }) => base44.entities.CentroCusto.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['centros-custo'] }); registrarLog({ acao: 'EDITAR', entidade: 'CentroCusto', detalhes: `Centro editado: ${form.nome}` }); }
  });
  const deleteMut = useMutation({
    mutationFn: (id) => base44.entities.CentroCusto.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['centros-custo'] }); registrarLog({ acao: 'EXCLUIR', entidade: 'CentroCusto', detalhes: 'Centro excluído' }); }
  });

  function salvar(e) {
    e.preventDefault();
    if (editing) updateMut.mutate({ id: editing.id, data: form });
    else createMut.mutate(form);
    setOpen(false); setEditing(null); setForm({ nome: '', descricao: '', cor: CORES[0], ativo: true });
  }

  const dadosCentros = centros.map(c => {
    const contasCentro = contas.filter(ct => ct.centro_custo_id === c.id);
    const receita = contasCentro.filter(ct => ct.tipo === 'RECEITA' && ct.status !== 'CANCELADO').reduce((s, ct) => s + (ct.valor || 0), 0);
    const despesa = contasCentro.filter(ct => ct.tipo === 'DESPESA' && ct.status !== 'CANCELADO').reduce((s, ct) => s + (ct.valor || 0), 0);
    return { ...c, receita, despesa, lucro: receita - despesa };
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold flex items-center gap-2"><Building2 className="w-4 h-4" />Centros de Custo</h3>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => exportarCSV(dadosCentros, [
            { label: 'Nome', key: 'nome' }, { label: 'Receita', key: c => c.receita.toFixed(2) },
            { label: 'Despesa', key: c => c.despesa.toFixed(2) }, { label: 'Lucro', key: c => c.lucro.toFixed(2) }
          ], 'centros-custo.csv')}><Download className="w-3.5 h-3.5 mr-1" />CSV</Button>
          {!readOnly && <Button size="sm" onClick={() => { setEditing(null); setForm({ nome: '', descricao: '', cor: CORES[0], ativo: true }); setOpen(true); }}><Plus className="w-4 h-4 mr-1" />Novo</Button>}
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-3">
        {dadosCentros.map(c => (
          <Card key={c.id} className="p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ background: c.cor }} />
                <span className="font-medium text-sm">{c.nome}</span>
              </div>
              {!readOnly && <div className="flex gap-1">
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => { setEditing(c); setForm(c); setOpen(true); }}><Pencil className="w-3 h-3" /></Button>
                <Button variant="ghost" size="icon" className="h-6 w-6 text-red-500" onClick={() => deleteMut.mutate(c.id)}><Trash2 className="w-3 h-3" /></Button>
              </div>}
            </div>
            <div className="space-y-1 text-xs">
              <div className="flex justify-between"><span className="text-muted-foreground">Receita:</span><span className="font-medium text-green-600">{formatCurrency(c.receita)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Despesa:</span><span className="font-medium text-red-600">{formatCurrency(c.despesa)}</span></div>
              <div className="flex justify-between border-t pt-1"><span className="text-muted-foreground">Lucro:</span><span className={`font-bold ${c.lucro >= 0 ? 'text-blue-600' : 'text-red-600'}`}>{formatCurrency(c.lucro)}</span></div>
            </div>
          </Card>
        ))}
        {dadosCentros.length === 0 && <p className="text-sm text-muted-foreground col-span-3 text-center py-8">Nenhum centro de custo cadastrado.</p>}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editing ? 'Editar' : 'Novo'} Centro de Custo</DialogTitle></DialogHeader>
          <form onSubmit={salvar} className="space-y-3">
            <div><Label>Nome *</Label><Input value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} required /></div>
            <div><Label>Descrição</Label><Input value={form.descricao} onChange={e => setForm({ ...form, descricao: e.target.value })} /></div>
            <div><Label>Cor</Label><div className="flex gap-2 flex-wrap">{CORES.map(cor => <button type="button" key={cor} onClick={() => setForm({ ...form, cor })} className={`w-7 h-7 rounded-full border-2 ${form.cor === cor ? 'border-foreground' : 'border-transparent'}`} style={{ background: cor }} />)}</div></div>
            <div className="flex justify-end gap-2 pt-2"><Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button><Button type="submit">Salvar</Button></div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}