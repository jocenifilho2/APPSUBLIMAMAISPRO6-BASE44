import React, { useState, useMemo, useRef, useEffect } from 'react';
import { entities } from '@/api/entities';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Plus, Search, Pencil, Trash2, FileText, Receipt, Layers, MessageCircle, Upload, Download, Link, FileCheck, Square, CheckSquare } from 'lucide-react';
import { format } from 'date-fns';
import PaymentBadge from '../components/pedidos/PaymentBadge';
import PedidoStatusBadge from '../components/pedidos/PedidoStatusBadge';
import ImpressaoFormDialog from '../components/impressoes/ImpressaoFormDialog';
import ImpressaoPedidoDoc from '../components/impressoes/ImpressaoPedidoDoc';
import ImpressaoReciboDoc from '../components/impressoes/ImpressaoReciboDoc';
import ImpressaoSeparacaoDoc from '../components/impressoes/ImpressaoSeparacaoDoc';
import ComprovanteViewer from '../components/impressoes/ComprovanteViewer';
import CancelamentoDialog from '../components/pedidos/CancelamentoDialog';
import Pagination from '../components/common/Pagination';
import { registrarLog } from '@/lib/audit-log';
import { registrarHistorico } from '@/lib/historico-pedido';
import { usePodeEditar } from '@/lib/permissoes';
import { limparVariacaoNome } from '@/lib/cliente-helpers';

const PAGE_SIZE = 20;

