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
  { key: 'RECEBIDOS', label: 'Recebidos', color: 'bg-gray-50 border-gray-200', badge: 'bg-gray-100 text-gray-700', pedidoStatus: ['NOVO', 'PAGO'], impressaoStatus: ['RECEBIDO'] },
  { key: 'EM_PRODUCAO', label: 'Em Produção', color: 'bg-indigo-50 border-indigo-200', badge: 'bg-indigo-100 text-indigo-700', pedidoStatus: ['PRODUCAO'], impressaoStatus: ['AGUARDANDO', 'EM_IMPRESSAO'] },
  { key: 'EM_SEPARACAO', label: 'Em Separação', color: 'bg-cyan-50 border-cyan-200', badge: 'bg-cyan-100 text-cyan-700', pedidoStatus: ['SEPARACAO'], impressaoStatus: ['PAGO'] },
  { key: 'PRONTO', label: 'Pronto p/ Retirada', color: 'bg-blue-50 border-blue-200', badge: 'bg-blue-100 text-blue-700', pedidoStatus: ['PRONTO'], impressaoStatus: ['CONCLUIDO'] },
  { key: 'ENTREGUES', label: 'Entregues', color: 'bg-green-50 border-green-200', badge: 'bg-green-100 text-green-700', pedidoStatus: ['ENTREGUE'], impressaoStatus: ['ENTREGUE'] }
];

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
  });

  const { data: impressoes = [] } = useQuery({
    queryKey: ['logistica_impressoes'],
    queryFn: () => base44.entities.PedidoImpressao.list('-created_date', 200),
    refetchInterval: 15000,
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
    try {
      const links = await base44.entities.LinkAcompanhamento.filter({ pedido_id: item.id });
      if (links.length > 0) {
        await base44.entities.LinkAcompanhamento.update(links[0].id, { status: proximo });
      }
    } catch (e) {}
    if (item._tipo === 'PRODUTO' && statusAnterior === 'SEPARACAO' && proximo === 'PRONTO') {
      setProntoModal({ ...item, status: proximo });