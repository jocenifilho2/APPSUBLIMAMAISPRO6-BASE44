import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, Trash2, Split, Download } from 'lucide-react';
import { exportarCSV } from '@/lib/financeiro-helpers';
import { registrarLog } from '@/lib/audit-log';

export default function RateioPanel({ readOnly = false, centros = [] }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ descricao: '', itens: [{ centro_custo_id: '', centro_custo_nome: '', percentual: 100 }] });

  const { data: rateios = [] } = useQuery({
    queryKey: ['rateios-despesa'],
    queryFn: () => base44.entities.RateioDespesa.list(),
    refetchInterval: 30000
  });

  const createMut = useMutation({
    mutationFn: (data) => base44.entities.RateioDespesa.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['rateios-despesa'] }); registrarLog({ acao: 'RATEAR', entidade: 'RateioDespesa', detalhes: `Rateio: ${form.descricao}` }); }
  });
  const deleteMut = useMutation({
    mutationFn: (id) => base44.entities.RateioDespesa.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['rateios-despesa'] })
  });

  function salvar(e) {
    e.preventDefault();
    const itens = form.itens.map(item => {
      const centro = centros.find(c => c.id === item.centro_custo_id);
      return { ...item, centro_custo_nome: centro?.nome || '', percentual: Number(item.percentual) };
    });
    createMut.mutate({ ...form, itens });
    setOpen(false);
    setForm({ descricao: '', itens: [{ centro_custo_id: '', centro_custo_nome: '', percentual: 100 }] });
  }

  function addItem() {
    setForm({ ...form, itens: [...form.itens, { centro_custo_id: '', centro_custo_nome: '', percentual: 0 }] });
  }
  function removeItem(i) {
    setForm({ ...form, itens: form.itens.filter((_, idx) => idx !== i) });
  }
  function updateItem(i, field, value) {
    const itens = [...form.itens];
    itens[i] = { ...itens[i], [field]: value };
    setForm({ ...form, itens });
  }

  const totalPercent = form.itens.reduce((s, i) => s + (Number(i.percentual) || 0), 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold flex items-center gap-2"><Split className="w-4 h-4" />Rateio de Despesas</h3>
        {!readOnly && <Button size="sm" onClick={() => setOpen(true)}><Plus className="w-4 h-4 mr-1" />Novo Rateio</Button>}
      </div>

      <div className="grid md:grid-cols-2 gap-3">
        {rateios.map(r => (
          <Card key={r.id} className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="font-medium text-sm">{r.descricao}</span>
              {!readOnly && <Button variant="ghost" size="icon" className="h-6 w-6 text-red-500" onClick={() => deleteMut.mutate(r.id)}><Trash2 className="w-3 h-3" /></Button>}
            </div>
            <div className="space-y-1">
              {(r.itens || []).map((item, i) => (
                <div key={i} className="flex items-center justify-between text-xs">
                  <span>{item.centro_custo_nome || '—'}</span>
                  <div className="flex items-center gap-2">
                    <div className="w-24 h-1.5 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-primary rounded-full" style={{ width: `${item.percentual}%` }} />
                    </div>
                    <span className="font-medium w-10 text-right">{item.percentual}%</span>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        ))}
        {rateios.length === 0 && <p className="text-sm text-muted-foreground col-span-2 text-center py-8">Nenhum rateio cadastrado.</p>}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Novo Rateio de Despesa</DialogTitle></DialogHeader>
          <form onSubmit={salvar} className="space-y-3">
            <div><Label>Descrição *</Label><Input value={form.descricao} onChange={e => setForm({ ...form, descricao: e.target.value })} placeholder="Ex: Energia Elétrica" required /></div>
            <div>
              <Label>Centros de Custo</Label>
              {form.itens.map((item, i) => (
                <div key={i} className="flex gap-2 mt-1">
                  <select className="flex-1 h-9 rounded-md border border-input bg-transparent px-3 text-sm" value={item.centro_custo_id} onChange={e => updateItem(i, 'centro_custo_id', e.target.value)}>
                    <option value="">— Centro —</option>
                    {centros.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                  </select>
                  <Input type="number" step="0.1" placeholder="%" value={item.percentual} onChange={e => updateItem(i, 'percentual', e.target.value)} className="w-20" />
                  {form.itens.length > 1 && <Button type="button" variant="ghost" size="icon" onClick={() => removeItem(i)}><Trash2 className="w-3.5 h-3.5 text-red-500" /></Button>}
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" onClick={addItem} className="mt-2"><Plus className="w-3.5 h-3.5 mr-1" />Adicionar</Button>
              <p className={`text-xs mt-1 ${totalPercent === 100 ? 'text-green-600' : 'text-red-500'}`}>Total: {totalPercent}% {totalPercent !== 100 && '(deve somar 100%)'}</p>
            </div>
            <div className="flex justify-end gap-2 pt-2"><Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button><Button type="submit" disabled={totalPercent !== 100}>Salvar</Button></div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}