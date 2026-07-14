import React, { useMemo, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Download, Info } from 'lucide-react';
import { calcularCMV, montarDRE, fmtMoeda, GRUPO_DRE_LABEL } from '@/lib/dre-helpers';

function primeiroDiaMes(offsetMeses = 0) {
  const d = new Date();
  d.setMonth(d.getMonth() + offsetMeses, 1);
  return d.toISOString().slice(0, 10);
}
function ultimoDiaMes(offsetMeses = 0) {
  const d = new Date();
  d.setMonth(d.getMonth() + offsetMeses + 1, 0);
  return d.toISOString().slice(0, 10);
}

function Linha({ label, valor, destaque, indent, sub, percentual }) {
  return (
    <div className={`flex items-center justify-between py-1.5 ${destaque ? 'border-t-2 border-foreground/20 mt-1 pt-2' : ''}`}>
      <span className={`text-sm ${indent ? 'pl-4 text-muted-foreground' : ''} ${destaque ? 'font-bold' : sub ? 'text-xs text-muted-foreground pl-6' : ''}`}>{label}</span>
      <span className={`text-sm tabular-nums ${destaque ? 'font-bold text-base' : ''} ${valor < 0 ? 'text-red-600' : ''}`}>
        {fmtMoeda(valor)}
        {percentual !== undefined && <span className="text-xs text-muted-foreground ml-2">({percentual.toFixed(1)}%)</span>}
      </span>
    </div>
  );
}

