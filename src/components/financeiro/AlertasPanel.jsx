import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertTriangle, CheckCircle, AlertCircle, Bell, Download } from 'lucide-react';
import { formatCurrency, gerarAlertas, ALERTA_COLOR, exportarCSV } from '@/lib/financeiro-helpers';

export default function AlertasPanel() {
  const { data: contas = [] } = useQuery({
    queryKey: ['contas-financeiras'],
    queryFn: () => base44.entities.ContaFinanceira.list('-data_vencimento', 500),
    refetchInterval: 15000
  });
  const { data: produtos = [] } = useQuery({
    queryKey: ['produtos'],
    queryFn: () => base44.entities.Produto.list(),
    refetchInterval: 30000
  });
  const { data: metas = [] } = useQuery({
    queryKey: ['metas-faturamento'],
    queryFn: () => base44.entities.MetaFaturamento.list('-data_inicio', 1),
    refetchInterval: 30000
  });

  const alertas = useMemo(() => {
    const saldoCaixa = contas.filter(c => c.status === 'PAGO').reduce((s, c) => s + (c.tipo === 'RECEITA' ? (c.valor || 0) : -(c.valor || 0)), 0);
    const metaAtual = metas[0];
    return gerarAlertas({
      contas,
      saldoCaixa,
      metas: metaAtual ? { faturamento: { meta: metaAtual.valor_meta, realizado: contas.filter(c => c.tipo === 'RECEITA' && c.status === 'PAGO').reduce((s, c) => s + (c.valor || 0), 0) } } : null,
      produtos
    });
  }, [contas, produtos, metas]);

  const ICON = { VERDE: CheckCircle, AMARELO: AlertTriangle, VERMELHO: AlertCircle };
  const ORDER = { VERMELHO: 0, AMARELO: 1, VERDE: 2 };
  const ordenados = [...alertas].sort((a, b) => ORDER[a.nivel] - ORDER[b.nivel]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold flex items-center gap-2"><Bell className="w-4 h-4" />Central de Alertas</h3>
        <Button variant="outline" size="sm" onClick={() => exportarCSV(alertas, [
          { label: 'Nível', key: 'nivel' }, { label: 'Título', key: 'titulo' }, { label: 'Detalhe', key: 'detalhe' }
        ], 'alertas.csv')}><Download className="w-3.5 h-3.5 mr-1" />CSV</Button>
      </div>

      <div className="space-y-2">
        {ordenados.map((a, i) => {
          const Icon = ICON[a.nivel];
          return (
            <Card key={i} className={`p-3 border-l-4 ${ALERTA_COLOR[a.nivel]}`}>
              <div className="flex items-center gap-3">
                <Icon className="w-5 h-5 shrink-0" />
                <div>
                  <p className="text-sm font-medium">{a.titulo}</p>
                  <p className="text-xs opacity-80">{a.detalhe}</p>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}