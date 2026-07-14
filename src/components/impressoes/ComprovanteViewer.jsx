import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { FileCheck, ExternalLink, AlertCircle } from 'lucide-react';

export default function ComprovanteViewer({ pedidoId, open, onOpenChange }) {
  const [linkData, setLinkData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!open || !pedidoId) return;
    setLoading(true);
    base44.entities.LinkAcompanhamento.filter({ pedido_id: pedidoId })
      .then(links => { setLinkData(links[0] || null); setLoading(false); });
  }, [open, pedidoId]);

  const retiradaLoja = linkData?.retirada_loja;
  const motoboyNome = linkData?.motoboy_nome;
  const comprovante = linkData?.comprovante_url;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileCheck className="w-5 h-5 text-amber-500" /> Comprovante do Cliente
          </DialogTitle>
        </DialogHeader>
        {loading ? (
          <div className="flex justify-center py-8">
            <div className="w-6 h-6 border-4 border-muted border-t-primary rounded-full animate-spin" />
          </div>
        ) : (
          <div className="space-y-4 py-2">
            {retiradaLoja && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-700 font-semibold flex items-center gap-2">
                🏪 Cliente confirmou <strong>Retirada em Loja</strong>
              </div>
            )}
            {motoboyNome && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-700 font-semibold flex items-center gap-2">
                🏍️ Retirada via motoboy parceiro: <strong>{motoboyNome}</strong>
              </div>
            )}
            {comprovante ? (
              <div className="space-y-3">
                <p className="text-sm font-semibold text-green-700 flex items-center gap-2">
                  <FileCheck className="w-4 h-4" /> Comprovante enviado pelo cliente
                </p>
                {comprovante.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
                  <img src={comprovante} alt="Comprovante" className="w-full rounded-lg border" />
                ) : (
                  <a href={comprovante} target="_blank" rel="noreferrer"
                    className="flex items-center gap-2 text-blue-600 hover:underline text-sm font-medium">
                    <ExternalLink className="w-4 h-4" /> Abrir comprovante (PDF)
                  </a>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
                <AlertCircle className="w-4 h-4" /> Nenhum comprovante enviado ainda.
              </div>
            )}
            <Button variant="outline" className="w-full" onClick={() => onOpenChange(false)}>Fechar</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}