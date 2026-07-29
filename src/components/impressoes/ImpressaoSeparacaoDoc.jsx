import React, { useRef, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Printer } from 'lucide-react';
import { format } from 'date-fns';

const LOGO_URL = 'https://media.base44.com/images/public/69f29a5ddcdad09f087cb710/aa4e7c437_logo-sublima-mais.jpg';

export default function ImpressaoSeparacaoDoc({ pedido, open, onOpenChange, autoPrint }) {
  const autoPrintedRef = useRef(null);

  const dataFormatada = pedido?.data
    ? format(new Date(pedido.data + 'T12:00:00'), 'dd/MM/yyyy')
    : format(new Date(), 'dd/MM/yyyy');

  const itens = pedido?.itens || [];
  const isPago = (pedido?.status === 'PAGO' || pedido?.status === 'ENTREGUE' || pedido?.status === 'CONCLUIDO') && pedido?.forma_pagamento !== 'MISTO';

  const handlePrint = () => {
    const itensRows = itens.map(item => {
      const qtdMet = item.metros ? `${item.quantidade || 1} • ${parseFloat(item.metros).toFixed(2)}m` : `${item.quantidade || 1}`;
      const desc = item.descricao ? ` (${item.descricao})` : '';
      return `<tr><td>${item.tipo || ''}${desc}</td><td class="qtd">${qtdMet}</td></tr>`;
    }).join('') || '<tr><td colspan="2" style="text-align:center;color:#999">Nenhum item</td></tr>';

    const win = window.open('', '_blank', 'width=700,height=900');
    win.document.write(`<!DOCTYPE html>
<html><head>
<meta charset="utf-8">
<title>Sep. ${pedido.numero || ''}</title>
<style>
  @page { size: A5 portrait; margin: 0; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; background: #fff; color: #000; }
  .page { width: 148mm; height: 210mm; overflow: hidden; padding: 5mm; display: flex; flex-direction: column; position: relative; }
  .pago-stamp { position: absolute; top: 60mm; right: 10mm; border: 4px solid #16a34a; color: #16a34a; font-size: 26px; font-weight: 900; padding: 4px 10px; border-radius: 6px; transform: rotate(-20deg); opacity: 0.35; pointer-events: none; letter-spacing: 2px; }
  .ci { transform-origin: top left; width: 138mm; }
  .logo-wrap { text-align: center; margin-bottom: 3px; }
  .logo-wrap img { width: 52px; height: 52px; border-radius: 50%; object-fit: cover; }
  hr { border: none; border-top: 1.5px solid #bbb; margin: 3px 0; }
  .titulo { text-align: center; font-size: 14px; font-weight: 900; margin-bottom: 3px; letter-spacing: 1px; }
  .data { font-size: 10px; font-weight: bold; margin-bottom: 3px; }
  .cliente-bloco { background: #FFD700; padding: 3px 8px; font-size: 12px; font-weight: 900; margin-bottom: 3px; border-radius: 3px; word-break: break-word; }
  .retirada { font-size: 10px; font-weight: bold; margin-bottom: 3px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 3px; }
  thead tr { background: #f0f0f0; }
  th { padding: 3px 5px; text-align: left; font-size: 10px; font-weight: bold; border: 1px solid #888; }
  td { padding: 2px 5px; font-size: 10px; font-weight: bold; border: 1px solid #aaa; word-break: break-word; line-height: 1.15; }
  td.qtd { width: 50px; text-align: center; }
  tr:nth-child(even) td { background: #f9f9f9; }
  .rodape { border-top: 1px solid #ccc; padding-top: 4px; margin-top: 4px; display: flex; justify-content: space-between; align-items: flex-end; }
  .assin { border-top: 1px solid #333; margin-top: 16px; padding-top: 2px; font-size: 9px; min-width: 130px; }
  .horario { text-align: right; font-size: 10px; font-weight: bold; }
  .num-box { background: #FFD700; border-radius: 10px; padding: 8px 14px; text-align: center; margin-top: 6px; }
  .num-label { font-size: 16px; font-weight: 900; line-height: 1; }
  .num-value { font-size: 24px; font-weight: 900; letter-spacing: 2px; line-height: 1.1; }
  .footer { text-align: center; color: #aaa; font-size: 8px; margin-top: 3px; }
</style>
</head><body>
<div class="page">
  ${isPago ? '<div class="pago-stamp">PAGO</div>' : ''}
  <div class="ci" id="ci">
    <div class="logo-wrap"><img src="${LOGO_URL}" /></div>
    <hr/>
    <div class="titulo">FICHA DE SEPARA&Ccedil;&Atilde;O</div>
    <div class="data">Data: ${dataFormatada}</div>
    <div class="cliente-bloco">Cliente: ${pedido.cliente || ''}</div>
    ${pedido.telefone ? `<div class="retirada">Telefone: ${pedido.telefone}</div>` : ''}
    ${pedido.origem ? `<div class="retirada">Origem do Pedido: ${pedido.origem}</div>` : ''}
    <div class="retirada">Forma de Retirada: ${pedido.forma_retirada || 'RETIRADA EM LOJA'}</div>
    ${pedido.forma_pagamento === 'MISTO' ? `<div class="retirada">Pagamento: MISTO &nbsp;&mdash;&nbsp; ${pedido.pagamento_misto_metodo_1 || ''}: R$ ${(pedido.pagamento_misto_valor_1 || 0).toFixed(2)} + ${pedido.pagamento_misto_metodo_2 || ''}: R$ ${(pedido.pagamento_misto_valor_2 || 0).toFixed(2)}</div>` : ''}
    ${pedido.banco_nome ? `<div class="retirada">Banco: ${pedido.banco_nome}</div>` : ''}
    <table>
      <thead><tr><th>Item</th><th>Qtd / Metragem</th></tr></thead>
      <tbody>${itensRows}</tbody>
    </table>
    <div class="rodape">
      <div class="assin">Assinatura de quem separou</div>
      <div class="horario">Hor&aacute;rio: ___:___</div>
    </div>
    <div class="num-box">
      <div class="num-label">N&deg;</div>
      <div class="num-value">${pedido.numero || '—'}</div>
    </div>
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
    win.focus();
  };

  useEffect(() => {
    if (open && autoPrint && pedido?.id && autoPrintedRef.current !== pedido.id) {
      autoPrintedRef.current = pedido.id;
      const t = setTimeout(() => handlePrint(), 300);
      return () => clearTimeout(t);
    }
  }, [open, autoPrint, pedido?.id]);

  if (!pedido) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Ficha de Separação — {pedido.numero}</DialogTitle></DialogHeader>
        <div className="space-y-3 py-2">
          <div className="border rounded-lg p-4 bg-white space-y-2 text-sm relative overflow-hidden">
            {isPago && (
              <div className="absolute top-16 right-4 border-4 border-green-600 text-green-600 text-xl font-black px-2 py-1 rounded opacity-30 rotate-[-20deg] pointer-events-none">PAGO</div>
            )}
            <div className="flex justify-center mb-2">
              <img src={LOGO_URL} alt="Logo" style={{ width: '52px', height: '52px', borderRadius: '50%', objectFit: 'cover' }} />
            </div>
            <div className="text-center font-bold text-base">FICHA DE SEPARAÇÃO</div>
            <div><strong>Data:</strong> {dataFormatada}</div>
            <div className="bg-yellow-300 px-3 py-2 rounded font-black text-base">Cliente: {pedido.cliente}</div>
            {pedido.telefone && <div><strong>Telefone:</strong> {pedido.telefone}</div>}
            {pedido.origem && <div><strong>Origem do Pedido:</strong> {pedido.origem}</div>}
            <div><strong>Forma de Retirada:</strong> {pedido.forma_retirada || 'RETIRADA EM LOJA'}</div>
            {pedido.forma_pagamento === 'MISTO' && (
              <div className="text-xs">
                <strong>Pagamento: MISTO</strong> — {pedido.pagamento_misto_metodo_1}: R$ {(pedido.pagamento_misto_valor_1 || 0).toFixed(2)} + {pedido.pagamento_misto_metodo_2}: R$ {(pedido.pagamento_misto_valor_2 || 0).toFixed(2)}
              </div>
            )}
            {pedido.banco_nome && <div className="text-xs"><strong>Banco:</strong> {pedido.banco_nome}</div>}
            <table className="w-full border text-xs mt-2">
              <thead><tr className="bg-gray-100"><th className="border px-2 py-1 text-left">Item</th><th className="border px-2 py-1 text-left">Qtd / Metragem</th></tr></thead>
              <tbody>
                {itens.map((item, i) => (
                  <tr key={i}>
                    <td className="border px-2 py-1 font-bold">{item.tipo}{item.descricao ? ` (${item.descricao})` : ''}</td>
                    <td className="border px-2 py-1 font-bold">{item.metros ? `${item.quantidade || 1} • ${parseFloat(item.metros).toFixed(2)}m` : `${item.quantidade || 1}`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="bg-yellow-300 text-center rounded-lg py-3 mt-3 font-black text-xl">PEDIDO Nº {pedido.numero}</div>
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