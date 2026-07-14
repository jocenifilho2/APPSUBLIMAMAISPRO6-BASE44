import React, { useState, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Calculator, Download } from 'lucide-react';
import { simularPreco, formatCurrency, formatPercent, RENTABILIDADE_COLOR, exportarCSV } from '@/lib/financeiro-helpers';

const CAMPOS = [
  { key: 'material', label: 'Material (R$)', placeholder: 'Ex: caneca em branco' },
  { key: 'tinta', label: 'Tinta / Sublimação (R$)' },
  { key: 'papel', label: 'Papel (R$)' },
  { key: 'filme', label: 'Filme DTF (R$)' },
  { key: 'energia', label: 'Energia (R$)' },
  { key: 'embalagem', label: 'Embalagem (R$)' },
  { key: 'frete', label: 'Frete (R$)' },
];

export default function SimuladorPreco() {
  const [form, setForm] = useState({
    material: 0, tinta: 0, papel: 0, filme: 0, energia: 0,
    tempoMinutos: 0, custoMaoObraHora: 0, embalagem: 0, frete: 0,
    margemDesejada: 30, impostos: 6, quantidade: 1
  });
  const [resultado, setResultado] = useState(null);

  function calcular() {
    const r = simularPreco(form);
    setResultado(r);
  }

  const setVal = (k, v) => setForm({ ...form, [k]: Number(v) || 0 });

  return (
    <div className="space-y-4">
      <h3 className="font-semibold flex items-center gap-2"><Calculator className="w-4 h-4" />Simulador de Formação de Preço</h3>

      <div className="grid md:grid-cols-2 gap-4">
        {/* Inputs */}
        <Card className="p-4 space-y-3">
          <h4 className="text-sm font-medium">Custos Diretos</h4>
          <div className="grid grid-cols-2 gap-3">
            {CAMPOS.map(c => (
              <div key={c.key}>
                <Label className="text-xs">{c.label}</Label>
                <Input type="number" step="0.01" value={form[c.key] || ''} onChange={e => setVal(c.key, e.target.value)} placeholder={c.placeholder || '0,00'} />
              </div>
            ))}
          </div>
          <hr />
          <h4 className="text-sm font-medium">Mão de Obra & Produção</h4>
          <div className="grid grid-cols-2 gap-3">
            <div><Label className="text-xs">Tempo de Máquina (min)</Label><Input type="number" step="1" value={form.tempoMinutos || ''} onChange={e => setVal('tempoMinutos', e.target.value)} /></div>
            <div><Label className="text-xs">Custo Mão de Obra (R$/h)</Label><Input type="number" step="0.01" value={form.custoMaoObraHora || ''} onChange={e => setVal('custoMaoObraHora', e.target.value)} /></div>
          </div>
          <hr />
          <h4 className="text-sm font-medium">Parâmetros</h4>
          <div className="grid grid-cols-3 gap-3">
            <div><Label className="text-xs">Margem (%)</Label><Input type="number" step="0.1" value={form.margemDesejada} onChange={e => setVal('margemDesejada', e.target.value)} /></div>
            <div><Label className="text-xs">Impostos (%)</Label><Input type="number" step="0.1" value={form.impostos} onChange={e => setVal('impostos', e.target.value)} /></div>
            <div><Label className="text-xs">Qtd</Label><Input type="number" step="1" value={form.quantidade} onChange={e => setVal('quantidade', e.target.value)} /></div>
          </div>
          <Button className="w-full" onClick={calcular}><Calculator className="w-4 h-4 mr-1" />Calcular Preço</Button>
        </Card>

        {/* Resultado */}
        <Card className="p-4 space-y-3">
          <h4 className="text-sm font-medium">Resultado</h4>
          {!resultado ? (
            <p className="text-sm text-muted-foreground text-center py-12">Preencha os campos e clique em "Calcular Preço".</p>
          ) : (
            <>
              <div className="bg-primary/5 rounded-lg p-4 text-center">
                <p className="text-xs text-muted-foreground">Preço Sugerido (unit.)</p>
                <p className="text-2xl font-bold text-primary">{formatCurrency(resultado.precoSugerido)}</p>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Custo Unitário:</span><span className="font-medium">{formatCurrency(resultado.custoUnitario)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Mão de Obra:</span><span className="font-medium">{formatCurrency(resultado.maoObra)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Custo Total ({form.quantidade} un):</span><span className="font-medium">{formatCurrency(resultado.custoTotal)}</span></div>
                <div className="flex justify-between border-t pt-2"><span className="text-muted-foreground">Lucro por Unidade:</span><span className="font-bold text-green-600">{formatCurrency(resultado.lucro)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Margem Real:</span><span className="font-bold">{formatPercent(resultado.margemReal)}</span></div>
                <div className="flex justify-between items-center"><span className="text-muted-foreground">Rentabilidade:</span><Badge className={RENTABILIDADE_COLOR[resultado.rentabilidade]}>{resultado.rentabilidade}</Badge></div>
              </div>
              <Button variant="outline" size="sm" className="w-full" onClick={() => exportarCSV([{
                ...form, ...resultado
              }], [
                { label: 'Material', key: 'material' }, { label: 'Tinta', key: 'tinta' }, { label: 'Papel', key: 'papel' },
                { label: 'Filme', key: 'filme' }, { label: 'Energia', key: 'energia' }, { label: 'Mão de Obra', key: 'maoObra' },
                { label: 'Custo Unit', key: r => r.custoUnitario?.toFixed(2) }, { label: 'Preço Sugerido', key: r => r.precoSugerido?.toFixed(2) },
                { label: 'Lucro', key: r => r.lucro?.toFixed(2) }, { label: 'Margem', key: r => r.margemReal }
              ], 'simulacao-preco.csv')}><Download className="w-3.5 h-3.5 mr-1" />Exportar Simulação</Button>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}