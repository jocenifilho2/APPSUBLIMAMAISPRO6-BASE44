import React, { useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ClipboardList, FileText, Receipt, MessageCircle, Pencil, Trash2, Link, FileCheck, CheckSquare, Square, CheckCheck, Pencil as PencilIcon, Clock } from 'lucide-react';
import { format } from 'date-fns';
import PaymentBadge from './PaymentBadge';
import { limparVariacaoNome } from '@/lib/cliente-helpers';

const STATUS_OPTIONS = [
  { value: 'NOVO', label: 'RECEBIDO' },
  { value: 'AGUARDANDO_PAGAMENTO', label: 'AGUARD. PAGAMENTO' },
  { value: 'PAGO', label: 'PAGO' },
  { value: 'AGUARDANDO_SEPARACAO', label: 'AGUARD. SEPARAÇÃO' },
  { value: 'SEPARACAO', label: 'EM SEPARAÇÃO' },
  { value: 'AGUARDANDO_PRODUCAO', label: 'AGUARD. PRODUÇÃO' },
  { value: 'PRODUCAO', label: 'EM PRODUÇÃO' },
  { value: 'AGUARDANDO_CONFERENCIA', label: 'AGUARD. CONFERÊNCIA' },
  { value: 'EM_CONFERENCIA', label: 'EM CONFERÊNCIA' },
  { value: 'EMBALAGEM', label: 'EMBALAGEM' },
  { value: 'EXPEDICAO', label: 'EXPEDIÇÃO' },
  { value: 'PRONTO', label: 'PRONTO' },
  { value: 'ENTREGUE', label: 'ENTREGUE' },
  { value: 'FINALIZADO', label: 'FINALIZADO' },
  { value: 'CANCELADO', label: 'CANCELADO' },
];

