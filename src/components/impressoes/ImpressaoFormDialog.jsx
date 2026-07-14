import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Trash2, Save, Search, Paperclip, Loader2, X } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { gerarNumeroImpressao } from '@/lib/numeroPedido';
import { limparVariacaoNome } from '@/lib/cliente-helpers';

const TIPOS = ['TAC', 'HAVIR', 'TRATADO', '0,50m', 'DTF A4', 'DTF A3', '1 METRO', 'ACIMA DE 1 METRO'];

// Tabela de preços
function calcularPrecoImpressao(tipo, metros) {
  const m = parseFloat(metros) || 0;
  if (tipo === 'TAC') {
    if (m <= 0.50) return 7.00;
    if (m < 5) return m * 8.90;
    if (m <= 10) return m * 7.90;
    if (m <= 60) return m * 7.40;
    return m * 6.90;
  }
  if (tipo === 'HAVIR') {
    if (m <= 0.50) return 8.00;
    if (m < 5) return m * 12.00;
    if (m <= 10) return m * 11.00;
    if (m <= 60) return m * 10.00;
    return m * 9.50;
  }
  if (tipo === 'TRATADO') {
    if (m < 5) return m * 6.90;
    if (m <= 10) return m * 6.00;
    if (m <= 60) return m * 5.90;
    return m * 5.60;
  }
  if (tipo === '0,50m') return 48.00;
  if (tipo === 'DTF A4') return 13.00;
  if (tipo === 'DTF A3') return 22.00;
  if (tipo === '1 METRO') return 60.00;
  if (tipo === 'ACIMA DE 1 METRO') return m * 60.00;
  return 0;
}

const emptyItem = { tipo: 'TAC', descricao: '', metros: 0, quantidade: 1, preco_unitario: 0, total: 0 };

