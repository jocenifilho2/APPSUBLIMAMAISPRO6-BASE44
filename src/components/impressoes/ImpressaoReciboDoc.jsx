import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Printer } from 'lucide-react';
import { format } from 'date-fns';

export default function ImpressaoReciboDoc({ pedido, open, onOpenChange }) {
  if (!pedido) return null;

  const dataFormatada = pedido.data
    ? format(new Date(pedido.data + 'T12:00:00'), 'dd/MM/yyyy')
    : format(new Date(), 'dd/MM/yyyy');

  const itens = pedido.itens || [];
  const isPago = pedido.status === 'PAGO' || pedido.status === 'ENTREGUE' || pedido.status === 'CONCLUIDO';

  const handlePrint = () => {
    const win = window.open('', '_blank', 'width=794,height=1123');
    win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8">
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&display=swap');
      * { margin:0; padding:0; box-sizing:border-box; }
      body { font-family: 'Inter', Arial, sans-serif; font-size: 14px; color: #111; background: #fff; padding: 32px 40px; position: relative; }
      .header { display: flex; align-items: center; gap: 16px; margin-bottom: 8px; }
      .logo-circle { width: 70px; height: 70px; border-radius: 50%; background: #facc15; display: flex; align-items: center; justify-content: center; font-size: 26px; font-weight: 900; color: #b91c1c; flex-shrink: 0; }
      .company-name { font-size: 20px; font-weight: 900; }
      .company-sub { font-size: 13px; color: #555; }
      .divider { border: none; border-top: 2px solid #ddd; margin: 16px 0; }
      .title { text-align: center; font-size: 20px; font-weight: 900; letter-spacing: 1px; margin-bottom: 20px; }
      .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 16px; margin-bottom: 20px; font-size: 15px; }
      .info-grid .lbl { font-weight: 900; }
      table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
      thead tr { background: #e5e7eb; }
      th { text-align: left; padding: 10px 12px; font-size: 14px; font-weight: 900; border: 1px solid #ccc; }
      td { padding: 10px 12px; font-size: 14px; font-weight: 700; border: 1px solid #ccc; }
      .total-row { text-align: right; font-size: 18px; font-weight: 900; margin-top: 12px; }
      .pago-stamp { position: absolute; top: 180px; right: 60px; border: 6px solid #16a34a; color: #16a34a; font-size: 44px; font-weight: 900; padding: 8px 18px; border-radius: 8px; transform: rotate(-20deg); opacity: 0.35; pointer-events: none; letter-spacing: 4px; }
      .rodape { text-align: center; color: #999; font-size: 12px; margin-top: 40px; }
      @media print { body { padding: 20px 28px; } }
    </style>
    </head><body>
    ${isPago ? '<div class="pago-stamp">PAGO</div>' : ''}
    <div class="header">
      <img src="https://media.base44.com/images/public/69f29a5ddcdad09f087cb710/56eda8412_16b4d9f6-8ee3-4f42-8e30-74da230042df.png" style="width:70px;height:70px;border-radius:50%;object-fit:cover;flex-shrink:0" />
      <div><div class="company-name">Sublima Mais</div><div class="company-sub">Produtos para Sublima&ccedil;&atilde;o</div></div>
    </div>
    <hr class="divider"/>
    <div class="title">RECIBO DE PEDIDO</div>
    <div class="info-grid">
      <div><span class="lbl">Pedido Nº:</span> ${pedido.numero || '—'}</div>
      <div><span class="lbl">Data:</span> ${dataFormatada}</div>
      <div><span class="lbl">Cliente:</span> ${pedido.cliente || ''}</div>
      <div></div>
      <div><span class="lbl">Forma de Pagamento:</span> ${pedido.forma_pagamento || '—'}</div>
      <div></div>
      <div><span class="lbl">Status:</span> ${pedido.status || '—'}</div>
      <div></div>
      ${pedido.banco_nome ? `<div><span class="lbl">Banco:</span> ${pedido.banco_nome}</div><div></div>` : ''}
    </div>
    ${pedido.forma_pagamento === 'MISTO' ? `<div style="margin-bottom:16px;font-size:15px;"><span class="lbl">Detalhe do Pagamento Misto:</span><br/>&nbsp;&nbsp;• ${pedido.pagamento_misto_metodo_1 || ''}: R$ ${(pedido.pagamento_misto_valor_1 || 0).toFixed(2)}<br/>&nbsp;&nbsp;• ${pedido.pagamento_misto_metodo_2 || ''}: R$ ${(pedido.pagamento_misto_valor_2 || 0).toFixed(2)}</div>` : ''}
    <table>
      <thead><tr><th>Item</th><th>Qtd</th><th>Unit.</th><th>Total</th></tr></thead>
      <tbody>
        ${itens.length > 0 ? itens.map(item => {
          const desc = item.metros ? `${item.tipo}${item.descricao ? ` - ${item.descricao}` : ''} (${parseFloat(item.metros).toFixed(2)}m)` : `${item.tipo}${item.descricao ? ` - ${item.descricao}` : ''}`;
          const qtd = item.metros ? 1 : (item.quantidade || 1);
          return `<tr><td>${desc}</td><td>${qtd}</td><td>R$ ${(item.preco_unitario || 0).toFixed(2)}</td><td>R$ ${(item.total || 0).toFixed(2)}</td></tr>`;
        }).join('') : `<tr><td colspan="4" style="text-align:center;color:#999">Nenhum item</td></tr>`}
      </tbody>
    </table>
    <hr class="divider"/>
    <div class="total-row">TOTAL FINAL: R$ ${(pedido.total || 0).toFixed(2)}</div>
    <div class="rodape">Sublima Mais - Produtos para Sublimação</div>
    </body></html>`);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); }, 500);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Recibo — {pedido.numero}</DialogTitle></DialogHeader>
        <div className="space-y-3 py-2">
          <div className="border rounded-lg p-4 bg-white space-y-2 text-sm relative overflow-hidden">
            {isPago && (
              <div className="absolute top-8 right-4 border-4 border-green-600 text-green-600 text-2xl font-black px-3 py-1 rounded opacity-30 rotate-[-20deg] pointer-events-none">PAGO</div>
            )}
            <div className="flex items-center gap-3 mb-2">
              <img src="https://media.base44.com/images/public/69f29a5ddcdad09f087cb710/56eda8412_16b4d9f6-8ee3-4f42-8e30-74da230042df.png" alt="Logo" className="w-10 h-10 rounded-full object-cover" />
              <div><div className="font-bold text-sm">Sublima Mais</div><div className="text-xs text-muted-foreground">Produtos para Sublimação</div></div>
            </div>
            <div className="text-center font-bold text-base border-y py-2">RECIBO DE PEDIDO</div>
            <div className="grid grid-cols-2 gap-1 text-xs">
              <div><strong>Pedido Nº:</strong> {pedido.numero}</div>
              <div><strong>Data:</strong> {dataFormatada}</div>
              <div><strong>Cliente:</strong> {pedido.cliente}</div>
              <div></div>
              <div><strong>Pagamento:</strong> {pedido.forma_pagamento}</div>
              <div><strong>Status:</strong> {pedido.status}</div>
              {pedido.banco_nome && (
                <div><strong>Banco:</strong> {pedido.banco_nome}</div>
              )}
            </div>
            {pedido.forma_pagamento === 'MISTO' && (
              <div className="text-xs">
                <strong>Detalhe do Pagamento Misto:</strong><br/>
                &nbsp;&nbsp;• {pedido.pagamento_misto_metodo_1}: R$ {(pedido.pagamento_misto_valor_1 || 0).toFixed(2)}<br/>
                &nbsp;&nbsp;• {pedido.pagamento_misto_metodo_2}: R$ {(pedido.pagamento_misto_valor_2 || 0).toFixed(2)}
              </div>
            )}
            <table className="w-full border text-xs mt-2">
              <thead><tr className="bg-gray-100"><th className="border px-2 py-1 text-left">Item</th><th className="border px-2 py-1">Qtd</th><th className="border px-2 py-1">Unit.</th><th className="border px-2 py-1">Total</th></tr></thead>
              <tbody>
                {itens.map((item, i) => (
                  <tr key={i}>
                    <td className="border px-2 py-1 font-medium">{item.tipo}{item.metros ? ` (${parseFloat(item.metros).toFixed(2)}m)` : ''}{item.descricao ? ` - ${item.descricao}` : ''}</td>
                    <td className="border px-2 py-1 text-center">{item.metros ? 1 : (item.quantidade || 1)}</td>
                    <td className="border px-2 py-1 text-right">R$ {(item.preco_unitario || 0).toFixed(2)}</td>
                    <td className="border px-2 py-1 text-right font-bold">R$ {(item.total || 0).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="text-right font-black text-base mt-2">TOTAL FINAL: R$ {(pedido.total || 0).toFixed(2)}</div>
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
            <Button onClick={handlePrint}><Printer className="w-4 h-4 mr-1" /> Imprimir</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}