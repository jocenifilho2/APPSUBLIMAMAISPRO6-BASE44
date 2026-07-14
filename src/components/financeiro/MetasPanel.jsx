import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Target, Plus, Trash2, TrendingUp, Download } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, LineChart, Line } from 'recharts';
import { formatCurrency, formatPercent, calcularMetaProgresso, exportarCSV } from '@/lib/financeiro-helpers';
import { registrarLog } from '@/lib/audit-log';

const PERIODOS = [
  { value: 'MENSAL', label: 'Mensal' },
  { value: 'TRIMESTRAL', label: 'Trimestral' },
  { value: 'SEMESTRAL', label: 'Semestral' },
  { value: 'ANUAL', label: 'Anual' },
];

export default function MetasPanel({ readOnly = false, receitaPeriodo = 0, lucroPeriodo = 0 }) {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState('faturamento');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    periodo: 'MENSAL', valor_meta: 0, margem_esperada: 0,
    data_inicio: new Date().toISOString().split('T')[0],
    data_fim: new Date(new Date().setMonth(new Date().getMonth() + 1)).toISOString().split('T')[0],
    descricao: ''
  });

  const { data: metasFat = [] } = useQuery({
    queryKey: ['metas-faturamento'],
    queryFn: () => base44.entities.MetaFaturamento.list('-data_inicio', 20),
    refetchInterval: 30000
  });
  const { data: metasLuc = [] } = useQuery({
    queryKey: ['metas-lucro'],
    queryFn: () => base44.entities.MetaLucro.list('-data_inicio', 20),
    refetchInterval: 30000
  });

  const createFatMut = useMutation({
    mutationFn: (data) => base44.entities.MetaFaturamento.create(data),
    onSuccess: (_res, data) => { queryClient.invalidateQueries({ queryKey: ['metas-faturamento'] }); registrarLog({ acao: 'CRIAR', entidade: 'MetaFaturamento', detalhes: `Meta: ${formatCurrency(data.valor_meta)}` }); }
  });
  const createLucMut = useMutation({
    mutationFn: (data) => base44.entities.MetaLucro.create(data),
    onSuccess: (_res, data) => { queryClient.invalidateQueries({ queryKey: ['metas-lucro'] }); registrarLog({ acao: 'CRIAR', entidade: 'MetaLucro', detalhes: `Meta: ${formatCurrency(data.valor_meta)}` }); }
  });
  const deleteFatMut = useMutation({
    mutationFn: (id) => base44.entities.MetaFaturamento.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['metas-faturamento'] })
  });
  const deleteLucMut = useMutation({
    mutationFn: (id) => base44.entities.MetaLucro.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['metas-lucro'] })
  });

  function salvar(e) {
    e.preventDefault();
    const data = { ...form, valor_meta: Number(form.valor_meta), margem_esperada: Number(form.margem_esperada) || undefined };
    if (tab === 'faturamento') createFatMut.mutate(data);
    else createLucMut.mutate(data);
    setOpen(false);
    setForm({ periodo: 'MENSAL', valor_meta: 0, margem_esperada: 0, data_inicio: new Date().toISOString().split('T')[0], data_fim: new Date(new Date().setMonth(new Date().getMonth() + 1)).toISOString().split('T')[0], descricao: '' });
  }

  const metas = tab === 'faturamento' ? metasFat : metasLuc;
  const realizado = tab === 'faturamento' ? receitaPeriodo : lucroPeriodo;

  const dadosGrafico = metas.map(m => {
    const progresso = calcularMetaProgresso(m.valor_meta, realizado);
    return { nome: m.descricao || m.periodo, Meta: m.valor_meta, Realizado: realizado, Percentual: progresso.percentual };
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold flex items-center gap-2"><Target className="w-4 h-4" />Metas</h3>
        {!readOnly && <Button size="sm" onClick={() => setOpen(true)}><Plus className="w-4 h-4 mr-1" />Nova Meta</Button>}
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="faturamento"><TrendingUp className="w-3.5 h-3.5 mr-1" />Faturamento</TabsTrigger>
          <TabsTrigger value="lucro"><Target className="w-3.5 h-3.5 mr-1" />Lucro</TabsTrigger>
        </TabsList>

        {['faturamento', 'lucro'].map(t => (
          <TabsContent key={t} value={t} className="mt-4 space-y-4">
            <div className="grid md:grid-cols-3 gap-3">
              {(t === 'faturamento' ? metasFat : metasLuc).slice(0, 3).map(m => {
                const prog = calcularMetaProgresso(m.valor_meta, t === 'faturamento' ? receitaPeriodo : lucroPeriodo);
                return (
                  <Card key={m.id} className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <Badge variant="outline" className="text-xs">{PERIODOS.find(p => p.value === m.periodo)?.label}</Badge>
                      {!readOnly && <Button variant="ghost" size="icon" className="h-6 w-6 text-red-500" onClick={() => (t === 'faturamento' ? deleteFatMut : deleteLucMut).mutate(m.id)}><Trash2 className="w-3 h-3" /></Button>}
                    </div>
                    <p className="text-xs text-muted-foreground">Meta</p>
                    <p className="text-lg font-bold">{formatCurrency(m.valor_meta)}</p>
                    <p className="text-xs text-muted-foreground mt-1">Realizado</p>
                    <p className={`text-sm font-medium ${prog.atingida ? 'text-green-600' : 'text-amber-600'}`}>{formatCurrency(t === 'faturamento' ? receitaPeriodo : lucroPeriodo)}</p>
                    <div className="mt-2 h-2 bg-muted rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${prog.atingida ? 'bg-green-500' : 'bg-amber-500'}`} style={{ width: `${Math.min(100, prog.percentual)}%` }} />
                    </div>
                    <div className="flex justify-between text-xs mt-1">
                      <span className={prog.atingida ? 'text-green-600 font-medium' : 'text-muted-foreground'}>{formatPercent(prog.percentual)}</span>
                      <span className="text-muted-foreground">Falta: {formatCurrency(prog.faltante)}</span>
                    </div>
                  </Card>
                );
              })}
              {(t === 'faturamento' ? metasFat : metasLuc).length === 0 && <p className="text-sm text-muted-foreground col-span-3 text-center py-8">Nenhuma meta cadastrada.</p>}
            </div>

            {dadosGrafico.length > 0 && (
              <Card className="p-4">
                <h4 className="text-sm font-medium mb-3">Meta vs Realizado</h4>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={dadosGrafico}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="nome" className="text-xs" />
                    <YAxis tickFormatter={v => `R$ ${(v / 1000).toFixed(0)}k`} className="text-xs" />
                    <Tooltip formatter={v => formatCurrency(v)} />
                    <Bar dataKey="Meta" fill="#e53e3e" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Realizado" fill="#38a169" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </Card>
            )}
          </TabsContent>
        ))}
      </Tabs>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Nova Meta de {tab === 'faturamento' ? 'Faturamento' : 'Lucro'}</DialogTitle></DialogHeader>
          <form onSubmit={salvar} className="space-y-3">
            <div><Label>Período</Label>
              <Select value={form.periodo} onValueChange={v => setForm({ ...form, periodo: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{PERIODOS.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Valor da Meta *</Label><Input type="number" step="0.01" value={form.valor_meta} onChange={e => setForm({ ...form, valor_meta: e.target.value })} required /></div>
            {tab === 'lucro' && <div><Label>Margem Esperada (%)</Label><Input type="number" step="0.1" value={form.margem_esperada} onChange={e => setForm({ ...form, margem_esperada: e.target.value })} /></div>}
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Início *</Label><Input type="date" value={form.data_inicio} onChange={e => setForm({ ...form, data_inicio: e.target.value })} required /></div>
              <div><Label>Fim *</Label><Input type="date" value={form.data_fim} onChange={e => setForm({ ...form, data_fim: e.target.value })} required /></div>
            </div>
            <div><Label>Descrição</Label><Input value={form.descricao} onChange={e => setForm({ ...form, descricao: e.target.value })} /></div>
            <div className="flex justify-end gap-2 pt-2"><Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button><Button type="submit">Salvar</Button></div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}