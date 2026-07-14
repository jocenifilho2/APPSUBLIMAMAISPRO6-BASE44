import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, Package, Printer, Clock, User, CheckSquare, Square, ListChecks } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import ProntoModal from '../components/pedidos/ProntoModal';
import SeparacaoDoc from '../components/pedidos/SeparacaoDoc';
import ImpressaoSeparacaoDoc from '../components/impressoes/ImpressaoSeparacaoDoc';
import { usePodeEditar } from '@/lib/permissoes';
import { registrarHistorico } from '@/lib/historico-pedido';

export default function Separacao() {
  const podeEditarModulo = usePodeEditar('separacao');
  const [prontoModal, setProntoModal] = useState(null);
  const [docPedido, setDocPedido] = useState(null);
  const [docImpressao, setDocImpressao] = useState(null);
  const [selecionados, setSelecionados] = useState(new Set());
  const queryClient = useQueryClient();

  const { data: pedidos = [] } = useQuery({
    queryKey: ['pedidos_sep'],
    queryFn: () => base44.entities.Pedido.filter({ status: 'SEPARACAO' }),
    refetchInterval: 12000,
    refetchIntervalInBackground: false,
  });

  const { data: impressoes = [] } = useQuery({
    queryKey: ['impressoes_sep'],
    queryFn: () => base44.entities.PedidoImpressao.filter({ status: 'PAGO' }),
    refetchInterval: 12000,
    refetchIntervalInBackground: false,
  });

  const updatePedidoMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Pedido.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['pedidos_sep'] }),
  });

  const updateImpressaoMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.PedidoImpressao.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['impressoes_sep'] }),
  });

  const updateLinkStatus = async (pedidoId, novoStatus) => {
    const links = await base44.entities.LinkAcompanhamento.filter({ pedido_id: pedidoId });
    if (links.length > 0) {
      base44.entities.LinkAcompanhamento.update(links[0].id, { status: novoStatus });
    }
  };

  const marcarPronto = (pedido) => {
    updatePedidoMutation.mutate({ id: pedido.id, data: { status: 'PRONTO' } });
    registrarHistorico({ pedido_id: pedido.id, tipo_pedido: 'PRODUTO', status_anterior: pedido.status, status_novo: 'PRONTO' });
    updateLinkStatus(pedido.id, 'PRONTO');
    setProntoModal(pedido);
  };

  const marcarImpressaoConcluida = (imp) => {
    updateImpressaoMutation.mutate({ id: imp.id, data: { status: 'CONCLUIDO' } });
  };

  const chave = (tipo, id) => `${tipo}:${id}`;

  const toggleSelecionado = (tipo, id) => {
    setSelecionados(prev => {
      const next = new Set(prev);
      const k = chave(tipo, id);
      if (next.has(k)) next.delete(k); else next.add(k);
      return next;
    });
  };

  const todosPedidosSelecionados = pedidos.length > 0 && pedidos.every(p => selecionados.has(chave('pedido', p.id)));
  const todasImpressoesSelecionadas = impressoes.length > 0 && impressoes.every(i => selecionados.has(chave('impressao', i.id)));

  const toggleSelecionarTodosPedidos = () => {
    setSelecionados(prev => {
      const next = new Set(prev);
      if (todosPedidosSelecionados) {
        pedidos.forEach(p => next.delete(chave('pedido', p.id)));
      } else {
        pedidos.forEach(p => next.add(chave('pedido', p.id)));
      }
      return next;
    });
  };

  const toggleSelecionarTodasImpressoes = () => {
    setSelecionados(prev => {
      const next = new Set(prev);
      if (todasImpressoesSelecionadas) {
        impressoes.forEach(i => next.delete(chave('impressao', i.id)));
      } else {
        impressoes.forEach(i => next.add(chave('impressao', i.id)));
      }
      return next;
    });
  };

  const limparSelecao = () => setSelecionados(new Set());

  const marcarSelecionadosComoPronto = () => {
    pedidos
      .filter(p => selecionados.has(chave('pedido', p.id)))
      .forEach(p => marcarPronto(p));
    impressoes
      .filter(i => selecionados.has(chave('impressao', i.id)))
      .forEach(i => marcarImpressaoConcluida(i));
    limparSelecao();
  };

  const tempo = (date) => {
    if (!date) return '—';
    return formatDistanceToNow(new Date(date), { addSuffix: true, locale: ptBR });
  };

  const urgencia = (date) => {
    if (!date) return '';
    const mins = (Date.now() - new Date(date).getTime()) / 60000;
    if (mins > 20) return 'border-red-400 bg-red-50';
    if (mins > 10) return 'border-amber-400 bg-amber-50';
    return 'border-green-300 bg-green-50';
  };

  const total = pedidos.length + impressoes.length;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-cyan-500 flex items-center justify-center">
          <Package className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold">Separação</h1>
          <p className="text-sm text-muted-foreground">{total} pedido(s) aguardando separação</p>
        </div>
      </div>

      {total === 0 && (
        <div className="text-center py-16 text-muted-foreground">
          <CheckCircle className="w-12 h-12 mx-auto mb-3 text-green-400" />
          <p className="font-semibold">Tudo separado! Nenhum pedido pendente.</p>
        </div>
      )}

      {pedidos.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold flex items-center gap-2">
              <Package className="w-4 h-4" /> Pedidos de Produto ({pedidos.length})
            </h2>
            {podeEditarModulo && (
              <Button size="sm" variant="outline" onClick={toggleSelecionarTodosPedidos} className="text-xs">
                {todosPedidosSelecionados ? <CheckSquare className="w-3.5 h-3.5 mr-1" /> : <Square className="w-3.5 h-3.5 mr-1" />}
                {todosPedidosSelecionados ? 'Desmarcar todos' : 'Selecionar todos'}
              </Button>
            )}
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {pedidos.map(p => (
              <Card key={p.id} className={`p-4 border-2 ${urgencia(p.created_date)} ${selecionados.has(chave('pedido', p.id)) ? 'ring-2 ring-primary' : ''}`}>
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-start gap-2">
                    {podeEditarModulo && (
                      <button type="button" onClick={() => toggleSelecionado('pedido', p.id)} className="mt-0.5" title="Selecionar pedido">
                        {selecionados.has(chave('pedido', p.id)) ? <CheckSquare className="w-4 h-4 text-primary" /> : <Square className="w-4 h-4 text-muted-foreground" />}
                      </button>
                    )}
                    <div>
                      <p className="font-mono font-bold text-sm">{p.numero_pedido}</p>
                      <p className="font-bold text-base">{p.cliente}</p>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-xs">{p.forma_retirada || 'LOJA'}</Badge>
                </div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground mb-3">
                  <Clock className="w-3 h-3" />
                  {tempo(p.created_date)}
                </div>
                {p.vendedor && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground mb-3">
                    <User className="w-3 h-3" /> {p.vendedor}
                  </div>
                )}
                <div className="space-y-1 mb-3">
                  {(p.itens || []).map((item, i) => (
                    <div key={i} className="flex justify-between text-sm">
                      <span className="truncate font-medium">{item.produto_nome}</span>
                      <span className="ml-2 font-bold text-primary">×{item.quantidade}</span>
                    </div>
                  ))}
                </div>
                {p.observacoes && <p className="text-xs text-muted-foreground italic mb-3">{p.observacoes}</p>}
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => setDocPedido(p)} className="flex-1 text-xs">
                    📋 Ficha
                  </Button>
                  {podeEditarModulo && (
                    <Button size="sm" onClick={() => marcarPronto(p)} className="flex-1 bg-green-600 hover:bg-green-700 text-xs">
                      <CheckCircle className="w-3.5 h-3.5 mr-1" /> Pronto
                    </Button>
                  )}
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {impressoes.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold flex items-center gap-2">
              <Printer className="w-4 h-4" /> Produção — Aguardando Separação ({impressoes.length})
            </h2>
            {podeEditarModulo && (
              <Button size="sm" variant="outline" onClick={toggleSelecionarTodasImpressoes} className="text-xs">
                {todasImpressoesSelecionadas ? <CheckSquare className="w-3.5 h-3.5 mr-1" /> : <Square className="w-3.5 h-3.5 mr-1" />}
                {todasImpressoesSelecionadas ? 'Desmarcar todos' : 'Selecionar todos'}
              </Button>
            )}
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {impressoes.map(imp => (
              <Card key={imp.id} className={`p-4 border-2 ${urgencia(imp.created_date)} ${selecionados.has(chave('impressao', imp.id)) ? 'ring-2 ring-primary' : ''}`}>
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-start gap-2">
                    {podeEditarModulo && (
                      <button type="button" onClick={() => toggleSelecionado('impressao', imp.id)} className="mt-0.5" title="Selecionar pedido">
                        {selecionados.has(chave('impressao', imp.id)) ? <CheckSquare className="w-4 h-4 text-primary" /> : <Square className="w-4 h-4 text-muted-foreground" />}
                      </button>
                    )}
                    <div>
                      <p className="font-mono font-bold text-sm">{imp.numero}</p>
                      <p className="font-bold text-base">{imp.cliente}</p>
                    </div>
                  </div>
                  <Badge className="bg-yellow-100 text-yellow-700 text-xs">PAGO</Badge>
                </div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground mb-3">
                  <Clock className="w-3 h-3" /> {tempo(imp.created_date)}
                </div>
                <div className="space-y-1 mb-3">
                  {(imp.itens || []).map((item, i) => (
                    <div key={i} className="text-sm font-medium">
                      {item.tipo}{item.descricao ? ` (${item.descricao})` : ''} {item.metros ? `• ${item.metros}m` : `×${item.quantidade || 1}`}
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => setDocImpressao(imp)} className="flex-1 text-xs">
                    📋 Ficha
                  </Button>
                  {podeEditarModulo && (
                    <Button size="sm" onClick={() => marcarImpressaoConcluida(imp)} className="flex-1 bg-green-600 hover:bg-green-700 text-xs">
                      <CheckCircle className="w-3.5 h-3.5 mr-1" /> Pronto
                    </Button>
                  )}
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {selecionados.size > 0 && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 bg-white border shadow-lg rounded-full px-4 py-2 flex items-center gap-3">
          <span className="text-sm font-semibold flex items-center gap-1">
            <ListChecks className="w-4 h-4" /> {selecionados.size} selecionado(s)
          </span>
          <Button size="sm" variant="ghost" onClick={limparSelecao}>Cancelar</Button>
          <Button size="sm" onClick={marcarSelecionadosComoPronto} className="bg-green-600 hover:bg-green-700">
            <CheckCircle className="w-3.5 h-3.5 mr-1" /> Marcar como Pronto
          </Button>
        </div>
      )}

      <ProntoModal open={!!prontoModal} onClose={() => setProntoModal(null)} pedido={prontoModal} />
      {docPedido && <SeparacaoDoc open={true} onOpenChange={() => setDocPedido(null)} pedido={docPedido} />}
      {docImpressao && <ImpressaoSeparacaoDoc open={true} onOpenChange={() => setDocImpressao(null)} pedido={docImpressao} />}
    </div>
  );
}