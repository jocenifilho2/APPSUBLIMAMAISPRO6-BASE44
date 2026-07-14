import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Printer } from 'lucide-react';
import { format } from 'date-fns';

export default function ImpressaoPedidoDoc({ pedido, open, onOpenChange }) {
  if (!pedido) return null;

  const dataFormatada = pedido.data
    ? format(new Date(pedido.data + 'T12:00:00'), 'dd/MM/yyyy')
    : format(new Date(), 'dd/MM/yyyy');

  const itens = pedido.itens || [];

  const handlePrint = () => {
    const win = window.open('', '_blank', 'width=794,height=1123');
    win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8">
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&display=swap');
      * { margin:0; padding:0; box-sizing:border-box; }
      body { font-family: 'Inter', Arial, sans-serif; font-size: 14px; color: #111; background: #fff; padding: 32px 40px; }
      .header { display: flex; align-items: center; gap: 16px; margin-bottom: 8px; }
      .logo-circle { width: 70px; height: 70px; border-radius: 50%; background: #facc15; display: flex; align-items: center; justify-content: center; font-size: 26px; font-weight: 900; color: #b91c1c; flex-shrink: 0; }
      .company-name { font-size: 20px; font-weight: 900; }
      .company-sub { font-size: 13px; color: #555; }
      .divider { border: none; border-top: 2px solid #ddd; margin: 16px 0; }
      .numero-pedido { display: inline-block; background: #facc15; font-size: 22px; font-weight: 900; padding: 6px 20px; border-radius: 8px; margin-bottom: 10px; }
      .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 16px; margin-bottom: 20px; font-size: 14px; }
      .lbl { font-weight: 900; }
      table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
      thead tr { background: #e5e7eb; }
      th { text-align: left; padding: 10px 12px; font-size: 14px; font-weight: 900; border: 1px solid #ccc; }
      td { padding: 10px 12px; font-size: 14px; font-weight: 700; border: 1px solid #ccc; }
      .total-box { background: #fef9c3; border: 2px solid #facc15; border-radius: 8px; padding: 12px 20px; text-align: right; font-size: 18px; font-weight: 900; }
      .obs { margin-top: 14px; font-size: 13px; color: #444; }
      .rodape { text-align: center; color: #999; font-size: 12px; margin-top: 32px; }
      @media print { body { padding: 20px 28px; } }
    </style>
    </head><body>
    <div class="header">
      <img src="https://media.base44.com/images/public/69f29a5ddcdad09f087cb710/5c7fee713_logo-sublima-mais.jpg" style="width:70px;height:70px;border-radius:50%;object-fit:cover;" />
      <div><div class="company-name">Sublima Mais</div><div class="company-sub">Produtos para Sublimação</div></div>
    </div>
    <hr class="divider"/>
    <div class="numero-pedido">${pedido.numero || '—'}</div>
    <div class="info-grid">
      <div><span class="lbl">Cliente:</span> ${pedido.cliente || ''}</div>
      <div><span class="lbl">Data:</span> ${dataFormatada}</div>
      <div><span class="lbl">Telefone:</span> ${pedido.telefone || '—'}</div>
      <div><span class="lbl">Origem do Pedido:</span> ${pedido.origem || '—'}</div>
      <div><span class="lbl">Pagamento:</span> ${pedido.forma_pagamento || '—'}</div>
      <div><span class="lbl">Forma de Retirada:</span> ${pedido.forma_retirada || 'RETIRADA EM LOJA'}</div>
      <div><span class="lbl">Status:</span> ${pedido.status || '—'}</div>
      ${pedido.banco_nome ? `<div><span class="lbl">Banco:</span> ${pedido.banco_nome}</div>` : ''}
    </div>
    ${pedido.forma_pagamento === 'MISTO' ? `<div style="margin-bottom:14px;font-size:14px;"><span class="lbl">Detalhe do Pagamento Misto:</span><br/>&nbsp;&nbsp;• ${pedido.pagamento_misto_metodo_1 || ''}: R$ ${(pedido.pagamento_misto_valor_1 || 0).toFixed(2)}<br/>&nbsp;&nbsp;• ${pedido.pagamento_misto_metodo_2 || ''}: R$ ${(pedido.pagamento_misto_valor_2 || 0).toFixed(2)}</div>` : ''}
    <table>
      <thead><tr><th>Item / Descrição</th><th>Qtd/Metros</th><th>Preço Unit.</th><th>Total</th></tr></thead>
      <tbody>
        ${itens.length > 0 ? itens.map(item => {
          const desc = item.descricao ? `${item.tipo} - ${item.descricao}` : item.tipo;
          const qtd = item.metros ? `${parseFloat(item.metros).toFixed(2)}m` : `${item.quantidade || 1}x`;
          return `<tr><td>${desc}</td><td>${qtd}</td><td>R$ ${(item.preco_unitario || 0).toFixed(2)}</td><td>R$ ${(item.total || 0).toFixed(2)}</td></tr>`;
        }).join('') : `<tr><td colspan="4" style="text-align:center;color:#999">Nenhum item</td></tr>`}
      </tbody>
    </table>
    ${pedido.observacoes ? `<div class="obs"><strong>Observações:</strong> ${pedido.observacoes}</div>` : ''}
    <hr class="divider"/>
    <div class="total-box">TOTAL FINAL: R$ ${(pedido.total || 0).toFixed(2)}</div>
    <div class="rodape">Sublima Mais - Produtos para Sublimação</div>
    </body></html>`);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); }, 500);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Pedido de Impressão — {pedido.numero}</DialogTitle></DialogHeader>
        <div className="space-y-3 py-2">
          <div className="border rounded-lg p-4 bg-white space-y-2 text-sm">
            <div className="flex items-center gap-3 mb-2">
              <img src="https://media.base44.com/images/public/69f29a5ddcdad09f087cb710/5c7fee713_logo-sublima-mais.jpg" alt="Logo" style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover' }} />
              <div><div className="font-bold text-sm">Sublima Mais</div><div className="text-xs text-muted-foreground">Produtos para Sublimação</div></div>
            </div>
            <div className="inline-block bg-yellow-300 font-black text-lg px-4 py-1 rounded">{pedido.numero}</div>
            <div className="grid grid-cols-2 gap-1 text-xs mt-2">
              <div><strong>Cliente:</strong> {pedido.cliente}</div>
              <div><strong>Data:</strong> {dataFormatada}</div>
              <div><strong>Telefone:</strong> {pedido.telefone || '—'}</div>
              <div><strong>Origem do Pedido:</strong> {pedido.origem || '—'}</div>
              <div><strong>Pagamento:</strong> {pedido.forma_pagamento}</div>
              <div><strong>Retirada:</strong> {pedido.forma_retirada || 'RETIRADA EM LOJA'}</div>
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
              <thead><tr className="bg-gray-100"><th className="border px-2 py-1 text-left">Item</th><th className="border px-2 py-1">Qtd/m</th><th className="border px-2 py-1">Unit.</th><th className="border px-2 py-1">Total</th></tr></thead>
              <tbody>
                {itens.map((item, i) => (
                  <tr key={i}>
                    <td className="border px-2 py-1 font-medium">{item.tipo}{item.descricao ? ` - ${item.descricao}` : ''}</td>
                    <td className="border px-2 py-1 text-center">{item.metros ? `${parseFloat(item.metros).toFixed(2)}m` : `${item.quantidade || 1}x`}</td>
                    <td className="border px-2 py-1 text-right">R$ {(item.preco_unitario || 0).toFixed(2)}</td>
                    <td className="border px-2 py-1 text-right font-bold">R$ {(item.total || 0).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="bg-yellow-100 border-2 border-yellow-300 text-right font-black text-base mt-2 px-3 py-2 rounded">
              TOTAL FINAL: R$ {(pedido.total || 0).toFixed(2)}
            </div>
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