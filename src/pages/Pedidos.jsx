import React, { useState, useMemo, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Plus, Download, Upload } from 'lucide-react';
import { useRef } from 'react';
import StatsCards from '../components/pedidos/StatsCards';
import PedidoFilters from '../components/pedidos/PedidoFilters';
import PedidoTable from '../components/pedidos/PedidoTable';
import Pagination from '../components/common/Pagination';
import PedidoFormDialog from '../components/pedidos/PedidoFormDialog';
import SeparacaoDoc from '../components/pedidos/SeparacaoDoc';
import PedidoDoc from '../components/pedidos/PedidoDoc';
import ReciboDoc from '../components/pedidos/ReciboDoc';
import { registrarLog } from '@/lib/audit-log';
import { registrarHistorico } from '@/lib/historico-pedido';
import { usePodeEditar } from '@/lib/permissoes';
import { statusLabel } from '@/lib/operacional-helpers';
import { limparVariacaoNome } from '@/lib/cliente-helpers';
import ProntoModal from '../components/pedidos/ProntoModal';
import ComprovanteViewer from '../components/impressoes/ComprovanteViewer';
import EntregueModal from '../components/pedidos/EntregueModal';
import CancelamentoDialog from '../components/pedidos/CancelamentoDialog';
import PedidoTimeline from '../components/pedidos/PedidoTimeline';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle
} from '@/components/ui/alert-dialog';

const PAGE_SIZE = 20;

