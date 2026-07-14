import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Truck, ExternalLink } from 'lucide-react';

export default function EntregasPanel({ pedidos = [], readOnly = false }) {
  const [links, setLinks] = useState({});
  const [saving, setSaving] = useState({});
  const queryClient = useQueryClient();

  const { data: impressoes = [] } = useQuery({
    queryKey: ['impressoes_entregas'],
    queryFn: () => base44.entities.PedidoImpressao.list('-created_date', 100),
    refetchInterval: 15000,
    refetchIntervalInBackground: false,
  });

  const allPedidos = [
    ...pedidos.map(p => ({ ...p, _tipo: 'PRODUTO' })),
    ...impressoes.map(p => ({ ...p, _tipo: 'IMPRESSAO', numero_pedido: p.numero })),
  ];

  // Somente pedidos marcados como ENTREGA (em PEDIDOS LOJA/WHATSAPP ou PRODUÇÃO) devem
  // aparecer aqui. Pedidos com RETIRADA EM LOJA não usam corrida/link de acompanhamento.
  const emEntrega = allPedidos.filter(p => p.link_corrida && p.status !== 'ENTREGUE' && p.status !== 'CANCELADO' && p.forma_retirada === 'ENTREGA');
  const prontos = allPedidos.filter(p => p.status === 'PRONTO' && !p.link_corrida && p.forma_retirada === 'ENTREGA');

  if (emEntrega.length === 0 && prontos.length === 0) return null;

  const salvarLink = async (pedido) => {
    const link = links[pedido.id];
    if (!link) return;
    setSaving(s => ({ ...s, [pedido.id]: true }));
    if (pedido._tipo === 'IMPRESSAO') {
      await base44.entities.PedidoImpressao.update(pedido.id, { link_corrida: link });
      queryClient.invalidateQueries({ queryKey: ['impressoes_entregas'] });
      queryClient.invalidateQueries({ queryKey: ['pedidos_impressao'] });
    } else {
      await base44.entities.Pedido.update(pedido.id, { link_corrida: link });
      queryClient.invalidateQueries({ queryKey: ['pedidos'] });
    }
    queryClient.invalidateQueries({ queryKey: ['pedidos_sep'] });
    queryClient.invalidateQueries({ queryKey: ['pedidos_sep_all'] });
    queryClient.invalidateQueries({ queryKey: ['logistica_pedidos'] });
    setSaving(s => ({ ...s, [pedido.id]: false }));
    setLinks(l => { const n = { ...l }; delete n[pedido.id]; return n; });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Truck className="w-4 h-4 text-orange-500" />
        <h3 className="font-bold text-sm">Entregas em Andamento</h3>
      </div>
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
        {emEntrega.map(p => (
          <Card key={p.id} className="p-3 border-orange-200 bg-orange-50">
            <p className="font-mono text-xs text-muted-foreground">{p.numero_pedido}</p>
            <p className="font-bold text-sm">{p.cliente}</p>
            <a href={p.link_corrida} target="_blank" rel="noreferrer"
              className="text-xs text-blue-600 flex items-center gap-1 mt-1 hover:underline truncate">
              <ExternalLink className="w-3 h-3 flex-shrink-0" /> Ver corrida
            </a>
          </Card>
        ))}
        {prontos.map(p => (
          <Card key={p.id} className="p-3 border-blue-200 bg-blue-50">
            <p className="font-mono text-xs text-muted-foreground">{p.numero_pedido}</p>
            <p className="font-bold text-sm mb-2">{p.cliente}</p>
            <div className="flex gap-1">
              <Input
                className="h-7 text-xs"
                placeholder="Cole o link Uber/99..."
                value={links[p.id] || ''}
                disabled={readOnly}
                onChange={e => setLinks(l => ({ ...l, [p.id]: e.target.value }))}
              />
              <Button size="sm" className="h-7 text-xs px-2 bg-orange-500 hover:bg-orange-600"
                disabled={readOnly || saving[p.id] || !links[p.id]}
                onClick={() => salvarLink(p)}>
                {saving[p.id] ? '...' : 'OK'}
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}