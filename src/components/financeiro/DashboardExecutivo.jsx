import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { DollarSign, TrendingUp, TrendingDown, Users, AlertCircle, Wallet, Receipt, Percent, Download } from 'lucide-react';
import { formatCurrency, formatDate, calcularIndicadoresSegmento, exportarCSV } from '@/lib/financeiro-helpers';

export default function DashboardExecutivo() {
  const { data: contas = [] } = useQuery({
    queryKey: ['contas-financeiras'],
    queryFn: () => base44.entities.ContaFinanceira.list('-data_vencimento', 500),
    refetchInterval: 15000
  });
  const { data: pedidos = [] } = useQuery({
    queryKey: ['pedidos'],
    queryFn: () => base44.entities.Pedido.list('-created_date', 500),
    refetchInterval: 15000
  });
  const { data: impressoes = [] } = useQuery({
    queryKey: ['pedidos-impressao'],
    queryFn: () => base44.entities.PedidoImpressao.list('-created_date', 500),
    refetchInterval: 15000
  });

  const kpis = useMemo(() => {
    const hoje = new Date();
    const inicioHoje = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
    const inicioSemana = new Date(hoje); inicioSemana.setDate(hoje.getDate() - 7);
    const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    const inicioAno = new Date(hoje.getFullYear(), 0, 1);

    const todosPedidos = [...(pedidos || []), ...(impressoes || [])].filter(p => p.status !== 'CANCELADO');

    const receitaHoje = todosPedidos.filter(p => p.data && new Date(p.data) >= inicioHoje).reduce((s, p) => s + (p.total || 0), 0);
    const receitaSemana = todosPedidos.filter(p => p.data && new Date(p.data) >= inicioSemana).reduce((s, p) => s + (p.total || 0), 0);
    const receitaMes = todosPedidos.filter(p => p.data && new Date(p.data) >= inicioMes).reduce((s, p) => s + (p.total || 0), 0);
    const receitaAno = todosPedidos.filter(p => p.data && new Date(p.data) >= inicioAno).reduce((s, p) => s + (p.total || 0), 0);

    const despesasMes = contas.filter(c => c.tipo === 'DESPESA' && c.status !== 'CANCELADO' && c.data_vencimento && new Date(c.data_vencimento) >= inicioMes).reduce((s, c) => s + (c.valor || 0), 0);
    const despesasAno = contas.filter(c => c.tipo === 'DESPESA' && c.status !== 'CANCELADO' && c.data_vencimento && new Date(c.data_vencimento) >= inicioAno).reduce((s, c) => s + (c.valor || 0), 0);

    const lucroBrutoMes = receitaMes - despesasMes;
    const lucroLiquidoMes = lucroBrutoMes * 0.85; // estimativa 15% impostos
    const margemMes = receitaMes > 0 ? (lucroLiquidoMes / receitaMes) * 100 : 0;
    const ticketMedio = todosPedidos.length > 0 ? receitaMes / todosPedidos.filter(p => p.data && new Date(p.data) >= inicioMes).length : 0;

    // Clientes
    const clientesUnicos = new Set(todosPedidos.map(p => (p.cliente || '').toLowerCase().trim()).filter(Boolean));
    const clientesNovosMes = new Set(todosPedidos.filter(p => p.data && new Date(p.data) >= inicioMes).map(p => (p.cliente || '').toLowerCase().trim()).filter(Boolean));

    // Contas vencidas
    const hojeStr = hoje.toISOString().split('T')[0];
    const contasVencidas = contas.filter(c => c.status === 'VENCIDO' || (c.status === 'PENDENTE' && c.data_vencimento < hojeStr));
    const contasFuturas = contas.filter(c => c.status === 'PENDENTE' && c.data_vencimento > hojeStr);

    const indicadores = calcularIndicadoresSegmento(pedidos, impressoes);

    return {
      receitaHoje, receitaSemana, receitaMes, receitaAno,
      despesasMes, despesasAno, lucroBrutoMes, lucroLiquidoMes,
      margemMes: Math.round(margemMes * 100) / 100, ticketMedio,
      clientesAtivos: clientesUnicos.size, clientesNovosMes: clientesNovosMes.size,
      contasVencidas, contasFuturas, indicadores
    };
  }, [contas, pedidos, impressoes]);

  const cards = [
    { label: 'Receita Hoje', value: formatCurrency(kpis.receitaHoje), icon: DollarSign, color: 'text-green-600' },
    { label: 'Receita Semana', value: formatCurrency(kpis.receitaSemana), icon: TrendingUp, color: 'text-green-600' },
    { label: 'Receita Mensal', value: formatCurrency(kpis.receitaMes), icon: TrendingUp, color: 'text-green-600' },
    { label: 'Receita Anual', value: formatCurrency(kpis.receitaAno), icon: TrendingUp, color: 'text-green-600' },
    { label: 'Lucro Bruto (mês)', value: formatCurrency(kpis.lucroBrutoMes), icon: Wallet, color: kpis.lucroBrutoMes >= 0 ? 'text-blue-600' : 'text-red-600' },
    { label: 'Lucro Líquido (mês)', value: formatCurrency(kpis.lucroLiquidoMes), icon: Wallet, color: kpis.lucroLiquidoMes >= 0 ? 'text-blue-600' : 'text-red-600' },
    { label: 'Margem', value: `${kpis.margemMes}%`, icon: Percent, color: 'text-purple-600' },
    { label: 'Ticket Médio', value: formatCurrency(kpis.ticketMedio), icon: Receipt, color: 'text-purple-600' },
    { label: 'Clientes Ativos', value: kpis.clientesAtivos, icon: Users, color: 'text-blue-600' },
    { label: 'Clientes Novos (mês)', value: kpis.clientesNovosMes, icon: Users, color: 'text-blue-600' },
    { label: 'Despesas (mês)', value: formatCurrency(kpis.despesasMes), icon: TrendingDown, color: 'text-red-600' },
    { label: 'Contas Vencidas', value: kpis.contasVencidas.length, icon: AlertCircle, color: kpis.contasVencidas.length > 0 ? 'text-red-600' : 'text-green-600' },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold flex items-center gap-2"><TrendingUp className="w-4 h-4" />Dashboard Executivo</h3>
        <Button variant="outline" size="sm" onClick={() => exportarCSV([
          { indicador: 'Receita Hoje', valor: kpis.receitaHoje.toFixed(2) },
          { indicador: 'Receita Semana', valor: kpis.receitaSemana.toFixed(2) },
          { indicador: 'Receita Mensal', valor: kpis.receitaMes.toFixed(2) },
          { indicador: 'Receita Anual', valor: kpis.receitaAno.toFixed(2) },
          { indicador: 'Lucro Bruto', valor: kpis.lucroBrutoMes.toFixed(2) },
          { indicador: 'Lucro Líquido', valor: kpis.lucroLiquidoMes.toFixed(2) },
          { indicador: 'Margem (%)', valor: kpis.margemMes },
          { indicador: 'Ticket Médio', valor: kpis.ticketMedio.toFixed(2) },
          { indicador: 'Clientes Ativos', valor: kpis.clientesAtivos },
          { indicador: 'Contas Vencidas', valor: kpis.contasVencidas.length },
        ], [{ label: 'Indicador', key: 'indicador' }, { label: 'Valor', key: 'valor' }], 'dashboard-executivo.csv')}>
          <Download className="w-3.5 h-3.5 mr-1" />CSV
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {cards.map((c, i) => (
          <Card key={i} className="p-3">
            <div className="flex items-center gap-1.5 mb-1"><c.icon className={`w-3.5 h-3.5 ${c.color}`} /><p className="text-xs text-muted-foreground">{c.label}</p></div>
            <p className={`text-base font-bold ${c.color}`}>{c.value}</p>
          </Card>
        ))}
      </div>

      {/* Indicadores de Segmento */}
      <Card className="p-4">
        <h4 className="text-sm font-medium mb-3">Indicadores de Produção (Segmento)</h4>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            { label: 'Metros DTF', value: kpis.indicadores.metrosDTF },
            { label: 'Folhas Impressas', value: kpis.indicadores.folhasImpressas },
            { label: 'Canecas', value: kpis.indicadores.canecas },
            { label: 'Camisetas', value: kpis.indicadores.camisetas },
            { label: 'Gravações Laser', value: kpis.indicadores.gravacoesLaser },
          ].map((ind, i) => (
            <div key={i} className="text-center p-2 bg-muted/30 rounded-lg">
              <p className="text-lg font-bold text-primary">{ind.value}</p>
              <p className="text-xs text-muted-foreground">{ind.label}</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}