export default function Pedidos() {
  const podeEditarModulo = usePodeEditar('pedidos');
  const [busca, setBusca] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [origemFilter, setOrigemFilter] = useState('all');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editingPedido, setEditingPedido] = useState(null);
  const [separacaoDoc, setSeparacaoDoc] = useState(null);
  const [pedidoDoc, setPedidoDoc] = useState(null);
  const [reciboDoc, setReciboDoc] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [prontoModal, setProntoModal] = useState(null);
  const [entregueModal, setEntregueModal] = useState(null);
  const [comprovanteTarget, setComprovanteTarget] = useState(null);
  const [timelineTarget, setTimelineTarget] = useState(null);
  const [cancelamentoTarget, setCancelamentoTarget] = useState(null);
  const [autoPrintSeparacao, setAutoPrintSeparacao] = useState(false);
  const [page, setPage] = useState(1);
  const csvImportRef = useRef(null);

  const queryClient = useQueryClient();

  const { data: pedidos = [], isLoading } = useQuery({
    queryKey: ['pedidos'],
    queryFn: () => base44.entities.Pedido.list('-created_date', 9999),
    refetchInterval: 15000,
    refetchIntervalInBackground: false,
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Pedido.create(data),
    onSuccess: (created) => { queryClient.invalidateQueries({ queryKey: ['pedidos'] }); setFormOpen(false); setEditingPedido(null); registrarLog({ acao: 'CRIAR', entidade: 'Pedido', entidade_id: created?.id, detalhes: `Pedido ${created?.numero_pedido || ''} — ${created?.cliente || ''}` }); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Pedido.update(id, data),
    onSuccess: (_d, { id, data: d }) => { queryClient.invalidateQueries({ queryKey: ['pedidos'] }); setFormOpen(false); setEditingPedido(null); registrarLog({ acao: 'EDITAR', entidade: 'Pedido', entidade_id: id, detalhes: `Pedido ${d?.numero_pedido || ''} — ${d?.cliente || ''}` }); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Pedido.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['pedidos'] }); if (deleteTarget) registrarLog({ acao: 'EXCLUIR', entidade: 'Pedido', entidade_id: deleteTarget.id, detalhes: `Pedido ${deleteTarget.numero_pedido || ''} — ${deleteTarget.cliente || ''}` }); setDeleteTarget(null); },
  });

  const baixaEstoqueMutation = useMutation({
    mutationFn: (data) => base44.entities.MovimentacaoEstoque.create(data),
  });

  const baixarEstoquePedido = (pedido, itens) => {
    itens?.forEach(item => {
      if (item.produto_nome && item.quantidade > 0) {
        baixaEstoqueMutation.mutate({
          produto_nome: item.produto_nome,
          tipo: 'SAIDA',
          quantidade: item.quantidade,
          localizacao_origem: 'LOJA',
          motivo: `Venda — Pedido ${pedido.numero_pedido || ''}`,
        });
      }
    });
  };

  const filteredPedidos = useMemo(() => {
    return pedidos.filter(p => {
      const matchBusca = !busca || p.cliente?.toLowerCase().includes(busca.toLowerCase()) || p.numero_pedido?.includes(busca);
      const matchStatus = statusFilter === 'all' || p.status === statusFilter;
      const matchOrigem = origemFilter === 'all' || p.origem === origemFilter;
      const matchDataInicio = !dataInicio || (p.data && p.data >= dataInicio);
      const matchDataFim = !dataFim || (p.data && p.data <= dataFim);
      return matchBusca && matchStatus && matchOrigem && matchDataInicio && matchDataFim;
    });
  }, [pedidos, busca, statusFilter, origemFilter, dataInicio, dataFim]);

  // Reseta para a primeira página sempre que o filtro mudar o conjunto de resultados
  useEffect(() => {
    setPage(1);
  }, [busca, statusFilter, origemFilter, dataInicio, dataFim]);

  const totalPaginas = Math.max(1, Math.ceil(filteredPedidos.length / PAGE_SIZE));
  const paginaSegura = Math.min(page, totalPaginas);
  const pedidosPaginados = useMemo(
    () => filteredPedidos.slice((paginaSegura - 1) * PAGE_SIZE, paginaSegura * PAGE_SIZE),
    [filteredPedidos, paginaSegura]
  );

  const handleSave = (data) => {
    if (editingPedido) {
      updateMutation.mutate({ id: editingPedido.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const gerarLink = async (pedido) => {
    const token = Math.random().toString(36).substring(2) + Date.now().toString(36);
    const itensTexto = (pedido.itens || []).map(i => `• ${i.quantidade}x ${i.produto_nome}`).join('\n');
    await base44.entities.LinkAcompanhamento.create({
      token,
      pedido_id: pedido.id,
      tipo: 'PRODUTO',
      numero: pedido.numero_pedido,
      cliente: limparVariacaoNome(pedido.cliente) || pedido.cliente,
      status: pedido.status,
      itens_texto: itensTexto,
      data: pedido.data,
    });
    const url = `${window.location.origin}/acompanhamento/${token}`;
    navigator.clipboard?.writeText(url).catch(() => {});
    window.open(url, '_blank');
  };

  const handleStatusChange = (id, newStatus) => {
    const p = pedidos.find(x => x.id === id);
    const statusAnterior = p?.status || '';
    if (newStatus === 'CANCELADO') {
      setCancelamentoTarget({ id, p, statusAnterior });
      return;
    }
    updateMutation.mutate({ id, data: { status: newStatus } });

    if (statusAnterior !== newStatus) {
      registrarHistorico({
        pedido_id: id,
        tipo_pedido: 'PRODUTO',
        status_anterior: statusAnterior,
        status_novo: newStatus,
      });
      registrarLog({ acao: 'STATUS', entidade: 'Pedido', entidade_id: id, detalhes: `${statusLabel(statusAnterior)} → ${statusLabel(newStatus)}` });
    }

    if (newStatus === 'PRONTO' && p) setProntoModal(p);
    if (newStatus === 'ENTREGUE' && p) setEntregueModal(p);
    if (newStatus === 'PAGO' && p && p.status !== 'PAGO') {
      setSeparacaoDoc({ ...p, status: 'PAGO' });
      setAutoPrintSeparacao(true);
    }

    const FINAIS = ['ENTREGUE', 'PRONTO', 'PAGO'];
    if (FINAIS.includes(newStatus) && p && !FINAIS.includes(p.status)) {
      baixarEstoquePedido(p, p.itens);
    }

    // Sync link status
    if (p) {
      base44.entities.LinkAcompanhamento.filter({ pedido_id: id }).then(links => {
        if (links.length > 0) {
          base44.entities.LinkAcompanhamento.update(links[0].id, { status: newStatus });
        }
      }).catch(() => {});
    }
  };

  const confirmarCancelamento = (motivo) => {
    if (!cancelamentoTarget) return;
    const { id, p, statusAnterior } = cancelamentoTarget;
    updateMutation.mutate({ id, data: { status: 'CANCELADO', motivo_cancelamento: motivo } });
    if (statusAnterior !== 'CANCELADO') {
      registrarHistorico({ pedido_id: id, tipo_pedido: 'PRODUTO', status_anterior: statusAnterior, status_novo: 'CANCELADO' });
      registrarLog({ acao: 'STATUS', entidade: 'Pedido', entidade_id: id, detalhes: `${statusLabel(statusAnterior)} → CANCELADO — Motivo: ${motivo}` });
    }
    setCancelamentoTarget(null);
  };

  const handleEdit = (pedido) => {
    setEditingPedido(pedido);
    setFormOpen(true);
  };

  const handleWhatsApp = async (pedido) => {
    if (!pedido.telefone) return;
    const phone = pedido.telefone.replace(/\D/g, '');
    const phoneNumber = phone.startsWith('55') ? phone : `55${phone}`;
    const nomeCliente = limparVariacaoNome(pedido.cliente) || pedido.cliente;

    // Reaproveita o link de acompanhamento já gerado para este pedido, ou cria um novo
    let token;
    try {
      const linksExistentes = await base44.entities.LinkAcompanhamento.filter({ pedido_id: pedido.id });
      if (linksExistentes.length > 0) {
        token = linksExistentes[0].token;
      } else {
        token = Math.random().toString(36).substring(2) + Date.now().toString(36);
        const itensTexto = (pedido.itens || []).map(i => `• ${i.quantidade}x ${i.produto_nome}`).join('\n');
        await base44.entities.LinkAcompanhamento.create({
          token,
          pedido_id: pedido.id,
          tipo: 'PRODUTO',
          numero: pedido.numero_pedido,
          cliente: nomeCliente,
          status: pedido.status,
          itens_texto: itensTexto,
          data: pedido.data,
        });
      }
    } catch (err) {
      token = Math.random().toString(36).substring(2) + Date.now().toString(36);
    }

    const linkPedido = `${window.location.origin}/acompanhamento/${token}`;
    const msg = `Olá, ${nomeCliente}.\nObrigado mais uma vez por escolher a Sublima Mais. 😄\nSegue o link de acompanhamento em tempo real do seu pedido.\n${linkPedido}`;
    window.open(`https://wa.me/${phoneNumber}?text=${encodeURIComponent(msg)}`, '_blank');
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
      await base44.entities.Pedido.create({
        numero_pedido: row.numero_pedido || row['Nº Pedido'] || row['numero'] || '',
        cliente: (row.cliente || row['Cliente'] || '').toUpperCase(),
        telefone: row.telefone || '',
        data: row.data || new Date().toISOString().split('T')[0],
        forma_pagamento: row.forma_pagamento || 'PIX',
        status: row.status || 'NOVO',
        total: parseFloat(row.total || 0),
        observacoes: row.observacoes || '',
        itens: [],
      });
    }
    queryClient.invalidateQueries({ queryKey: ['pedidos'] });
    e.target.value = '';
  };

  const exportCSV = () => {
    const header = 'Nº Pedido,Cliente,Telefone,Data,Pagamento,Status,Total\n';
    const rows = filteredPedidos.map(p =>
      `${p.numero_pedido},${limparVariacaoNome(p.cliente) || p.cliente},${p.telefone || ''},${p.data},${p.forma_pagamento},${p.status},${p.total?.toFixed(2)}`
    ).join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'pedidos.csv';
    a.click();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Pedidos Loja / WhatsApp</h1>
          <p className="text-sm text-muted-foreground">Gerencie os pedidos dos clientes</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={exportCSV}>
            <Download className="w-3.5 h-3.5 mr-1" /> Exportar CSV
          </Button>
          {podeEditarModulo && (
            <>
              <input ref={csvImportRef} type="file" accept=".csv" className="hidden" onChange={handleCSVImport} />
              <Button variant="outline" size="sm" onClick={() => csvImportRef.current?.click()}>
                <Upload className="w-3.5 h-3.5 mr-1" /> Importar CSV
              </Button>
              <Button size="sm" onClick={() => { setEditingPedido(null); setFormOpen(true); }}>
                <Plus className="w-4 h-4 mr-1" /> Novo Pedido
              </Button>
            </>
          )}
        </div>
      </div>

      <StatsCards pedidos={pedidos} />

      <PedidoFilters
        busca={busca} setBusca={setBusca}
        statusFilter={statusFilter} setStatusFilter={setStatusFilter}
        origemFilter={origemFilter} setOrigemFilter={setOrigemFilter}
        dataInicio={dataInicio} setDataInicio={setDataInicio}
        dataFim={dataFim} setDataFim={setDataFim}
      />

      <PedidoTable
        pedidos={pedidosPaginados}
        onStatusChange={handleStatusChange}
        onSeparacao={setSeparacaoDoc}
        onPedidoDoc={setPedidoDoc}
        onRecibo={setReciboDoc}
        onWhatsApp={handleWhatsApp}
        onEdit={handleEdit}
        onDelete={setDeleteTarget}
        onGerarLink={gerarLink}
        onComprovante={setComprovanteTarget}
        onTimeline={setTimelineTarget}
        readOnly={!podeEditarModulo}
      />

      <Pagination
        page={paginaSegura}
        pageSize={PAGE_SIZE}
        totalItems={filteredPedidos.length}
        onPageChange={setPage}
      />

      <PedidoFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        pedido={editingPedido}
        onSave={handleSave}
        pedidosExistentes={pedidos}
      />

      <SeparacaoDoc
        open={!!separacaoDoc}
        onOpenChange={(v) => { if (!v) { setSeparacaoDoc(null); setAutoPrintSeparacao(false); } }}
        pedido={separacaoDoc}
        autoPrint={autoPrintSeparacao}
      />
      <PedidoDoc open={!!pedidoDoc} onOpenChange={() => setPedidoDoc(null)} pedido={pedidoDoc} />
      <ReciboDoc open={!!reciboDoc} onOpenChange={() => setReciboDoc(null)} pedido={reciboDoc} />
      <ComprovanteViewer pedidoId={comprovanteTarget} open={!!comprovanteTarget} onOpenChange={() => setComprovanteTarget(null)} />
      <ProntoModal open={!!prontoModal} onClose={() => setProntoModal(null)} pedido={prontoModal} />
      <EntregueModal open={!!entregueModal} onClose={() => setEntregueModal(null)} pedido={entregueModal} />
      <CancelamentoDialog
        open={!!cancelamentoTarget}
        onOpenChange={() => setCancelamentoTarget(null)}
        pedido={cancelamentoTarget?.p}
        onConfirm={confirmarCancelamento}
      />
      <PedidoTimeline open={!!timelineTarget} onOpenChange={() => setTimelineTarget(null)} pedido={timelineTarget} />

      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Pedido</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o pedido {deleteTarget?.numero_pedido} de {limparVariacaoNome(deleteTarget?.cliente) || deleteTarget?.cliente}? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteMutation.mutate(deleteTarget.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}