export default function GestaoImpressoes() {
  const podeEditarModulo = usePodeEditar('producao');
  const [busca, setBusca] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('TODOS');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [docTarget, setDocTarget] = useState(null);
  const [docType, setDocType] = useState(null);
  const [comprovanteTarget, setComprovanteTarget] = useState(null);
  const [autoPrintSeparacao, setAutoPrintSeparacao] = useState(false);
  const [selected, setSelected] = useState(new Set());
  const [bulkStatusValue, setBulkStatusValue] = useState('');
  const [showBulkStatus, setShowBulkStatus] = useState(false);
  const [cancelamentoTarget, setCancelamentoTarget] = useState(null);
  const [page, setPage] = useState(1);
  const csvRef = useRef(null);
  const queryClient = useQueryClient();

  const { data: pedidos = [], isLoading } = useQuery({
    queryKey: ['pedidos_impressao'],
    queryFn: () => entities.PedidoImpressao.list('-created_date', 9999),
  });

  const createMutation = useMutation({
    mutationFn: (data) => entities.PedidoImpressao.create(data),
    onSuccess: (created) => { queryClient.invalidateQueries({ queryKey: ['pedidos_impressao'] }); setFormOpen(false); registrarLog({ acao: 'CRIAR', entidade: 'PedidoImpressao', entidade_id: created?.id, detalhes: `Pedido ${created?.numero || ''} — ${created?.cliente || ''}` }); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => entities.PedidoImpressao.update(id, data),
    onSuccess: (_d, { id, data: d }) => { queryClient.invalidateQueries({ queryKey: ['pedidos_impressao'] }); setFormOpen(false); setEditing(null); registrarLog({ acao: 'EDITAR', entidade: 'PedidoImpressao', entidade_id: id, detalhes: `Pedido ${d?.numero || ''} — ${d?.cliente || ''}` }); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => entities.PedidoImpressao.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['pedidos_impressao'] }); if (deleteTarget) registrarLog({ acao: 'EXCLUIR', entidade: 'PedidoImpressao', entidade_id: deleteTarget.id, detalhes: `Pedido ${deleteTarget.numero || ''} — ${deleteTarget.cliente || ''}` }); setDeleteTarget(null); },
  });

  const statusMutation = useMutation({
    mutationFn: async ({ id, status, motivo_cancelamento }) => {
      const p = pedidos.find(x => x.id === id);
      const statusAnterior = p?.status || '';
      const statusSalvo = status === 'ENTREGUE' ? 'PAGO' : status;
      const updateData = { status: statusSalvo };
      if (motivo_cancelamento) updateData.motivo_cancelamento = motivo_cancelamento;
      await entities.PedidoImpressao.update(id, updateData);
      registrarHistorico({ pedido_id: id, tipo_pedido: 'IMPRESSAO', status_anterior: statusAnterior, status_novo: statusSalvo });
      const links = await entities.LinkAcompanhamento.filter({ pedido_id: id });
      if (links.length > 0) {
        await entities.LinkAcompanhamento.update(links[0].id, { status: statusSalvo });
      }
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['pedidos_impressao'] });
      registrarLog({ acao: 'STATUS', entidade: 'PedidoImpressao', entidade_id: variables?.id, detalhes: `Status → ${variables?.status || ''}` });
      const statusSalvo = variables?.status === 'ENTREGUE' ? 'PAGO' : variables?.status;
      if (statusSalvo === 'PAGO') {
        const p = pedidos.find(x => x.id === variables.id);
        if (p && p.status !== 'PAGO') {
          setDocTarget({ ...p, status: 'PAGO' });
          setDocType('separacao');
          setAutoPrintSeparacao(true);
        }
      }
    },
  });

  const filtered = useMemo(() => {
    let result = pedidos;
    if (busca) {
      const b = busca.toLowerCase();
      result = result.filter(p => p.cliente?.toLowerCase().includes(b) || p.numero?.includes(b));
    }
    if (filtroStatus !== 'TODOS') {
      result = result.filter(p => p.status === filtroStatus);
    }
    if (dataInicio) {
      result = result.filter(p => p.data && p.data >= dataInicio);
    }
    if (dataFim) {
      result = result.filter(p => p.data && p.data <= dataFim);
    }
    return result;
  }, [pedidos, busca, filtroStatus, dataInicio, dataFim]);

  // Reseta para a primeira página quando a busca/filtro/período muda o conjunto de resultados
  useEffect(() => {
    setPage(1);
  }, [busca, filtroStatus, dataInicio, dataFim]);

  const totalPaginas = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginaSegura = Math.min(page, totalPaginas);
  const paginado = useMemo(
    () => filtered.slice((paginaSegura - 1) * PAGE_SIZE, paginaSegura * PAGE_SIZE),
    [filtered, paginaSegura]
  );

  // Stats
  const totalTAC = pedidos.reduce((s, p) => s + ((p.itens || []).filter(i => i.tipo === 'TAC').reduce((a, i) => a + (i.metros || 0), 0)), 0);
  const totalHAVIR = pedidos.reduce((s, p) => s + ((p.itens || []).filter(i => i.tipo === 'HAVIR').reduce((a, i) => a + (i.metros || 0), 0)), 0);
  const totalTRATADO = pedidos.reduce((s, p) => s + ((p.itens || []).filter(i => i.tipo === 'TRATADO').reduce((a, i) => a + (i.metros || 0), 0)), 0);
  const totalMetros = totalTAC + totalHAVIR + totalTRATADO;
  const totalDTFA4 = pedidos.reduce((s, p) => s + ((p.itens || []).filter(i => i.tipo === 'DTF A4').reduce((a, i) => a + (i.quantidade || 1), 0)), 0);
  const totalDTFA3 = pedidos.reduce((s, p) => s + ((p.itens || []).filter(i => i.tipo === 'DTF A3').reduce((a, i) => a + (i.quantidade || 1), 0)), 0);
  const totalDTFMetros = pedidos.reduce((s, p) => s + ((p.itens || []).filter(i => i.tipo === 'DTF METRO' || i.tipo === '0,50m' || i.tipo === '1 METRO' || i.tipo === 'ACIMA DE 1 METRO').reduce((a, i) => a + (i.metros || 0), 0)), 0);

  // Contadores por status — lógica puramente computacional (sem IA / sem chamadas de API externa),
  // aplicados sobre a lista já filtrada (busca + status + período) para refletir o recorte selecionado.
  const totalPagos = filtered.filter(p => p.status === 'PAGO').length;
  const totalEntregues = filtered.filter(p => p.status === 'ENTREGUE').length;
  const totalProntos = filtered.filter(p => p.status === 'PRONTO').length;
  const totalCancelados = filtered.filter(p => p.status === 'CANCELADO').length;
  const totalNovos = filtered.filter(p => p.status === 'RECEBIDO').length;
  const totalPendentes = filtered.filter(p => [
    'CONFERENCIA',
    'AGUARDANDO_PAGAMENTO',
    'ARTE_REVISADA',
    'EM_IMPRESSAO',
    'ACABAMENTO',
    'QUALIDADE',
  ].includes(p.status)).length;

  const confirmarCancelamento = (motivo) => {
    if (!cancelamentoTarget) return;
    statusMutation.mutate({ id: cancelamentoTarget.id, status: 'CANCELADO', motivo_cancelamento: motivo });
    setCancelamentoTarget(null);
  };

  const openDoc = (p, type) => { setDocTarget(p); setDocType(type); };

  const allSelected = filtered.length > 0 && selected.size === filtered.length;
  const toggleAll = () => { if (allSelected) setSelected(new Set()); else setSelected(new Set(filtered.map(p => p.id))); };
  const toggleOne = (id) => { const n = new Set(selected); n.has(id) ? n.delete(id) : n.add(id); setSelected(n); };
  const clearBulk = () => { setSelected(new Set()); setShowBulkStatus(false); setBulkStatusValue(''); };
  const handleBulkStatus = (status) => { selected.forEach(id => statusMutation.mutate({ id, status })); clearBulk(); };
  const handleBulkDelete = () => { selected.forEach(id => { const p = filtered.find(x => x.id === id); if (p) setDeleteTarget(p); }); clearBulk(); };

  const gerarLink = async (p) => {
    const token = Math.random().toString(36).substring(2) + Date.now().toString(36);
    const itensTexto = (p.itens || []).map(i => `• ${i.tipo}${i.metros ? ` ${i.metros}m` : `×${i.quantidade || 1}`}${i.descricao ? ` (${i.descricao})` : ''}`).join('\n');
    // Reusar link existente se já houver
    const existing = await entities.LinkAcompanhamento.filter({ pedido_id: p.id });
    let url;
    if (existing.length > 0) {
      await entities.LinkAcompanhamento.update(existing[0].id, { status: p.status, itens_texto: itensTexto });
      url = `${window.location.origin}/acompanhamento/${existing[0].token}`;
    } else {
      await entities.LinkAcompanhamento.create({
        token,
        pedido_id: p.id,
        tipo: 'IMPRESSAO',
        numero: p.numero,
        cliente: p.cliente,
        status: p.status || 'RECEBIDO',
        itens_texto: itensTexto,
        data: p.data,
      });
      url = `${window.location.origin}/acompanhamento/${token}`;
    }
    navigator.clipboard?.writeText(url).catch(() => {});
    window.open(url, '_blank');
  };

  const handleWhatsApp = async (p) => {
    if (!p.telefone) return;
    const num = p.telefone.replace(/\D/g, '');

    // Reaproveita o link de acompanhamento já gerado para este pedido, ou cria um novo
    const itensTexto = (p.itens || []).map(i => `• ${i.tipo}${i.metros ? ` ${i.metros}m` : `×${i.quantidade || 1}`}${i.descricao ? ` (${i.descricao})` : ''}`).join('\n');
    let token;
    try {
      const existing = await entities.LinkAcompanhamento.filter({ pedido_id: p.id });
      if (existing.length > 0) {
        await entities.LinkAcompanhamento.update(existing[0].id, { status: p.status, itens_texto: itensTexto });
        token = existing[0].token;
      } else {
        token = Math.random().toString(36).substring(2) + Date.now().toString(36);
        await entities.LinkAcompanhamento.create({
          token,
          pedido_id: p.id,
          tipo: 'IMPRESSAO',
          numero: p.numero,
          cliente: p.cliente,
          status: p.status || 'RECEBIDO',
          itens_texto: itensTexto,
          data: p.data,
        });
      }
    } catch (err) {
      token = Math.random().toString(36).substring(2) + Date.now().toString(36);
    }

    const linkPedido = `${window.location.origin}/acompanhamento/${token}`;
    const msg = encodeURIComponent(`Olá, ${p.cliente}.\nObrigado mais uma vez por escolher a Sublima Mais. 😄\nSegue o link de acompanhamento em tempo real do seu pedido.\n${linkPedido}`);
    window.open(`https://wa.me/55${num}?text=${msg}`, '_blank');
  };

  const handleCSVImport = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const text = await file.text();
    const lines = text.trim().split('\n');
    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
    const rows = lines.slice(1).map(line => {
      const vals = line.split(',').map(v => v.trim().replace(/"/g, ''));
      const obj = {};
      headers.forEach((h, i) => { obj[h] = vals[i] || ''; });
      return obj;
    });
    for (const row of rows) {
      await entities.PedidoImpressao.create({
        numero: row.numero || row['Nº'] || '',
        cliente: (row.cliente || row['Cliente'] || '').toUpperCase(),
        telefone: row.telefone || '',
        data: row.data || new Date().toISOString().split('T')[0],
        forma_pagamento: row.forma_pagamento || 'PIX',
        status: row.status || 'PENDENTE',
        total: parseFloat(row.total || 0),
        observacoes: row.observacoes || '',
        itens: [],
      });
    }
    queryClient.invalidateQueries({ queryKey: ['pedidos_impressao'] });
    e.target.value = '';
  };

  if (isLoading) {
    return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-yellow-400 flex items-center justify-center text-xl font-black text-red-700">S</div>
          <div>
            <h1 className="text-2xl font-bold">Gestão de Impressões</h1>
          </div>
        </div>
        {podeEditarModulo && (
          <Button onClick={() => { setEditing(null); setFormOpen(true); }}>
            <Plus className="w-4 h-4 mr-1" /> Novo Pedido
          </Button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-7 gap-3">
        <Card className="p-3 min-w-0"><p className="text-xs text-muted-foreground font-medium truncate">Total Pedidos</p><p className="text-lg font-bold truncate">{pedidos.length}</p></Card>
        <Card className="p-3 min-w-0"><p className="text-xs text-muted-foreground font-medium truncate">TAC (m)</p><p className="text-lg font-bold text-blue-600 truncate">{totalTAC.toFixed(2)}m</p></Card>
        <Card className="p-3 min-w-0"><p className="text-xs text-muted-foreground font-medium truncate">HAVIR (m)</p><p className="text-lg font-bold text-purple-600 truncate">{totalHAVIR.toFixed(2)}m</p></Card>
        <Card className="p-3 min-w-0"><p className="text-xs text-muted-foreground font-medium truncate">TRATADO (m)</p><p className="text-lg font-bold text-teal-600 truncate">{totalTRATADO.toFixed(2)}m</p></Card>
        <Card className="p-3 min-w-0"><p className="text-xs text-muted-foreground font-medium truncate">Total Metragem</p><p className="text-lg font-bold text-orange-600 truncate">{totalMetros.toFixed(2)}m</p></Card>
        <Card className="p-3 min-w-0"><p className="text-xs text-muted-foreground font-medium truncate">DTF A4</p><p className="text-lg font-bold text-amber-600 truncate">{totalDTFA4}</p></Card>
        <Card className="p-3 min-w-0"><p className="text-xs text-muted-foreground font-medium truncate">DTF A3</p><p className="text-lg font-bold text-amber-700 truncate">{totalDTFA3}</p></Card>
      </div>

      {/* Stats por status — contagem pura, sem IA/API externa */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 xl:grid-cols-6 gap-3">
        <Card className="p-3 min-w-0"><p className="text-xs text-muted-foreground font-medium truncate">Novos</p><p className="text-lg font-bold text-amber-600 truncate">{totalNovos}</p></Card>
        <Card className="p-3 min-w-0"><p className="text-xs text-muted-foreground font-medium truncate">Pendentes</p><p className="text-lg font-bold text-orange-600 truncate">{totalPendentes}</p></Card>
        <Card className="p-3 min-w-0"><p className="text-xs text-muted-foreground font-medium truncate">Pagos</p><p className="text-lg font-bold text-green-600 truncate">{totalPagos}</p></Card>
        <Card className="p-3 min-w-0"><p className="text-xs text-muted-foreground font-medium truncate">Prontos</p><p className="text-lg font-bold text-blue-600 truncate">{totalProntos}</p></Card>
        <Card className="p-3 min-w-0"><p className="text-xs text-muted-foreground font-medium truncate">Entregues</p><p className="text-lg font-bold text-emerald-600 truncate">{totalEntregues}</p></Card>
        <Card className="p-3 min-w-0"><p className="text-xs text-muted-foreground font-medium truncate">Cancelados</p><p className="text-lg font-bold text-red-600 truncate">{totalCancelados}</p></Card>
      </div>

      {/* Busca + importar */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Buscar por cliente ou número do pedido..." value={busca} onChange={(e) => setBusca(e.target.value)} className="pl-9" />
        </div>
        <Select value={filtroStatus} onValueChange={setFiltroStatus}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="Filtrar por status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="TODOS">Todos os status</SelectItem>
            <SelectItem value="RECEBIDO">RECEBIDO</SelectItem>
            <SelectItem value="CONFERENCIA">CONFERÊNCIA</SelectItem>
            <SelectItem value="AGUARDANDO_PAGAMENTO">AG. PAGAMENTO</SelectItem>
            <SelectItem value="PAGO">PAGO</SelectItem>
            <SelectItem value="ARTE_REVISADA">ARTE REVISADA</SelectItem>
            <SelectItem value="EM_IMPRESSAO">EM IMPRESSÃO</SelectItem>
            <SelectItem value="ACABAMENTO">ACABAMENTO</SelectItem>
            <SelectItem value="QUALIDADE">QUALIDADE</SelectItem>
            <SelectItem value="PRONTO">PRONTO</SelectItem>
            <SelectItem value="ENTREGUE">ENTREGUE</SelectItem>
            <SelectItem value="CANCELADO">CANCELADO</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex items-center gap-1.5">
          <Input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} className="w-[150px]" title="Data inicial" />
          <span className="text-xs text-muted-foreground">até</span>
          <Input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} className="w-[150px]" title="Data final" />
          {(dataInicio || dataFim) && (
            <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => { setDataInicio(''); setDataFim(''); }}>Limpar período</Button>
          )}
        </div>
        {podeEditarModulo && (
          <>
            <input ref={csvRef} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={handleCSVImport} />
            <Button variant="outline" size="sm" onClick={() => csvRef.current?.click()}>
              <Upload className="w-4 h-4 mr-1" /> Importar CSV/Excel
            </Button>
          </>
        )}
        <Button variant="outline" size="sm" onClick={() => {
          const header = 'Nº,Cliente,Telefone,Data,Pagamento,Status,Total\n';
          const rows = filtered.map(p =>
            `${p.numero || ''},"${p.cliente || ''}",${p.telefone || ''},${p.data || ''},${p.forma_pagamento || ''},${p.status || ''},${(p.total || 0).toFixed(2)}`
          ).join('\n');
          const blob = new Blob([header + rows], { type: 'text/csv' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url; a.download = 'impressoes.csv'; a.click();
        }}>
          <Download className="w-4 h-4 mr-1" /> Exportar CSV
        </Button>
      </div>

      {/* Barra de ações em lote */}
      {selected.size > 0 && podeEditarModulo && (
        <div className="flex flex-wrap items-center gap-2 bg-primary/10 border border-primary/30 rounded-xl px-4 py-2.5">
          <span className="text-sm font-semibold text-primary">{selected.size} selecionado{selected.size > 1 ? 's' : ''}</span>
          {!showBulkStatus ? (
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setShowBulkStatus(true)}>Alterar Status</Button>
          ) : (
            <div className="flex items-center gap-1">
              <Select value={bulkStatusValue} onValueChange={(v) => { setBulkStatusValue(v); handleBulkStatus(v); }}>
                <SelectTrigger className="h-7 w-[160px] text-xs"><SelectValue placeholder="Escolha o status..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="RECEBIDO">RECEBIDO</SelectItem>
                  <SelectItem value="CONFERENCIA">CONFERÊNCIA</SelectItem>
                  <SelectItem value="AGUARDANDO_PAGAMENTO">AG. PAGAMENTO</SelectItem>
                  <SelectItem value="PAGO">PAGO</SelectItem>
                  <SelectItem value="ARTE_REVISADA">ARTE REVISADA</SelectItem>
                  <SelectItem value="EM_IMPRESSAO">EM IMPRESSÃO</SelectItem>
                  <SelectItem value="ACABAMENTO">ACABAMENTO</SelectItem>
                  <SelectItem value="QUALIDADE">QUALIDADE</SelectItem>
                  <SelectItem value="PRONTO">PRONTO</SelectItem>
                  <SelectItem value="ENTREGUE">ENTREGUE</SelectItem>
                  <SelectItem value="CANCELADO">CANCELADO</SelectItem>
                </SelectContent>
              </Select>
              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setShowBulkStatus(false)}>✕</Button>
            </div>
          )}
          {selected.size === 1 && (
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => { const id = Array.from(selected)[0]; const p = filtered.find(x => x.id === id); if (p) { setEditing(p); setFormOpen(true); } clearBulk(); }}>
              <Pencil className="w-3 h-3 mr-1" /> Editar
            </Button>
          )}
          <Button size="sm" variant="outline" className="h-7 text-xs text-red-600 hover:text-red-700 hover:bg-red-50" onClick={handleBulkDelete}>
            <Trash2 className="w-3 h-3 mr-1" /> Excluir
          </Button>
          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={clearBulk}>Cancelar</Button>
        </div>
      )}

      {/* Tabela */}
      <div className="rounded-xl border bg-card overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="w-10">
                {podeEditarModulo ? (
                  <button onClick={toggleAll} className="text-muted-foreground hover:text-foreground transition-colors">
                    {allSelected ? <CheckSquare className="w-4 h-4 text-primary" /> : <Square className="w-4 h-4" />}
                  </button>
                ) : <span className="w-4 h-4 inline-block" />}
              </TableHead>
              <TableHead>Nº Pedido</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Data</TableHead>
              <TableHead>Itens</TableHead>
              <TableHead>Total</TableHead>
              <TableHead>Pagamento</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-center">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 && (
              <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Nenhum pedido encontrado</TableCell></TableRow>
            )}
            {paginado.map(p => (
              <TableRow key={p.id} className={selected.has(p.id) ? 'bg-primary/5' : ''}>
                <TableCell>
                  {podeEditarModulo ? (
                    <button onClick={() => toggleOne(p.id)} className="text-muted-foreground hover:text-foreground transition-colors">
                      {selected.has(p.id) ? <CheckSquare className="w-4 h-4 text-primary" /> : <Square className="w-4 h-4" />}
                    </button>
                  ) : <span className="w-4 h-4 inline-block" />}
                </TableCell>
                <TableCell className="font-mono font-bold text-sm">{p.numero || '—'}</TableCell>
                <TableCell className="font-medium">{limparVariacaoNome(p.cliente) || p.cliente}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{p.data ? format(new Date(p.data + 'T12:00:00'), 'dd/MM/yyyy') : '—'}</TableCell>
                {/* comprovante inline — via link, não na linha */}
                <TableCell className="text-sm text-muted-foreground max-w-[180px] truncate">
                  {(p.itens || []).map(i => `${i.tipo}${i.metros ? ` ${i.metros}m` : ''}`).join(', ') || p.descricao || '—'}
                </TableCell>
                <TableCell className="font-semibold">R$ {(p.total || 0).toFixed(2)}</TableCell>
                <TableCell><PaymentBadge tipo={p.forma_pagamento} /></TableCell>
                <TableCell>
                  <Select value={p.status} onValueChange={(v) => { if (v === 'CANCELADO') { setCancelamentoTarget({ id: p.id, p }); } else { statusMutation.mutate({ id: p.id, status: v }); } }} disabled={!podeEditarModulo}>
                    <SelectTrigger className={`w-[120px] h-7 text-[11px] font-semibold border ${
                      p.status === 'PAGO' ? 'bg-green-100 text-green-700 border-green-200' :
                      p.status === 'ENTREGUE' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' :
                      p.status === 'PRONTO' ? 'bg-blue-100 text-blue-700 border-blue-200' :
                      p.status === 'EM_IMPRESSAO' ? 'bg-indigo-100 text-indigo-700 border-indigo-200' :
                      p.status === 'ACABAMENTO' || p.status === 'QUALIDADE' ? 'bg-purple-100 text-purple-700 border-purple-200' :
                      p.status === 'AGUARDANDO_PAGAMENTO' ? 'bg-orange-100 text-orange-700 border-orange-200' :
                      p.status === 'CANCELADO' ? 'bg-red-100 text-red-700 border-red-200' :
                      'bg-amber-100 text-amber-700 border-amber-200'
                    }`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="RECEBIDO">RECEBIDO</SelectItem>
                      <SelectItem value="CONFERENCIA">CONFERÊNCIA</SelectItem>
                      <SelectItem value="AGUARDANDO_PAGAMENTO">AG. PAGAMENTO</SelectItem>
                      <SelectItem value="PAGO">PAGO</SelectItem>
                      <SelectItem value="ARTE_REVISADA">ARTE REVISADA</SelectItem>
                      <SelectItem value="EM_IMPRESSAO">EM IMPRESSÃO</SelectItem>
                      <SelectItem value="ACABAMENTO">ACABAMENTO</SelectItem>
                      <SelectItem value="QUALIDADE">QUALIDADE</SelectItem>
                      <SelectItem value="PRONTO">PRONTO</SelectItem>
                      <SelectItem value="ENTREGUE">ENTREGUE</SelectItem>
                      <SelectItem value="CANCELADO">CANCELADO</SelectItem>
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  <div className="flex items-center justify-center gap-1">
                    <ActionBtn icon={<FileText className="w-4 h-4" />} label="Pedido" color="text-blue-600" onClick={() => openDoc(p, 'pedido')} />
                    <ActionBtn icon={<Receipt className="w-4 h-4" />} label="Recibo" color="text-green-600" onClick={() => openDoc(p, 'recibo')} />
                    <ActionBtn icon={<Layers className="w-4 h-4" />} label="Separação" color="text-orange-500" onClick={() => openDoc(p, 'separacao')} />
                    <ActionBtn icon={<MessageCircle className="w-4 h-4" />} label="WhatsApp" color="text-emerald-600" onClick={() => handleWhatsApp(p)} />
                    <ActionBtn icon={<Link className="w-4 h-4" />} label="Link" color="text-purple-600" onClick={() => gerarLink(p)} />
                    {p.status === 'AGUARDANDO_PAGAMENTO' && (
                      <ActionBtn icon={<FileCheck className="w-4 h-4" />} label="Comprov." color="text-amber-600" onClick={() => setComprovanteTarget(p.id)} />
                    )}
                    {podeEditarModulo && <ActionBtn icon={<Pencil className="w-4 h-4" />} label="Editar" color="text-amber-600" onClick={() => { setEditing(p); setFormOpen(true); }} />}
                    {podeEditarModulo && <ActionBtn icon={<Trash2 className="w-4 h-4" />} label="Excluir" color="text-red-500" onClick={() => setDeleteTarget(p)} />}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Pagination
        page={paginaSegura}
        pageSize={PAGE_SIZE}
        totalItems={filtered.length}
        onPageChange={setPage}
      />

      {formOpen && (
        <ImpressaoFormDialog
          open={formOpen}
          onOpenChange={setFormOpen}
          pedido={editing}
          onSave={(data) => {
            if (editing) updateMutation.mutate({ id: editing.id, data });
            else createMutation.mutate(data);
          }}
          pedidosExistentes={pedidos}
        />
      )}

      {docTarget && docType === 'pedido' && <ImpressaoPedidoDoc pedido={docTarget} open={true} onOpenChange={() => setDocTarget(null)} />}
      {docTarget && docType === 'recibo' && <ImpressaoReciboDoc pedido={docTarget} open={true} onOpenChange={() => setDocTarget(null)} />}
      {docTarget && docType === 'separacao' && (
        <ImpressaoSeparacaoDoc
          pedido={docTarget}
          open={true}
          onOpenChange={(v) => { if (!v) { setDocTarget(null); setAutoPrintSeparacao(false); } }}
          autoPrint={autoPrintSeparacao}
        />
      )}
      <ComprovanteViewer pedidoId={comprovanteTarget} open={!!comprovanteTarget} onOpenChange={() => setComprovanteTarget(null)} />
      <CancelamentoDialog
        open={!!cancelamentoTarget}
        onOpenChange={() => setCancelamentoTarget(null)}
        pedido={cancelamentoTarget?.p}
        onConfirm={confirmarCancelamento}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Excluir Pedido</AlertDialogTitle><AlertDialogDescription>Tem certeza que deseja excluir este pedido de impressão?</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={() => deleteMutation.mutate(deleteTarget.id)} className="bg-destructive text-destructive-foreground">Excluir</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function ActionBtn({ icon, label, color, onClick }) {
  return (
    <button onClick={onClick} className={`flex flex-col items-center gap-0.5 px-1.5 py-1 rounded hover:bg-muted transition-colors ${color}`} title={label}>
      {icon}
      <span className="text-[9px] font-medium text-muted-foreground">{label}</span>
    </button>
  );
}
