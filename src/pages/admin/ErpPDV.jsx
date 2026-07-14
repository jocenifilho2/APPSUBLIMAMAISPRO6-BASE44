import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Search, Plus, Minus, Trash2, ShoppingCart, CheckCircle, Tag } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { registrarLog } from '@/lib/audit-log';
import { gerarNumeroPedido, calcularPrecoDesconto } from '@/lib/numeroPedido';

const PAGAMENTOS = ['PIX', 'DINHEIRO', 'CARTAO_DEBITO', 'CARTAO_CREDITO', 'BOLETO', 'CREDIARIO'];

// Mapeia as formas de pagamento do PDV para os tokens usados pelas regras de
// desconto do módulo "Pedidos Loja / WhatsApp" (calcularPrecoDesconto), para que
// as duas telas apliquem exatamente a mesma lógica de preço — incluindo as regras
// especiais de Tinta WPrime (por cliente) e Caneca de Porcelana (por quantidade).
function formaParaCalculo(pagamento) {
  if (pagamento === 'CARTAO_DEBITO' || pagamento === 'CARTAO_CREDITO') return 'CARTAO';
  if (pagamento === 'BOLETO' || pagamento === 'CREDIARIO') return 'DUPLICATA';
  return pagamento; // PIX, DINHEIRO — recebem as regras de desconto
}

function isWPrime(nome) {
  return (nome || '').toUpperCase().replace(/\s+/g, '').includes('WPRIME');
}

