import React, { useState, useMemo, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Package, Plus, AlertTriangle, ArrowLeftRight, Search,
  BarChart3, Layers, Activity, CheckCircle, XCircle,
  Pencil, Trash2, Factory, Gift, ClipboardList, Barcode, Camera
} from 'lucide-react';
import { format } from 'date-fns';
import { useAuth } from '@/lib/AuthContext';

const LOCALIZACOES = ['LOJA', 'ECOMMERCE', 'PRODUCAO', 'RESERVA', 'TERCEIROS'];
const TIPOS_MOV = ['ENTRADA', 'SAIDA', 'AJUSTE', 'TRANSFERENCIA', 'PERDA', 'PRODUCAO'];

function estoqueStatus(qtd, minimo = 5) {
  if (qtd <= 0) return { color: 'bg-red-100 text-red-700', icon: '🔴', label: 'CRÍTICO' };
  if (qtd <= minimo) return { color: 'bg-amber-100 text-amber-700', icon: '🟡', label: 'ATENÇÃO' };
  return { color: 'bg-green-100 text-green-700', icon: '🟢', label: 'NORMAL' };
}

function BarcodeInput({ label, onCode, placeholder = 'Digite ou escaneie o código...' }) {
  const [val, setVal] = useState('');
  const inputRef = useRef(null);
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && val.trim()) {
      onCode(val.trim());
      setVal('');
    }
  };
  return (
    <div className="space-y-1.5">
      <Label className="flex items-center gap-1"><Barcode className="w-3.5 h-3.5" />{label}</Label>
      <div className="flex gap-2">
        <Input ref={inputRef} value={val} onChange={e => setVal(e.target.value)} onKeyDown={handleKeyDown} placeholder={placeholder} className="font-mono" autoFocus />
        <Button type="button" size="sm" variant="outline" onClick={() => { if (val.trim()) { onCode(val.trim()); setVal(''); } }}>
          <Barcode className="w-4 h-4" />
        </Button>
      </div>
      <p className="text-[10px] text-muted-foreground">Pressione Enter ou clique no botão após escanear / digitar</p>
    </div>
  );
}

