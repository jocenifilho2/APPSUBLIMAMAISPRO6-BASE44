import React, { useRef, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Printer } from 'lucide-react';
import { format } from 'date-fns';

const LOGO_URL = 'https://media.base44.com/images/public/69f29a5ddcdad09f087cb710/56eda8412_16b4d9f6-8ee3-4f42-8e30-74da230042df.png';

export default function SeparacaoDoc({ open, onOpenChange, pedido, autoPrint }) {
  const autoPrintedRef = useRef(null);

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

    const win = window.open('', '', 'width=900,height=700');
    win.document.write(`<!DOCTYPE html>
<html><head>
<title>Sep. ${pedido.numero_pedido}</title>
<meta charset="utf-8">
<style>
  @page { size: A5 portrait; margin: 0; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; background: #fff; color: #000; }
  .page { width: 148mm; height: 210mm; position: relative; padding: 5mm 5mm 46mm 5mm; overflow: hidden; }
  .conteudo { transform-origin: top left; }
  .logo-wrap { text-align: center; margin-bottom: 3px; }
  .logo-wrap img { width: 48px; height: 48px; border-radius: 50%; object-fit: cover; }
  hr { border: none; border-top: 1.5px solid #bbb; margin: 4px 0; }
  .titulo { text-align: center; font-size: 15px; font-weight: 900; margin-bottom: 4px; letter-spacing: 1px; }
  .data { font-size: 11px; font-weight: bold; margin-bottom: 4px; }
  .cliente-bloco { background: ${clienteBg}; color: ${clienteColor}; padding: 4px 8px; font-size: 13px; font-weight: 900; margin-bottom: 4px; border-radius: 3px; word-break: break-word; }
  .retirada { font-size: 11px; font-weight: bold; margin-bottom: 4px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 4px; }
  thead tr { background: #f0f0f0; }
  th { padding: 4px 5px; text-align: left; font-size: 11px; font-weight: bold; border: 1px solid #888; }
  th.right, td.right { text-align: right; }
  th.center, td.center { text-align: center; }
  td { padding: 3px 5px; font-size: 11px; font-weight: bold; border: 1px solid #aaa; word-break: break-word; line-height: 1.2; }
  tr:nth-child(even) td { background: #f9f9f9; }
  .totais { text-align: right; font-size: 11px; margin-top: 4px; }
  .totais p { margin-bottom: 1px; }
  .totais p.green { color: #16a34a; }
  .totais p.total-final { font-size: 14px; font-weight: 900; margin-top: 3px; border-top: 1.5px solid #333; padding-top: 3px; }
  /* Rodapé fixo na parte inferior da página */
  .rodape-fixo { position: absolute; bottom: 5mm; left: 5mm; right: 5mm; }
  .assin-linha { display: flex; justify-content: space-between; align-items: flex-end; border-top: 1px solid #ccc; padding-top: 4px; margin-bottom: 5px; }
  .assin { border-top: 1px solid #333; margin-top: 18px; padding-top: 2px; font-size: 10px; min-width: 130px; }
  .horario { text-align: right; font-size: 11px; font-weight: bold; }
  .num-box { background: #FFD700; border-radius: 10px; padding: 6px 14px; text-align: center; }
  .num-label { font-size: 16px; font-weight: 900; line-height: 1; }
  .num-value { font-size: 24px; font-weight: 900; letter-spacing: 2px; line-height: 1.1; }
  .footer { text-align: center; color: #aaa; font-size: 9px; margin-top: 4px; }
</style>
</head><body>
<div class="page">
  <div class="conteudo" id="ci">
    <div class="logo-wrap"><img src="${LOGO_URL}" /></div>
    <hr/>
    <div class="titulo">FICHA DE SEPARA&Ccedil;&Atilde;O</div>
    <div class="data">Data: ${dataFormatada} &nbsp;&nbsp; N&ordm;: ${pedido.numero_pedido || ''}</div>
    <div class="cliente-bloco">Cliente: ${pedido.cliente || ''}</div>
    ${pedido.telefone ? `<div class="retirada">Telefone: ${pedido.telefone}</div>` : ''}
    ${pedido.origem ? `<div class="retirada">Origem do Pedido: ${pedido.origem}</div>` : ''}
    ${pedido.forma_retirada ? `<div class="retirada">Retirada: ${pedido.forma_retirada}</div>` : ''}
    ${pedido.forma_pagamento === 'MISTO' ? `<div class="retirada">Pagamento: MISTO &nbsp;&mdash;&nbsp; ${pedido.pagamento_misto_metodo_1 || ''}: R$ ${(pedido.pagamento_misto_valor_1 || 0).toFixed(2)} + ${pedido.pagamento_misto_metodo_2 || ''}: R$ ${(pedido.pagamento_misto_valor_2 || 0).toFixed(2)}</div>` : ''}
    ${pedido.banco ? `<div class="retirada">Banco: ${pedido.banco}</div>` : ''}
    ${pedido.observacoes ? `<div class="retirada" style="background:#fff8d6;border:1px solid #e0c93a;padding:4px 6px;border-radius:3px;"><strong>Observações:</strong> ${pedido.observacoes}</div>` : ''}
    <table>
      <thead><tr><th>Item</th><th class="center">Qtd</th><th class="right">Unit.</th><th class="right">Total</th></tr></thead>
      <tbody>${itensRows}</tbody>
    </table>
    <div class="totais">
      ${subtotal !== totalFinal ? `<p><strong>Subtotal:</strong> R$ ${subtotal.toFixed(2)}</p>` : ''}
      ${isPix && desconto > 0 ? `<p class="green"><strong>Desconto PIX/Dinheiro:</strong> -R$ ${desconto.toFixed(2)}</p>` : ''}
      <p class="total-final">TOTAL: R$ ${totalFinal.toFixed(2)}</p>
    </div>
    ${((pedido.status === 'PAGO' || pedido.status === 'CONCLUIDO' || pedido.status === 'ENTREGUE') && pedido.forma_pagamento !== 'MISTO') ? `<div style="font-size:40px;font-weight:900;color:rgba(0,180,0,0.18);text-align:center;margin-top:8px;letter-spacing:6px;transform:rotate(-15deg);">PAGO</div>` : ''}
  </div>
  <!-- Rodapé sempre fixo no final da página -->
  <div class="rodape-fixo">
    <div class="assin-linha">
      <div class="assin">Assinatura de quem separou</div>
      <div class="horario">Hor&aacute;rio: ___:___</div>
    </div>
    <div class="num-box">
      <div class="num-label">N&deg;</div>
      <div class="num-value">${pedido.numero_pedido || ''}</div>
    </div>
    <div class="footer">Sublima Mais &mdash; Produtos para Sublima&ccedil;&atilde;o</div>
  </div>
</div>
<script>
  window.onload = function() {
    var ci = document.getElementById('ci');
    var page = ci.parentElement;
    // Área disponível descontando o rodapé fixo (46mm ≈ 174px a 96dpi)
    var rodapeH = page.offsetHeight * (46 / 210);
    var availH = page.offsetHeight - rodapeH - 20;
    var availW = page.offsetWidth - 20;
    var actualH = ci.scrollHeight;
    var actualW = ci.scrollWidth;
    if (actualH > availH || actualW > availW) {
      var scale = Math.min(availH / actualH, availW / actualW, 1);
      ci.style.transform = 'scale(' + scale + ')';
      ci.style.transformOrigin = 'top left';
    }
    setTimeout(function(){ window.print(); }, 400);
  };
</script>
</body></html>`);
    win.document.close();
  };

  useEffect(() => {
    if (open && autoPrint && pedido?.id && autoPrintedRef.current !== pedido.id) {
      autoPrintedRef.current = pedido.id;
      const t = setTimeout(() => handlePrint(), 300);
      return () => clearTimeout(t);
    }
  }, [open, autoPrint, pedido?.id]);

  if (!pedido) return null;

  const dataFormatada = pedido.data
    ? format(new Date(pedido.data + 'T12:00:00'), 'dd/MM/yyyy')
    : '—';

  const isAtualizado = (pedido.cliente || '').toUpperCase().includes('ATUALIZADO');
  const clienteBg = isAtualizado ? '#dc2626' : '#FFD700';
  const clienteColor = isAtualizado ? '#ffffff' : '#000000';

  const isCartao = pedido.forma_pagamento === 'CARTAO';
  const isPix = pedido.forma_pagamento === 'PIX' || pedido.forma_pagamento === 'DINHEIRO';
  const subtotal = pedido.subtotal || 0;
  const desconto = pedido.desconto || 0;
  const totalPix = pedido.total_pix || (subtotal - desconto);
  const totalCartao = pedido.total_cartao || subtotal;
  const totalFinal = pedido.total || totalPix;

  const clienteStyle = isAtualizado
    ? { background: '#dc2626', color: '#fff', padding: '5px 10px', fontSize: '13px', fontWeight: '900', marginBottom: '6px', borderRadius: '4px' }
    : { background: '#FFD700', padding: '5px 10px', fontSize: '13px', fontWeight: '900', marginBottom: '6px', borderRadius: '4px' };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            Ficha de Separação
            <Button size="sm" onClick={handlePrint}>
              <Printer className="w-4 h-4 mr-1" /> Imprimir
            </Button>
          </DialogTitle>
        </DialogHeader>

        <div style={{ fontFamily: 'Arial, Helvetica, sans-serif', fontSize: '13px', background: '#fff', color: '#000' }}>
          <div style={{ textAlign: 'center', marginBottom: '6px' }}>
            <img src={LOGO_URL} alt="Logo" style={{ width: '50px', height: '50px', borderRadius: '50%', objectFit: 'cover' }} />
          </div>
          <hr style={{ border: 'none', borderTop: '1.5px solid #bbb', margin: '4px 0' }} />
          <div style={{ textAlign: 'center', fontSize: '15px', fontWeight: '900', marginBottom: '4px' }}>FICHA DE SEPARAÇÃO</div>
          <div style={{ fontSize: '12px', fontWeight: 'bold', marginBottom: '4px' }}>Data: {dataFormatada} &nbsp; Nº: {pedido.numero_pedido}</div>
          <div style={clienteStyle}>Cliente: {pedido.cliente}</div>
          {pedido.telefone && (
            <div style={{ fontSize: '12px', fontWeight: 'bold', marginBottom: '4px' }}>Telefone: {pedido.telefone}</div>
          )}
          {pedido.origem && (
            <div style={{ fontSize: '12px', fontWeight: 'bold', marginBottom: '4px' }}>Origem do Pedido: {pedido.origem}</div>
          )}
          {pedido.forma_retirada && (
            <div style={{ fontSize: '12px', fontWeight: 'bold', marginBottom: '4px' }}>Retirada: {pedido.forma_retirada}</div>
          )}
          {pedido.forma_pagamento === 'MISTO' && (
            <div style={{ fontSize: '12px', fontWeight: 'bold', marginBottom: '4px' }}>
              Pagamento: MISTO — {pedido.pagamento_misto_metodo_1}: R$ {(pedido.pagamento_misto_valor_1 || 0).toFixed(2)} + {pedido.pagamento_misto_metodo_2}: R$ {(pedido.pagamento_misto_valor_2 || 0).toFixed(2)}
            </div>
          )}
          {pedido.banco && (
            <div style={{ fontSize: '12px', fontWeight: 'bold', marginBottom: '4px' }}>Banco: {pedido.banco}</div>
          )}
          {pedido.observacoes && (
            <div style={{ fontSize: '12px', fontWeight: 'bold', marginBottom: '4px', background: '#fff8d6', border: '1px solid #e0c93a', padding: '4px 6px', borderRadius: '3px' }}><strong>Observações:</strong> {pedido.observacoes}</div>
          )}
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '6px' }}>
            <thead>
              <tr style={{ background: '#f0f0f0' }}>
                <th style={{ padding: '4px 6px', textAlign: 'left', fontSize: '11px', border: '1px solid #888' }}>Item</th>
                <th style={{ padding: '4px 6px', textAlign: 'center', fontSize: '11px', border: '1px solid #888', width: '36px' }}>Qtd</th>
                <th style={{ padding: '4px 6px', textAlign: 'right', fontSize: '11px', border: '1px solid #888' }}>Unit.</th>
                <th style={{ padding: '4px 6px', textAlign: 'right', fontSize: '11px', border: '1px solid #888' }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {pedido.itens?.map((item, i) => {
                const preco = isCartao ? item.preco_unitario_cartao : item.preco_unitario_pix;
                const tot = (item.quantidade || 0) * (preco || 0);
                return (
                  <tr key={i} style={{ background: i % 2 === 1 ? '#fafafa' : '#fff' }}>
                    <td style={{ padding: '3px 6px', fontSize: '11px', fontWeight: 'bold', border: '1px solid #aaa' }}>{item.produto_nome}</td>
                    <td style={{ padding: '3px 6px', fontSize: '11px', fontWeight: 'bold', border: '1px solid #aaa', textAlign: 'center' }}>{item.quantidade}</td>
                    <td style={{ padding: '3px 6px', fontSize: '11px', fontWeight: 'bold', border: '1px solid #aaa', textAlign: 'right' }}>R$ {(preco || 0).toFixed(2)}</td>
                    <td style={{ padding: '3px 6px', fontSize: '11px', fontWeight: 'bold', border: '1px solid #aaa', textAlign: 'right' }}>R$ {tot.toFixed(2)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div style={{ textAlign: 'right', fontSize: '11px', marginBottom: '8px' }}>
            {subtotal !== totalFinal && <p style={{ marginBottom: '2px' }}><strong>Subtotal:</strong> R$ {subtotal.toFixed(2)}</p>}
            {isPix && desconto > 0 && <p style={{ color: '#16a34a', marginBottom: '2px' }}><strong>Desconto PIX/Dinheiro:</strong> -R$ {desconto.toFixed(2)}</p>}
            <p style={{ fontSize: '14px', fontWeight: '900', borderTop: '1.5px solid #333', paddingTop: '3px', marginTop: '3px' }}>TOTAL: R$ {totalFinal.toFixed(2)}</p>
          </div>
          {(pedido.status === 'PAGO' || pedido.status === 'CONCLUIDO' || pedido.status === 'ENTREGUE') && pedido.forma_pagamento !== 'MISTO' && (
            <div style={{ fontSize: '40px', fontWeight: 900, color: 'rgba(0,180,0,0.18)', textAlign: 'center', marginBottom: '4px', letterSpacing: '6px', transform: 'rotate(-15deg)' }}>
              PAGO
            </div>
          )}
          {/* Rodapé — sempre no final */}
          <div style={{ borderTop: '1px solid #ccc', paddingTop: '5px', marginBottom: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
              <div style={{ borderTop: '1px solid #333', marginTop: '20px', paddingTop: '2px', fontSize: '10px', minWidth: '140px' }}>Assinatura de quem separou</div>
              <div style={{ textAlign: 'right', fontSize: '11px', fontWeight: 'bold' }}>Horário: ___:___</div>
            </div>
          </div>
          <div style={{ background: '#FFD700', borderRadius: '10px', padding: '8px', textAlign: 'center' }}>
            <div style={{ fontSize: '16px', fontWeight: '900', lineHeight: 1 }}>N°</div>
            <div style={{ fontSize: '24px', fontWeight: '900', letterSpacing: '2px', lineHeight: 1.1 }}>{pedido.numero_pedido}</div>
          </div>
          <div style={{ textAlign: 'center', color: '#aaa', fontSize: '10px', marginTop: '4px' }}>Sublima Mais — Produtos para Sublimação</div>
        </div>
      </DialogContent>
    </Dialog>
  );
}