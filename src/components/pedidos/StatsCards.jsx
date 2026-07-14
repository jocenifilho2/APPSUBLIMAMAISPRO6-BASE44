import React from 'react';
import { Card } from '@/components/ui/card';
import { ShoppingCart, CircleCheckBig, Clock, XCircle, PackageCheck, Package } from 'lucide-react';

export default function StatsCards({ pedidos }) {
  const total = pedidos.length;
  const pagos = pedidos.filter(p => p.status === 'PAGO').length;
  const pendentes = pedidos.filter(p => p.status === 'PENDENTE' || p.status === 'NOVO' || p.status === 'AGUARDANDO_PAGAMENTO').length;
  const cancelados = pedidos.filter(p => p.status === 'CANCELADO').length;
  const entregues = pedidos.filter(p => p.status === 'ENTREGUE' || p.status === 'FINALIZADO').length;
  const prontos = pedidos.filter(p => p.status === 'PRONTO').length;

  const stats = [
    { label: 'Total Pedidos', value: total, icon: ShoppingCart, bg: 'bg-blue-50', color: 'text-blue-600' },
    { label: 'Pagos', value: pagos, icon: CircleCheckBig, bg: 'bg-green-50', color: 'text-green-600' },
    { label: 'Pendentes', value: pendentes, icon: Clock, bg: 'bg-amber-50', color: 'text-amber-600' },
    { label: 'Prontos', value: prontos, icon: Package, bg: 'bg-cyan-50', color: 'text-cyan-600' },
    { label: 'Entregues', value: entregues, icon: PackageCheck, bg: 'bg-emerald-50', color: 'text-emerald-600' },
    { label: 'Cancelados', value: cancelados, icon: XCircle, bg: 'bg-red-50', color: 'text-red-600' },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
      {stats.map((stat) => (
        <Card key={stat.label} className="p-4 hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${stat.bg}`}>
              <stat.icon className={`w-5 h-5 ${stat.color}`} />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">{stat.label}</p>
              <p className="text-lg font-bold">{stat.value}</p>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}