export default function EstoqueERP({ readOnly = false }) {
  const { user } = useAuth();
  const nomeUsuarioAtual = user?.nome_usuario || user?.full_name || 'Sistema';
  const [activeTab, setActiveTab] = useState('estoque');
  const [busca, setBusca] = useState('');
  const [movOpen, setMovOpen] = useState(false);
  const [produtoOpen, setProdutoOpen] = useState(false);
  const [fichaOpen, setFichaOpen] = useState(false);
  const [kitOpen, setKitOpen] = useState(false);
  const [editingProduto, setEditingProduto] = useState(null);
  const [inventarioMode, setInventarioMode] = useState(false);
  const [inventarioCounts, setInventarioCounts] = useState({});

  const [movForm, setMovForm] = useState({ produto_nome: '', tipo: 'ENTRADA', quantidade: 1, localizacao_origem: 'LOJA', localizacao_destino: 'LOJA', custo_unitario: 0, motivo: '' });
  const [prodForm, setProdForm] = useState({ nome: '', preco_cartao: 0, preco_pix: 0, categoria: 'outro', ativo: true, estoque_minimo: 5 });
  const [fichaForm, setFichaForm] = useState({ produto_final: '', insumos_texto: '', energia_estimada: 0, tempo_producao_min: 0, custo_estimado: 0 });
  const [kitForm, setKitForm] = useState({ nome: '', preco_kit: 0, itens_texto: '', descricao: '' });
  const [producaoForm, setProducaoForm] = useState({ ficha_id: '', produto_final: '', quantidade: 1 });

  const queryClient = useQueryClient();

  const { data: produtos = [] } = useQuery({ queryKey: ['produtos'], queryFn: () => base44.entities.Produto.list() });
  const { data: movimentacoes = [] } = useQuery({ queryKey: ['movimentacoes'], queryFn: () => base44.entities.MovimentacaoEstoque.list('-created_date', 300) });
  const { data: pedidos = [] } = useQuery({ queryKey: ['pedidos'], queryFn: () => base44.entities.Pedido.list('-created_date', 500), refetchInterval: 10000 });
  const { data: fichas = [] } = useQuery({ queryKey: ['fichas'], queryFn: () => base44.entities.FichaTecnica.list() });
  const { data: kits = [] } = useQuery({ queryKey: ['kits'], queryFn: () => base44.entities.KitProduto.list() });

  const createMovMutation = useMutation({ mutationFn: (data) => base44.entities.MovimentacaoEstoque.create(data), onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['movimentacoes'] }); setMovOpen(false); } });
  const createProdMutation = useMutation({ mutationFn: (data) => base44.entities.Produto.create(data), onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['produtos'] }); setProdutoOpen(false); setProdForm({ nome: '', preco_cartao: 0, preco_pix: 0, categoria: 'outro', ativo: true, estoque_minimo: 5 }); } });
  const updateProdMutation = useMutation({ mutationFn: ({ id, data }) => base44.entities.Produto.update(id, data), onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['produtos'] }); setProdutoOpen(false); setEditingProduto(null); } });
  const deleteProdMutation = useMutation({ mutationFn: (id) => base44.entities.Produto.delete(id), onSuccess: () => queryClient.invalidateQueries({ queryKey: ['produtos'] }) });
  const createFichaMutation = useMutation({ mutationFn: (data) => base44.entities.FichaTecnica.create(data), onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['fichas'] }); setFichaOpen(false); setFichaForm({ produto_final: '', insumos_texto: '', energia_estimada: 0, tempo_producao_min: 0, custo_estimado: 0 }); } });
  const createKitMutation = useMutation({ mutationFn: (data) => base44.entities.KitProduto.create(data), onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['kits'] }); setKitOpen(false); setKitForm({ nome: '', preco_kit: 0, itens_texto: '', descricao: '' }); } });

  const estoqueAtual = useMemo(() => {
    const map = {};
    movimentacoes.forEach(m => {
      if (!map[m.produto_nome]) map[m.produto_nome] = { total: 0, por_local: {} };
      const qtd = m.quantidade || 0;
      if (m.tipo === 'TRANSFERENCIA') {
        const orig = m.localizacao_origem || 'LOJA';
        const dest = m.localizacao_destino || 'LOJA';
        if (!map[m.produto_nome].por_local[orig]) map[m.produto_nome].por_local[orig] = 0;
        if (!map[m.produto_nome].por_local[dest]) map[m.produto_nome].por_local[dest] = 0;
        map[m.produto_nome].por_local[orig] -= qtd;
        map[m.produto_nome].por_local[dest] += qtd;
        return;
      }
      let delta = 0;
      if (m.tipo === 'ENTRADA' || m.tipo === 'PRODUCAO') delta = qtd;
      else if (m.tipo === 'SAIDA' || m.tipo === 'PERDA') delta = -qtd;
      else if (m.tipo === 'AJUSTE') delta = qtd;
      map[m.produto_nome].total += delta;
      const local = m.localizacao_origem || 'LOJA';
      if (!map[m.produto_nome].por_local[local]) map[m.produto_nome].por_local[local] = 0;
      map[m.produto_nome].por_local[local] += delta;
    });
    return map;
  }, [movimentacoes]);

  const custoMedio = useMemo(() => {
    const map = {};
    movimentacoes.filter(m => m.tipo === 'ENTRADA' && m.custo_unitario > 0).forEach(m => {
      if (!map[m.produto_nome]) map[m.produto_nome] = { total_valor: 0, total_qtd: 0 };
      map[m.produto_nome].total_valor += m.quantidade * m.custo_unitario;
      map[m.produto_nome].total_qtd += m.quantidade;
    });
    const result = {};
    Object.keys(map).forEach(k => { result[k] = map[k].total_qtd > 0 ? map[k].total_valor / map[k].total_qtd : 0; });
    return result;
  }, [movimentacoes]);

  const vendas30d = useMemo(() => {
    const map = {};
    const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 30);
    pedidos.filter(p => new Date(p.created_date) >= cutoff).forEach(p => {
      p.itens?.forEach(item => { if (!map[item.produto_nome]) map[item.produto_nome] = 0; map[item.produto_nome] += item.quantidade; });
    });
    return map;
  }, [pedidos]);

  const produtosFiltrados = useMemo(() => {
    if (!busca) return produtos;
    return produtos.filter(p => p.nome?.toLowerCase().includes(busca.toLowerCase()));
  }, [produtos, busca]);

  const alertas = useMemo(() => produtos.filter(p => (estoqueAtual[p.nome]?.total || 0) <= (p.estoque_minimo || 5)), [produtos, estoqueAtual]);

  const giroEstoque = (nome) => { const v = vendas30d[nome] || 0; const e = estoqueAtual[nome]?.total || 0; if (e === 0) return 0; return (v / e).toFixed(2); };
  const diasRuptura = (nome) => { const v = vendas30d[nome] || 0; const e = estoqueAtual[nome]?.total || 0; if (v === 0) return '∞'; return Math.floor(e / (v / 30)); };
  const curvaABC = (nome) => { const v = vendas30d[nome] || 0; const t = Object.values(vendas30d).reduce((s, x) => s + x, 0) || 1; const p = v / t; if (p >= 0.2) return { label: 'A', color: 'bg-green-100 text-green-700' }; if (p >= 0.05) return { label: 'B', color: 'bg-blue-100 text-blue-700' }; return { label: 'C', color: 'bg-gray-100 text-gray-600' }; };

  const handleMovSubmit = (e) => { e.preventDefault(); createMovMutation.mutate({ ...movForm, usuario: nomeUsuarioAtual }); };
  const handleProdSubmit = (e) => { e.preventDefault(); if (editingProduto) updateProdMutation.mutate({ id: editingProduto.id, data: prodForm }); else createProdMutation.mutate(prodForm); };
  const handleFichaSubmit = (e) => { e.preventDefault(); createFichaMutation.mutate(fichaForm); };
  const handleKitSubmit = (e) => { e.preventDefault(); createKitMutation.mutate(kitForm); };

  const openEditProduto = (p) => { setEditingProduto(p); setProdForm({ nome: p.nome, preco_cartao: p.preco_cartao, preco_pix: p.preco_pix, categoria: p.categoria || 'outro', ativo: p.ativo !== false, estoque_minimo: p.estoque_minimo || 5 }); setProdutoOpen(true); };

  const aplicarInventario = () => {
    Object.entries(inventarioCounts).forEach(([nome, contado]) => {
      const atual = estoqueAtual[nome]?.total || 0;
      const diff = parseInt(contado) - atual;
      if (diff !== 0) {
        createMovMutation.mutate({ produto_nome: nome, tipo: 'AJUSTE', quantidade: diff, localizacao_origem: 'LOJA', custo_unitario: 0, motivo: 'Ajuste de inventário físico', usuario: nomeUsuarioAtual });
      }
    });
    setInventarioMode(false);
    setInventarioCounts({});
  };

  const produzir = () => {
    if (!producaoForm.ficha_id || !producaoForm.quantidade) return;
    const ficha = fichas.find(f => f.id === producaoForm.ficha_id);
    if (!ficha) return;
    // Baixa insumos e adiciona produto final
    createMovMutation.mutate({ produto_nome: ficha.produto_final, tipo: 'PRODUCAO', quantidade: producaoForm.quantidade, localizacao_origem: 'PRODUCAO', custo_unitario: ficha.custo_estimado || 0, motivo: `Produção — Ficha: ${ficha.produto_final}`, usuario: nomeUsuarioAtual });
  };

  const tipoColor = { ENTRADA: 'bg-green-100 text-green-700', SAIDA: 'bg-red-100 text-red-700', AJUSTE: 'bg-blue-100 text-blue-700', TRANSFERENCIA: 'bg-purple-100 text-purple-700', PERDA: 'bg-orange-100 text-orange-700', PRODUCAO: 'bg-teal-100 text-teal-700' };

  return (
    <div className="space-y-5">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2"><Package className="w-5 h-5 text-primary" />ERP — Estoque Industrial</h2>
          <p className="text-sm text-muted-foreground">Controle total de estoque, produção e custos</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {!readOnly && <Button variant="outline" size="sm" onClick={() => setMovOpen(true)}><ArrowLeftRight className="w-4 h-4 mr-1" />Movimentação</Button>}
          {!readOnly && <Button size="sm" onClick={() => { setEditingProduto(null); setProdForm({ nome: '', preco_cartao: 0, preco_pix: 0, categoria: 'outro', ativo: true, estoque_minimo: 5 }); setProdutoOpen(true); }}><Plus className="w-4 h-4 mr-1" />Produto</Button>}
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="p-4"><p className="text-xs text-muted-foreground">Produtos</p><p className="text-2xl font-bold">{produtos.length}</p></Card>
        <Card className="p-4"><p className="text-xs text-muted-foreground">🔴 Alertas</p><p className="text-2xl font-bold text-red-600">{alertas.length}</p></Card>
        <Card className="p-4"><p className="text-xs text-muted-foreground">Movimentações</p><p className="text-2xl font-bold">{movimentacoes.length}</p></Card>
        <Card className="p-4"><p className="text-xs text-muted-foreground">Vendas 30d</p><p className="text-2xl font-bold">{Object.values(vendas30d).reduce((s, v) => s + v, 0)}</p></Card>
      </div>

      {alertas.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <p className="font-semibold text-red-700 mb-2 flex items-center gap-2"><AlertTriangle className="w-4 h-4" />Alertas ({alertas.length})</p>
          <div className="flex flex-wrap gap-2">
            {alertas.map(p => { const qtd = estoqueAtual[p.nome]?.total || 0; const s = estoqueStatus(qtd, p.estoque_minimo || 5); return <span key={p.id} className={`text-xs px-2 py-1 rounded-full font-semibold ${s.color}`}>{s.icon} {p.nome} ({qtd})</span>; })}
          </div>
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="estoque"><Layers className="w-4 h-4 mr-1" />Estoque</TabsTrigger>
          <TabsTrigger value="produtos"><Package className="w-4 h-4 mr-1" />Produtos</TabsTrigger>
          <TabsTrigger value="movimentacoes"><Activity className="w-4 h-4 mr-1" />Histórico</TabsTrigger>
          <TabsTrigger value="producao"><Factory className="w-4 h-4 mr-1" />Produção</TabsTrigger>
          <TabsTrigger value="kits"><Gift className="w-4 h-4 mr-1" />Kits</TabsTrigger>
          <TabsTrigger value="inventario"><ClipboardList className="w-4 h-4 mr-1" />Inventário</TabsTrigger>
          <TabsTrigger value="inteligencia"><BarChart3 className="w-4 h-4 mr-1" />Inteligência</TabsTrigger>
        </TabsList>

        {/* ESTOQUE */}
        <TabsContent value="estoque" className="mt-4">
          <div className="relative mb-4 max-w-sm"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" /><Input placeholder="Buscar..." value={busca} onChange={e => setBusca(e.target.value)} className="pl-9" /></div>
          <div className="rounded-xl border bg-card overflow-x-auto">
            <Table>
              <TableHeader><TableRow className="bg-muted/50"><TableHead>Produto</TableHead><TableHead>Categoria</TableHead><TableHead>Estoque</TableHead><TableHead>Status</TableHead><TableHead>Custo Médio</TableHead><TableHead>Preço Cartão</TableHead><TableHead>Preço PIX</TableHead><TableHead>Margem</TableHead><TableHead>Ação</TableHead></TableRow></TableHeader>
              <TableBody>
                {produtosFiltrados.map(p => { const qtd = estoqueAtual[p.nome]?.total || 0; const s = estoqueStatus(qtd, p.estoque_minimo || 5); const cm = custoMedio[p.nome] || 0; const margem = cm > 0 ? (((p.preco_pix - cm) / p.preco_pix) * 100).toFixed(1) : '—'; return (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium text-sm">{p.nome}</TableCell>
                    <TableCell><Badge variant="outline" className="text-xs">{p.categoria}</Badge></TableCell>
                    <TableCell className="font-bold">{qtd}</TableCell>
                    <TableCell><span className={`text-xs px-2 py-1 rounded-full font-semibold ${s.color}`}>{s.icon} {s.label}</span></TableCell>
                    <TableCell className="text-sm">{cm > 0 ? `R$ ${cm.toFixed(2)}` : '—'}</TableCell>
                    <TableCell className="text-sm">R$ {(p.preco_cartao || 0).toFixed(2)}</TableCell>
                    <TableCell className="text-sm text-green-700">R$ {(p.preco_pix || 0).toFixed(2)}</TableCell>
                    <TableCell className="text-sm">{margem !== '—' ? `${margem}%` : '—'}</TableCell>
                    <TableCell>{!readOnly && <Button variant="ghost" size="sm" onClick={() => { setMovForm({ ...movForm, produto_nome: p.nome }); setMovOpen(true); }} className="text-xs"><Plus className="w-3 h-3 mr-1" />Mov.</Button>}</TableCell>
                  </TableRow>
                ); })}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* PRODUTOS */}
        <TabsContent value="produtos" className="mt-4">
          <div className="rounded-xl border bg-card overflow-x-auto">
            <Table>
              <TableHeader><TableRow className="bg-muted/50"><TableHead>Nome</TableHead><TableHead>Categoria</TableHead><TableHead>Preço Cartão</TableHead><TableHead>Preço PIX</TableHead><TableHead>Est. Mín.</TableHead><TableHead>Ativo</TableHead><TableHead>Ações</TableHead></TableRow></TableHeader>
              <TableBody>
                {produtos.map(p => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium text-sm">{p.nome}</TableCell>
                    <TableCell><Badge variant="outline" className="text-xs">{p.categoria}</Badge></TableCell>
                    <TableCell>R$ {(p.preco_cartao || 0).toFixed(2)}</TableCell>
                    <TableCell className="text-green-700">R$ {(p.preco_pix || 0).toFixed(2)}</TableCell>
                    <TableCell className="text-sm">{p.estoque_minimo || 5}</TableCell>
                    <TableCell>{p.ativo !== false ? <CheckCircle className="w-4 h-4 text-green-600" /> : <XCircle className="w-4 h-4 text-red-500" />}</TableCell>
                    <TableCell>{!readOnly && <div className="flex gap-1"><Button variant="ghost" size="icon" className="h-7 w-7 text-amber-600" onClick={() => openEditProduto(p)}><Pencil className="w-3.5 h-3.5" /></Button><Button variant="ghost" size="icon" className="h-7 w-7 text-red-500" onClick={() => deleteProdMutation.mutate(p.id)}><Trash2 className="w-3.5 h-3.5" /></Button></div>}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* HISTÓRICO */}
        <TabsContent value="movimentacoes" className="mt-4">
          <div className="rounded-xl border bg-card overflow-x-auto">
            <Table>
              <TableHeader><TableRow className="bg-muted/50"><TableHead>Data/Hora</TableHead><TableHead>Produto</TableHead><TableHead>Tipo</TableHead><TableHead>Qtd</TableHead><TableHead>Local</TableHead><TableHead>Custo Unit.</TableHead><TableHead>Motivo</TableHead><TableHead>Usuário</TableHead></TableRow></TableHeader>
              <TableBody>
                {movimentacoes.slice(0, 150).map(m => (
                  <TableRow key={m.id}>
                    <TableCell className="text-xs">{m.created_date ? format(new Date(m.created_date), 'dd/MM HH:mm') : '—'}</TableCell>
                    <TableCell className="font-medium text-sm">{m.produto_nome}</TableCell>
                    <TableCell><span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${tipoColor[m.tipo] || 'bg-gray-100 text-gray-700'}`}>{m.tipo}</span></TableCell>
                    <TableCell className={`font-bold ${m.tipo === 'ENTRADA' || m.tipo === 'PRODUCAO' ? 'text-green-600' : 'text-red-600'}`}>{m.tipo === 'ENTRADA' || m.tipo === 'PRODUCAO' ? '+' : '-'}{m.quantidade}</TableCell>
                    <TableCell className="text-xs">{m.localizacao_origem}</TableCell>
                    <TableCell className="text-sm">{m.custo_unitario > 0 ? `R$ ${m.custo_unitario.toFixed(2)}` : '—'}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{m.motivo || '—'}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{m.usuario || '—'}</TableCell>
                  </TableRow>
                ))}
                {movimentacoes.length === 0 && <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Nenhuma movimentação</TableCell></TableRow>}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* PRODUÇÃO */}
        <TabsContent value="producao" className="mt-4">
          <div className="grid lg:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Fichas Técnicas (BOM)</h3>
                {!readOnly && <Button size="sm" onClick={() => setFichaOpen(true)}><Plus className="w-4 h-4 mr-1" />Nova Ficha</Button>}
              </div>
              <div className="space-y-2">
                {fichas.map(f => (
                  <Card key={f.id} className="p-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-semibold text-sm">{f.produto_final}</p>
                        <p className="text-xs text-muted-foreground mt-1">Insumos: {f.insumos_texto}</p>
                        <p className="text-xs text-muted-foreground">Tempo: {f.tempo_producao_min}min · Custo est.: R$ {(f.custo_estimado || 0).toFixed(2)}</p>
                      </div>
                    </div>
                  </Card>
                ))}
                {fichas.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">Nenhuma ficha técnica criada</p>}
              </div>
            </div>
            <div className="space-y-4">
              <h3 className="font-semibold">Registrar Produção</h3>
              <Card className="p-4 space-y-3">
                <div className="space-y-1.5"><Label>Ficha Técnica</Label>
                  <Select value={producaoForm.ficha_id} onValueChange={v => { const f = fichas.find(x => x.id === v); setProducaoForm({ ...producaoForm, ficha_id: v, produto_final: f?.produto_final || '' }); }}>
                    <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                    <SelectContent>{fichas.map(f => <SelectItem key={f.id} value={f.id}>{f.produto_final}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5"><Label>Quantidade</Label><Input type="number" min="1" value={producaoForm.quantidade} onChange={e => setProducaoForm({ ...producaoForm, quantidade: parseInt(e.target.value) || 1 })} /></div>
                <Button onClick={produzir} className="w-full" disabled={readOnly}><Factory className="w-4 h-4 mr-1" />Registrar Produção</Button>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* KITS */}
        <TabsContent value="kits" className="mt-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">Kits e Combos</h3>
            {!readOnly && <Button size="sm" onClick={() => setKitOpen(true)}><Plus className="w-4 h-4 mr-1" />Novo Kit</Button>}
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
            {kits.map(k => (
              <Card key={k.id} className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <p className="font-semibold text-sm">{k.nome}</p>
                  <Badge className="bg-yellow-100 text-yellow-700 text-xs">R$ {(k.preco_kit || 0).toFixed(2)}</Badge>
                </div>
                <p className="text-xs text-muted-foreground">{k.itens_texto}</p>
                {k.descricao && <p className="text-xs text-muted-foreground mt-1 italic">{k.descricao}</p>}
              </Card>
            ))}
            {kits.length === 0 && <p className="text-sm text-muted-foreground col-span-3 text-center py-8">Nenhum kit cadastrado</p>}
          </div>
        </TabsContent>

        {/* INVENTÁRIO */}
        <TabsContent value="inventario" className="mt-4">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold">Inventário Físico</h3>
                <p className="text-sm text-muted-foreground">Contagem real vs sistema</p>
              </div>
              {!inventarioMode ? (
                !readOnly && <Button size="sm" onClick={() => setInventarioMode(true)}>Iniciar Contagem</Button>
              ) : (
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => { setInventarioMode(false); setInventarioCounts({}); }}>Cancelar</Button>
                  <Button size="sm" onClick={aplicarInventario} className="bg-green-600 hover:bg-green-700">Aplicar Ajustes</Button>
                </div>
              )}
            </div>
            <div className="rounded-xl border bg-card overflow-x-auto">
              <Table>
                <TableHeader><TableRow className="bg-muted/50">
                  <TableHead>Produto</TableHead>
                  <TableHead>Estoque Sistema</TableHead>
                  {inventarioMode && <><TableHead>Contagem Física</TableHead><TableHead>Diferença</TableHead></>}
                  <TableHead>Status</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {produtos.map(p => {
                    const sistemaQtd = estoqueAtual[p.nome]?.total || 0;
                    const contado = inventarioCounts[p.nome] !== undefined ? parseInt(inventarioCounts[p.nome]) : sistemaQtd;
                    const diff = contado - sistemaQtd;
                    const s = estoqueStatus(sistemaQtd, p.estoque_minimo || 5);
                    return (
                      <TableRow key={p.id}>
                        <TableCell className="font-medium text-sm">{p.nome}</TableCell>
                        <TableCell className="font-bold">{sistemaQtd}</TableCell>
                        {inventarioMode && (
                          <>
                            <TableCell><Input type="number" className="h-7 w-20 text-sm" value={inventarioCounts[p.nome] ?? sistemaQtd} onChange={e => setInventarioCounts({ ...inventarioCounts, [p.nome]: e.target.value })} /></TableCell>
                            <TableCell className={`font-bold text-sm ${diff > 0 ? 'text-green-600' : diff < 0 ? 'text-red-600' : 'text-muted-foreground'}`}>{diff > 0 ? `+${diff}` : diff}</TableCell>
                          </>
                        )}
                        <TableCell><span className={`text-xs px-2 py-1 rounded-full font-semibold ${s.color}`}>{s.icon} {s.label}</span></TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </div>
        </TabsContent>

        {/* INTELIGÊNCIA */}
        <TabsContent value="inteligencia" className="mt-4">
          <div className="rounded-xl border bg-card overflow-x-auto">
            <Table>
              <TableHeader><TableRow className="bg-muted/50"><TableHead>Produto</TableHead><TableHead>Curva ABC</TableHead><TableHead>Vendas 30d</TableHead><TableHead>Estoque</TableHead><TableHead>Giro</TableHead><TableHead>Dias Ruptura</TableHead><TableHead>Sugestão</TableHead></TableRow></TableHeader>
              <TableBody>
                {produtos.map(p => {
                  const abc = curvaABC(p.nome); const qtd = estoqueAtual[p.nome]?.total || 0; const dias = diasRuptura(p.nome); const giro = giroEstoque(p.nome); const vendas = vendas30d[p.nome] || 0;
                  let sugestao = '—';
                  if (qtd <= 0) sugestao = '🚨 Comprar urgente';
                  else if (typeof dias === 'number' && dias <= 7) sugestao = '⚠️ Repor em breve';
                  else if (parseFloat(giro) < 0.1 && qtd > 10) sugestao = '💡 Considerar promoção';
                  else if (qtd > 0) sugestao = '✅ OK';
                  return (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium text-sm">{p.nome}</TableCell>
                      <TableCell><Badge className={abc.color}>{abc.label}</Badge></TableCell>
                      <TableCell>{vendas}</TableCell>
                      <TableCell className="font-bold">{qtd}</TableCell>
                      <TableCell>{giro}</TableCell>
                      <TableCell className={typeof dias === 'number' && dias <= 7 ? 'text-red-600 font-bold' : ''}>{dias === '∞' ? dias : `${dias}d`}</TableCell>
                      <TableCell className="text-xs">{sugestao}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>

      {/* Dialog Movimentação */}
      <Dialog open={movOpen} onOpenChange={setMovOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Registrar Movimentação</DialogTitle></DialogHeader>
          <form onSubmit={handleMovSubmit} className="space-y-4">
            <BarcodeInput label="Código de Barras do Produto" placeholder="Escaneie ou digite o código..." onCode={(code) => {
              const prod = produtos.find(p => p.codigo_barras === code || p.nome === code);
              if (prod) setMovForm(f => ({ ...f, produto_nome: prod.nome }));
              else setMovForm(f => ({ ...f, produto_nome: code }));
            }} />
            <div className="space-y-1.5"><Label>Produto *</Label>
              <Input value={movForm.produto_nome} onChange={e => setMovForm({ ...movForm, produto_nome: e.target.value })} placeholder="Nome do produto" required />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5"><Label>Tipo *</Label>
                <Select value={movForm.tipo} onValueChange={v => setMovForm({ ...movForm, tipo: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{TIPOS_MOV.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5"><Label>Quantidade *</Label><Input type="number" min="1" value={movForm.quantidade} onChange={e => setMovForm({ ...movForm, quantidade: parseInt(e.target.value) || 0 })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5"><Label>{movForm.tipo === 'TRANSFERENCIA' ? 'Origem' : 'Localização'}</Label>
                <Select value={movForm.localizacao_origem} onValueChange={v => setMovForm({ ...movForm, localizacao_origem: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{LOCALIZACOES.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              {movForm.tipo === 'TRANSFERENCIA' && (
                <div className="space-y-1.5"><Label>Destino</Label>
                  <Select value={movForm.localizacao_destino} onValueChange={v => setMovForm({ ...movForm, localizacao_destino: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{LOCALIZACOES.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              )}
            </div>
            {movForm.tipo === 'ENTRADA' && (
              <div className="space-y-1.5"><Label>Custo Unitário (R$)</Label><Input type="number" step="0.01" value={movForm.custo_unitario} onChange={e => setMovForm({ ...movForm, custo_unitario: parseFloat(e.target.value) || 0 })} /></div>
            )}
            <div className="space-y-1.5"><Label>Motivo</Label><Input value={movForm.motivo} onChange={e => setMovForm({ ...movForm, motivo: e.target.value })} /></div>
            <div className="flex justify-end gap-3"><Button type="button" variant="outline" onClick={() => setMovOpen(false)}>Cancelar</Button><Button type="submit">Registrar</Button></div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog Produto */}
      <Dialog open={produtoOpen} onOpenChange={setProdutoOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editingProduto ? 'Editar Produto' : 'Novo Produto'}</DialogTitle></DialogHeader>
          <form onSubmit={handleProdSubmit} className="space-y-4">
            {!editingProduto && (
              <BarcodeInput label="Código de Barras (opcional)" placeholder="Escaneie o código de barras..." onCode={(code) => setProdForm(f => ({ ...f, codigo_barras: code }))} />
            )}
            <div className="space-y-1.5"><Label>Nome *</Label><Input value={prodForm.nome} onChange={e => setProdForm({ ...prodForm, nome: e.target.value })} required /></div>
            {prodForm.codigo_barras && <p className="text-xs text-green-700 bg-green-50 px-2 py-1 rounded">📦 Código: {prodForm.codigo_barras}</p>}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5"><Label>Preço Cartão</Label><Input type="number" step="0.01" value={prodForm.preco_cartao} onChange={e => setProdForm({ ...prodForm, preco_cartao: parseFloat(e.target.value) || 0 })} /></div>
              <div className="space-y-1.5"><Label>Preço PIX</Label><Input type="number" step="0.01" value={prodForm.preco_pix} onChange={e => setProdForm({ ...prodForm, preco_pix: parseFloat(e.target.value) || 0 })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5"><Label>Categoria</Label>
                <Select value={prodForm.categoria} onValueChange={v => setProdForm({ ...prodForm, categoria: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{['caneca', 'camiseta', 'chinelo', 'azulejo', 'squeeze', 'porta_copos', 'sublimacao', 'dtf', 'serigrafia', 'insumo', 'outro'].map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5"><Label>Estoque Mínimo</Label><Input type="number" min="0" value={prodForm.estoque_minimo} onChange={e => setProdForm({ ...prodForm, estoque_minimo: parseInt(e.target.value) || 0 })} /></div>
            </div>
            <div className="flex justify-end gap-3"><Button type="button" variant="outline" onClick={() => setProdutoOpen(false)}>Cancelar</Button><Button type="submit">{editingProduto ? 'Salvar' : 'Criar'}</Button></div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog Ficha Técnica */}
      <Dialog open={fichaOpen} onOpenChange={setFichaOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Nova Ficha Técnica (BOM)</DialogTitle></DialogHeader>
          <form onSubmit={handleFichaSubmit} className="space-y-4">
            <div className="space-y-1.5"><Label>Produto Final *</Label>
              <Input value={fichaForm.produto_final} onChange={e => setFichaForm({ ...fichaForm, produto_final: e.target.value })} placeholder="Nome do produto final" required />
            </div>
            <div className="space-y-1.5"><Label>Insumos (ex: Caneca branca x1, Papel sublimático x1)</Label><Input value={fichaForm.insumos_texto} onChange={e => setFichaForm({ ...fichaForm, insumos_texto: e.target.value })} placeholder="Insumo 1, Insumo 2..." /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5"><Label>Energia Estimada (R$)</Label><Input type="number" step="0.01" value={fichaForm.energia_estimada} onChange={e => setFichaForm({ ...fichaForm, energia_estimada: parseFloat(e.target.value) || 0 })} /></div>
              <div className="space-y-1.5"><Label>Tempo Produção (min)</Label><Input type="number" value={fichaForm.tempo_producao_min} onChange={e => setFichaForm({ ...fichaForm, tempo_producao_min: parseInt(e.target.value) || 0 })} /></div>
            </div>
            <div className="space-y-1.5"><Label>Custo Estimado Total (R$)</Label><Input type="number" step="0.01" value={fichaForm.custo_estimado} onChange={e => setFichaForm({ ...fichaForm, custo_estimado: parseFloat(e.target.value) || 0 })} /></div>
            <div className="flex justify-end gap-3"><Button type="button" variant="outline" onClick={() => setFichaOpen(false)}>Cancelar</Button><Button type="submit">Criar Ficha</Button></div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog Kit */}
      <Dialog open={kitOpen} onOpenChange={setKitOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Novo Kit / Combo</DialogTitle></DialogHeader>
          <form onSubmit={handleKitSubmit} className="space-y-4">
            <div className="space-y-1.5"><Label>Nome do Kit *</Label><Input value={kitForm.nome} onChange={e => setKitForm({ ...kitForm, nome: e.target.value })} required /></div>
            <div className="space-y-1.5"><Label>Itens do Kit (ex: Caneca x1, Caixa x1)</Label><Input value={kitForm.itens_texto} onChange={e => setKitForm({ ...kitForm, itens_texto: e.target.value })} placeholder="Item 1, Item 2..." /></div>
            <div className="space-y-1.5"><Label>Preço do Kit (R$)</Label><Input type="number" step="0.01" value={kitForm.preco_kit} onChange={e => setKitForm({ ...kitForm, preco_kit: parseFloat(e.target.value) || 0 })} /></div>
            <div className="space-y-1.5"><Label>Descrição</Label><Input value={kitForm.descricao} onChange={e => setKitForm({ ...kitForm, descricao: e.target.value })} /></div>
            <div className="flex justify-end gap-3"><Button type="button" variant="outline" onClick={() => setKitOpen(false)}>Cancelar</Button><Button type="submit">Criar Kit</Button></div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}