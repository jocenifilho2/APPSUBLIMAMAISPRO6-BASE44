import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Trash2, RefreshCw, Split, Search, Paperclip, Loader2, X } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { gerarNumeroPedido, calcularPrecoDesconto } from '@/lib/numeroPedido';
import { limparVariacaoNome } from '@/lib/cliente-helpers';

const emptyItem = { produto_nome: '', quantidade: 1, preco_unitario_cartao: 0, preco_unitario_pix: 0, manual: false };

const CANECA_PORCELANA_KEY = 'CANECA DE PORCELANA BRANCA 325 ML';

function isCanecaPorcelana(nome) {
  return (nome || '').toUpperCase().includes('CANECA') && 
    ((nome || '').toUpperCase().includes('PORCELANA') || (nome || '').toUpperCase().includes('PORECLANA')) &&
    !(nome || '').toUpperCase().includes('CAIXA') &&
    !(nome || '').toUpperCase().includes('BANDEJA');
}

export default function PedidoFormDialog({ open, onOpenChange, pedido, onSave, pedidosExistentes = [] }) {
  const [vendedorCustom, setVendedorCustom] = useState('');
  const [showSugestoes, setShowSugestoes] = useState(false);
  const [uploadingComprovante, setUploadingComprovante] = useState(false);

  const { data: clientesCRM = [] } = useQuery({
    queryKey: ['clientes-crm'],
    queryFn: () => base44.entities.Cliente.list(),
    enabled: open,
  });

  const [form, setForm] = useState({
    numero_pedido: '',
    cliente: '',
    telefone: '',
    data: new Date().toISOString().split('T')[0],
    horario: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    origem: 'LOJA',
    vendedor: 'Jeyse',
    forma_pagamento: 'PIX',
    forma_retirada: 'RETIRADA EM LOJA',
    status: 'NOVO',
    itens: [{ ...emptyItem }],
    observacoes: '',
    pagamento_misto_metodo_1: 'PIX',
    pagamento_misto_valor_1: 0,
    pagamento_misto_metodo_2: 'CARTAO',
    pagamento_misto_valor_2: 0,
    banco: '',
    comprovante_url: '',
  });



  useEffect(() => {
    if (pedido) {
      setForm({
        numero_pedido: pedido.numero_pedido || '',
        cliente: limparVariacaoNome(pedido.cliente) || pedido.cliente || '',
        telefone: pedido.telefone || '',
        data: pedido.data || new Date().toISOString().split('T')[0],
        horario: pedido.horario || '',
        forma_pagamento: pedido.forma_pagamento || 'PIX',
        forma_retirada: pedido.forma_retirada || 'RETIRADA EM LOJA',
        status: pedido.status || 'PENDENTE',
        itens: pedido.itens?.length ? pedido.itens : [{ ...emptyItem }],
        observacoes: pedido.observacoes || '',
        pagamento_misto_metodo_1: pedido.pagamento_misto_metodo_1 || 'PIX',
        pagamento_misto_valor_1: pedido.pagamento_misto_valor_1 || 0,
        pagamento_misto_metodo_2: pedido.pagamento_misto_metodo_2 || 'CARTAO',
        pagamento_misto_valor_2: pedido.pagamento_misto_valor_2 || 0,
        banco: pedido.banco || '',
        comprovante_url: pedido.comprovante_url || '',
      });
    } else {
      const novoNumero = gerarNumeroPedido(pedidosExistentes);
      setVendedorCustom('');
      setForm({
        numero_pedido: novoNumero,
        cliente: '',
        telefone: '',
        data: new Date().toISOString().split('T')[0],
        horario: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        origem: 'LOJA',
        vendedor: 'Jeyse',
        forma_pagamento: 'PIX',
        forma_retirada: 'RETIRADA EM LOJA',
        status: 'NOVO',
        itens: [{ ...emptyItem }],
        observacoes: '',
        pagamento_misto_metodo_1: 'PIX',
        pagamento_misto_valor_1: 0,
        pagamento_misto_metodo_2: 'CARTAO',
        pagamento_misto_valor_2: 0,
        banco: '',
        comprovante_url: '',
      });
    }
  }, [pedido, open]);

  const sugestoesClientes = (() => {
    const termo = (form.cliente || '').trim().toLowerCase();
    if (termo.length < 2) return [];
    return clientesCRM
      .filter(c => (c.nome || '').toLowerCase().includes(termo))
      .slice(0, 6);
  })();

  const selecionarCliente = (cliente) => {
    setForm(prev => ({ ...prev, cliente: cliente.nome, telefone: cliente.telefone || prev.telefone }));
    setShowSugestoes(false);
  };

  // Recalcular preços PIX ao mudar forma pagamento (passa cliente/telefone para regras WPrime)
  const handleFormaPagamentoChange = (novaForma) => {
    const novosItens = form.itens.map(item => {
      if (!item.preco_unitario_cartao) return { ...item, forma_pagamento: novaForma };
      const pixPrice = calcularPrecoDesconto(item.produto_nome, item.preco_unitario_cartao, item.quantidade, novaForma, form.cliente, form.telefone);
      return { ...item, preco_unitario_pix: parseFloat(pixPrice.toFixed(2)) };
    });
    setForm({ ...form, forma_pagamento: novaForma, itens: novosItens });
  };

  const handleItemChange = (index, field, value) => {
    const newItens = [...form.itens];
    newItens[index] = { ...newItens[index], [field]: value };
    
    // Recalcular PIX se mudou preço cartão ou quantidade
    if (field === 'preco_unitario_cartao' || field === 'quantidade') {
      const qtd = field === 'quantidade' ? (parseInt(value) || 1) : newItens[index].quantidade;
      const precoCartao = field === 'preco_unitario_cartao' ? (parseFloat(value) || 0) : newItens[index].preco_unitario_cartao;
      const pixPrice = calcularPrecoDesconto(newItens[index].produto_nome, precoCartao, qtd, form.forma_pagamento, form.cliente, form.telefone);
      newItens[index].preco_unitario_pix = parseFloat(pixPrice.toFixed(2));
    }
    setForm({ ...form, itens: newItens });
  };

  // Recalcular PIX ao mudar cliente/telefone (regras WPrime por cliente)
  useEffect(() => {
    setForm(prev => {
      if (prev.forma_pagamento === 'CARTAO' || prev.forma_pagamento === 'DUPLICATA') return prev;
      const novosItens = prev.itens.map(item => {
        if (!item.preco_unitario_cartao) return item;
        const pixPrice = calcularPrecoDesconto(item.produto_nome, item.preco_unitario_cartao, item.quantidade, prev.forma_pagamento, prev.cliente, prev.telefone);
        return { ...item, preco_unitario_pix: parseFloat(pixPrice.toFixed(2)) };
      });
      return { ...prev, itens: novosItens };
    });
  }, [form.cliente, form.telefone]);



  const addItem = () => {
    setForm({ ...form, itens: [...form.itens, { ...emptyItem }] });
  };

  const removeItem = (index) => {
    if (form.itens.length <= 1) return;
    setForm({ ...form, itens: form.itens.filter((_, i) => i !== index) });
  };

  const gerarNovoNumero = () => {
    const novoNumero = gerarNumeroPedido(pedidosExistentes);
    setForm({ ...form, numero_pedido: novoNumero });
  };

  const calcSubtotal = () =>
    form.itens.reduce((sum, item) => sum + (item.quantidade * item.preco_unitario_cartao), 0);

  const calcTotalPix = () =>
    form.itens.reduce((sum, item) => sum + (item.quantidade * item.preco_unitario_pix), 0);

  const calcTotalCartao = () => calcSubtotal();

  const calcTotal = () => {
    if (form.forma_pagamento === 'CARTAO') return calcTotalCartao();
    if (form.forma_pagamento === 'DUPLICATA') return calcSubtotal();
    if (form.forma_pagamento === 'MISTO') {
      return (form.pagamento_misto_valor_1 || 0) + (form.pagamento_misto_valor_2 || 0);
    }
    return calcTotalPix();
  };

  const calcDesconto = () => calcSubtotal() - calcTotalPix();

  const calcTotalMistoReferencia = () => calcTotalPix();

  const handleValor1Change = (valor) => {
    const totalRef = calcTotalMistoReferencia();
    const restante = Math.max(0, totalRef - valor);
    setForm({ ...form, pagamento_misto_valor_1: valor, pagamento_misto_valor_2: parseFloat(restante.toFixed(2)) });
  };

  const handleComprovanteChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingComprovante(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setForm((prev) => ({ ...prev, comprovante_url: file_url }));
    } catch (err) {
      console.error('Falha ao anexar comprovante', err);
    } finally {
      setUploadingComprovante(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const subtotal = calcSubtotal();
    const total = calcTotal();
    const desconto = calcDesconto();
    const total_cartao = calcTotalCartao();
    const total_pix = calcTotalPix();
    onSave({
      ...form,
      cliente: form.cliente.toUpperCase(),
      subtotal,
      total,
      desconto,
      total_cartao,
      total_pix,
    });
  };

  const isPIXorDinheiro = form.forma_pagamento === 'PIX' || form.forma_pagamento === 'DINHEIRO';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{pedido ? 'Editar Pedido' : 'Novo Pedido'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Nº Pedido (ID Único)</Label>
              <div className="flex gap-2">
                <Input
                  value={form.numero_pedido}
                  onChange={(e) => setForm({ ...form, numero_pedido: e.target.value })}
                  placeholder="0426.001"
                  className="font-mono font-bold"
                />
                {!pedido && (
                  <Button type="button" variant="outline" size="icon" onClick={gerarNovoNumero} title="Gerar novo número">
                    <RefreshCw className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Cliente *</Label>
              <div className="relative">
                <Input
                  value={form.cliente}
                  onChange={(e) => { setForm({ ...form, cliente: e.target.value }); setShowSugestoes(true); }}
                  onFocus={() => setShowSugestoes(true)}
                  onBlur={() => setTimeout(() => setShowSugestoes(false), 200)}
                  required
                  placeholder="Digite para buscar no CRM..."
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
            </div>
            <div className="space-y-1.5">
              <Label>Telefone</Label>
              <Input value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Data</Label>
              <Input type="date" value={form.data} onChange={(e) => setForm({ ...form, data: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Horário</Label>
              <Input value={form.horario} onChange={(e) => setForm({ ...form, horario: e.target.value })} placeholder="14:30" />
            </div>
            <div className="space-y-1.5">
              <Label>Forma de Pagamento</Label>
              <Select value={form.forma_pagamento} onValueChange={handleFormaPagamentoChange}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="PIX">PIX</SelectItem>
                  <SelectItem value="DINHEIRO">Dinheiro</SelectItem>
                  <SelectItem value="CARTAO">Cartão</SelectItem>
                  <SelectItem value="MISTO">Pagamento Parcial (Misto)</SelectItem>
                  <SelectItem value="DUPLICATA">Duplicata</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Origem do Pedido</Label>
              <Select value={form.origem} onValueChange={(v) => setForm({ ...form, origem: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="LOJA">🏪 Loja</SelectItem>
                  <SelectItem value="WHATSAPP">💬 WhatsApp</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Vendedor</Label>
              <Select value={['Jeyse','Jocení','Outro'].includes(form.vendedor) ? form.vendedor : 'Outro'} onValueChange={(v) => { if (v !== 'Outro') setForm({ ...form, vendedor: v }); else setForm({ ...form, vendedor: '' }); setVendedorCustom(v === 'Outro' ? '' : ''); }}>
                <SelectTrigger><SelectValue placeholder="Vendedor..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Jeyse">Jeyse</SelectItem>
                  <SelectItem value="Jocení">Jocení</SelectItem>
                  <SelectItem value="Outro">Outro...</SelectItem>
                </SelectContent>
              </Select>
              {(!['Jeyse','Jocení'].includes(form.vendedor)) && (
                <Input value={form.vendedor} onChange={e => setForm({ ...form, vendedor: e.target.value })} placeholder="Nome do vendedor..." className="mt-1" />
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Forma de Retirada</Label>
              <Select value={form.forma_retirada} onValueChange={(v) => setForm({ ...form, forma_retirada: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="RETIRADA EM LOJA">Retirada em Loja</SelectItem>
                  <SelectItem value="ENTREGA">Entrega</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="NOVO">Novo</SelectItem>
                  <SelectItem value="AGUARDANDO_PAGAMENTO">Aguardando Pagamento</SelectItem>
                  <SelectItem value="PAGO">Pago</SelectItem>
                  <SelectItem value="SEPARACAO">Separação</SelectItem>
                  <SelectItem value="PRODUCAO">Produção</SelectItem>
                  <SelectItem value="PRONTO">Pronto</SelectItem>
                  <SelectItem value="ENTREGUE">Entregue</SelectItem>
                  <SelectItem value="CANCELADO">Cancelado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {form.forma_pagamento === 'MISTO' && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 space-y-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-blue-800">
                <Split className="w-3.5 h-3.5" /> Pagamento Parcial — divida o total entre duas formas
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">1ª Forma</Label>
                  <Select value={form.pagamento_misto_metodo_1} onValueChange={(v) => setForm({ ...form, pagamento_misto_metodo_1: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PIX">PIX</SelectItem>
                      <SelectItem value="DINHEIRO">Dinheiro</SelectItem>
                      <SelectItem value="CARTAO">Cartão</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    type="number" step="0.01"
                    value={form.pagamento_misto_valor_1}
                    onChange={(e) => handleValor1Change(parseFloat(e.target.value) || 0)}
                    placeholder="R$ 0,00"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">2ª Forma</Label>
                  <Select value={form.pagamento_misto_metodo_2} onValueChange={(v) => setForm({ ...form, pagamento_misto_metodo_2: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PIX">PIX</SelectItem>
                      <SelectItem value="DINHEIRO">Dinheiro</SelectItem>
                      <SelectItem value="CARTAO">Cartão</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    type="number" step="0.01"
                    value={form.pagamento_misto_valor_2}
                    readOnly
                    className="bg-blue-100/60 font-semibold"
                    placeholder="R$ 0,00"
                  />
                </div>
              </div>
              <div className="flex justify-between text-xs text-blue-800 border-t border-blue-200 pt-2">
                <span>Total de referência (PIX): R$ {calcTotalMistoReferencia().toFixed(2)} — 2ª forma calculada automaticamente</span>
                <span className="font-bold">Soma: R$ {((form.pagamento_misto_valor_1 || 0) + (form.pagamento_misto_valor_2 || 0)).toFixed(2)}</span>
              </div>
            </div>
          )}
          <div className="bg-slate-50 border rounded-lg p-3 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Banco (opcional)</Label>
                <Select
                  value={["Inter", "Stone", "Itaú"].includes(form.banco) ? form.banco : (form.banco ? "Outro" : "")}
                  onValueChange={(v) => setForm({ ...form, banco: v === "Outro" ? "" : v })}
                >
                  <SelectTrigger><SelectValue placeholder="Selecionar banco..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Inter">Inter</SelectItem>
                    <SelectItem value="Stone">Stone</SelectItem>
                    <SelectItem value="Itaú">Itaú</SelectItem>
                    <SelectItem value="Outro">Outro (digitar)</SelectItem>
                  </SelectContent>
                </Select>
                {(!["Inter", "Stone", "Itaú"].includes(form.banco)) && (
                  <Input
                    value={form.banco}
                    onChange={(e) => setForm({ ...form, banco: e.target.value })}
                    placeholder="Nome do banco..."
                    className="mt-1"
                  />
                )}
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Comprovante de Pagamento (opcional)</Label>
                {form.comprovante_url ? (
                  <div className="flex items-center gap-2 text-xs bg-white border rounded-md px-2 py-1.5">
                    <a href={form.comprovante_url} target="_blank" rel="noopener noreferrer" className="text-primary underline truncate flex-1">
                      Ver comprovante anexado
                    </a>
                    <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => setForm({ ...form, comprovante_url: '' })}>
                      <X className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                ) : (
                  <label className="flex items-center gap-2 text-xs border rounded-md px-2 py-1.5 bg-white cursor-pointer hover:bg-muted/50">
                    {uploadingComprovante ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Paperclip className="w-3.5 h-3.5" />}
                    {uploadingComprovante ? 'Enviando...' : 'Anexar comprovante'}
                    <input type="file" accept="image/*,.pdf" className="hidden" onChange={handleComprovanteChange} disabled={uploadingComprovante} />
                  </label>
                )}
              </div>
            </div>
          </div>

          {isPIXorDinheiro && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-xs text-green-800">
              <strong>✓ Desconto automático aplicado:</strong> 5% para {form.forma_pagamento} (exceto Caneca de Porcelana: 8,33% unid / 6,67% bandeja 12 / 6,94% caixa 36+)
            </div>
          )}
          {isPIXorDinheiro && form.itens.some(it => (it.produto_nome || '').toUpperCase().replace(/\s+/g, '').includes('WPRIME')) && (() => {
            const wprimeItem = form.itens.find(it => (it.produto_nome || '').toUpperCase().replace(/\s+/g, '').includes('WPRIME'));
            const temClienteEspecial = wprimeItem && wprimeItem.preco_unitario_pix !== 236.55 && wprimeItem.preco_unitario_pix !== wprimeItem.preco_unitario_cartao * 0.95;
            return (
              <div className={`border rounded-lg p-3 text-xs ${temClienteEspecial ? 'bg-blue-50 border-blue-200 text-blue-800' : 'bg-amber-50 border-amber-200 text-amber-800'}`}>
                {temClienteEspecial
                  ? <><strong>🎯 Tinta WPrime — Preço especial aplicado:</strong> R$ {wprimeItem.preco_unitario_pix.toFixed(2)} no {form.forma_pagamento} para {form.cliente}</>
                  : <><strong>🎨 Tinta WPrime detectada:</strong> R$ 236,55 no PIX/Dinheiro (preço padrão). Cliente especial? Verifique nome e telefone.</>
                }
              </div>
            );
          })()}


          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-base font-semibold">Itens do Pedido</Label>
              <Button type="button" variant="outline" size="sm" onClick={addItem}>
                <Plus className="w-3.5 h-3.5 mr-1" /> Adicionar Item
              </Button>
            </div>
            {form.itens.map((item, index) => (
              <div key={index} className="grid grid-cols-12 gap-2 items-end p-3 rounded-lg border bg-muted/30">
                <div className="col-span-12 md:col-span-4 space-y-1">
                  <Label className="text-xs">Produto</Label>
                  <Input
                    placeholder="Digite o nome do produto..."
                    value={item.produto_nome}
                    onChange={(e) => handleItemChange(index, 'produto_nome', e.target.value)}
                  />
                </div>
                <div className="col-span-3 md:col-span-2 space-y-1">
                  <Label className="text-xs">Qtd</Label>
                  <Input
                    type="number" min="1"
                    value={item.quantidade}
                    onChange={(e) => handleItemChange(index, 'quantidade', parseInt(e.target.value) || 1)}
                  />
                </div>
                <div className="col-span-4 md:col-span-2 space-y-1">
                  <Label className="text-xs">Cartão R$</Label>
                  <Input
                    type="number" step="0.01"
                    value={item.preco_unitario_cartao}
                    onChange={(e) => handleItemChange(index, 'preco_unitario_cartao', parseFloat(e.target.value) || 0)}
                  />
                </div>
                <div className="col-span-4 md:col-span-2 space-y-1">
                  <Label className="text-xs text-green-700">PIX/Din R$</Label>
                  <Input
                    type="number" step="0.01"
                    value={item.preco_unitario_pix}
                    onChange={(e) => handleItemChange(index, 'preco_unitario_pix', parseFloat(e.target.value) || 0)}
                    className={isPIXorDinheiro ? 'border-green-400 bg-green-50' : ''}
                  />
                </div>
                <div className="col-span-1 md:col-span-2 flex items-center justify-between gap-1">
                  <div className="hidden md:block">
                    <p className="text-[10px] text-muted-foreground">Total</p>
                    <p className="text-sm font-bold">
                      R$ {(item.quantidade * (isPIXorDinheiro ? item.preco_unitario_pix : item.preco_unitario_cartao)).toFixed(2)}
                    </p>
                  </div>
                  <Button type="button" variant="ghost" size="icon" onClick={() => removeItem(index)} className="text-destructive h-8 w-8 flex-shrink-0">
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>

          <div className="space-y-1.5">
            <Label>Observações</Label>
            <Textarea value={form.observacoes} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} rows={2} />
          </div>

          <div className="bg-muted/50 rounded-lg p-4 space-y-1.5 text-sm">
            <div className="flex justify-between"><span>Subtotal (Cartão base):</span><span>R$ {calcSubtotal().toFixed(2)}</span></div>
            <div className="flex justify-between text-green-700"><span>Desconto (PIX/Din):</span><span>-R$ {calcDesconto().toFixed(2)}</span></div>
            <div className="flex justify-between text-muted-foreground"><span>Total no PIX:</span><span>R$ {calcTotalPix().toFixed(2)}</span></div>
            <div className="flex justify-between text-muted-foreground"><span>Total no Cartão:</span><span>R$ {calcTotalCartao().toFixed(2)}</span></div>
            {form.forma_pagamento === 'MISTO' && (
              <>
                <div className="flex justify-between text-blue-700"><span>1ª Parte ({form.pagamento_misto_metodo_1}):</span><span>R$ {(form.pagamento_misto_valor_1 || 0).toFixed(2)}</span></div>
                <div className="flex justify-between text-blue-700"><span>2ª Parte ({form.pagamento_misto_metodo_2}):</span><span>R$ {(form.pagamento_misto_valor_2 || 0).toFixed(2)}</span></div>
              </>
            )}
            <div className="flex justify-between font-bold text-base border-t pt-2 mt-1">
              <span>TOTAL FINAL ({form.forma_pagamento === 'MISTO' ? 'MISTO' : form.forma_pagamento}):</span>
              <span className="text-primary">R$ {calcTotal().toFixed(2)}</span>
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit">{pedido ? 'Salvar Alterações' : 'Criar Pedido'}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}