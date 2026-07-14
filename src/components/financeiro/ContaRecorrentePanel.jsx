import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Pencil, Trash2, RefreshCw, Repeat, Download } from 'lucide-react';
import { formatCurrency, formatDate, calcularProximaData, exportarCSV } from '@/lib/financeiro-helpers';
import { registrarLog } from '@/lib/audit-log';

const PERIODICIDADES = ['SEMANAL', 'QUINZENAL', 'MENSAL', 'BIMESTRAL', 'TRIMESTRAL', 'SEMESTRAL', 'ANUAL'];
const PERIODICIDADE_LABEL = {
  SEMANAL: 'Semanal', QUINZENAL: 'Quinzenal', MENSAL: 'Mensal', BIMESTRAL: 'Bimestral',
  TRIMESTRAL: 'Trimestral', SEMESTRAL: 'Semestral', ANUAL: 'Anual'
};

export default function ContaRecorrentePanel({ readOnly = false, centros = [] }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({
    descricao: '', tipo: 'DESPESA', valor: 0, periodicidade: 'MENSAL',
    proxima_data: new Date().toISOString().split('T')[0], centro_custo_id: '', centro_custo_nome: '',
    classificacao: 'FIXA', categoria: '', observacoes: '', ativo: true
  });

  const { data: recorrentes = [] } = useQuery({
    queryKey: ['contas-recorrentes'],
    queryFn: () => base44.entities.ContaRecorrente.list(),
    refetchInterval: 30000
  });

  const createMut = useMutation({
    mutationFn: (data) => base44.entities.ContaRecorrente.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['contas-recorrentes'] }); registrarLog({ acao: 'CRIAR', entidade: 'ContaRecorrente', detalhes: `Conta recorrente: ${form.descricao}` }); }
  });
  const updateMut = useMutation({
    mutationFn: ({ id, data }) => base44.entities.ContaRecorrente.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['contas-recorrentes'] }); }
  });
  const deleteMut = useMutation({
    mutationFn: (id) => base44.entities.ContaRecorrente.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['contas-recorrentes'] }); registrarLog({ acao: 'EXCLUIR', entidade: 'ContaRecorrente', detalhes: 'Conta recorrente excluída' }); }
  });

  function salvar(e) {
    e.preventDefault();
    const centro = centros.find(c => c.id === form.centro_custo_id);
    const data = { ...form, centro_custo_nome: centro?.nome || '', valor: Number(form.valor) };
    if (editing) updateMut.mutate({ id: editing.id, data });
    else createMut.mutate(data);
    setOpen(false); setEditing(null);
    setForm({ descricao: '', tipo: 'DESPESA', valor: 0, periodicidade: 'MENSAL', proxima_data: new Date().toISOString().split('T')[0], centro_custo_id: '', centro_custo_nome: '', classificacao: 'FIXA', categoria: '', observacoes: '', ativo: true });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold flex items-center gap-2"><Repeat className="w-4 h-4" />Contas Recorrentes</h3>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => exportarCSV(recorrentes, [
            { label: 'Descrição', key: 'descricao' }, { label: 'Tipo', key: 'tipo' },
            { label: 'Valor', key: r => r.valor?.toFixed(2) }, { label: 'Periodicidade', key: 'periodicidade' },
            { label: 'Próxima', key: r => r.proxima_data }
          ], 'contas-recorrentes.csv')}><Download className="w-3.5 h-3.5 mr-1" />CSV</Button>
          {!readOnly && <Button size="sm" onClick={() => { setEditing(null); setForm({ descricao: '', tipo: 'DESPESA', valor: 0, periodicidade: 'MENSAL', proxima_data: new Date().toISOString().split('T')[0], centro_custo_id: '', centro_custo_nome: '', classificacao: 'FIXA', categoria: '', observacoes: '', ativo: true }); setOpen(true); }}><Plus className="w-4 h-4 mr-1" />Nova Conta</Button>}
        </div>
      </div>

      <Card>
        <Table>
          <TableHeader><TableRow className="bg-muted/50">
            <TableHead>Descrição</TableHead><TableHead>Tipo</TableHead><TableHead>Periodicidade</TableHead>
            <TableHead className="text-right">Valor</TableHead><TableHead>Próxima</TableHead><TableHead>Centro</TableHead>
            {!readOnly && <TableHead className="w-20">Ações</TableHead>}
          </TableRow></TableHeader>
          <TableBody>
            {recorrentes.map(r => (
              <TableRow key={r.id}>
                <TableCell className="text-sm font-medium">{r.descricao}</TableCell>
                <TableCell><Badge variant={r.tipo === 'RECEITA' ? 'default' : 'secondary'} className="text-xs">{r.tipo}</Badge></TableCell>
                <TableCell className="text-xs">{PERIODICIDADE_LABEL[r.periodicidade] || r.periodicidade}</TableCell>
                <TableCell className="text-right text-sm font-medium">{formatCurrency(r.valor)}</TableCell>
                <TableCell className="text-xs">{formatDate(r.proxima_data)}</TableCell>
                <TableCell className="text-xs">{r.centro_custo_nome || '—'}</TableCell>
                {!readOnly && <TableCell><div className="flex gap-1">
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => { setEditing(r); setForm(r); setOpen(true); }}><Pencil className="w-3 h-3" /></Button>
                  <Button variant="ghost" size="icon" className="h-6 w-6 text-red-500" onClick={() => deleteMut.mutate(r.id)}><Trash2 className="w-3 h-3" /></Button>
                </div></TableCell>}
              </TableRow>
            ))}
            {recorrentes.length === 0 && <TableRow><TableCell colSpan={readOnly ? 6 : 7} className="text-center py-8 text-muted-foreground">Nenhuma conta recorrente cadastrada.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editing ? 'Editar' : 'Nova'} Conta Recorrente</DialogTitle></DialogHeader>
          <form onSubmit={salvar} className="space-y-3">
            <div><Label>Descrição *</Label><Input value={form.descricao} onChange={e => setForm({ ...form, descricao: e.target.value })} required /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Tipo</Label>
                <Select value={form.tipo} onValueChange={v => setForm({ ...form, tipo: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="DESPESA">Despesa</SelectItem><SelectItem value="RECEITA">Receita</SelectItem></SelectContent>
                </Select>
              </div>
              <div><Label>Valor *</Label><Input type="number" step="0.01" value={form.valor} onChange={e => setForm({ ...form, valor: e.target.value })} required /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Periodicidade</Label>
                <Select value={form.periodicidade} onValueChange={v => setForm({ ...form, periodicidade: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{PERIODICIDADES.map(p => <SelectItem key={p} value={p}>{PERIODICIDADE_LABEL[p]}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Próxima Data *</Label><Input type="date" value={form.proxima_data} onChange={e => setForm({ ...form, proxima_data: e.target.value })} required /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Centro de Custo</Label>
                <Select value={form.centro_custo_id} onValueChange={v => setForm({ ...form, centro_custo_id: v })}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>{centros.map(c => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Classificação</Label>
                <Select value={form.classificacao} onValueChange={v => setForm({ ...form, classificacao: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="FIXA">Fixa</SelectItem><SelectItem value="VARIAVEL">Variável</SelectItem></SelectContent>
                </Select>
              </div>
            </div>
            <div><Label>Categoria</Label><Input value={form.categoria} onChange={e => setForm({ ...form, categoria: e.target.value })} placeholder="ex: Aluguel, Energia" /></div>
            <div><Label>Observações</Label><Input value={form.observacoes} onChange={e => setForm({ ...form, observacoes: e.target.value })} /></div>
            <div className="flex justify-end gap-2 pt-2"><Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button><Button type="submit">Salvar</Button></div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}