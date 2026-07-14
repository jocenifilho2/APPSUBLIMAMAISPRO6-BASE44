import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Calendar, ChevronLeft, ChevronRight, Download } from 'lucide-react';
import { formatCurrency, formatDate, STATUS_CONTA_COLOR, exportarCSV } from '@/lib/financeiro-helpers';

const DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

export default function CalendarioFinanceiro() {
  const [dataRef, setDataRef] = useState(new Date());
  const [eventoSel, setEventoSel] = useState(null);

  const { data: contas = [] } = useQuery({
    queryKey: ['contas-financeiras'],
    queryFn: () => base44.entities.ContaFinanceira.list('-data_vencimento', 500),
    refetchInterval: 15000
  });

  const contasMes = useMemo(() => {
    const ano = dataRef.getFullYear();
    const mes = dataRef.getMonth();
    return contas.filter(c => {
      if (!c.data_vencimento) return false;
      const d = new Date(c.data_vencimento);
      return d.getFullYear() === ano && d.getMonth() === mes;
    });
  }, [contas, dataRef]);

  const diasCalendario = useMemo(() => {
    const ano = dataRef.getFullYear();
    const mes = dataRef.getMonth();
    const primeiroDia = new Date(ano, mes, 1);
    const ultimoDia = new Date(ano, mes + 1, 0);
    const inicioSemana = primeiroDia.getDay();
    const totalDias = ultimoDia.getDate();

    const dias = [];
    for (let i = 0; i < inicioSemana; i++) dias.push(null);
    for (let d = 1; d <= totalDias; d++) {
      const dataStr = `${ano}-${String(mes + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const eventos = contasMes.filter(c => c.data_vencimento === dataStr);
      dias.push({ dia: d, dataStr, eventos });
    }
    return dias;
  }, [dataRef, contasMes]);

  const totalReceber = contasMes.filter(c => c.tipo === 'RECEITA' && c.status !== 'CANCELADO').reduce((s, c) => s + (c.valor || 0), 0);
  const totalPagar = contasMes.filter(c => c.tipo === 'DESPESA' && c.status !== 'CANCELADO').reduce((s, c) => s + (c.valor || 0), 0);

  function mudarMes(delta) {
    const nova = new Date(dataRef);
    nova.setMonth(nova.getMonth() + delta);
    setDataRef(nova);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold flex items-center gap-2"><Calendar className="w-4 h-4" />Calendário Financeiro</h3>
        <Button variant="outline" size="sm" onClick={() => exportarCSV(contasMes, [
          { label: 'Vencimento', key: 'data_vencimento' }, { label: 'Descrição', key: 'descricao' },
          { label: 'Tipo', key: 'tipo' }, { label: 'Valor', key: c => c.valor?.toFixed(2) },
          { label: 'Status', key: 'status' }
        ], `calendario-${dataRef.getFullYear()}-${dataRef.getMonth() + 1}.csv`)}><Download className="w-3.5 h-3.5 mr-1" />CSV</Button>
      </div>

      <div className="flex items-center justify-between">
        <Button variant="outline" size="icon" onClick={() => mudarMes(-1)}><ChevronLeft className="w-4 h-4" /></Button>
        <h4 className="font-medium">{MESES[dataRef.getMonth()]} {dataRef.getFullYear()}</h4>
        <Button variant="outline" size="icon" onClick={() => mudarMes(1)}><ChevronRight className="w-4 h-4" /></Button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Card className="p-3"><p className="text-xs text-muted-foreground">Total a Receber</p><p className="text-lg font-bold text-green-600">{formatCurrency(totalReceber)}</p></Card>
        <Card className="p-3"><p className="text-xs text-muted-foreground">Total a Pagar</p><p className="text-lg font-bold text-red-600">{formatCurrency(totalPagar)}</p></Card>
      </div>

      <Card className="p-3">
        <div className="grid grid-cols-7 gap-1 mb-1">
          {DIAS.map(d => <div key={d} className="text-center text-xs font-medium text-muted-foreground py-1">{d}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {diasCalendario.map((d, i) => (
            <div key={i} className={`min-h-[60px] border rounded-md p-1 ${d ? 'bg-card' : 'bg-muted/20'}`}>
              {d && (
                <>
                  <p className="text-xs font-medium mb-1">{d.dia}</p>
                  <div className="space-y-0.5">
                    {d.eventos.slice(0, 3).map((e, j) => (
                      <button key={j} onClick={() => setEventoSel(e)} className={`block w-full text-left text-[10px] px-1 py-0.5 rounded truncate ${e.tipo === 'RECEITA' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {formatCurrency(e.valor)}
                      </button>
                    ))}
                    {d.eventos.length > 3 && <p className="text-[10px] text-muted-foreground">+{d.eventos.length - 3} mais</p>}
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      </Card>

      <Dialog open={!!eventoSel} onOpenChange={() => setEventoSel(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Detalhes do Lançamento</DialogTitle></DialogHeader>
          {eventoSel && (
            <div className="space-y-2 text-sm">
              <div><span className="text-muted-foreground">Descrição:</span> <span className="font-medium">{eventoSel.descricao}</span></div>
              <div><span className="text-muted-foreground">Tipo:</span> <Badge variant={eventoSel.tipo === 'RECEITA' ? 'default' : 'secondary'}>{eventoSel.tipo}</Badge></div>
              <div><span className="text-muted-foreground">Valor:</span> <span className="font-bold">{formatCurrency(eventoSel.valor)}</span></div>
              <div><span className="text-muted-foreground">Vencimento:</span> {formatDate(eventoSel.data_vencimento)}</div>
              <div><span className="text-muted-foreground">Status:</span> <Badge className={STATUS_CONTA_COLOR[eventoSel.status]}>{eventoSel.status}</Badge></div>
              {eventoSel.centro_custo_nome && <div><span className="text-muted-foreground">Centro:</span> {eventoSel.centro_custo_nome}</div>}
              {eventoSel.observacoes && <div><span className="text-muted-foreground">Obs:</span> {eventoSel.observacoes}</div>}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}