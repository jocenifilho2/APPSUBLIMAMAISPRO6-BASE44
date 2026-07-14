import React, { useMemo, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import {
  Clock, Package, Printer, Truck, AlertTriangle, CheckCircle2,
  ShoppingCart, Factory, TrendingUp, Activity
} from 'lucide-react';
import {
  calcularMetricasOperacionais, ORIGENS, formatarTempo,
  statusLabel, statusCor, PRIORIDADES
} from '@/lib/operacional-helpers';

const CORES_GRAFICO = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

function MetricCard({ icon: Icon, label, value, color, sublabel }) {
  return (
    <Card className="p-3 flex items-center gap-3">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${color}`}>
        <Icon className="w-5 h-5 text-white" />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground truncate">{label}</p>
        <p className="text-xl font-bold truncate">{value}</p>
        {sublabel && <p className="text-[10px] text-muted-foreground truncate">{sublabel}</p>}
      </div>
    </Card>
  );
}

export default function ErpDashboardOperacional({ readOnly = false }) {
  const [periodo, setPeriodo] = useState('mes_atual');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');

  const { dataFiltroInicio, dataFiltroFim } = useMemo(() => {
    const hoje = new Date();
    const fim = hoje.toISOString().split('T')[0];
    if (periodo === 'hoje') return { dataFiltroInicio: fim, dataFiltroFim: fim };
    if (periodo === '7dias') {
      const d = new Date(hoje); d.setDate(d.getDate() - 7);
      return { dataFiltroInicio: d.toISOString().split('T')[0], dataFiltroFim: fim };
    }
    if (periodo === '30dias') {
      const d = new Date(hoje); d.setDate(d.getDate() - 30);
      return { dataFiltroInicio: d.toISOString().split('T')[0], dataFiltroFim: fim };
    }
    if (periodo === 'mes_atual') {
      const d = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
      return { dataFiltroInicio: d.toISOString().split('T')[0], dataFiltroFim: fim };
    }
    return { dataFiltroInicio: dataInicio, dataFiltroFim: dataFim };
  }, [periodo, dataInicio, dataFim]);

  const { data: pedidos = [] } = useQuery({
    queryKey: ['dash_op_pedidos'],
    // Sincronizado com o mesmo limite usado em Pedidos.jsx (menu "Pedidos Loja / WhatsApp"),
    // para que o Total Geral do dashboard reflita a contagem real, sem teto artificial.
    queryFn: () => base44.entities.Pedido.list('-created_date', 9999),
    refetchInterval: 10000,
  });

  const { data: impressoes = [] } = useQuery({
    queryKey: ['dash_op_impressoes'],
    // Sincronizado com o mesmo limite usado em GestaoImpressoes.jsx (menu "Produção").
    queryFn: () => base44.entities.PedidoImpressao.list('-created_date', 9999),
    refetchInterval: 10000,
  });

  const { data: historico = [] } = useQuery({
    queryKey: ['dash_op_historico'],
    queryFn: () => base44.entities.HistoricoPedido.list('-data_hora', 3000),
    refetchInterval: 15000,
  });

  const { data: ops = [] } = useQuery({
    queryKey: ['dash_op_ops'],
    queryFn: () => base44.entities.OrdemProducao.list('-created_date', 200),
    refetchInterval: 10000,
  });

  const { data: ocorrencias = [] } = useQuery({
    queryKey: ['dash_op_ocorrencias'],
    queryFn: () => base44.entities.OcorrenciaLogistica.filter({ resolvida: false }),
    refetchInterval: 15000,
  });

  const pedidosFiltrados = useMemo(() => {
    if (!dataFiltroInicio && !dataFiltroFim) return pedidos;
    return pedidos.filter(item => {
      const data = item.data || (item.created_date ? item.created_date.split('T')[0] : '');
      if (!data) return false;
      if (dataFiltroInicio && data < dataFiltroInicio) return false;
      if (dataFiltroFim && data > dataFiltroFim) return false;
      return true;
    });
  }, [pedidos, dataFiltroInicio, dataFiltroFim]);

  const impressoesFiltradas = useMemo(() => {
    if (!dataFiltroInicio && !dataFiltroFim) return impressoes;
    return impressoes.filter(item => {
      const data = item.data || (item.created_date ? item.created_date.split('T')[0] : '');
      if (!data) return false;
      if (dataFiltroInicio && data < dataFiltroInicio) return false;
      if (dataFiltroFim && data > dataFiltroFim) return false;
      return true;
    });
  }, [impressoes, dataFiltroInicio, dataFiltroFim]);

  const metricas = useMemo(
    () => calcularMetricasOperacionais(pedidosFiltrados, impressoesFiltradas),
    [pedidosFiltrados, impressoesFiltradas]
  );

  // Dados para gráfico de origem
  const dadosOrigem = useMemo(() => {
    return ORIGENS.map(o => ({
      name: o.label,
      value: metricas.porOrigem[o.value] || 0,
    })).filter(d => d.value > 0);
  }, [metricas]);

  // Dados para gráfico de status (distribuição)
  const dadosStatus = useMemo(() => {
    const todos = [...pedidosFiltrados, ...impressoesFiltradas];
    const contagem = {};
    todos.forEach(p => {
      const s = p.status || 'NOVO';
      contagem[s] = (contagem[s] || 0) + 1;
    });
    return Object.entries(contagem)
      .map(([status, count]) => ({ name: statusLabel(status), value: count }))
      .filter(d => d.value > 0)
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [pedidosFiltrados, impressoesFiltradas]);

  // Indicadores de tempo médio — baseados no histórico real de transições de status
  // (HistoricoPedido), não em "agora - data de criação", que nunca parava de crescer
  // para pedidos já entregues há tempo.
  // Cada indicador também expõe o tamanho da amostra (n), usado para decidir se há
  // dados suficientes para um número ser confiável (ver MIN_AMOSTRA abaixo).
  const temposMedios = useMemo(() => {
    const media = (valores) => (valores.length > 0 ? valores.reduce((a, b) => a + b, 0) / valores.length : 0);

    // Tempo médio de separação: duração real de cada passagem por Separação
    // (tempo_etapa_minutos registrado ao SAIR do status).
    const temposSep = historico
      .filter(h => ['SEPARACAO', 'EM_SEPARACAO'].includes(h.status_anterior) && h.tempo_etapa_minutos > 0)
      .map(h => h.tempo_etapa_minutos);

    const temposProd = historico
      .filter(h => ['PRODUCAO', 'EM_IMPRESSAO'].includes(h.status_anterior) && h.tempo_etapa_minutos > 0)
      .map(h => h.tempo_etapa_minutos);

    // Tempo médio de entrega: tempo total desde a criação do pedido até o
    // registro de entrada em ENTREGUE/FINALIZADO no histórico (não até "agora").
    const criadoEm = new Map();
    pedidos.forEach(p => criadoEm.set(p.id, p.created_date));
    impressoes.forEach(i => criadoEm.set(i.id, i.created_date));

    const temposEntrega = historico
      .filter(h => ['ENTREGUE', 'FINALIZADO'].includes(h.status_novo))
      .map(h => {
        const criado = criadoEm.get(h.pedido_id);
        if (!criado || !h.data_hora) return null;
        const mins = (new Date(h.data_hora).getTime() - new Date(criado).getTime()) / 60000;
        return mins > 0 ? mins : null;
      })
      .filter(m => m !== null);

    return {
      tempoMedioEntrega: media(temposEntrega),
      amostraEntrega: temposEntrega.length,
      tempoMedioSeparacao: media(temposSep),
      amostraSeparacao: temposSep.length,
      tempoMedioProducao: media(temposProd),
      amostraProducao: temposProd.length,
    };
  }, [historico, pedidos, impressoes]);

  // Amostra mínima para considerar um tempo médio confiável. Abaixo disso,
  // o dashboard mostra "Dados insuficientes" em vez de um número que pode
  // estar distorcido por poucos registros (ex.: testes, backlog antigo).
  const MIN_AMOSTRA = 5;

  // Prioridades
  const porPrioridade = useMemo(() => {
    const contagem = {};
    PRIORIDADES.forEach(p => { contagem[p.value] = 0; });
    pedidosFiltrados.forEach(p => {
      const pr = p.prioridade || 'NORMAL';
      contagem[pr] = (contagem[pr] || 0) + 1;
    });
    return PRIORIDADES.map(p => ({ name: p.label, value: contagem[p.value] || 0 })).filter(d => d.value > 0);
  }, [pedidosFiltrados]);

  // OPs ativas
  const opsAtivas = useMemo(() => ops.filter(op => op.status === 'EM_PRODUCAO' || op.status === 'AGUARDANDO'), [ops]);

  return (
    <div className="space-y-5">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-500 flex items-center justify-center">
            <Activity className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold">Dashboard Operacional</h2>
            <p className="text-sm text-muted-foreground">Visão geral do fluxo operacional em tempo real</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={periodo} onValueChange={setPeriodo}>
            <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="hoje">Hoje</SelectItem>
              <SelectItem value="7dias">Últimos 7 dias</SelectItem>
              <SelectItem value="30dias">Últimos 30 dias</SelectItem>
              <SelectItem value="mes_atual">Mês Atual</SelectItem>
              <SelectItem value="custom">Período Personalizado</SelectItem>
            </SelectContent>
          </Select>
          {periodo === 'custom' && (
            <>
              <Input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} className="w-[150px]" />
              <span className="text-muted-foreground text-sm">até</span>
              <Input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} className="w-[150px]" />
            </>
          )}
        </div>
      </div>

      {/* Métricas principais */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        <MetricCard icon={ShoppingCart} label="Pedidos Hoje" value={metricas.hoje} color="bg-blue-500" />
        <MetricCard icon={Clock} label="Aguardando" value={metricas.aguardando} color="bg-amber-500" />
        <MetricCard icon={Factory} label="Em Produção" value={metricas.emProducao} color="bg-indigo-500" />
        <MetricCard icon={Package} label="Em Separação" value={metricas.emSeparacao} color="bg-cyan-500" />
        <MetricCard icon={CheckCircle2} label="Prontos" value={metricas.prontos} color="bg-blue-600" />
        <MetricCard icon={Truck} label="Enviados" value={metricas.enviados} color="bg-teal-500" />
        <MetricCard icon={AlertTriangle} label="Atrasados" value={metricas.atrasados} color="bg-red-500" sublabel="> 2h sem movimento" />
        <MetricCard icon={TrendingUp} label="Total Geral" value={metricas.total} color="bg-slate-600" />
      </div>

      {/* Indicadores de tempo médio */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-1">
            <Package className="w-4 h-4 text-cyan-500" />
            <p className="text-xs text-muted-foreground font-medium">Tempo Médio de Separação</p>
          </div>
          {temposMedios.amostraSeparacao < MIN_AMOSTRA ? (
            <>
              <p className="text-lg font-bold text-muted-foreground">Dados insuficientes</p>
              <p className="text-[10px] text-muted-foreground">{temposMedios.amostraSeparacao} registro(s) no histórico</p>
            </>
          ) : (
            <p className="text-2xl font-bold">{formatarTempo(temposMedios.tempoMedioSeparacao)}</p>
          )}
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-1">
            <Factory className="w-4 h-4 text-indigo-500" />
            <p className="text-xs text-muted-foreground font-medium">Tempo Médio de Produção</p>
          </div>
          {temposMedios.amostraProducao < MIN_AMOSTRA ? (
            <>
              <p className="text-lg font-bold text-muted-foreground">Dados insuficientes</p>
              <p className="text-[10px] text-muted-foreground">{temposMedios.amostraProducao} registro(s) no histórico</p>
            </>
          ) : (
            <p className="text-2xl font-bold">{formatarTempo(temposMedios.tempoMedioProducao)}</p>
          )}
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-1">
            <Truck className="w-4 h-4 text-teal-500" />
            <p className="text-xs text-muted-foreground font-medium">Tempo Médio de Entrega</p>
          </div>
          {temposMedios.amostraEntrega < MIN_AMOSTRA ? (
            <>
              <p className="text-lg font-bold text-muted-foreground">Dados insuficientes</p>
              <p className="text-[10px] text-muted-foreground">{temposMedios.amostraEntrega} registro(s) no histórico</p>
            </>
          ) : (
            <p className="text-2xl font-bold">{formatarTempo(temposMedios.tempoMedioEntrega)}</p>
          )}
        </Card>
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Origem das vendas */}
        <Card className="p-4">
          <h3 className="font-bold text-sm mb-3">Origem das Vendas</h3>
          {dadosOrigem.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Sem dados</p>
          ) : (
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie data={dadosOrigem} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={(d) => `${d.name}: ${d.value}`}>
                  {dadosOrigem.map((_, i) => <Cell key={i} fill={CORES_GRAFICO[i % CORES_GRAFICO.length]} />)}
                </Pie>
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: '11px' }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </Card>

        {/* Distribuição por status */}
        <Card className="p-4">
          <h3 className="font-bold text-sm mb-3">Distribuição por Status</h3>
          {dadosStatus.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Sem dados</p>
          ) : (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={dadosStatus} layout="vertical" margin={{ left: 20 }}>
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={100} />
                <Tooltip />
                <Bar dataKey="value" fill="#3b82f6" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>
      </div>

      {/* Prioridades e OPs ativas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="p-4">
          <h3 className="font-bold text-sm mb-3">Pedidos por Prioridade</h3>
          <div className="space-y-2">
            {porPrioridade.length === 0 && <p className="text-sm text-muted-foreground">Sem dados</p>}
            {porPrioridade.map(p => {
              const info = PRIORIDADES.find(pr => pr.label === p.name);
              return (
                <div key={p.name} className="flex items-center gap-2">
                  <Badge className={`text-xs ${info?.cor || 'bg-gray-100'}`}>{p.name}</Badge>
                  <div className="flex-1 bg-muted rounded-full h-5 overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all"
                      style={{ width: `${Math.min(100, (p.value / Math.max(1, metricas.total)) * 100)}%` }}
                    />
                  </div>
                  <span className="text-sm font-bold w-8 text-right">{p.value}</span>
                </div>
              );
            })}
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-sm">Ordens de Produção Ativas</h3>
            <Badge className="bg-indigo-100 text-indigo-700">{opsAtivas.length}</Badge>
          </div>
          {opsAtivas.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Nenhuma OP ativa</p>
          ) : (
            <div className="space-y-2 max-h-[200px] overflow-y-auto">
              {opsAtivas.slice(0, 8).map(op => (
                <div key={op.id} className="flex items-center justify-between text-xs border-b pb-1.5">
                  <div className="min-w-0">
                    <p className="font-mono font-bold truncate">{op.numero_op}</p>
                    <p className="text-muted-foreground truncate">{op.cliente} · {op.maquina_nome || '—'}</p>
                  </div>
                  <Badge variant="outline" className={`text-[10px] ${
                    op.status === 'EM_PRODUCAO' ? 'bg-indigo-100 text-indigo-700' : 'bg-amber-100 text-amber-700'
                  }`}>
                    {op.status === 'EM_PRODUCAO' ? 'Produzindo' : 'Aguardando'}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Ocorrências logísticas */}
      {ocorrencias.length > 0 && (
        <Card className="p-4 border-red-200">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-4 h-4 text-red-500" />
            <h3 className="font-bold text-sm">Ocorrências Logísticas em Aberto</h3>
            <Badge className="bg-red-100 text-red-700">{ocorrencias.length}</Badge>
          </div>
          <div className="space-y-1.5 max-h-[200px] overflow-y-auto">
            {ocorrencias.slice(0, 10).map(oc => (
              <div key={oc.id} className="flex items-center justify-between text-xs border-b pb-1">
                <div>
                  <p className="font-medium">{oc.cliente || '—'}</p>
                  <p className="text-muted-foreground">{oc.tipo?.replace(/_/g, ' ')} · {oc.descricao}</p>
                </div>
                <Badge variant="outline" className="text-[10px] bg-red-50 text-red-600">Pendente</Badge>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}