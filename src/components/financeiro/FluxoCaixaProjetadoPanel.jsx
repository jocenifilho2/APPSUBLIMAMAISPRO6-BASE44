import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { TrendingUp, TrendingDown, Wallet, Calendar, Download } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Cell } from 'recharts';
import { formatCurrency, calcularFluxoProjetado, gerarSerieProjecao, exportarCSV } from '@/lib/financeiro-helpers';

const PERIODOS = [
  { label: 'Hoje', dias: 0 },
  { label: '7 dias', dias: 7 },
  { label: '15 dias', dias: 15 },
  { label: '30 dias', dias: 30 },
  { label: '60 dias', dias: 60 },
  { label: '90 dias', dias: 90 },
];

export default function FluxoCaixaProjetadoPanel({ saldoManual = 0 }) {
  const [periodoSel, setPeriodoSel] = useState(30);

  const { data: contas = [] } = useQuery({
    queryKey: ['contas-financeiras'],
    queryFn: () => base44.entities.ContaFinanceira.list('-data_vencimento', 500),
    refetchInterval: 15000
  });

  const { data: pagamentos = [] } = useQuery({
    queryKey: ['pagamentos-parciais'],
    queryFn: () => base44.entities.PagamentoParcial.list('-data_pagamento', 200),
    refetchInterval: 15000
  });

  const { data: caixas = [] } = useQuery({
    queryKey: ['caixas-diario'],
    queryFn: () => base44.entities.CaixaDiario.list('-data', 1),
    refetchInterval: 30000
  });

  const saldoAtual = useMemo(() => {
    const caixaAberto = caixas.find(c => c.status === 'ABERTO');
    if (caixaAberto) {
      // Ideally we'd compute from movements, but for projection use valor_inicial as base
      return caixaAberto.valor_calculado || caixaAberto.valor_inicial || 0;
    }
    // Fallback: sum of PAGO accounts
    const pagas = contas.filter(c => c.status === 'PAGO');
    const receitas = pagas.filter(c => c.tipo === 'RECEITA').reduce((s, c) => s + (c.valor || 0), 0);
    const despesas = pagas.filter(c => c.tipo === 'DESPESA').reduce((s, c) => s + (c.valor || 0), 0);
    return receitas - despesas + saldoManual;
  }, [caixas, contas, saldoManual]);

  const serie = useMemo(() => gerarSerieProjecao(contas, pagamentos, saldoAtual), [contas, pagamentos, saldoAtual]);
  const fluxoAtual = useMemo(() => calcularFluxoProjetado(contas, pagamentos, saldoAtual, periodoSel), [contas, pagamentos, saldoAtual, periodoSel]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold flex items-center gap-2"><TrendingUp className="w-4 h-4" />Fluxo de Caixa Projetado</h3>
        <Button variant="outline" size="sm" onClick={() => exportarCSV(serie, [
          { label: 'Período', key: 'label' }, { label: 'A Receber', key: s => s.receber?.toFixed(2) },
          { label: 'A Pagar', key: s => s.pagar?.toFixed(2) }, { label: 'Saldo Projetado', key: s => s.saldo?.toFixed(2) }
        ], 'fluxo-projetado.csv')}><Download className="w-3.5 h-3.5 mr-1" />CSV</Button>
      </div>

      {/* Cards de resumo */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-1"><Wallet className="w-4 h-4 text-blue-600" /><p className="text-xs text-muted-foreground">Saldo Atual</p></div>
          <p className={`text-lg font-bold ${saldoAtual >= 0 ? 'text-blue-700' : 'text-red-600'}`}>{formatCurrency(saldoAtual)}</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-1"><TrendingUp className="w-4 h-4 text-green-600" /><p className="text-xs text-muted-foreground">A Receber ({PERIODOS.find(p => p.dias === periodoSel)?.label})</p></div>
          <p className="text-lg font-bold text-green-700">{formatCurrency(fluxoAtual.receber)}</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-1"><TrendingDown className="w-4 h-4 text-red-600" /><p className="text-xs text-muted-foreground">A Pagar ({PERIODOS.find(p => p.dias === periodoSel)?.label})</p></div>
          <p className="text-lg font-bold text-red-700">{formatCurrency(fluxoAtual.pagar)}</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-1"><Calendar className="w-4 h-4 text-purple-600" /><p className="text-xs text-muted-foreground">Saldo Projetado</p></div>
          <p className={`text-lg font-bold ${fluxoAtual.projetado >= 0 ? 'text-purple-700' : 'text-red-600'}`}>{formatCurrency(fluxoAtual.projetado)}</p>
        </Card>
      </div>

      {/* Filtro de período */}
      <div className="flex gap-2 flex-wrap">
        {PERIODOS.map(p => (
          <Button key={p.dias} size="sm" variant={periodoSel === p.dias ? 'default' : 'outline'} onClick={() => setPeriodoSel(p.dias)}>{p.label}</Button>
        ))}
      </div>

      {/* Gráfico de projeção */}
      <Card className="p-4">
        <h4 className="text-sm font-medium mb-3">Projeção de Saldo</h4>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={serie}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis dataKey="label" className="text-xs" />
            <YAxis tickFormatter={v => `R$ ${(v / 1000).toFixed(0)}k`} className="text-xs" />
            <Tooltip formatter={v => formatCurrency(v)} />
            <ReferenceLine y={0} stroke="#e53e3e" />
            <Bar dataKey="saldo" name="Saldo Projetado" radius={[4, 4, 0, 0]}>
              {serie.map((entry, i) => <Cell key={i} fill={entry.saldo >= 0 ? '#38a169' : '#e53e3e'} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </Card>

      {/* Vencidos */}
      {(fluxoAtual.vencidoReceber > 0 || fluxoAtual.vencidoPagar > 0) && (
        <div className="grid grid-cols-2 gap-3">
          <Card className="p-3 border-red-200 bg-red-50">
            <p className="text-xs text-red-700">Vencido a Receber</p>
            <p className="text-lg font-bold text-red-700">{formatCurrency(fluxoAtual.vencidoReceber)}</p>
          </Card>
          <Card className="p-3 border-red-200 bg-red-50">
            <p className="text-xs text-red-700">Vencido a Pagar</p>
            <p className="text-lg font-bold text-red-700">{formatCurrency(fluxoAtual.vencidoPagar)}</p>
          </Card>
        </div>
      )}
    </div>
  );
}