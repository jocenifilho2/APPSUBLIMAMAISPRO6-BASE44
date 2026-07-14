import React, { useMemo, useRef, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Landmark, Upload, CheckCircle2, AlertTriangle, Link2, Ban, RefreshCw } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { parseExtrato, hashLancamento, sugerirMatches } from '@/lib/conciliacao-helpers';

const statusColor = {
  PENDENTE: 'bg-amber-100 text-amber-700',
  CONCILIADO: 'bg-green-100 text-green-700',
  DIVERGENTE: 'bg-orange-100 text-orange-700',
  IGNORADO: 'bg-gray-100 text-gray-600',
};

export default function ErpConciliacao() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef(null);
  const [importando, setImportando] = useState(false);
  const [statusFilter, setStatusFilter] = useState('TODOS');
  const [matchAbertoId, setMatchAbertoId] = useState(null);

  const { data: extrato = [] } = useQuery({
    queryKey: ['extrato_bancario'],
    queryFn: () => base44.entities.ExtratoBancario.list('-data', 2000),
    refetchInterval: 15000,
  });
  const { data: contas = [] } = useQuery({
    queryKey: ['contas_fin'],
    queryFn: () => base44.entities.ContaFinanceira.list('-created_date', 2000),
  });

  const hashesExistentes = useMemo(() => new Set(extrato.map(e => e.hash_unico).filter(Boolean)), [extrato]);
  const contaPorId = useMemo(() => {
    const m = {};
    contas.forEach(c => { m[c.id] = c; });
    return m;
  }, [contas]);

  // Candidatas para conciliar = contas não canceladas, com status PENDENTE ou PAGO
  const contasCandidatas = useMemo(() => contas.filter(c => c.status !== 'CANCELADO'), [contas]);

  const importarMut = useMutation({
    mutationFn: async (linhas) => {
      // Dedup local (na base já importada) e dentro do próprio arquivo
      const vistos = new Set();
      const novos = [];
      for (const l of linhas) {
        const hash = hashLancamento(l.data, l.valor, l.descricao);
        if (hashesExistentes.has(hash) || vistos.has(hash)) continue;
        vistos.add(hash);

        // Matching automático determinístico
        const candidatas = contasCandidatas.filter(c => c.tipo === (l.valor >= 0 ? 'RECEITA' : 'DESPESA'));
        const sugestoes = sugerirMatches(l, candidatas);
        const melhor = sugestoes[0];
        const autoConciliar = melhor && melhor.score >= 0.85 && (!sugestoes[1] || sugestoes[1].score < melhor.score - 0.15);

        novos.push({
          data: l.data,
          descricao: l.descricao,
          valor: l.valor,
          tipo: l.tipo,
          hash_unico: hash,
          origem_importacao: 'importação manual',
          status_conciliacao: autoConciliar ? 'CONCILIADO' : (melhor ? 'DIVERGENTE' : 'PENDENTE'),
          conta_financeira_id: autoConciliar ? melhor.conta.id : undefined,
        });
      }
      if (novos.length === 0) return { criados: 0 };
      await base44.entities.ExtratoBancario.bulkCreate(novos);

      // Baixa automática das contas conciliadas com alta confiança
      const conciliadosAuto = novos.filter(n => n.status_conciliacao === 'CONCILIADO' && n.conta_financeira_id);
      for (const n of conciliadosAuto) {
        const conta = contaPorId[n.conta_financeira_id];
        if (conta && conta.status !== 'PAGO') {
          await base44.entities.ContaFinanceira.update(conta.id, { status: 'PAGO', data_pagamento: n.data });
        }
      }
      return { criados: novos.length, autoConciliados: conciliadosAuto.length };
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['extrato_bancario'] });
      queryClient.invalidateQueries({ queryKey: ['contas_fin'] });
      toast({ title: 'Extrato importado!', description: `${res.criados} lançamento(s) novos · ${res.autoConciliados || 0} conciliados automaticamente.` });
    },
  });

  const conciliarManualMut = useMutation({
    mutationFn: async ({ item, contaId }) => {
      await base44.entities.ExtratoBancario.update(item.id, { status_conciliacao: 'CONCILIADO', conta_financeira_id: contaId });
      const conta = contaPorId[contaId];
      if (conta && conta.status !== 'PAGO') {
        await base44.entities.ContaFinanceira.update(contaId, { status: 'PAGO', data_pagamento: item.data });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['extrato_bancario'] });
      queryClient.invalidateQueries({ queryKey: ['contas_fin'] });
      setMatchAbertoId(null);
      toast({ title: 'Lançamento conciliado!' });
    },
  });

  const desconciliarMut = useMutation({
    mutationFn: (item) => base44.entities.ExtratoBancario.update(item.id, { status_conciliacao: 'PENDENTE', conta_financeira_id: null }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['extrato_bancario'] }),
  });

  const ignorarMut = useMutation({
    mutationFn: (item) => base44.entities.ExtratoBancario.update(item.id, { status_conciliacao: 'IGNORADO' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['extrato_bancario'] }),
  });

  const criarLancamentoMut = useMutation({
    mutationFn: async (item) => {
      const conta = await base44.entities.ContaFinanceira.create({
        tipo: item.valor >= 0 ? 'RECEITA' : 'DESPESA',
        descricao: item.descricao,
        valor: Math.abs(item.valor),
        data_vencimento: item.data,
        data_pagamento: item.data,
        status: 'PAGO',
        categoria: 'Outros',
        referencia: 'Conciliação bancária',
      });
      await base44.entities.ExtratoBancario.update(item.id, { status_conciliacao: 'CONCILIADO', conta_financeira_id: conta.id });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['extrato_bancario'] });
      queryClient.invalidateQueries({ queryKey: ['contas_fin'] });
      toast({ title: 'Lançamento financeiro criado e conciliado!' });
    },
  });

  const handleArquivo = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportando(true);
    try {
      const texto = await file.text();
      const linhas = parseExtrato(texto, file.name);
      if (linhas.length === 0) {
        toast({ title: 'Nenhum lançamento reconhecido', description: 'Verifique o formato do arquivo (CSV com colunas Data/Descrição/Valor, ou OFX).' });
      } else {
        importarMut.mutate(linhas);
      }
    } catch (err) {
      toast({ title: 'Erro ao ler arquivo', description: String(err?.message || err) });
    } finally {
      setImportando(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const extratoFiltrado = useMemo(() => {
    if (statusFilter === 'TODOS') return extrato;
    return extrato.filter(e => e.status_conciliacao === statusFilter);
  }, [extrato, statusFilter]);

  const resumo = useMemo(() => {
    const total = extrato.length;
    const conciliado = extrato.filter(e => e.status_conciliacao === 'CONCILIADO').length;
    const pendente = extrato.filter(e => e.status_conciliacao === 'PENDENTE').length;
    const divergente = extrato.filter(e => e.status_conciliacao === 'DIVERGENTE').length;
    const saldoExtrato = extrato.reduce((s, e) => s + (e.valor || 0), 0);
    return { total, conciliado, pendente, divergente, saldoExtrato };
  }, [extrato]);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-indigo-600 rounded-xl flex items-center justify-center">
            <Landmark className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-bold">Conciliação Bancária</h2>
            <p className="text-sm text-muted-foreground">Importe o extrato e concilie com o financeiro automaticamente</p>
          </div>
        </div>
        <div>
          <input ref={fileInputRef} type="file" accept=".csv,.ofx,.txt" className="hidden" onChange={handleArquivo} />
          <Button onClick={() => fileInputRef.current?.click()} disabled={importando}>
            <Upload className="w-4 h-4 mr-1" />{importando ? 'Importando...' : 'Importar Extrato (CSV/OFX)'}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card className="p-4"><p className="text-xs text-muted-foreground">Total Importado</p><p className="text-lg font-bold">{resumo.total}</p></Card>
        <Card className="p-4"><p className="text-xs text-muted-foreground">Conciliados</p><p className="text-lg font-bold text-green-700">{resumo.conciliado}</p></Card>
        <Card className="p-4"><p className="text-xs text-muted-foreground">Pendentes</p><p className="text-lg font-bold text-amber-600">{resumo.pendente}</p></Card>
        <Card className="p-4"><p className="text-xs text-muted-foreground">Divergentes</p><p className="text-lg font-bold text-orange-600">{resumo.divergente}</p></Card>
        <Card className="p-4"><p className="text-xs text-muted-foreground">Saldo do Extrato</p><p className={`text-lg font-bold ${resumo.saldoExtrato >= 0 ? 'text-blue-700' : 'text-red-600'}`}>R$ {resumo.saldoExtrato.toFixed(2)}</p></Card>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">Filtrar:</span>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="TODOS">Todos</SelectItem>
            <SelectItem value="PENDENTE">Pendentes</SelectItem>
            <SelectItem value="DIVERGENTE">Divergentes (sugestão)</SelectItem>
            <SelectItem value="CONCILIADO">Conciliados</SelectItem>
            <SelectItem value="IGNORADO">Ignorados</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-xl border bg-card overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead>Data</TableHead>
              <TableHead>Descrição</TableHead>
              <TableHead>Valor</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Vinculado a</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {extratoFiltrado.map(item => {
              const contaVinculada = item.conta_financeira_id ? contaPorId[item.conta_financeira_id] : null;
              const candidatas = statusFilter !== 'CONCILIADO' && matchAbertoId === item.id
                ? sugerirMatches(item, contasCandidatas.filter(c => c.tipo === (item.valor >= 0 ? 'RECEITA' : 'DESPESA'))).slice(0, 5)
                : [];
              return (
                <React.Fragment key={item.id}>
                  <TableRow>
                    <TableCell className="text-xs">{item.data}</TableCell>
                    <TableCell className="text-sm max-w-[280px] truncate" title={item.descricao}>{item.descricao}</TableCell>
                    <TableCell className={`font-bold ${item.valor >= 0 ? 'text-green-700' : 'text-red-600'}`}>R$ {item.valor.toFixed(2)}</TableCell>
                    <TableCell><Badge className={`text-xs ${statusColor[item.status_conciliacao] || ''}`}>{item.status_conciliacao}</Badge></TableCell>
                    <TableCell className="text-xs">{contaVinculada ? contaVinculada.descricao : '—'}</TableCell>
                    <TableCell className="text-right space-x-1">
                      {item.status_conciliacao !== 'CONCILIADO' && (
                        <Button size="sm" variant="outline" onClick={() => setMatchAbertoId(matchAbertoId === item.id ? null : item.id)}>
                          <Link2 className="w-3.5 h-3.5 mr-1" />Conciliar
                        </Button>
                      )}
                      {item.status_conciliacao === 'CONCILIADO' && (
                        <Button size="sm" variant="outline" onClick={() => desconciliarMut.mutate(item)}>
                          <RefreshCw className="w-3.5 h-3.5 mr-1" />Desfazer
                        </Button>
                      )}
                      {item.status_conciliacao !== 'IGNORADO' && item.status_conciliacao !== 'CONCILIADO' && (
                        <Button size="sm" variant="ghost" onClick={() => ignorarMut.mutate(item)}>
                          <Ban className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                  {matchAbertoId === item.id && (
                    <TableRow>
                      <TableCell colSpan={6} className="bg-muted/30">
                        <div className="p-2 space-y-2">
                          <p className="text-xs font-semibold text-muted-foreground">Sugestões (por valor, data e descrição):</p>
                          {candidatas.length === 0 && (
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-muted-foreground">Nenhuma conta compatível encontrada.</span>
                              <Button size="sm" onClick={() => criarLancamentoMut.mutate(item)}>Criar lançamento novo</Button>
                            </div>
                          )}
                          {candidatas.map(({ conta, score }) => (
                            <div key={conta.id} className="flex items-center justify-between text-xs bg-card border rounded-lg px-3 py-2">
                              <div>
                                <span className="font-medium">{conta.descricao}</span>
                                <span className="text-muted-foreground ml-2">R$ {(conta.valor || 0).toFixed(2)} · {conta.data_vencimento || '—'} · compatibilidade {Math.round(score * 100)}%</span>
                              </div>
                              <Button size="sm" onClick={() => conciliarManualMut.mutate({ item, contaId: conta.id })}>
                                <CheckCircle2 className="w-3.5 h-3.5 mr-1" />Vincular
                              </Button>
                            </div>
                          ))}
                          {candidatas.length > 0 && (
                            <Button size="sm" variant="outline" onClick={() => criarLancamentoMut.mutate(item)}>Nenhuma serve — criar lançamento novo</Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </React.Fragment>
              );
            })}
            {extratoFiltrado.length === 0 && (
              <TableRow><TableCell colSpan={6} className="text-center py-10 text-muted-foreground">
                <AlertTriangle className="w-6 h-6 mx-auto mb-2 opacity-40" />
                Nenhum lançamento — importe um extrato CSV ou OFX para começar.
              </TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
