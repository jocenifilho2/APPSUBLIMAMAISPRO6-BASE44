import React from 'react';
import { Badge } from '@/components/ui/badge';

const statusConfig = {
  PAGO: { label: 'PAGO', className: 'bg-green-100 text-green-700 border-green-200' },
  PENDENTE: { label: 'PENDENTE', className: 'bg-amber-100 text-amber-700 border-amber-200' },
  AGUARDANDO: { label: 'AGUARDANDO', className: 'bg-orange-100 text-orange-700 border-orange-200' },
  CONCLUIDO: { label: 'CONCLUÍDO', className: 'bg-blue-100 text-blue-700 border-blue-200' },
  ENTREGUE: { label: 'ENTREGUE', className: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  DUPLICATA: { label: 'DUPLICATA', className: 'bg-purple-100 text-purple-700 border-purple-200' },
  CANCELADO: { label: 'CANCELADO', className: 'bg-red-100 text-red-700 border-red-200' },
};

export default function PedidoStatusBadge({ status }) {
  const config = statusConfig[status] || statusConfig.PENDENTE;
  return (
    <Badge variant="outline" className={`${config.className} text-[11px] font-semibold border`}>
      {config.label}
    </Badge>
  );
}