export default function ErpPDV({ readOnly = false }) {
  const [busca, setBusca] = useState('');
  const [cart, setCart] = useState([]);
  const [pagamento, setPagamento] = useState('PIX');
  const [descManual, setDescManual] = useState(0);
  const [cliente, setCliente] = useState('');
  const [telefone, setTelefone] = useState('');
  const [showSugestoes, setShowSugestoes] = useState(false);
  const [sucesso, setSucesso] = useState(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: produtos = [] } = useQuery({
    queryKey: ['produtos'],
    queryFn: () => base44.entities.Produto.list(),
  });

  // Mesma fonte do CRM usada em "Pedidos Loja / WhatsApp — Novo Pedido".
  const { data: clientesCRM = [] } = useQuery({
    queryKey: ['clientes-crm'],
    queryFn: () => base44.entities.Cliente.list(),
  });

  // Lista completa de pedidos — necessária para gerar o número sequencial com a
  // MESMA lógica do módulo Pedidos (gerarNumeroPedido), evitando colisão de
  // números entre vendas feitas no PDV e pedidos criados em Pedidos Loja/WhatsApp.
  const { data: pedidosExistentes = [] } = useQuery({
    queryKey: ['pedidos_pdv_numeracao'],
    queryFn: () => base44.entities.Pedido.list('-created_date', 9999),
    refetchInterval: 10000,
  });

  const produtosFiltrados = useMemo(() => {
    if (!busca) return produtos.filter(p => p.ativo !== false);
    return produtos.filter(p => p.ativo !== false && p.nome?.toLowerCase().includes(busca.toLowerCase()));
  }, [produtos, busca]);

  // Sugestões de clientes do CRM — mesma regra do módulo Pedidos (mín. 2 caracteres).
  const sugestoesClientes = useMemo(() => {
    const termo = (cliente || '').trim().toLowerCase();
    if (termo.length < 2) return [];
    return clientesCRM.filter(c => (c.nome || '').toLowerCase().includes(termo)).slice(0, 6);
  }, [cliente, clientesCRM]);

  const selecionarCliente = (c) => {
    setCliente(c.nome);
    if (c.telefone) setTelefone(c.telefone);
    setShowSugestoes(false);
  };

  const addToCart = (produto) => {
    setCart(prev => {
      const ex = prev.find(i => i.id === produto.id);
      if (ex) return prev.map(i => i.id === produto.id ? { ...i, quantidade: i.quantidade + 1 } : i);
      return [...prev, {
        id: produto.id,
        nome: produto.nome,
        quantidade: 1,
        preco_unitario_cartao: produto.preco_cartao ?? produto.preco_pix ?? 0,
      }];
    });
  };

  const updateQty = (id, delta) => {
    setCart(prev => prev.map(i => i.id === id ? { ...i, quantidade: Math.max(1, i.quantidade + delta) } : i));
  };

  const removeItem = (id) => setCart(prev => prev.filter(i => i.id !== id));

  const formaCalculo = formaParaCalculo(pagamento);
  const isPixDinheiro = pagamento === 'PIX' || pagamento === 'DINHEIRO';

  // Preço PIX/Dinheiro de cada item calculado com as MESMAS regras do módulo
  // Pedidos (calcularPrecoDesconto): Tinta WPrime por cliente/telefone, Caneca de
  // Porcelana por quantidade, e 5% padrão para os demais produtos. Reage a
  // cliente, telefone e forma de pagamento — não é mais um flat 5% genérico.
  const cartComPrecos = useMemo(() => {
    return cart.map(item => ({
      ...item,
      preco_unitario_pix: parseFloat(
        calcularPrecoDesconto(item.nome, item.preco_unitario_cartao, item.quantidade, formaCalculo, cliente, telefone).toFixed(2)
      ),
    }));
  }, [cart, formaCalculo, cliente, telefone]);

  const temWPrime = cartComPrecos.some(i => isWPrime(i.nome));

  const subtotal = cartComPrecos.reduce((s, i) => s + i.quantidade * i.preco_unitario_cartao, 0);
  const totalBase = cartComPrecos.reduce((s, i) => s + i.quantidade * (isPixDinheiro ? i.preco_unitario_pix : i.preco_unitario_cartao), 0);
  const descAuto = Math.max(0, subtotal - totalBase);
  const descManualValor = totalBase * (descManual / 100);
  const total = Math.max(0, totalBase - descManualValor);

  // Mesmo gerador de numeração do módulo Pedidos Loja/WhatsApp (formato P+MM+SEQ),
  // considerando TODOS os pedidos existentes — não só os últimos 10.
  const nextNumero = useMemo(() => gerarNumeroPedido(pedidosExistentes), [pedidosExistentes]);

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Pedido.create(data),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['pedidos_pdv_numeracao'] });
      queryClient.invalidateQueries({ queryKey: ['pedidos'] });
      registrarLog({
        acao: 'CRIAR',
        entidade: 'Pedido',
        entidade_id: result?.id,
        detalhes: `Pedido ${result?.numero_pedido || ''} — ${result?.cliente || ''} (PDV)`,
      });
      setSucesso(result);
      setCart([]);
      setCliente('');
      setTelefone('');
      setDescManual(0);
      setPagamento('PIX');
    },
  });

  const finalizarVenda = () => {
    if (cart.length === 0) { toast({ title: 'Carrinho vazio', variant: 'destructive' }); return; }
    const itens = cartComPrecos.map(i => ({
      produto_nome: i.nome,
      quantidade: i.quantidade,
      preco_unitario_pix: i.preco_unitario_pix,
      preco_unitario_cartao: i.preco_unitario_cartao,
    }));
    createMutation.mutate({
      numero_pedido: nextNumero,
      cliente: (cliente || 'BALCÃO').toUpperCase(),
      telefone,
      data: new Date().toISOString().split('T')[0],
      // Venda feita fisicamente no balcão — mesma origem "LOJA" usada no módulo
      // Pedidos Loja/WhatsApp, para manter o gráfico "Origem das Vendas" correto.
      origem: 'LOJA',
      forma_pagamento: pagamento,
      status: 'ENTREGUE',
      itens,
      subtotal,
      total,
      desconto: Math.max(0, subtotal - total),
      total_cartao: subtotal,
      total_pix: totalBase,
    });
  };

  if (sucesso) {
    return (
      <div className="flex flex-col items-center justify-center py-16 space-y-4">
        <CheckCircle className="w-16 h-16 text-green-500" />
        <h2 className="text-xl font-bold text-green-700">Venda Finalizada!</h2>
        <p className="text-muted-foreground">Pedido Nº {sucesso.numero_pedido} — R$ {sucesso.total?.toFixed(2)}</p>
        <Button onClick={() => setSucesso(null)}>Nova Venda</Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold flex items-center gap-2"><ShoppingCart className="w-5 h-5 text-primary" />PDV — Ponto de Venda</h2>

      <div className="grid lg:grid-cols-3 gap-4">
        {/* Produtos */}
        <div className="lg:col-span-2 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Buscar produto..." value={busca} onChange={e => setBusca(e.target.value)} className="pl-9" />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-[400px] overflow-y-auto">
            {produtosFiltrados.map(p => (
              <button key={p.id} onClick={() => !readOnly && addToCart(p)} disabled={readOnly}
                className="text-left p-3 rounded-xl border bg-card hover:border-primary hover:shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                <p className="font-semibold text-sm truncate">{p.nome}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{p.categoria}</p>
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-sm font-bold text-green-700">R$ {(p.preco_pix || 0).toFixed(2)}</span>
                  <Badge variant="outline" className="text-[10px]">PIX</Badge>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Carrinho */}
        <div className="space-y-3">
          <Card className="p-4 space-y-3">
            <h3 className="font-semibold text-sm">Carrinho</h3>
            {cartComPrecos.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Nenhum item</p>}
            {cartComPrecos.map(item => (
              <div key={item.id} className="flex items-center gap-2 text-sm">
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate text-xs">{item.nome}</p>
                  <p className="text-xs text-muted-foreground">R$ {((isPixDinheiro ? item.preco_unitario_pix : item.preco_unitario_cartao) || 0).toFixed(2)}</p>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => updateQty(item.id, -1)} className="w-6 h-6 rounded border flex items-center justify-center hover:bg-muted"><Minus className="w-3 h-3" /></button>
                  <span className="w-6 text-center font-bold text-xs">{item.quantidade}</span>
                  <button onClick={() => updateQty(item.id, 1)} className="w-6 h-6 rounded border flex items-center justify-center hover:bg-muted"><Plus className="w-3 h-3" /></button>
                  <button onClick={() => removeItem(item.id)} className="w-6 h-6 rounded text-red-500 hover:bg-red-50 flex items-center justify-center"><Trash2 className="w-3 h-3" /></button>
                </div>
              </div>
            ))}

            <hr />

            <div className="relative">
              <Input
                placeholder="Cliente — digite para buscar no CRM..."
                value={cliente}
                onChange={e => { setCliente(e.target.value); setShowSugestoes(true); }}
                onFocus={() => setShowSugestoes(true)}
                onBlur={() => setTimeout(() => setShowSugestoes(false), 200)}
                className="h-8 text-sm"
              />
              {showSugestoes && sugestoesClientes.length > 0 && (
                <div className="absolute z-50 left-0 right-0 mt-1 bg-popover border rounded-md shadow-lg max-h-52 overflow-y-auto">
                  {sugestoesClientes.map(c => (
                    <button
                      key={c.id}
                      type="button"
                      onMouseDown={(e) => { e.preventDefault(); selecionarCliente(c); }}
                      className="w-full text-left px-3 py-2 hover:bg-accent text-sm border-b last:border-0"
                    >
                      <div className="font-medium">{c.nome}</div>
                      {c.telefone && <div className="text-xs text-muted-foreground">{c.telefone}</div>}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <Input placeholder="Telefone (opcional)" value={telefone} onChange={e => setTelefone(e.target.value)} className="h-8 text-sm" />

            <div>
              <p className="text-xs text-muted-foreground mb-1.5 font-medium">Pagamento</p>
              <div className="grid grid-cols-3 gap-1">
                {PAGAMENTOS.map(pg => (
                  <button key={pg} onClick={() => setPagamento(pg)}
                    className={`text-[10px] py-1.5 px-2 rounded border font-semibold transition-all ${pagamento === pg ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-muted'}`}>
                    {pg.replace('_', ' ')}
                  </button>
                ))}
              </div>
            </div>

            {temWPrime && isPixDinheiro && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-2 text-[11px] text-amber-800">
                🎨 <strong>Tinta WPrime detectada</strong> — preço PIX/Dinheiro calculado por cliente (mesma regra do módulo Pedidos). Confira nome e telefone.
              </div>
            )}

            <div className="space-y-1 text-sm">
              {isPixDinheiro && descAuto > 0 && (
                <div className="flex justify-between text-green-600 text-xs">
                  <span className="flex items-center gap-1"><Tag className="w-3 h-3" />Desconto automático (regras por produto)</span>
                  <span>-R$ {descAuto.toFixed(2)}</span>
                </div>
              )}
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground flex-1">Desconto manual (%)</span>
                <Input type="number" min="0" max="100" value={descManual} onChange={e => setDescManual(parseFloat(e.target.value) || 0)} className="h-7 w-16 text-xs text-right" />
              </div>
              <div className="flex justify-between font-bold text-base pt-1">
                <span>Total</span>
                <span className="text-primary">R$ {total.toFixed(2)}</span>
              </div>
            </div>

            <Button className="w-full" onClick={finalizarVenda} disabled={readOnly || createMutation.isPending || cart.length === 0}>
              {createMutation.isPending ? 'Processando...' : 'Finalizar Venda'}
            </Button>
          </Card>
        </div>
      </div>
    </div>
  );
}
