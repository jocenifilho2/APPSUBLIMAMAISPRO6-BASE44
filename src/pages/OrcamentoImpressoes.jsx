import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, Calculator, Printer } from 'lucide-react';

const TIPOS_IMPRESSAO = [
  { label: 'A4 Colorido', preco: 2.50 },
  { label: 'A4 P&B', preco: 1.00 },
  { label: 'A3 Colorido', preco: 5.00 },
  { label: 'A3 P&B', preco: 2.00 },
  { label: 'Foto 10x15', preco: 3.00 },
  { label: 'Foto 15x21', preco: 5.00 },
  { label: 'Adesivo A4', preco: 4.00 },
  { label: 'Banner (m²)', preco: 35.00 },
];

export default function OrcamentoImpressoes() {
  const [cliente, setCliente] = useState('');
  const [itens, setItens] = useState([{ tipo: '', quantidade: 1, preco_unitario: 0 }]);

  const addItem = () => setItens([...itens, { tipo: '', quantidade: 1, preco_unitario: 0 }]);

  const removeItem = (index) => {
    if (itens.length <= 1) return;
    setItens(itens.filter((_, i) => i !== index));
  };

  const updateItem = (index, field, value) => {
    const newItens = [...itens];
    newItens[index] = { ...newItens[index], [field]: value };
    setItens(newItens);
  };

  const selectTipo = (index, tipo) => {
    const tipoObj = TIPOS_IMPRESSAO.find(t => t.label === tipo);
    const newItens = [...itens];
    newItens[index] = { ...newItens[index], tipo, preco_unitario: tipoObj?.preco || 0 };
    setItens(newItens);
  };

  const total = itens.reduce((s, item) => s + (item.quantidade * item.preco_unitario), 0);

  const handlePrint = () => {
    const win = window.open('', '', 'width=500,height=600');
    win.document.write('<html><head><title>Orçamento</title><style>body{font-family:Arial;padding:20px;font-size:13px}table{width:100%;border-collapse:collapse;margin:10px 0}th,td{border:1px solid #ddd;padding:6px 8px;text-align:left}th{background:#f5f5f5}.total{font-size:18px;font-weight:bold;text-align:right;margin-top:15px}</style></head><body>');
    win.document.write(`<h2>ORÇAMENTO DE IMPRESSÕES</h2><p><strong>Cliente:</strong> ${cliente || '—'}</p><p><strong>Data:</strong> ${new Date().toLocaleDateString('pt-BR')}</p>`);
    win.document.write('<table><thead><tr><th>Tipo</th><th>Qtd</th><th>Valor Unit.</th><th>Total</th></tr></thead><tbody>');
    itens.forEach(item => {
      win.document.write(`<tr><td>${item.tipo}</td><td>${item.quantidade}</td><td>R$ ${item.preco_unitario.toFixed(2)}</td><td>R$ ${(item.quantidade * item.preco_unitario).toFixed(2)}</td></tr>`);
    });
    win.document.write('</tbody></table>');
    win.document.write(`<div class="total">TOTAL: R$ ${total.toFixed(2)}</div>`);
    win.document.write('</body></html>');
    win.document.close();
    win.print();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Orçamento de Impressões</h1>
        <p className="text-sm text-muted-foreground">Crie orçamentos rápidos para serviços de impressão</p>
      </div>

      <Card className="p-6 space-y-5">
        <div className="max-w-sm space-y-1.5">
          <Label>Nome do Cliente</Label>
          <Input value={cliente} onChange={(e) => setCliente(e.target.value)} placeholder="Nome do cliente" />
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-base font-semibold">Itens do Orçamento</Label>
            <Button variant="outline" size="sm" onClick={addItem}><Plus className="w-3.5 h-3.5 mr-1" /> Adicionar Item</Button>
          </div>

          {itens.map((item, index) => (
            <div key={index} className="grid grid-cols-12 gap-3 items-end p-3 rounded-lg border bg-muted/30">
              <div className="col-span-12 md:col-span-4 space-y-1">
                <Label className="text-xs">Tipo</Label>
                <Select value={item.tipo} onValueChange={(v) => selectTipo(index, v)}>
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    {TIPOS_IMPRESSAO.map(t => (
                      <SelectItem key={t.label} value={t.label}>{t.label} - R$ {t.preco.toFixed(2)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-4 md:col-span-2 space-y-1">
                <Label className="text-xs">Qtd</Label>
                <Input type="number" min="1" value={item.quantidade} onChange={(e) => updateItem(index, 'quantidade', parseInt(e.target.value) || 0)} />
              </div>
              <div className="col-span-4 md:col-span-2 space-y-1">
                <Label className="text-xs">Valor Unit.</Label>
                <Input type="number" step="0.01" value={item.preco_unitario} onChange={(e) => updateItem(index, 'preco_unitario', parseFloat(e.target.value) || 0)} />
              </div>
              <div className="col-span-3 md:col-span-3 flex items-center gap-2">
                <span className="text-sm font-semibold">R$ {(item.quantidade * item.preco_unitario).toFixed(2)}</span>
                <Button type="button" variant="ghost" size="icon" onClick={() => removeItem(index)} className="text-destructive h-8 w-8">
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>

        <div className="bg-muted/50 rounded-lg p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calculator className="w-5 h-5 text-primary" />
            <span className="font-semibold text-lg">Total do Orçamento:</span>
          </div>
          <span className="text-2xl font-bold">R$ {total.toFixed(2)}</span>
        </div>

        <div className="flex justify-end">
          <Button onClick={handlePrint}><Printer className="w-4 h-4 mr-1" /> Imprimir Orçamento</Button>
        </div>
      </Card>
    </div>
  );
}