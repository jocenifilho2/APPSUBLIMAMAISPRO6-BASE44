import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Clock, User, CheckCircle2, ArrowRight } from 'lucide-react';
import { statusLabel, statusCor, formatarTempo } from '@/lib/operacional-helpers';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function PedidoTimeline({ open, onOpenChange, pedido }) {
  const [historico, setHistorico] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !pedido?.id) return;
    setLoading(true);
    base44.entities.HistoricoPedido.filter({ pedido_id: pedido.id })
      .then(regs => {
        const ordenado = (regs || []).sort((a, b) => {
          const da = a.data_hora ? new Date(a.data_hora).getTime() : 0;
          const db = b.data_hora ? new Date(b.data_hora).getTime() : 0;
          return da - db;
        });
        setHistorico(ordenado);
      })
      .catch(() => setHistorico([]))
      .finally(() => setLoading(false));
  }, [open, pedido?.id]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-primary" />
            Timeline do Pedido
          </DialogTitle>
        </DialogHeader>

        {pedido && (
          <div className="bg-muted/50 rounded-lg p-3 mb-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-mono font-bold text-sm">{pedido.numero_pedido || pedido.numero || '—'}</p>
                <p className="text-sm font-medium">{pedido.cliente}</p>
              </div>
              <Badge className={`text-xs ${statusCor(pedido.status)}`}>
                {statusLabel(pedido.status)}
              </Badge>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-8">
            <div className="w-6 h-6 border-4 border-muted border-t-primary rounded-full animate-spin" />
          </div>
        ) : historico.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-8">
            Nenhum registro de alteração encontrado.
          </p>
        ) : (
          <div className="space-y-1">
            {historico.map((h, idx) => (
              <div key={h.id || idx} className="flex gap-3">
                {/* Linha vertical + ponto */}
                <div className="flex flex-col items-center">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${
                    idx === historico.length - 1 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                  }`}>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  </div>
                  {idx < historico.length - 1 && (
                    <div className="w-0.5 flex-1 bg-border min-h-[24px]" />
                  )}
                </div>

                {/* Conteúdo */}
                <div className="flex-1 pb-3">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {h.status_anterior && (
                      <>
                        <Badge variant="outline" className={`text-[10px] ${statusCor(h.status_anterior)}`}>
                          {statusLabel(h.status_anterior)}
                        </Badge>
                        <ArrowRight className="w-3 h-3 text-muted-foreground" />
                      </>
                    )}
                    <Badge className={`text-[10px] ${statusCor(h.status_novo)}`}>
                      {statusLabel(h.status_novo)}
                    </Badge>
                  </div>

                  {h.data_hora && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {format(new Date(h.data_hora), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    </p>
                  )}

                  {h.usuario && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                      <User className="w-3 h-3" /> {h.usuario}
                    </p>
                  )}

                  {h.tempo_etapa_minutos > 0 && (
                    <p className="text-xs text-amber-600 flex items-center gap-1 mt-0.5">
                      <Clock className="w-3 h-3" /> Tempo na etapa: {formatarTempo(h.tempo_etapa_minutos)}
                    </p>
                  )}

                  {h.observacoes && (
                    <p className="text-xs text-foreground bg-muted/50 rounded p-1.5 mt-1 italic">
                      "{h.observacoes}"
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}