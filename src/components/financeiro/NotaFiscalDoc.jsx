import React, { useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Printer } from 'lucide-react';

export default function NotaFiscalDoc({ open, onOpenChange, nota }) {
  const printRef = useRef();

  const handlePrint = () => {
    const content = printRef.current?.innerHTML || '';
    const win = window.open('', '', 'width=900,height=700');
    win.document.write(`<!DOCTYPE html><html><head><title>Espelho NF-e</title>
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body { font-family: Arial, Helvetica, sans-serif; font-size: 13px; background: #fff; color: #000; padding: 30px 40px; }
      table { width: 100%; border-collapse: collapse; margin-top: 10px; }
      th, td { border: 1px solid #999; padding: 6px 8px; text-align: left; font-size: 11px; }
      th { background: #f0f0f0; }
      .box { border: 2px solid #222; border-radius: 6px; padding: 14px; margin-top: 10px; }
      .titulo { text-align: center; font-size: 17px; font-weight: bold; margin-bottom: 4px; }
      .chave { font-family: monospace; font-size: 11px; word-break: break-all; }
      .aviso { background: #fff8e1; border: 1px solid #f0c14b; border-radius: 6px; padding: 10px 14px; font-size: 11px; margin-top: 14px; color: #6b5300; }
      .total { font-size: 22px; font-weight: 900; text-align: right; margin-top: 10px; }
    </style>
    </head><body>${content}</body></html>`);
    win.document.close();
    setTimeout(() => win.print(), 400);
  };

  if (!nota) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            Espelho da Nota
            <Button size="sm" onClick={handlePrint}><Printer className="w-4 h-4 mr-1" />Imprimir</Button>
          </DialogTitle>
        </DialogHeader>

        <div ref={printRef} style={{ fontFamily: 'Arial, Helvetica, sans-serif', fontSize: '13px' }}>
          <div className="titulo" style={{ textAlign: 'center', fontSize: '17px', fontWeight: 'bold' }}>
            DOCUMENTO AUXILIAR DE CONTROLE INTERNO — NF-e
          </div>
          <p style={{ textAlign: 'center', fontSize: '11px', color: '#888', marginBottom: '8px' }}>
            Este documento NÃO é um DANFE fiscal válido — é um espelho de controle interno.
          </p>

          <div className="box" style={{ border: '2px solid #222', borderRadius: '6px', padding: '14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span><span style={{ color: '#555', fontSize: '11px' }}>Nº NF-e / SÉRIE</span><br /><strong>{nota.numero_nfe || '(rascunho)'} / {nota.serie || '1'}</strong></span>
              <span style={{ textAlign: 'right' }}><span style={{ color: '#555', fontSize: '11px' }}>AMBIENTE</span><br /><strong>{nota.ambiente}</strong></span>
              <span style={{ textAlign: 'right' }}><span style={{ color: '#555', fontSize: '11px' }}>EMISSÃO</span><br /><strong>{nota.data_emissao || '—'}</strong></span>
            </div>
            <div style={{ marginTop: '8px' }}><span style={{ color: '#555', fontSize: '11px' }}>DESTINATÁRIO</span><br /><strong>{nota.cliente}</strong> {nota.cliente_documento ? `— ${nota.cliente_documento}` : ''}</div>
            <div style={{ marginTop: '4px' }}><span style={{ color: '#555', fontSize: '11px' }}>NATUREZA DA OPERAÇÃO</span><br />{nota.natureza_operacao || 'Venda de mercadoria'}</div>
            {nota.chave_acesso && (
              <div style={{ marginTop: '8px' }}>
                <span style={{ color: '#555', fontSize: '11px' }}>CHAVE DE CONTROLE (não fiscal)</span>
                <div className="chave" style={{ fontFamily: 'monospace', fontSize: '11px', wordBreak: 'break-all' }}>{nota.chave_acesso}</div>
              </div>
            )}
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '10px' }}>
            <thead>
              <tr>
                <th style={{ border: '1px solid #999', padding: '6px 8px', background: '#f0f0f0', fontSize: '11px', textAlign: 'left' }}>Produto</th>
                <th style={{ border: '1px solid #999', padding: '6px 8px', background: '#f0f0f0', fontSize: '11px', textAlign: 'left' }}>Qtd</th>
                <th style={{ border: '1px solid #999', padding: '6px 8px', background: '#f0f0f0', fontSize: '11px', textAlign: 'left' }}>Vlr. Unit.</th>
                <th style={{ border: '1px solid #999', padding: '6px 8px', background: '#f0f0f0', fontSize: '11px', textAlign: 'left' }}>Vlr. Total</th>
              </tr>
            </thead>
            <tbody>
              {(nota.itens || []).map((it, i) => (
                <tr key={i}>
                  <td style={{ border: '1px solid #999', padding: '6px 8px', fontSize: '11px' }}>{it.produto_nome}</td>
                  <td style={{ border: '1px solid #999', padding: '6px 8px', fontSize: '11px' }}>{it.quantidade}</td>
                  <td style={{ border: '1px solid #999', padding: '6px 8px', fontSize: '11px' }}>R$ {(it.valor_unitario || 0).toFixed(2)}</td>
                  <td style={{ border: '1px solid #999', padding: '6px 8px', fontSize: '11px' }}>R$ {(it.valor_total || 0).toFixed(2)}</td>
                </tr>
              ))}
              {(!nota.itens || nota.itens.length === 0) && (
                <tr><td colSpan={4} style={{ border: '1px solid #999', padding: '6px 8px', fontSize: '11px', textAlign: 'center', color: '#888' }}>Sem itens detalhados</td></tr>
              )}
            </tbody>
          </table>

          <div className="total" style={{ fontSize: '22px', fontWeight: 900, textAlign: 'right', marginTop: '10px' }}>
            R$ {(nota.valor_total || 0).toFixed(2)}
          </div>

          {nota.status_nfe === 'CANCELADA' && (
            <div className="aviso" style={{ background: '#fee2e2', border: '1px solid #ef4444', borderRadius: '6px', padding: '10px 14px', fontSize: '11px', marginTop: '14px', color: '#7f1d1d' }}>
              <strong>NOTA CANCELADA</strong> em {nota.data_cancelamento || '—'}. Motivo: {nota.motivo_cancelamento || '—'}
            </div>
          )}

          <div className="aviso" style={{ background: '#fff8e1', border: '1px solid #f0c14b', borderRadius: '6px', padding: '10px 14px', fontSize: '11px', marginTop: '14px', color: '#6b5300' }}>
            Documento gerado localmente para controle interno. Para validade fiscal, a NF-e precisa ser transmitida à SEFAZ via backend com certificado digital A1.
          </div>

          {nota.observacoes && <p style={{ fontSize: '11px', color: '#555', marginTop: '10px' }}>{nota.observacoes}</p>}
        </div>
      </DialogContent>
    </Dialog>
  );
}