export default function ImpressaoFormDialog({ open, onOpenChange, pedido, onSave, pedidosExistentes = [] }) {
  const [showSugestoes, setShowSugestoes] = useState(false);
  const [uploadingComprovante, setUploadingComprovante] = useState(false);

  const { data: clientesCRM = [] } = useQuery({
    queryKey: ['clientes-crm'],
    queryFn: () => base44.entities.Cliente.list(),
    enabled: open,
  });

  const [form, setForm] = useState({
    numero: '',
    cliente: '',
    telefone: '',
    origem: 'LOJA',
    data: new Date().toISOString().split('T')[0],
    forma_pagamento: 'PIX',
    forma_retirada: 'RETIRADA EM LOJA',
    status: 'PENDENTE',
    itens: [{ ...emptyItem }],
    observacoes: '',
    pagamento_misto_metodo_1: 'PIX',
    pagamento_misto_valor_1: 0,
    pagamento_misto_metodo_2: 'CARTAO',
    pagamento_misto_valor_2: 0,
    banco_nome: '',
    comprovante_url: '',
  });

  useEffect(() => {
    if (pedido) {
      setForm({
        numero: pedido.numero || '',
        cliente: limparVariacaoNome(pedido.cliente) || pedido.cliente || '',
        telefone: pedido.telefone || '',
        origem: pedido.origem || 'LOJA',
        data: pedido.data || new Date().toISOString().split('T')[0],
        forma_pagamento: pedido.forma_pagamento || 'PIX',
        forma_retirada: pedido.forma_retirada || 'RETIRADA EM LOJA',
        status: pedido.status || 'PENDENTE',
        itens: pedido.itens?.length ? pedido.itens : [{ ...emptyItem }],
        observacoes: pedido.observacoes || '',
        pagamento_misto_metodo_1: pedido.pagamento_misto_metodo_1 || 'PIX',
        pagamento_misto_valor_1: pedido.pagamento_misto_valor_1 || 0,
        pagamento_misto_metodo_2: pedido.pagamento_misto_metodo_2 || 'CARTAO',
        pagamento_misto_valor_2: pedido.pagamento_misto_valor_2 || 0,
        banco_nome: pedido.banco_nome || '',
        comprovante_url: pedido.comprovante_url || '',
      });
    } else {
      setForm({
        numero: gerarNumeroImpressao(pedidosExistentes),
        cliente: '',
        telefone: '',
        origem: 'LOJA',
        data: new Date().toISOString().split('T')[0],
        forma_pagamento: 'PIX',
        forma_retirada: 'RETIRADA EM LOJA',
        status: 'PENDENTE',
        itens: [{ ...emptyItem }],
        observacoes: '',
        pagamento_misto_metodo_1: 'PIX',
        pagamento_misto_valor_1: 0,
        pagamento_misto_metodo_2: 'CARTAO',
        pagamento_misto_valor_2: 0,
        banco_nome: '',
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

  const handleItemChange = (index, field, value) => {
    const newItens = [...form.itens];
    newItens[index] = { ...newItens[index], [field]: value };
    // Recalcular preço ao mudar tipo ou metros/qtd
    if (field === 'tipo' || field === 'metros' || field === 'quantidade') {
      const tipo = field === 'tipo' ? value : newItens[index].tipo;
      const metros = field === 'metros' ? parseFloat(value) || 0 : (parseFloat(newItens[index].metros) || 0);
      const qtd = field === 'quantidade' ? parseInt(value) || 1 : (parseInt(newItens[index].quantidade) || 1);
      const isMeter = ['TAC', 'HAVIR', 'TRATADO', 'ACIMA DE 1 METRO'].includes(tipo);
      const preco = calcularPrecoImpressao(tipo, metros);
      const totalItem = isMeter ? preco : preco * qtd;
      newItens[index].preco_unitario = preco;
      newItens[index].total = parseFloat(totalItem.toFixed(2));
    }
    if (field === 'preco_unitario') {
      const qtd = parseInt(newItens[index].quantidade) || 1;
      newItens[index].total = parseFloat((parseFloat(value) * qtd).toFixed(2));
    }
    setForm({ ...form, itens: newItens });
  };

  const handleMistoValor1Change = (valor) => {
    const totalAtual = form.itens.reduce((s, i) => s + (i.total || 0), 0);
    const restante = Math.max(0, totalAtual - (parseFloat(valor) || 0));
    setForm({ ...form, pagamento_misto_valor_1: valor, pagamento_misto_valor_2: parseFloat(restante.toFixed(2)) });
  };

  const addItem = () => setForm({ ...form, itens: [...form.itens, { ...emptyItem }] });
  const removeItem = (i) => { if (form.itens.length > 1) setForm({ ...form, itens: form.itens.filter((_, idx) => idx !== i) }); };

  const total = form.itens.reduce((s, i) => s + (i.total || 0), 0);

  const statsTAC = form.itens.filter(i => i.tipo === 'TAC').reduce((s, i) => s + (parseFloat(i.metros) || 0), 0);
  const statsHAVIR = form.itens.filter(i => i.tipo === 'HAVIR').reduce((s, i) => s + (parseFloat(i.metros) || 0), 0);
  const statsTRATADO = form.itens.filter(i => i.tipo === 'TRATADO').reduce((s, i) => s + (parseFloat(i.metros) || 0), 0);
  const statsDTFA4 = form.itens.filter(i => i.tipo === 'DTF A4').reduce((s, i) => s + (parseInt(i.quantidade) || 1), 0);
  const statsDTFA3 = form.itens.filter(i => i.tipo === 'DTF A3').reduce((s, i) => s + (parseInt(i.quantidade) || 1), 0);
  const statsDTFM = form.itens.filter(i => ['1 METRO', 'ACIMA DE 1 METRO', '0,50m'].includes(i.tipo)).reduce((s, i) => s + (parseFloat(i.metros) || 0), 0);

  const isMeterType = (tipo) => ['TAC', 'HAVIR', 'TRATADO', 'ACIMA DE 1 METRO'].includes(tipo);

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
    onSave({ ...form, cliente: form.cliente.toUpperCase(), total });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{pedido ? 'Editar' : 'Novo'} Pedido de Impressão</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="space-y-1.5"><Label>Nº Pedido</Label><Input value={form.numero} onChange={(e) => setForm({ ...form, numero: e.target.value })} className="font-mono font-bold" /></div>
            <div className="space-y-1.5 md:col-span-2 relative"><Label>Cliente *</Label><Input value={form.cliente} onChange={(e) => { setForm({ ...form, cliente: e.target.value }); setShowSugestoes(true); }} onFocus={() => setShowSugestoes(true)} onBlur={() => setTimeout(() => setShowSugestoes(false), 200)} required placeholder="Digite para buscar no CRM..." />{showSugestoes && sugestoesClientes.length > 0 && (<div className="absolute z-50 left-0 right-0 mt-1 bg-popover border rounded-md shadow-lg max-h-52 overflow-y-auto">{sugestoesClientes.map(c => (<button key={c.id} type="button" onMouseDown={(e) => { e.preventDefault(); selecionarCliente(c); }} className="w-full text-left px-3 py-2 hover:bg-accent text-sm border-b last:border-0"><div className="font-medium">{c.nome}</div>{c.telefone && <div className="text-xs text-muted-foreground">{c.telefone}</div>}</button>))}</div>)}</div>
            <div className="space-y-1.5"><Label>Telefone</Label><Input value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Origem do Pedido</Label>
              <Select value={form.origem} onValueChange={(v) => setForm({ ...form, origem: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="LOJA">🏪 Loja</SelectItem>
                  <SelectItem value="WHATSAPP">💬 WhatsApp</SelectItem>
                  <SelectItem value="LOJA_VIRTUAL">Loja Virtual</SelectItem>
                  <SelectItem value="BALCAO">Balcão</SelectItem>
                  <SelectItem value="INSTAGRAM">Instagram</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label>Data</Label><Input type="date" value={form.data} onChange={(e) => setForm({ ...form, data: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Pagamento</Label>
              <Select value={form.forma_pagamento} onValueChange={(v) => setForm({ ...form, forma_pagamento: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="PIX">PIX</SelectItem>
                  <SelectItem value="DINHEIRO">Dinheiro</SelectItem>
                  <SelectItem value="CARTAO">Cartão</SelectItem>
                  <SelectItem value="MISTO">Pagamento Parcial (Misto)</SelectItem>
                  <SelectItem value="DUPLICATA">Duplicata</SelectItem>
                  <SelectItem value="BANCO">Banco</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="PENDENTE">PENDENTE</SelectItem>
                  <SelectItem value="AGUARDANDO">AGUARDANDO</SelectItem>
                  <SelectItem value="PAGO">PAGO</SelectItem>
                  <SelectItem value="CONCLUIDO">CONCLUÍDO</SelectItem>
                  <SelectItem value="ENTREGUE">ENTREGUE</SelectItem>
                  <SelectItem value="DUPLICATA">DUPLICATA</SelectItem>
                  <SelectItem value="CANCELADO">CANCELADO</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label>Forma de Entrega</Label>
              <Select value={form.forma_retirada} onValueChange={(v) => setForm({ ...form, forma_retirada: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="RETIRADA EM LOJA">Retirada em Loja</SelectItem>
                  <SelectItem value="ENTREGA">Entrega</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {form.forma_pagamento === 'MISTO' && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 space-y-3">
              <div className="text-xs font-semibold text-blue-800">Pagamento Parcial — divida o total entre duas formas</div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">1ª Forma</Label>
                  <Select value={form.pagamento_misto_metodo_1} onValueChange={(v) => setForm({ ...form, pagamento_misto_metodo_1: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PIX">PIX</SelectItem>
                      <SelectItem value="DINHEIRO">Dinheiro</SelectItem>
                      <SelectItem value="CARTAO">Cartão</SelectItem>
                      <SelectItem value="BANCO">Banco</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input type="number" step="0.01" value={form.pagamento_misto_valor_1} onChange={(e) => handleMistoValor1Change(parseFloat(e.target.value) || 0)} placeholder="R$ 0,00" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">2ª Forma</Label>
                  <Select value={form.pagamento_misto_metodo_2} onValueChange={(v) => setForm({ ...form, pagamento_misto_metodo_2: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PIX">PIX</SelectItem>
                      <SelectItem value="DINHEIRO">Dinheiro</SelectItem>
                      <SelectItem value="CARTAO">Cartão</SelectItem>
                      <SelectItem value="BANCO">Banco</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input type="number" step="0.01" value={form.pagamento_misto_valor_2} readOnly className="bg-blue-100/60 font-semibold" placeholder="R$ 0,00" />
                </div>
              </div>
              <div className="flex justify-between text-xs text-blue-800 border-t border-blue-200 pt-2">
                <span>Total do pedido: R$ {total.toFixed(2)}</span>
                <span className="font-bold">Soma: R$ {((form.pagamento_misto_valor_1 || 0) + (form.pagamento_misto_valor_2 || 0)).toFixed(2)}</span>
              </div>
            </div>
          )}

          <div className="bg-slate-50 border rounded-lg p-3 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Banco (opcional)</Label>
                <Select
                  value={["Inter", "Stone", "Itaú"].includes(form.banco_nome) ? form.banco_nome : (form.banco_nome ? "Outro" : "")}
                  onValueChange={(v) => setForm({ ...form, banco_nome: v === "Outro" ? "" : v })}
                >
                  <SelectTrigger><SelectValue placeholder="Selecionar banco..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Inter">Inter</SelectItem>
                    <SelectItem value="Stone">Stone</SelectItem>
                    <SelectItem value="Itaú">Itaú</SelectItem>
                    <SelectItem value="Outro">Outro (digitar)</SelectItem>
                  </SelectContent>
                </Select>
                {(!["Inter", "Stone", "Itaú"].includes(form.banco_nome)) && (
                  <Input
                    value={form.banco_nome}
                    onChange={(e) => setForm({ ...form, banco_nome: e.target.value })}
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

          {/* Itens */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-base font-semibold">Itens</Label>
              <Button type="button" variant="outline" size="sm" onClick={addItem}><Plus className="w-3.5 h-3.5 mr-1" /> Add Item</Button>
            </div>
            <div className="grid grid-cols-12 gap-1 px-2 text-xs text-muted-foreground font-medium">
              <div className="col-span-2">Tipo</div>
              <div className="col-span-3">Descrição</div>
              <div className="col-span-2">Metros/Qtd</div>
              <div className="col-span-2">Preço/m</div>
              <div className="col-span-2">Total</div>
              <div className="col-span-1"></div>
            </div>
            {form.itens.map((item, index) => (
              <div key={index} className="grid grid-cols-12 gap-1 items-center p-2 rounded-lg border bg-muted/20">
                <div className="col-span-2">
                  <Select value={item.tipo} onValueChange={(v) => handleItemChange(index, 'tipo', v)}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {TIPOS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-3">
                  <Input className="h-8 text-xs" placeholder="Descrição" value={item.descricao} onChange={(e) => handleItemChange(index, 'descricao', e.target.value)} />
                </div>
                <div className="col-span-2">
                  {isMeterType(item.tipo) ? (
                    <Input className="h-8 text-xs" type="number" step="0.01" placeholder="Metros" value={item.metros} onChange={(e) => handleItemChange(index, 'metros', e.target.value)} />
                  ) : (
                    <Input className="h-8 text-xs" type="number" min="1" placeholder="Qtd" value={item.quantidade} onChange={(e) => handleItemChange(index, 'quantidade', e.target.value)} />
                  )}
                </div>
                <div className="col-span-2">
                  <Input className="h-8 text-xs bg-green-50 border-green-300" readOnly value={`R$ ${(item.preco_unitario || 0).toFixed(2)}`} />
                </div>
                <div className="col-span-2">
                  <Input className="h-8 text-xs bg-muted font-bold" readOnly value={`R$ ${(item.total || 0).toFixed(2)}`} />
                </div>
                <div className="col-span-1 flex justify-center">
                  <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeItem(index)}>
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

          {/* Resumo */}
          <div className="bg-muted/50 rounded-lg p-4 text-sm grid grid-cols-2 md:grid-cols-4 gap-2">
            <div><span className="text-muted-foreground">TAC: </span><strong>{statsTAC.toFixed(2)}m</strong></div>
            <div><span className="text-muted-foreground">HAVIR: </span><strong>{statsHAVIR.toFixed(2)}m</strong></div>
            <div><span className="text-muted-foreground">TRATADO: </span><strong>{statsTRATADO.toFixed(2)}m</strong></div>
            <div><span className="text-muted-foreground">Total Metros: </span><strong>{(statsTAC + statsHAVIR + statsTRATADO).toFixed(2)}m</strong></div>
            <div><span className="text-muted-foreground">DTF A4: </span><strong>{statsDTFA4}</strong></div>
            <div><span className="text-muted-foreground">DTF A3: </span><strong>{statsDTFA3}</strong></div>
            <div><span className="text-muted-foreground">DTF Metros: </span><strong>{statsDTFM.toFixed(2)}m</strong></div>
            <div className="col-span-2 md:col-span-4 border-t pt-2 mt-1 flex justify-between font-bold text-base">
              <span>TOTAL:</span><span className="text-primary">R$ {total.toFixed(2)}</span>
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit"><Save className="w-4 h-4 mr-1" /> Salvar Pedido</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}