export default function PedidoTable({ pedidos, onStatusChange, onSeparacao, onPedidoDoc, onRecibo, onWhatsApp, onEdit, onDelete, onGerarLink, onComprovante, onTimeline, readOnly = false }) {
  const [selected, setSelected] = useState(new Set());
  const [bulkStatus, setBulkStatus] = useState('');
  const [showBulkStatusSelect, setShowBulkStatusSelect] = useState(false);

  const allSelected = pedidos.length > 0 && selected.size === pedidos.length;
  const someSelected = selected.size > 0;

  const toggleAll = () => {
    if (readOnly) return;
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(pedidos.map(p => p.id)));
  };

  const toggleOne = (id) => {
    if (readOnly) return;
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  const clearSelection = () => {
    setSelected(new Set());
    setShowBulkStatusSelect(false);
    setBulkStatus('');
  };

  const handleBulkStatus = (status) => {
    selected.forEach(id => onStatusChange(id, status));
    clearSelection();
  };

  const handleBulkEdit = () => {
    const ids = Array.from(selected);
    if (ids.length === 1) {
      const p = pedidos.find(x => x.id === ids[0]);
      if (p) onEdit(p);
    }
    clearSelection();
  };

  const handleBulkDelete = () => {
    selected.forEach(id => {
      const p = pedidos.find(x => x.id === id);
      if (p) onDelete(p);
    });
    clearSelection();
  };

  return (
    <div className="space-y-2">
      {/* Barra de ações em lote */}
      {someSelected && !readOnly && (
        <div className="flex flex-wrap items-center gap-2 bg-primary/10 border border-primary/30 rounded-xl px-4 py-2.5">
          <span className="text-sm font-semibold text-primary">{selected.size} selecionado{selected.size > 1 ? 's' : ''}</span>
          <div className="flex items-center gap-2 flex-wrap">
            {!showBulkStatusSelect ? (
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setShowBulkStatusSelect(true)}>
                Alterar Status
              </Button>
            ) : (
              <div className="flex items-center gap-1">
                <Select value={bulkStatus} onValueChange={(v) => { setBulkStatus(v); handleBulkStatus(v); }}>
                  <SelectTrigger className="h-7 w-[160px] text-xs">
                    <SelectValue placeholder="Escolha o status..." />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map(s => (
                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setShowBulkStatusSelect(false)}>✕</Button>
              </div>
            )}
            {selected.size === 1 && (
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={handleBulkEdit}>
                <PencilIcon className="w-3 h-3 mr-1" /> Editar
              </Button>
            )}
            <Button size="sm" variant="outline" className="h-7 text-xs text-red-600 hover:text-red-700 hover:bg-red-50" onClick={handleBulkDelete}>
              <Trash2 className="w-3 h-3 mr-1" /> Excluir
            </Button>
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={clearSelection}>Cancelar</Button>
          </div>
        </div>
      )}

      <div className="rounded-xl border bg-card overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="w-10">
                {readOnly ? <span className="w-4 h-4 inline-block" /> : (
                  <button onClick={toggleAll} className="text-muted-foreground hover:text-foreground transition-colors">
                    {allSelected ? <CheckSquare className="w-4 h-4 text-primary" /> : <Square className="w-4 h-4" />}
                  </button>
                )}
              </TableHead>
              <TableHead>Nº Pedido</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Data</TableHead>
              <TableHead>Pagamento</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Total</TableHead>
              <TableHead className="text-center">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pedidos.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                  Nenhum pedido encontrado
                </TableCell>
              </TableRow>
            )}
            {pedidos.map((pedido) => {
              const dataFormatada = pedido.data ? format(new Date(pedido.data + 'T12:00:00'), 'dd/MM/yyyy') : '—';
              const isSelected = selected.has(pedido.id);
              return (
                <TableRow key={pedido.id} className={`hover:bg-muted/30 transition-colors ${isSelected ? 'bg-primary/5' : ''}`}>
                  <TableCell>
                    {readOnly ? <span className="w-4 h-4 inline-block" /> : (
                      <button onClick={() => toggleOne(pedido.id)} className="text-muted-foreground hover:text-foreground transition-colors">
                        {isSelected ? <CheckSquare className="w-4 h-4 text-primary" /> : <Square className="w-4 h-4" />}
                      </button>
                    )}
                  </TableCell>
                  <TableCell className="font-mono font-medium text-sm">{pedido.numero_pedido || '—'}</TableCell>
                  <TableCell>
                    <div>
                      <p className="font-medium text-sm">{limparVariacaoNome(pedido.cliente) || pedido.cliente}</p>
                      {pedido.telefone && <p className="text-xs text-muted-foreground">{pedido.telefone}</p>}
                      {pedido.origem && (
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${pedido.origem === 'WHATSAPP' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                          {pedido.origem === 'WHATSAPP' ? '💬 WA' : '🏪 Loja'}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">{dataFormatada}</TableCell>
                  <TableCell><PaymentBadge tipo={pedido.forma_pagamento} /></TableCell>
                  <TableCell>
                    <Select value={pedido.status} onValueChange={(v) => onStatusChange(pedido.id, v)} disabled={readOnly}>
                      <SelectTrigger className={`w-[120px] h-7 text-[11px] font-semibold border ${
                        pedido.status === 'PAGO' ? 'bg-green-100 text-green-700 border-green-200' :
                        pedido.status === 'ENTREGUE' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' :
                        pedido.status === 'PRONTO' ? 'bg-blue-100 text-blue-700 border-blue-200' :
                        pedido.status === 'PRODUCAO' ? 'bg-indigo-100 text-indigo-700 border-indigo-200' :
                        pedido.status === 'SEPARACAO' ? 'bg-cyan-100 text-cyan-700 border-cyan-200' :
                        pedido.status === 'AGUARDANDO_PAGAMENTO' ? 'bg-orange-100 text-orange-700 border-orange-200' :
                        pedido.status === 'CANCELADO' ? 'bg-red-100 text-red-700 border-red-200' :
                        pedido.status === 'NOVO' ? 'bg-yellow-100 text-yellow-700 border-yellow-200' :
                        'bg-amber-100 text-amber-700 border-amber-200'
                      }`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {STATUS_OPTIONS.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="font-semibold text-sm">R$ {pedido.total?.toFixed(2)}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1 justify-center">
                      <ActionBtn icon={FileText} label="Pedido" color="text-indigo-600" onClick={() => onPedidoDoc(pedido)} />
                      <ActionBtn icon={Receipt} label="Recibo" color="text-emerald-600" onClick={() => onRecibo(pedido)} />
                      <ActionBtn icon={ClipboardList} label="Separação" color="text-blue-600" onClick={() => onSeparacao(pedido)} />
                      <ActionBtn icon={MessageCircle} label="WhatsApp" color="text-green-600" onClick={() => onWhatsApp(pedido)} />
                      <ActionBtn icon={Clock} label="Timeline" color="text-slate-600" onClick={() => onTimeline && onTimeline(pedido)} />
                      <ActionBtn icon={Link} label="Link" color="text-purple-600" onClick={() => onGerarLink && onGerarLink(pedido)} />
                      {pedido.status === 'AGUARDANDO_PAGAMENTO' && (
                        <ActionBtn icon={FileCheck} label="Comprov." color="text-amber-600" onClick={() => onComprovante && onComprovante(pedido.id)} />
                      )}
                      {!readOnly && <ActionBtn icon={Pencil} label="Editar" color="text-amber-600" onClick={() => onEdit(pedido)} />}
                      {!readOnly && <ActionBtn icon={Trash2} label="Excluir" color="text-red-500" onClick={() => onDelete(pedido)} />}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function ActionBtn({ icon: Icon, label, color, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center gap-0.5 p-1.5 rounded-md hover:bg-muted transition-colors ${color}`}
      title={label}
    >
      <Icon className="w-4 h-4" />
      <span className="text-[9px] font-medium">{label}</span>
    </button>
  );
}