import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Clock, Package, Printer, AlertTriangle, Truck, ChevronRight, Square, CheckSquare, Trash2, MoveRight } from 'lucide-react';
import EntregasPanel from '../../components/pedidos/EntregasPanel';
import SeparacaoDoc from '../../components/pedidos/SeparacaoDoc';
import ImpressaoSeparacaoDoc from '../../components/impressoes/ImpressaoSeparacaoDoc';
import ProntoModal from '../../components/pedidos/ProntoModal';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { usePodeEditar } from '@/lib/permissoes';
import { registrarHistorico } from '@/lib/historico-pedido';

const COLUMNS = [
  { key: 'RECEBIDOS', label: 'Recebidos', color: 'bg-yellow-50 border-yellow-200', badge: 'bg-yellow-100 text-yellow-700', pedidoStatus: ['NOVO'], impressaoStatus: ['PENDENTE'] },
  { key: 'EM_PRODUCAO', label: 'Em Produção', color: 'bg-indigo-50 border-indigo-200', badge: 'bg-indigo-100 text-indigo-700', pedidoStatus: ['PRODUCAO'], impressaoStatus: ['AGUARDANDO'] },
  { key: 'EM_SEPARACAO', label: 'Em Separação', color: 'bg-cyan-50 border-cyan-200', badge: 'bg-cyan-100 text-cyan-700', pedidoStatus: ['SEPARACAO'], impressaoStatus: ['PAGO'] },
  { key: 'PRONTO', label: 'Pronto p/ Retirada', color: 'bg-blue-50 border-blue-200', badge: 'bg-blue-100 text-blue-700', pedidoStatus: ['PRONTO', 'PAGO'], impressaoStatus: ['CONCLUIDO'] },
  { key: 'FINALIZADOS', label: 'Entregues', color: 'bg-green-50 border-green-200', badge: 'bg-green-100 text-green-700', pedidoStatus: ['ENTREGUE', 'CANCELADO'], impressaoStatus: ['ENTREGUE', 'CANCELADO'] },
];

// Colunas para as quais é possível mover um pedido manualmente (movimentação livre,
// sem qualquer restrição por data/tempo do pedido).
const COLUNAS_MOVIVEIS = COLUMNS.filter(c => c.pedidoStatus.length > 0 || c.impressaoStatus.length > 0);

const STATUS_AVANCAR = {
  NOVO: 'PRODUCAO', PRODUCAO: 'SEPARACAO', SEPARACAO: 'PRONTO', PAGO: 'PRONTO', PRONTO: 'ENTREGUE',
};

function tempoDecorrido(date) {
  if (!date) return null;
  return formatDistanceToNow(new Date(date), { addSuffix: false, locale: ptBR });
}

function alertColor(date) {
  if (!date) return '';
  const mins = (Date.now() - new Date(date).getTime()) / 60000;
  if (mins > 20) return 'border-l-4 border-l-red-500';
  if (mins > 10) return 'border-l-4 border-l-amber-400';
  return '';
}

function minutesOld(date) {
  if (!date) return 0;
  return (Date.now() - new Date(date).getTime()) / 60000;
}