export default function DREPanel() {
  const [periodo, setPeriodo] = useState('mes_atual');
  const [inicioCustom, setInicioCustom] = useState(primeiroDiaMes());
  const [fimCustom, setFimCustom] = useState(ultimoDiaMes());
  const [aliquota, setAliquota] = useState(0);

  const { data: contas = [] } = useQuery({ queryKey: ['contas_fin'], queryFn: () => base44.entities.ContaFinanceira.list('-created_date', 2000) });
  const { data: pedidos = [] } = useQuery({ queryKey: ['pedidos'], queryFn: () => base44.entities.Pedido.list('-created_date', 9999) });
  const { data: impressoes = [] } = useQuery({ queryKey: ['pedidos_impressao'], queryFn: () => base44.entities.PedidoImpressao.list('-created_date', 9999) });
  const { data: movimentacoes = [] } = useQuery({ queryKey: ['mov_estoque_dre'], queryFn: () => base44.entities.MovimentacaoEstoque.list('-created_date', 5000) });

  const { dataInicio, dataFim } = useMemo(() => {
    if (periodo === 'mes_atual') return { dataInicio: primeiroDiaMes(0), dataFim: ultimoDiaMes(0) };
    if (periodo === 'mes_anterior') return { dataInicio: primeiroDiaMes(-1), dataFim: ultimoDiaMes(-1) };
    return { dataInicio: inicioCustom, dataFim: fimCustom };
  }, [periodo, inicioCustom, fimCustom]);

  const { dataInicioAnt, dataFimAnt } = useMemo(() => {
    const ini = new Date(dataInicio + 'T12:00:00');
    const fim = new Date(dataFim + 'T12:00:00');
    const dias = Math.round((fim - ini) / (1000 * 60 * 60 * 24)) + 1;
    const fimAnt = new Date(ini); fimAnt.setDate(fimAnt.getDate() - 1);
    const iniAnt = new Date(fimAnt); iniAnt.setDate(iniAnt.getDate() - dias + 1);
    return { dataInicioAnt: iniAnt.toISOString().slice(0, 10), dataFimAnt: fimAnt.toISOString().slice(0, 10) };
  }, [dataInicio, dataFim]);

  const todosPedidos = useMemo(() => [
    ...pedidos.map(p => ({ ...p, numero: p.numero_pedido })),
    ...impressoes,
  ], [pedidos, impressoes]);

  const filtrarPeriodo = (lista, campoData, ini, fim) =>
    lista.filter(x => x[campoData] && x[campoData] >= ini && x[campoData] <= fim);

  const { cmvNoPeriodo, temDadosCusto } = useMemo(() => {
    const r = calcularCMV(movimentacoes, dataInicio, dataFim);
    return { cmvNoPeriodo: r.cmvNoPeriodo, temDadosCusto: r.temDados };
  }, [movimentacoes, dataInicio, dataFim]);

  const dre = useMemo(() => montarDRE({
    pedidosPeriodo: filtrarPeriodo(todosPedidos, 'data', dataInicio, dataFim),
    contasPeriodo: filtrarPeriodo(contas, 'data_vencimento', dataInicio, dataFim),
    cmvNoPeriodo,
    aliquotaImpostoPct: Number(aliquota) || 0,
  }), [todosPedidos, contas, cmvNoPeriodo, dataInicio, dataFim, aliquota]);

  const dreAnterior = useMemo(() => {
    const cmvAnt = calcularCMV(movimentacoes, dataInicioAnt, dataFimAnt).cmvNoPeriodo;
    return montarDRE({
      pedidosPeriodo: filtrarPeriodo(todosPedidos, 'data', dataInicioAnt, dataFimAnt),
      contasPeriodo: filtrarPeriodo(contas, 'data_vencimento', dataInicioAnt, dataFimAnt),
      cmvNoPeriodo: cmvAnt,
      aliquotaImpostoPct: Number(aliquota) || 0,
    });
  }, [todosPedidos, contas, movimentacoes, dataInicioAnt, dataFimAnt, aliquota]);

  const variacaoResultado = dreAnterior.resultadoLiquido !== 0
    ? ((dre.resultadoLiquido - dreAnterior.resultadoLiquido) / Math.abs(dreAnterior.resultadoLiquido)) * 100
    : null;

  // Últimos 6 meses para o gráfico comparativo
  const comparativoMensal = useMemo(() => {
    const meses = [];
    for (let i = 5; i >= 0; i--) {
      const ini = primeiroDiaMes(-i);
      const fim = ultimoDiaMes(-i);
      const cmvMes = calcularCMV(movimentacoes, ini, fim).cmvNoPeriodo;
      const d = montarDRE({
        pedidosPeriodo: filtrarPeriodo(todosPedidos, 'data', ini, fim),
        contasPeriodo: filtrarPeriodo(contas, 'data_vencimento', ini, fim),
        cmvNoPeriodo: cmvMes,
        aliquotaImpostoPct: Number(aliquota) || 0,
      });
      meses.push({
        label: new Date(ini + 'T12:00:00').toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }),
        Receita: parseFloat(d.receitaLiquida.toFixed(2)),
        Custos: parseFloat(d.custoTotal.toFixed(2)),
        Despesas: parseFloat(d.totalDespesasOperacionais.toFixed(2)),
        Resultado: parseFloat(d.resultadoLiquido.toFixed(2)),
      });
    }
    return meses;
  }, [todosPedidos, contas, movimentacoes, aliquota]);

  const exportarCSV = () => {
    const linhas = [
      ['Linha', 'Valor'],
      ['Receita Bruta', dre.receitaBruta.toFixed(2)],
      ['(-) Impostos sobre Venda', (-dre.deducaoImpostos).toFixed(2)],
      ['(-) Outras Deduções', (-dre.deducaoManual).toFixed(2)],
      ['= Receita Líquida', dre.receitaLiquida.toFixed(2)],
      ['(-) CMV (custo estimado)', (-dre.cmv).toFixed(2)],
      ['(-) Custos Variáveis Lançados', (-dre.custoVariavelLancado).toFixed(2)],
      ['= Lucro Bruto', dre.lucroBruto.toFixed(2)],
      ['(-) Despesas Fixas', (-dre.despesasOperacionais.DESPESA_FIXA).toFixed(2)],
      ['(-) Despesas Variáveis', (-dre.despesasOperacionais.DESPESA_VARIAVEL).toFixed(2)],
      ['= EBITDA', dre.ebitda.toFixed(2)],
      ['(-) Despesas Financeiras', (-dre.despesasFinanceiras).toFixed(2)],
      ['(+) Outras Receitas', dre.outrasReceitas.toFixed(2)],
      ['(-) Outras Despesas', (-dre.outrasDespesas).toFixed(2)],
      ['= Resultado Líquido', dre.resultadoLiquido.toFixed(2)],
    ];
    const csv = linhas.map(l => l.join(';')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `DRE_${dataInicio}_a_${dataFim}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Período</Label>
          <Select value={periodo} onValueChange={setPeriodo}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="mes_atual">Mês Atual</SelectItem>
              <SelectItem value="mes_anterior">Mês Anterior</SelectItem>
              <SelectItem value="custom">Personalizado</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {periodo === 'custom' && (
          <>
            <div className="space-y-1.5"><Label className="text-xs">De</Label><Input type="date" value={inicioCustom} onChange={e => setInicioCustom(e.target.value)} /></div>
            <div className="space-y-1.5"><Label className="text-xs">Até</Label><Input type="date" value={fimCustom} onChange={e => setFimCustom(e.target.value)} /></div>
          </>
        )}
        <div className="space-y-1.5">
          <Label className="text-xs">% Impostos sobre venda</Label>
          <Input type="number" step="0.1" className="w-28" value={aliquota} onChange={e => setAliquota(e.target.value)} />
        </div>
        <Button variant="outline" size="sm" onClick={exportarCSV}><Download className="w-3.5 h-3.5 mr-1" />Exportar CSV</Button>
      </div>

      {!temDadosCusto && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 flex gap-2">
          <Info className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-blue-700">O CMV é calculado automaticamente pelo custo médio das movimentações de estoque com <code>custo_unitario</code> informado. Ainda não há entradas com custo lançado — o CMV aparece zerado até que compras/produções registrem o custo unitário.</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="p-5">
          <h3 className="font-bold text-sm mb-2">Demonstração do Resultado — {dataInicio} a {dataFim}</h3>
          <div className="divide-y divide-border/50">
            <Linha label="Receita Bruta de Vendas" valor={dre.receitaBruta} />
            <Linha label="Impostos sobre Vendas" valor={-dre.deducaoImpostos} indent />
            <Linha label="Outras Deduções" valor={-dre.deducaoManual} indent />
            <Linha label="Receita Líquida" valor={dre.receitaLiquida} destaque />

            <Linha label="CMV — Custo de Mercadoria Vendida" valor={-dre.cmv} indent />
            <Linha label="Custos Variáveis Lançados" valor={-dre.custoVariavelLancado} indent />
            <Linha label="Lucro Bruto" valor={dre.lucroBruto} destaque percentual={dre.margemBruta} />

            <Linha label="Despesas Fixas" valor={-dre.despesasOperacionais.DESPESA_FIXA} indent />
            <Linha label="Despesas Variáveis" valor={-dre.despesasOperacionais.DESPESA_VARIAVEL} indent />
            <Linha label="EBITDA (Resultado Operacional)" valor={dre.ebitda} destaque />

            <Linha label="Despesas Financeiras" valor={-dre.despesasFinanceiras} indent />
            <Linha label="Outras Receitas" valor={dre.outrasReceitas} indent />
            <Linha label="Outras Despesas" valor={-dre.outrasDespesas} indent />
            <Linha label="Resultado Líquido do Período" valor={dre.resultadoLiquido} destaque percentual={dre.margemLiquida} />
          </div>
          {variacaoResultado !== null && (
            <p className="text-xs text-muted-foreground mt-3">
              Vs. período anterior ({dataInicioAnt} a {dataFimAnt}): resultado de {fmtMoeda(dreAnterior.resultadoLiquido)}
              {' '}(<span className={variacaoResultado >= 0 ? 'text-green-600' : 'text-red-600'}>{variacaoResultado >= 0 ? '+' : ''}{variacaoResultado.toFixed(1)}%</span>)
            </p>
          )}
        </Card>

        <Card className="p-5">
          <h3 className="font-bold text-sm mb-4">Evolução — Últimos 6 Meses</h3>
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={comparativoMensal}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis dataKey="label" fontSize={11} />
              <YAxis fontSize={11} />
              <Tooltip formatter={(v) => fmtMoeda(v)} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="Receita" fill="#68d391" radius={[3, 3, 0, 0]} />
              <Bar dataKey="Custos" fill="#f6ad55" radius={[3, 3, 0, 0]} />
              <Bar dataKey="Despesas" fill="#fc8181" radius={[3, 3, 0, 0]} />
              <Bar dataKey="Resultado" fill="#63b3ed" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <Card className="p-4">
        <p className="text-xs text-muted-foreground">
          <strong>Como classificar despesas:</strong> por padrão, o sistema infere o grupo do DRE pela categoria do lançamento
          ({Object.entries(GRUPO_DRE_LABEL).map(([k, v]) => v).join(', ')}).
          Para maior precisão, edite um lançamento em Fluxo de Caixa e defina o campo "grupo_dre" manualmente.
        </p>
      </Card>
    </div>
  );
}
