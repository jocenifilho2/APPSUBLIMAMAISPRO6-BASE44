import React, { useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Printer } from 'lucide-react';
import { format } from 'date-fns';

export default function ReciboDoc({ open, onOpenChange, pedido }) {
  const printRef = useRef();

  const handlePrint = () => {
    const content = printRef.current?.innerHTML || '';
    const win = window.open('', '', 'width=900,height=700');
    win.document.write(`<!DOCTYPE html><html><head><title>Recibo</title>
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body { font-family: Arial, Helvetica, sans-serif; font-size: 14px; background: #fff; color: #000; padding: 30px 40px; }
      .logo-row { display: flex; align-items: center; gap: 14px; margin-bottom: 12px; }
      .logo-circle { width: 60px; height: 60px; background: #FFD700; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 10px; font-weight: bold; text-align: center; border: 3px solid #e00; }
      .empresa-nome { font-size: 20px; font-weight: bold; }
      .empresa-sub { font-size: 13px; color: #555; }
      .separador { border: none; border-top: 2px solid #ccc; margin: 12px 0; }
      .titulo { text-align: center; font-size: 20px; font-weight: bold; margin-bottom: 16px; }
      .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 20px; margin-bottom: 14px; }
      .info-linha { font-size: 14px; font-weight: bold; margin-bottom: 6px; }
      table { width: 100%; border-collapse: collapse; margin: 12px 0; }
      thead tr { background: #f0f0f0; }
      th { padding: 8px 12px; text-align: left; font-size: 14px; font-weight: bold; border: 1px solid #bbb; }
      td { padding: 9px 12px; font-size: 14px; border: 1px solid #ddd; }
      .totais { margin-top: 14px; text-align: right; }
      .totais p { font-size: 14px; margin-bottom: 4px; }
      .total-final { font-size: 20px; font-weight: 900; margin-top: 8px; }
      .pago-stamp { font-size: 60px; font-weight: 900; color: rgba(0,180,0,0.18); text-align: center; margin-top: 20px; letter-spacing: 8px; transform: rotate(-15deg); display: block; }
      .footer-text { text-align: center; color: #888; font-size: 12px; margin-top: 30px; }
    </style>
    </head><body>${content}</body></html>`);
    win.document.close();
    setTimeout(() => win.print(), 500);
  };

  if (!pedido) return null;

  const dataFormatada = pedido.data
    ? format(new Date(pedido.data + 'T12:00:00'), 'dd/MM/yyyy')
    : '—';

  const subtotal = pedido.subtotal || 0;
  const desconto = pedido.desconto || 0;
  const totalFinal = pedido.total || 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            Recibo de Pedido
            <Button size="sm" onClick={handlePrint}>
              <Printer className="w-4 h-4 mr-1" /> Imprimir
            </Button>
          </DialogTitle>
        </DialogHeader>

        <div ref={printRef} style={{ fontFamily: 'Arial, Helvetica, sans-serif', fontSize: '14px', background: '#fff', color: '#000' }}>
          {/* Logo row - estilo do recibo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '12px' }}>
            <img src="https://media.base44.com/images/public/69f29a5ddcdad09f087cb710/56eda8412_16b4d9f6-8ee3-4f42-8e30-74da230042df.png" alt="Sublima Mais" style={{ width: '70px', height: '70px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: '20px', fontWeight: 'bold' }}>Sublima Mais</div>
              <div style={{ fontSize: '13px', color: '#555' }}>Produtos para Sublimação</div>
            </div>
          </div>

          <hr style={{ border: 'none', borderTop: '2px solid #ccc', margin: '10px 0' }} />

          <div style={{ textAlign: 'center', fontSize: '20px', fontWeight: 'bold', marginBottom: '16px' }}>RECIBO DE PEDIDO</div>

          {/* Informações em grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 20px', marginBottom: '14px' }}>
            <p style={{ fontSize: '14px', fontWeight: 'bold' }}><strong>Pedido Nº:</strong> {pedido.numero_pedido}</p>
            <p style={{ fontSize: '14px', fontWeight: 'bold' }}><strong>Data:</strong> {dataFormatada}</p>
          </div>
          <p style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '6px' }}><strong>Cliente:</strong> {pedido.cliente}</p>
          <p style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '6px' }}><strong>Forma de Pagamento:</strong> {pedido.forma_pagamento}</p>
          {pedido.forma_pagamento === 'MISTO' && (
            <p style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '6px', paddingLeft: '10px' }}>
              • {pedido.pagamento_misto_metodo_1}: R$ {(pedido.pagamento_misto_valor_1 || 0).toFixed(2)}<br/>
              • {pedido.pagamento_misto_metodo_2}: R$ {(pedido.pagamento_misto_valor_2 || 0).toFixed(2)}
            </p>
          )}
          {pedido.banco && <p style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '6px' }}><strong>Banco:</strong> {pedido.banco}</p>}
          <p style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '6px' }}><strong>Status:</strong> {pedido.status}</p>
          {pedido.observacoes && (
            <p style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '10px', background: '#fff8d6', border: '1px solid #e0c93a', padding: '6px 10px', borderRadius: '4px' }}><strong>Observações:</strong> {pedido.observacoes}</p>
          )}

          {/* Tabela */}
          <table style={{ width: '100%', borderCollapse: 'collapse', margin: '12px 0' }}>
            <thead>
              <tr style={{ background: '#f0f0f0' }}>
                <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 'bold', border: '1px solid #bbb' }}>Item</th>
                <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 'bold', border: '1px solid #bbb' }}>Qtd</th>
                <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 'bold', border: '1px solid #bbb' }}>Unit.</th>
                <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 'bold', border: '1px solid #bbb' }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {pedido.itens?.map((item, i) => (
                <tr key={i}>
                  <td style={{ padding: '9px 12px', border: '1px solid #ddd' }}>{item.produto_nome}</td>
                  <td style={{ padding: '9px 12px', border: '1px solid #ddd' }}>{item.quantidade}</td>
                  <td style={{ padding: '9px 12px', border: '1px solid #ddd' }}>R$ {item.preco_unitario_cartao?.toFixed(2)}</td>
                  <td style={{ padding: '9px 12px', border: '1px solid #ddd' }}>R$ {(item.quantidade * item.preco_unitario_cartao).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Totais */}
          <div style={{ marginTop: '14px', textAlign: 'right' }}>
            <p style={{ fontSize: '14px', marginBottom: '4px' }}><strong>Subtotal:</strong> R$ {subtotal.toFixed(2)}</p>
            <p style={{ fontSize: '14px', marginBottom: '4px', color: 'green' }}><strong>Desconto:</strong> -R$ {desconto.toFixed(2)}</p>
            <p style={{ fontSize: '20px', fontWeight: '900', marginTop: '8px' }}>TOTAL FINAL: R$ {totalFinal.toFixed(2)}</p>
          </div>

          {/* Carimbo PAGO */}
          {(pedido.status === 'PAGO' || pedido.status === 'CONCLUIDO' || pedido.status === 'ENTREGUE') && (
            <div style={{ fontSize: '60px', fontWeight: '900', color: 'rgba(0,180,0,0.18)', textAlign: 'center', marginTop: '20px', letterSpacing: '8px', transform: 'rotate(-15deg)', display: 'block' }}>
              PAGO
            </div>
          )}

          <div style={{ textAlign: 'center', color: '#999', fontSize: '12px', marginTop: '30px' }}>
            Sublima Mais - Produtos para Sublimação
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}