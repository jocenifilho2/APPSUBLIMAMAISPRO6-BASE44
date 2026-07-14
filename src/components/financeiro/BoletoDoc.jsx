import React, { useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Printer } from 'lucide-react';
import { calcularEncargos } from '@/lib/boleto-helpers';

export default function BoletoDoc({ open, onOpenChange, boleto }) {
  const printRef = useRef();

  const handlePrint = () => {
    const content = printRef.current?.innerHTML || '';
    const win = window.open('', '', 'width=900,height=700');
    win.document.write(`<!DOCTYPE html><html><head><title>Cobrança</title>
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body { font-family: Arial, Helvetica, sans-serif; font-size: 14px; background: #fff; color: #000; padding: 30px 40px; }
      .box { border: 2px solid #222; border-radius: 6px; padding: 18px; margin-top: 12px; }
      .row { display: flex; justify-content: space-between; margin-bottom: 6px; }
      .label { color: #555; font-size: 11px; text-transform: uppercase; }
      .value { font-weight: bold; }
      .titulo { text-align: center; font-size: 18px; font-weight: bold; margin-bottom: 4px; }
      .aviso { background: #fff8e1; border: 1px solid #f0c14b; border-radius: 6px; padding: 10px 14px; font-size: 11px; margin-top: 14px; color: #6b5300; }
      .total { font-size: 26px; font-weight: 900; text-align: right; margin-top: 10px; }
    </style>
    </head><body>${content}</body></html>`);
    win.document.close();
    setTimeout(() => win.print(), 400);
  };

  if (!boleto) return null;
  const encargos = calcularEncargos(boleto);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            Cobrança / 2ª via
            <Button size="sm" onClick={handlePrint}><Printer className="w-4 h-4 mr-1" />Imprimir</Button>
          </DialogTitle>
        </DialogHeader>

        <div ref={printRef} style={{ fontFamily: 'Arial, Helvetica, sans-serif', fontSize: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '10px' }}>
            <img src="https://media.base44.com/images/public/69f29a5ddcdad09f087cb710/56eda8412_16b4d9f6-8ee3-4f42-8e30-74da230042df.png" alt="Sublima Mais" style={{ width: '56px', height: '56px', borderRadius: '50%', objectFit: 'cover' }} />
            <div>
              <div style={{ fontSize: '18px', fontWeight: 'bold' }}>Sublima Mais</div>
              <div style={{ fontSize: '12px', color: '#555' }}>Produtos para Sublimação</div>
            </div>
          </div>

          <div style={{ textAlign: 'center', fontSize: '18px', fontWeight: 'bold', margin: '10px 0' }}>DOCUMENTO DE COBRANÇA</div>

          <div style={{ border: '2px solid #222', borderRadius: '6px', padding: '18px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
              <span><span style={{ color: '#555', fontSize: '11px' }}>CONTROLE INTERNO Nº</span><br /><strong>{boleto.nosso_numero}</strong></span>
              <span style={{ textAlign: 'right' }}><span style={{ color: '#555', fontSize: '11px' }}>VENCIMENTO</span><br /><strong>{boleto.data_vencimento}</strong></span>
            </div>
            <div style={{ marginBottom: '6px' }}><span style={{ color: '#555', fontSize: '11px' }}>PAGADOR</span><br /><strong>{boleto.cliente}</strong> {boleto.cliente_documento ? `— ${boleto.cliente_documento}` : ''}</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '10px', fontSize: '12px' }}>
              <span>Valor original: <strong>R$ {(boleto.valor_original || 0).toFixed(2)}</strong></span>
              {encargos.vencido && <span style={{ color: '#b00' }}>Atraso: {encargos.diasAtraso} dia(s)</span>}
            </div>
            {encargos.vencido && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#b00' }}>
                <span>Multa: R$ {encargos.valorMulta.toFixed(2)}</span>
                <span>Juros: R$ {encargos.valorJuros.toFixed(2)}</span>
              </div>
            )}
            <div style={{ fontSize: '26px', fontWeight: 900, textAlign: 'right', marginTop: '10px' }}>
              R$ {encargos.valorAtualizado.toFixed(2)}
            </div>
          </div>

          <div style={{ background: '#fff8e1', border: '1px solid #f0c14b', borderRadius: '6px', padding: '10px 14px', fontSize: '12px', marginTop: '14px', color: '#6b5300' }}>
            <strong>Instruções de pagamento:</strong> {boleto.instrucoes || 'Consulte a loja para dados de PIX/transferência bancária.'}
            <br />Este documento é um controle interno de cobrança e não é um boleto registrado em banco.
          </div>

          {boleto.observacoes && <p style={{ fontSize: '12px', color: '#555', marginTop: '10px' }}>{boleto.observacoes}</p>}

          <p style={{ textAlign: 'center', color: '#888', fontSize: '11px', marginTop: '24px' }}>Sublima Mais — Produtos para Sublimação</p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