export default function ErpLogistica() {
  const podeEditarModulo = usePodeEditar('logistica');
  const [linkCorrida, setLinkCorrida] = useState({});
  const [editingCorrida, setEditingCorrida] = useState(null);
  const [movingItem, setMovingItem] = useState(null);
  const [selected, setSelected] = useState(new Set());
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [bulkMoving, setBulkMoving] = useState(false);
  const [docPedido, setDocPedido] = useState(null);
  const [docImpressao, setDocImpressao] = useState(null);
  const [prontoModal, setProntoModal] = useState(null);
  const queryClient = useQueryClient();

  const { data: pedidos = [] } = useQuery({
    queryKey: ['logistica_pedidos'],
    queryFn: () => base44.entities.Pedido.list('-created_date', 200),
    refetchInterval: 15000,
    refetchIntervalInBackground: false,
  });

  const { data: impressoes = [] } = useQuery({
    queryKey: ['logistica_impressoes'],
    queryFn: () => base44.entities.PedidoImpressao.list('-created_date', 200),
    refetchInterval: 15000,
    refetchIntervalInBackground: false,
  });

  const updatePedidoMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Pedido.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['logistica_pedidos'] }),
  });

  const updateImpressaoMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.PedidoImpressao.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['logistica_impressoes'] }),
  });

  const deletePedidoMutation = useMutation({
    mutationFn: (id) => base44.entities.Pedido.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['logistica_pedidos'] }),
  });

  const deleteImpressaoMutation = useMutation({
    mutationFn: (id) => base44.entities.PedidoImpressao.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['logistica_impressoes'] }),
  });

  const allItems = useMemo(() => {
    const p = pedidos.map(x => ({ ...x, _tipo: 'PRODUTO' }));
    const i = impressoes.map(x => ({ ...x, _tipo: 'IMPRESSAO', numero_pedido: x.numero }));
    return [...p, ...i];
  }, [pedidos, impressoes]);

  const itemKey = (item) => `${item._tipo}:${item.id}`;

  const getColumn = (item) => {
    for (const col of COLUMNS) {
      if (item._tipo === 'PRODUTO' && col.pedidoStatus.includes(item.status)) return col.key;
      if (item._tipo === 'IMPRESSAO' && col.impressaoStatus.includes(item.status)) return col.key;
    }
    return null;
  };

  const columnItems = useMemo(() => {
    const map = {};
    COLUMNS.forEach(c => { map[c.key] = []; });
    allItems.forEach(item => {
      const col = getColumn(item);
      if (col) map[col].push(item);
    });
    return map;
  }, [allItems]);

  const metrics = useMemo(() => ({
    hoje: allItems.filter(x => {
      const d = x.data || x.created_date?.split('T')[0];
      return d === new Date().toISOString().split('T')[0];
    }).length,
    producao: (columnItems['EM_PRODUCAO'] || []).length,
    atraso: allItems.filter(x => minutesOld(x.created_date) > 20 && !['ENTREGUE', 'CANCELADO'].includes(x.status)).length,
    prontos: (columnItems['PRONTO'] || []).length,
  }), [allItems, columnItems]);

  const avancarStatus = async (item) => {
    const proximo = STATUS_AVANCAR[item.status];
    if (!proximo) return;
    const statusAnterior = item.status;
    if (item._tipo === 'PRODUTO') updatePedidoMutation.mutate({ id: item.id, data: { status: proximo } });
    else updateImpressaoMutation.mutate({ id: item.id, data: { status: proximo } });
    registrarHistorico({ pedido_id: item.id, tipo_pedido: item._tipo, status_anterior: statusAnterior, status_novo: proximo });
    // Sync link acompanhamento
    try {
      const links = await base44.entities.LinkAcompanhamento.filter({ pedido_id: item.id });
      if (links.length > 0) {
        await base44.entities.LinkAcompanhamento.update(links[0].id, { status: proximo });
      }
    } catch (e) {}
    // Ao sair de "Em Separação" para "Pronto p/ Retirada" (pedidos de produto), mantém
    // a mesma experiência que existia na antiga tela SEPARAÇÃO: modal de confete +
    // atalhos para chamar motoboy/Uber/99.
    if (item._tipo === 'PRODUTO' && statusAnterior === 'SEPARACAO' && proximo === 'PRONTO') {
      setProntoModal({ ...item, status: proximo });
    }
  };

  // Move o pedido diretamente para qualquer coluna do quadro, em qualquer direção
  // (inclusive "para trás"), independente de há quanto tempo o pedido foi criado.
  const moverParaColuna = async (item, colKey) => {
    const col = COLUMNS.find(c => c.key === colKey);
    if (!col) return;
    const novoStatus = item._tipo === 'PRODUTO' ? col.pedidoStatus[0] : col.impressaoStatus[0];
    if (!novoStatus) return;
    const statusAnterior = item.status;
    if (item._tipo === 'PRODUTO') updatePedidoMutation.mutate({ id: item.id, data: { status: novoStatus } });
    else updateImpressaoMutation.mutate({ id: item.id, data: { status: novoStatus } });
    registrarHistorico({ pedido_id: item.id, tipo_pedido: item._tipo, status_anterior: statusAnterior, status_novo: novoStatus });
    try {
      const links = await base44.entities.LinkAcompanhamento.filter({ pedido_id: item.id });
      if (links.length > 0) {
        await base44.entities.LinkAcompanhamento.update(links[0].id, { status: novoStatus });
      }
    } catch (e) {}
    setMovingItem(null);
  };

  const salvarCorrida = (item) => {
    const link = linkCorrida[item.id] || '';
    if (item._tipo === 'PRODUTO') updatePedidoMutation.mutate({ id: item.id, data: { link_corrida: link } });
    setEditingCorrida(null);
  };

  const toggleSelected = (item) => {
    const key = itemKey(item);
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const clearSelection = () => { setSelected(new Set()); setBulkMoving(false); };

  const todosSelecionados = allItems.length > 0 && allItems.every(item => selected.has(itemKey(item)));

  const toggleSelecionarTodos = () => {
    if (todosSelecionados) {
      clearSelection();
    } else {
      setSelected(new Set(allItems.map(itemKey)));
    }
  };

  const moverSelecionadosParaColuna = (colKey) => {
    const itensSelecionados = allItems.filter(item => selected.has(itemKey(item)));
    itensSelecionados.forEach(item => moverParaColuna(item, colKey));
    clearSelection();
  };

  const executarExclusao = () => {
    selected.forEach(key => {
      const [tipo, id] = key.split(':');
      if (tipo === 'PRODUTO') deletePedidoMutation.mutate(id);
      else deleteImpressaoMutation.mutate(id);
    });
    clearSelection();
    setConfirmDelete(false);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-orange-500 flex items-center justify-center">
          <Truck className="w-5 h-5 text-white" />
        </div>
        <div>
          <h2 className="text-xl font-bold">Logística — Painel Operacional</h2>
          <p className="text-sm text-muted-foreground">Kanban em tempo real • Atualiza a cada 8s</p>
        </div>
      </div>

      {/* Métricas */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-3 text-center"><p className="text-xs text-muted-foreground">Pedidos Hoje</p><p className="text-2xl font-black">{metrics.hoje}</p></Card>
        <Card className="p-3 text-center"><p className="text-xs text-muted-foreground">Em Produção</p><p className="text-2xl font-black text-indigo-600">{metrics.producao}</p></Card>
        <Card className="p-3 text-center"><p className="text-xs text-muted-foreground text-red-600">⚠️ Em Atraso</p><p className="text-2xl font-black text-red-600">{metrics.atraso}</p></Card>
        <Card className="p-3 text-center"><p className="text-xs text-muted-foreground">Prontos</p><p className="text-2xl font-black text-blue-600">{metrics.prontos}</p></Card>
      </div>

      {/* Entregas em andamento */}
      <EntregasPanel pedidos={pedidos} readOnly={!podeEditarModulo} />

      {/* Toggle de seleção em massa */}
      {podeEditarModulo && allItems.length > 0 && (
        <div className="flex justify-end">
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={toggleSelecionarTodos}>
            {todosSelecionados ? <CheckSquare className="w-3.5 h-3.5 mr-1" /> : <Square className="w-3.5 h-3.5 mr-1" />}
            {todosSelecionados ? 'Desmarcar todos' : `Selecionar todos (${allItems.length})`}
          </Button>
        </div>
      )}

      {/* Barra de ações em lote (seleção múltipla) */}
      {podeEditarModulo && selected.size > 0 && (
        <div className="sticky top-0 z-20 flex flex-wrap items-center gap-2 bg-primary/10 border border-primary/30 rounded-xl px-4 py-2.5 shadow-sm">
          <span className="text-sm font-semibold text-primary">{selected.size} pedido{selected.size > 1 ? 's' : ''} selecionado{selected.size > 1 ? 's' : ''}</span>
          {bulkMoving ? (
            <Select onValueChange={moverSelecionadosParaColuna}>
              <SelectTrigger className="h-7 text-xs w-44 bg-white"><SelectValue placeholder="Mover para..." /></SelectTrigger>
              <SelectContent>
                {COLUNAS_MOVIVEIS.map(c => (
                  <SelectItem key={c.key} value={c.key} className="text-xs">{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setBulkMoving(true)}>
              <MoveRight className="w-3 h-3 mr-1" /> Mover para...
            </Button>
          )}
          <Button size="sm" variant="outline" className="h-7 text-xs text-red-600 hover:text-red-700 hover:bg-red-50" onClick={() => setConfirmDelete(true)}>
            <Trash2 className="w-3 h-3 mr-1" /> Excluir
          </Button>
          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={clearSelection}>Cancelar</Button>
        </div>
      )}

      {/* Kanban */}
      <div className="flex gap-4 overflow-x-auto pb-4 -mx-1 px-1">
        {COLUMNS.map(col => {
          const items = columnItems[col.key] || [];
          return (
            <div key={col.key} className={`flex-shrink-0 w-64 rounded-xl border-2 ${col.color} flex flex-col`} style={{ minHeight: 400 }}>
              <div className="p-3 border-b border-inherit">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm">{col.label}</span>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${col.badge}`}>{items.length}</span>
                </div>
              </div>
              <div className="flex-1 p-2 space-y-2 overflow-y-auto" style={{ maxHeight: 600 }}>
                {items.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-6">Nenhum pedido</p>
                )}
                {items.map(item => {
                  const mins = minutesOld(item.created_date);
                  const isAlert = mins > 20;
                  const isWarn = mins > 10 && !isAlert;
                  const key = itemKey(item);
                  const isSelected = selected.has(key);
                  return (
                    <div key={key} className={`bg-white rounded-lg p-3 shadow-sm ${alertColor(item.created_date)} ${isSelected ? 'ring-2 ring-primary' : ''}`}>
                      <div className="flex items-start justify-between mb-1">
                        <div className="flex items-start gap-2">
                          {podeEditarModulo && (
                            <button
                              onClick={() => toggleSelected(item)}
                              className="mt-0.5 text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
                              title="Selecionar pedido"
                            >
                              {isSelected ? <CheckSquare className="w-4 h-4 text-primary" /> : <Square className="w-4 h-4" />}
                            </button>
                          )}
                          <div>
                            <p className="font-mono text-xs font-bold text-muted-foreground">{item.numero_pedido || item.numero}</p>
                            <p className="font-bold text-sm leading-tight">{item.cliente}</p>
                          </div>
                        </div>
                        <Badge className={`text-[10px] ${item._tipo === 'PRODUTO' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
                          {item._tipo === 'PRODUTO' ? <Package className="w-3 h-3" /> : <Printer className="w-3 h-3" />}
                        </Badge>
                      </div>

                      {/* Time badge */}
                      <div className={`flex items-center gap-1 text-[10px] mb-2 ${isAlert ? 'text-red-600 font-bold' : isWarn ? 'text-amber-600' : 'text-muted-foreground'}`}>
                        {isAlert && <AlertTriangle className="w-3 h-3" />}
                        <Clock className="w-3 h-3" />
                        {tempoDecorrido(item.created_date)}
                      </div>

                      {/* Items summary */}
                      {item._tipo === 'PRODUTO' && item.itens?.slice(0, 2).map((it, i) => (
                        <p key={i} className="text-[10px] text-muted-foreground truncate">• {it.quantidade}× {it.produto_nome}</p>
                      ))}
                      {item._tipo === 'IMPRESSAO' && item.itens?.slice(0, 2).map((it, i) => (
                        <p key={i} className="text-[10px] text-muted-foreground truncate">• {it.tipo} {it.metros ? `${it.metros}m` : `×${it.quantidade || 1}`}</p>
                      ))}

                      {/* Link corrida */}
                      {item.link_corrida && (
                        <a href={item.link_corrida} target="_blank" rel="noreferrer" className="text-[10px] text-blue-600 underline block mt-1 truncate">🔗 Ver corrida</a>
                      )}
                      {editingCorrida === item.id && (
                        <div className="mt-2 flex gap-1">
                          <Input className="h-6 text-[10px]" placeholder="Cole o link da corrida..." value={linkCorrida[item.id] || ''} onChange={e => setLinkCorrida(v => ({ ...v, [item.id]: e.target.value }))} />
                          <Button size="sm" className="h-6 text-[10px] px-2" onClick={() => salvarCorrida(item)}>OK</Button>
                        </div>
                      )}

                      {/* Mover para outra coluna — disponível sempre, independente da data do pedido */}
                      {movingItem === key && (
                        <div className="mt-2 flex gap-1">
                          <Select onValueChange={(v) => moverParaColuna(item, v)}>
                            <SelectTrigger className="h-6 text-[10px] flex-1"><SelectValue placeholder="Mover para..." /></SelectTrigger>
                            <SelectContent>
                              {COLUNAS_MOVIVEIS.filter(c => c.key !== col.key).map(c => (
                                <SelectItem key={c.key} value={c.key} className="text-xs">{c.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Button size="sm" variant="ghost" className="h-6 text-[10px] px-1.5" onClick={() => setMovingItem(null)}>✕</Button>
                        </div>
                      )}

                      {/* Ficha de separação — só faz sentido enquanto o item está "Em Separação",
                          preserva a função que existia na antiga tela SEPARAÇÃO */}
                      {col.key === 'EM_SEPARACAO' && (
                        <div className="mt-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-6 text-[10px] px-2 w-full"
                            onClick={() => item._tipo === 'PRODUTO' ? setDocPedido(item) : setDocImpressao(item)}
                          >
                            📋 Ficha
                          </Button>
                        </div>
                      )}

                      {/* Actions */}
                      {podeEditarModulo && (
                        <div className="flex gap-1 mt-2">
                          {STATUS_AVANCAR[item.status] && (
                            <Button size="sm" className="h-6 text-[10px] px-2 flex-1" onClick={() => avancarStatus(item)}>
                              {STATUS_AVANCAR[item.status]} <ChevronRight className="w-3 h-3" />
                            </Button>
                          )}
                          <Button size="sm" variant="outline" className="h-6 text-[10px] px-1.5" onClick={() => setMovingItem(movingItem === key ? null : key)} title="Mover para outra coluna">
                            <MoveRight className="w-3 h-3" />
                          </Button>
                          <Button size="sm" variant="outline" className="h-6 text-[10px] px-1.5" onClick={() => setEditingCorrida(editingCorrida === item.id ? null : item.id)} title="Corrida">
                            🚗
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir {selected.size} pedido{selected.size > 1 ? 's' : ''}?</AlertDialogTitle>
            <AlertDialogDescription>
              Essa ação não pode ser desfeita. Os pedidos selecionados serão removidos permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={executarExclusao}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {docPedido && <SeparacaoDoc open={true} onOpenChange={() => setDocPedido(null)} pedido={docPedido} />}
      {docImpressao && <ImpressaoSeparacaoDoc open={true} onOpenChange={() => setDocImpressao(null)} pedido={docImpressao} />}
      <ProntoModal open={!!prontoModal} onClose={() => setProntoModal(null)} pedido={prontoModal} />
    </div>
  );
}
