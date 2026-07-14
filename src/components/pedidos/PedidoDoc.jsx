import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Printer } from 'lucide-react';
import { format } from 'date-fns';

const LOGO_URL = 'https://media.base44.com/images/public/69f29a5ddcdad09f087cb710/56eda8412_16b4d9f6-8ee3-4f42-8e30-74da230042df.png';

export default function PedidoDoc({ open, onOpenChange, pedido }) {
  if (!pedido) return null;

  const dataFormatada = pedido.data
    ? format(new Date(pedido.data + 'T12:00:00'), 'dd/MM/yyyy')
    : '—';

  const subtotal = pedido.subtotal || 0;
  const desconto = pedido.desconto || 0;
  const totalPix = pedido.total_pix || (subtotal - desconto);
  const totalCartao = pedido.total_cartao || subtotal;
  const totalFinal = pedido.total || totalPix;

  const isCartao = pedido.forma_pagamento === 'CARTAO';
  const isPix = pedido.forma_pagamento === 'PIX' || pedido.forma_pagamento === 'DINHEIRO';

  const handlePrint = () => {
    const itensRows = (pedido.itens || []).map((item) => {
      const preco = isCartao ? item.preco_unitario_cartao : item.preco_unitario_pix;
      const tot = (item.quantidade || 0) * (preco || 0);
      return `<tr>
        <td>${item.produto_nome || ''}</td>
        <td class="center">${item.quantidade || ''}</td>
        <td class="right">R$ ${(preco || 0).toFixed(2)}</td>
        <td class="right">R$ ${tot.toFixed(2)}</td>
      </tr>`;
    }).join('');

    const totaisHtml = `
      ${subtotal !== totalFinal ? `<p><strong>Subtotal:</strong> R$ ${subtotal.toFixed(2)}</p>` : ''}
      ${isPix && desconto > 0 ? `<p class="green"><strong>Desconto PIX/Dinheiro:</strong> -R$ ${desconto.toFixed(2)}</p>` : ''}
      <p class="total-final">TOTAL: R$ ${totalFinal.toFixed(2)}</p>
    `;

    const win = window.open('', '', 'width=900,height=700');
    win.document.write(`<!DOCTYPE html>
<html><head>
<title>Pedido ${pedido.numero_pedido}</title>
<meta charset="utf-8">
<style>
  @page { size: A5 portrait; margin: 0; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; background: #fff; color: #000; }
  .page { width: 148mm; height: 210mm; overflow: hidden; padding: 5mm; position: relative; }
  .ci { transform-origin: top left; width: 138mm; }
  .logo-wrap { text-align: center; margin-bottom: 4px; }
  .logo-wrap img { width: 52px; height: 52px; border-radius: 50%; object-fit: cover; }
  hr { border: none; border-top: 1.5px solid #ccc; margin: 4px 0; }
  .titulo { text-align: center; font-size: 15px; font-weight: 900; margin-bottom: 4px; letter-spacing: 1px; }
  .num-box { background: #FFD700; border-radius: 8px; padding: 5px 14px; font-size: 18px; font-weight: 900; display: inline-block; letter-spacing: 2px; }
  .num-wrap { text-align: center; margin-bottom: 6px; }
  .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 2px 12px; margin-bottom: 4px; font-size: 11px; }
  .info-linha { font-size: 11px; font-weight: bold; margin-bottom: 3px; }
  table { width: 100%; border-collapse: collapse; margin: 5px 0; }
  thead tr { background: #f0f0f0; }
  th { padding: 3px 5px; text-align: left; font-size: 11px; font-weight: bold; border: 1px solid #bbb; }
  td { padding: 3px 5px; font-size: 11px; border: 1px solid #ddd; }
  td.center { text-align: center; }
  td.right { text-align: right; }
  .totais { margin-top: 5px; text-align: right; font-size: 11px; }
  .totais p { margin-bottom: 2px; }
  .totais p.green { color: #16a34a; }
  .totais p.total-final { font-size: 15px; font-weight: 900; margin-top: 4px; }
  .footer { text-align: center; color: #aaa; font-size: 9px; margin-top: 6px; }
</style>
</head><body>
<div class="page">
  <div class="ci" id="ci">
    <div class="logo-wrap"><img src="${LOGO_URL}" /></div>
    <hr/>
    <div class="titulo">PEDIDO</div>
    <div class="num-wrap"><div class="num-box">N&ordm; ${pedido.numero_pedido || ''}</div></div>
    <div class="info-grid">
      <p><strong>Data:</strong> ${dataFormatada}</p>
      <p><strong>Hor&aacute;rio:</strong> ${pedido.horario || '&mdash;'}</p>
      <p><strong>Vendedor:</strong> ${pedido.vendedor || '&mdash;'}</p>
      <p><strong>Origem:</strong> ${pedido.origem || '&mdash;'}</p>
    </div>
    <p class="info-linha"><strong>Cliente:</strong> ${pedido.cliente || ''}</p>
    ${pedido.telefone ? `<p class="info-linha"><strong>Telefone:</strong> ${pedido.telefone}</p>` : ''}
    <p class="info-linha"><strong>Pagamento:</strong> ${pedido.forma_pagamento || ''}</p>
    ${pedido.forma_pagamento === 'MISTO' ? `<p class="info-linha">&nbsp;&nbsp;• ${pedido.pagamento_misto_metodo_1 || ''}: R$ ${(pedido.pagamento_misto_valor_1 || 0).toFixed(2)}<br/>&nbsp;&nbsp;• ${pedido.pagamento_misto_metodo_2 || ''}: R$ ${(pedido.pagamento_misto_valor_2 || 0).toFixed(2)}</p>` : ''}
    ${pedido.banco ? `<p class="info-linha"><strong>Banco:</strong> ${pedido.banco}</p>` : ''}
    ${pedido.forma_retirada ? `<p class="info-linha"><strong>Retirada:</strong> ${pedido.forma_retirada}</p>` : ''}
    <table>
      <thead><tr><th>Item</th><th>Qtd</th><th>Unit.</th><th>Total</th></tr></thead>
      <tbody>${itensRows}</tbody>
    </table>
    <div class="totais">${totaisHtml}</div>
    ${pedido.observacoes ? `<p style="font-size:10px;margin-top:4px;"><strong>Obs:</strong> ${pedido.observacoes}</p>` : ''}
    <div class="footer">Sublima Mais &mdash; Produtos para Sublima&ccedil;&atilde;o</div>
  </div>
</div>
<script>
  window.onload = function() {
    var ci = document.getElementById('ci');
    var page = ci.parentElement;
    var availH = page.offsetHeight - 10;
    var availW = page.offsetWidth - 10;
    var actualH = ci.scrollHeight;
    var actualW = ci.scrollWidth;
    if (actualH > availH || actualW > availW) {
      var scale = Math.min(availH / actualH, availW / actualW, 1);
      ci.style.transform = 'scale(' + scale + ')';
      ci.style.transformOrigin = 'top left';
      ci.style.width = (100 / scale) + '%';
    }
    setTimeout(function(){ window.print(); }, 400);
  };
</script>
</body></html>`);
    win.document.close();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            Pedido
            <Button size="sm" onClick={handlePrint}>
              <Printer className="w-4 h-4 mr-1" /> Imprimir
            </Button>
          </DialogTitle>
        </DialogHeader>

        <div style={{ fontFamily: 'Arial, Helvetica, sans-serif', fontSize: '12px', background: '#fff', color: '#000' }}>
          <div style={{ textAlign: 'center', marginBottom: '8px' }}>
            <img src={LOGO_URL} alt="Logo" style={{ width: '60px', height: '60px', borderRadius: '50%', objectFit: 'cover' }} />
          </div>
          <hr style={{ border: 'none', borderTop: '1.5px solid #ccc', margin: '6px 0' }} />
          <div style={{ textAlign: 'center', fontSize: '16px', fontWeight: '900', marginBottom: '6px' }}>PEDIDO</div>
          <div style={{ textAlign: 'center', marginBottom: '8px' }}>
            <span style={{ background: '#FFD700', borderRadius: '8px', padding: '4px 14px', fontSize: '18px', fontWeight: '900', letterSpacing: '2px', display: 'inline-block' }}>
              Nº {pedido.numero_pedido}
            </span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px 12px', marginBottom: '4px', fontSize: '11px' }}>
            <p><strong>Data:</strong> {dataFormatada}</p>
            <p><strong>Horário:</strong> {pedido.horario || '—'}</p>
            <p><strong>Vendedor:</strong> {pedido.vendedor || '—'}</p>
            <p><strong>Origem:</strong> {pedido.origem || '—'}</p>
          </div>
          <p style={{ fontSize: '11px', fontWeight: 'bold', marginBottom: '3px' }}><strong>Cliente:</strong> {pedido.cliente}</p>
          {pedido.telefone && <p style={{ fontSize: '11px', marginBottom: '3px' }}><strong>Telefone:</strong> {pedido.telefone}</p>}
          <p style={{ fontSize: '11px', marginBottom: '3px' }}><strong>Pagamento:</strong> {pedido.forma_pagamento}</p>
          {pedido.forma_pagamento === 'MISTO' && (
            <p style={{ fontSize: '11px', marginBottom: '3px', paddingLeft: '10px' }}>
              • {pedido.pagamento_misto_metodo_1}: R$ {(pedido.pagamento_misto_valor_1 || 0).toFixed(2)}<br/>
              • {pedido.pagamento_misto_metodo_2}: R$ {(pedido.pagamento_misto_valor_2 || 0).toFixed(2)}
            </p>
          )}
          {pedido.banco && <p style={{ fontSize: '11px', marginBottom: '3px' }}><strong>Banco:</strong> {pedido.banco}</p>}
          {pedido.forma_retirada && <p style={{ fontSize: '11px', marginBottom: '5px' }}><strong>Retirada:</strong> {pedido.forma_retirada}</p>}

          <table style={{ width: '100%', borderCollapse: 'collapse', margin: '6px 0' }}>
            <thead>
              <tr style={{ background: '#f0f0f0' }}>
                <th style={{ padding: '4px 6px', textAlign: 'left', fontSize: '11px', border: '1px solid #bbb' }}>Item</th>
                <th style={{ padding: '4px 6px', textAlign: 'center', fontSize: '11px', border: '1px solid #bbb' }}>Qtd</th>
                <th style={{ padding: '4px 6px', textAlign: 'right', fontSize: '11px', border: '1px solid #bbb' }}>Unit.</th>
                <th style={{ padding: '4px 6px', textAlign: 'right', fontSize: '11px', border: '1px solid #bbb' }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {pedido.itens?.map((item, i) => {
                const preco = isCartao ? item.preco_unitario_cartao : item.preco_unitario_pix;
                const tot = (item.quantidade || 0) * (preco || 0);
                return (
                  <tr key={i} style={{ background: i % 2 === 1 ? '#fafafa' : '#fff' }}>
                    <td style={{ padding: '4px 6px', fontSize: '11px', border: '1px solid #ddd' }}>{item.produto_nome}</td>
                    <td style={{ padding: '4px 6px', fontSize: '11px', border: '1px solid #ddd', textAlign: 'center' }}>{item.quantidade}</td>
                    <td style={{ padding: '4px 6px', fontSize: '11px', border: '1px solid #ddd', textAlign: 'right' }}>R$ {(preco || 0).toFixed(2)}</td>
                    <td style={{ padding: '4px 6px', fontSize: '11px', border: '1px solid #ddd', textAlign: 'right' }}>R$ {tot.toFixed(2)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <div style={{ textAlign: 'right', fontSize: '11px', marginTop: '4px' }}>
            {subtotal !== totalFinal && <p style={{ marginBottom: '2px' }}><strong>Subtotal:</strong> R$ {subtotal.toFixed(2)}</p>}
            {isPix && desconto > 0 && <p style={{ color: '#16a34a', marginBottom: '2px' }}><strong>Desconto PIX/Dinheiro:</strong> -R$ {desconto.toFixed(2)}</p>}
            <p style={{ fontSize: '16px', fontWeight: '900', marginTop: '4px' }}>TOTAL: R$ {totalFinal.toFixed(2)}</p>
          </div>

          {pedido.observacoes && <p style={{ fontSize: '10px', marginTop: '6px' }}><strong>Obs:</strong> {pedido.observacoes}</p>}
          <div style={{ textAlign: 'center', color: '#aaa', fontSize: '10px', marginTop: '8px' }}>Sublima Mais — Produtos para Sublimação</div>
        </div>
      </DialogContent>
    </Dialog>
  );
}