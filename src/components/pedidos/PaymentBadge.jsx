import React from 'react';
import { Badge } from '@/components/ui/badge';

const paymentConfig = {
  PIX: { label: 'PIX', className: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  CARTAO: { label: 'CARTÃO', className: 'bg-blue-100 text-blue-700 border-blue-200' },
  DINHEIRO: { label: 'DINHEIRO', className: 'bg-purple-100 text-purple-700 border-purple-200' },
  DUPLICATA: { label: 'DUPLICATA', className: 'bg-orange-100 text-orange-700 border-orange-200' },
  MISTO: { label: 'MISTO', className: 'bg-indigo-100 text-indigo-700 border-indigo-200' },
  BANCO: { label: 'BANCO', className: 'bg-slate-100 text-slate-700 border-slate-200' },
};

export default function PaymentBadge({ tipo }) {
  const config = paymentConfig[tipo] || paymentConfig.PIX;
  return (
    <Badge variant="outline" className={`${config.className} text-[11px] font-semibold border`}>
      {config.label}
    </Badge>
  );
}