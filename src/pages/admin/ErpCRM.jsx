import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Users, Plus, Search, Star, AlertTriangle, Clock, TrendingUp, Pencil, Trash2, RefreshCw, Download, Upload } from 'lucide-react';
import { chaveNomeCliente, limparVariacaoNome, clienteCorresponde } from '@/lib/cliente-helpers';

const CLASSIFICACOES = ['VIP', 'RECORRENTE', 'NORMAL', 'RISCO', 'INATIVO'];

const classColor = {
  VIP: 'bg-yellow-100 text-yellow-800',
  RECORRENTE: 'bg-green-100 text-green-700',
  NORMAL: 'bg-blue-100 text-blue-700',
  RISCO: 'bg-orange-100 text-orange-700',
  INATIVO: 'bg-gray-100 text-gray-600',
};

export default function ErpCRM({ readOnly = false }) {
  const [busca, setBusca] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('todos');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ nome: '', email: '', telefone: '', cpf: '', classificacao: 'NORMAL', observacoes: '' });
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState(null);
  const [ultimoPedidoOpen, setUltimoPedidoOpen] = useState(false);
  const [ultimoPedidoData, setUltimoPedidoData] = useState(null);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [paginaAtual, setPaginaAtual] = useState(1);
  const [merging, setMerging] = useState(false);
  const [mergeResult, setMergeResult] = useState(null);
  const [mergePreviewOpen, setMergePreviewOpen] = useState(false);
  const ITENS_POR_PAGINA = 20;
  const queryClient = useQueryClient();

  const { data: clientes = [] } = useQuery({
    queryKey: ['clientes'],
    queryFn: () => base44.entities.Cliente.list('-created_date', 9999),
  });

  const { data: pedidos = [] } = useQuery({
    queryKey: ['pedidos'],
    queryFn: () => base44.entities.Pedido.list('-created_date', 9999),
    refetchInterval: 10000,
  });

  const { data: impressoes = [] } = useQuery({
    queryKey: ['pedidos_impressao'],
    queryFn: () => base44.entities.PedidoImpressao.list('-created_date', 9999),
    refetchInterval: 10000,
  });

  const todosPedidos = useMemo(() => [...pedidos, ...impressoes], [pedidos, impressoes]);

  const clientesEnriquecidos = useMemo(() => {
    return clientes.map(c => {
      const pedsCli = todosPedidos.filter(p => clienteCorresponde(p.cliente, p.telefone, c.nome, c.telefone));
      const totalGasto = pedsCli.reduce((s, p) => s + (p.total || 0), 0);
      const sorted = [...pedsCli].sort((a, b) => (b.data || '').localeCompare(a.data || ''));
      const ultimaCompra = sorted[0]?.data || null;
      const diasSemCompra = ultimaCompra ? Math.floor((Date.now() - new Date(ultimaCompra + 'T12:00:00')) / (1000 * 60 * 60 * 24)) : 999;

      let autoClass = c.classificacao || 'NORMAL';
      if (pedsCli.length >= 5) autoClass = 'VIP';
      else if (pedsCli.length >= 3) autoClass = 'RECORRENTE';
      else if (diasSemCompra > 60) autoClass = 'INATIVO';

      return { ...c, pedidos_count: pedsCli.length, total_gasto: totalGasto, ultima_compra: ultimaCompra, dias_sem_compra: diasSemCompra, auto_class: autoClass, ultimo_pedido: sorted[0] || null, pedidos_lista: sorted };
    });
  }, [clientes, todosPedidos]);

  const filtrados = useMemo(() => {
    let list = clientesEnriquecidos;
    if (filtroStatus === 'inativos') list = list.filter(c => c.auto_class === 'INATIVO');
    else if (filtroStatus === 'ativos') list = list.filter(c => c.auto_class !== 'INATIVO');
    else if (filtroStatus === 'vip') list = list.filter(c => c.auto_class === 'VIP');
    else if (filtroStatus === 'normal') list = list.filter(c => c.auto_class === 'NORMAL');
    else if (filtroStatus === 'recorrente') list = list.filter(c => c.auto_class === 'RECORRENTE');
    if (busca) list = list.filter(c => c.nome?.toLowerCase().includes(busca.toLowerCase()) || c.telefone?.includes(busca));
    if (dataInicio) list = list.filter(c => c.ultima_compra && c.ultima_compra >= dataInicio);
    if (dataFim) list = list.filter(c => c.ultima_compra && c.ultima_compra <= dataFim);
    return list;
  }, [clientesEnriquecidos, busca, filtroStatus, dataInicio, dataFim]);

  // Reseta para a primeira página sempre que os filtros/busca mudarem
  React.useEffect(() => {
    setPaginaAtual(1);
  }, [busca, filtroStatus, dataInicio, dataFim]);

  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / ITENS_POR_PAGINA));

  // Garante que a página atual nunca fique além do total (ex: após excluir clientes)
  React.useEffect(() => {
    if (paginaAtual > totalPaginas) setPaginaAtual(totalPaginas);
  }, [totalPaginas, paginaAtual]);

  const paginados = useMemo(() => {
    const inicio = (paginaAtual - 1) * ITENS_POR_PAGINA;
    return filtrados.slice(inicio, inicio + ITENS_POR_PAGINA);
  }, [filtrados, paginaAtual]);

  const exportarCSV = () => {
    const header = 'Nome,Telefone,Email,CPF,Classificação,Pedidos,Total Gasto,Última Compra';
    const rows = filtrados.map(c =>
      `"${c.nome || ''}","${c.telefone || ''}","${c.email || ''}","${c.cpf || ''}","${c.auto_class || ''}","${c.pedidos_count}","${c.total_gasto.toFixed(2)}","${c.ultima_compra || ''}"`
    );
    const csv = [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'clientes.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  const importarCSV = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const lines = ev.target.result.split('\n').slice(1).filter(Boolean);
      const novos = lines.map(line => {
        const cols = line.match(/(".*?"|[^,]+)/g)?.map(c => c.replace(/^"|"$/g, '').trim()) || [];
        return { nome: cols[0], telefone: cols[1] || '', email: cols[2] || '', cpf: cols[3] || '', classificacao: cols[4] || 'NORMAL' };
      }).filter(c => c.nome);
      if (novos.length > 0) {
        await base44.entities.Cliente.bulkCreate(novos);
        queryClient.invalidateQueries({ queryKey: ['clientes'] });
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const createMut = useMutation({
    mutationFn: (data) => base44.entities.Cliente.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['clientes'] }); setFormOpen(false); },
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Cliente.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['clientes'] }); setFormOpen(false); setEditing(null); },
  });

  const deleteMut = useMutation({
    mutationFn: async (ids) => { await Promise.all(ids.map(id => base44.entities.Cliente.delete(id))); },
    onSuccess: (_data, ids) => {
      queryClient.invalidateQueries({ queryKey: ['clientes'] });
      setSelectedIds(prev => { const next = new Set(prev); ids.forEach(id => next.delete(id)); return next; });
      setConfirmDelete(null);
    },
  });

  const openNew = () => { setEditing(null); setForm({ nome: '', email: '', telefone: '', cpf: '', classificacao: 'NORMAL', observacoes: '' }); setFormOpen(true); };
  const openEdit = (c) => { setEditing(c); setForm({ nome: c.nome, email: c.email || '', telefone: c.telefone || '', cpf: c.cpf || '', classificacao: c.classificacao || 'NORMAL', observacoes: c.observacoes || '' }); setFormOpen(true); };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (editing) updateMut.mutate({ id: editing.id, data: form });
    else createMut.mutate(form);
  };

  const toggleSelect = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  // Checkbox "selecionar todos" reflete apenas os clientes da página atual
  const allPageSelected = paginados.length > 0 && paginados.every(c => selectedIds.has(c.id));

  const toggleSelectAll = () => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (allPageSelected) { paginados.forEach(c => next.delete(c.id)); }
      else { paginados.forEach(c => next.add(c.id)); }
      return next;
    });
  };

  const pedirExclusao = (c) => setConfirmDelete({ ids: [c.id], nomes: [c.nome] });
  const pedirExclusaoSelecionados = () => setConfirmDelete({ ids: Array.from(selectedIds), nomes: clientesEnriquecidos.filter(c => selectedIds.has(c.id)).map(c => c.nome) });
  const confirmarExclusao = () => { if (confirmDelete) deleteMut.mutate(confirmDelete.ids); };

  const reativarMut = useMutation({
    mutationFn: ({ id }) => base44.entities.Cliente.update(id, { classificacao: 'NORMAL' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['clientes'] }),
  });

  const handleReativar = (c) => {
    reativarMut.mutate({ id: c.id });
    const tel = c.telefone?.replace(/\D/g, '');
    if (tel) {
      const ultimoPedido = c.ultimo_pedido;
      const isImpressao = !!(ultimoPedido && !ultimoPedido.numero_pedido && ultimoPedido.numero);
      const itensTexto = (ultimoPedido?.itens || [])
        .map(it => (isImpressao ? (it.descricao || it.tipo) : it.produto_nome))
        .filter(Boolean)
        .join(', ') || 'seus produtos';
      const dataUltimoPedido = c.ultima_compra
        ? c.ultima_compra.split('-').reverse().join('/')
        : '—';
      const msg = encodeURIComponent(`Olá, ${c.nome}.\n\nSentimos sua falta.... Vimos que seu último pedido de ${itensTexto} foi dia ${dataUltimoPedido}.\n\nEstamos á disposição para lhe ouvir ou renovar seu estoque.\nEstá precisando de algo hoje?`);
      window.open(`https://wa.me/55${tel}?text=${msg}`, '_blank');
    }
  };

  const sincronizarClientes = async () => {
    setSyncing(true);
    setSyncResult(null);
    try {
      // Busca todos os pedidos (loja + impressões) e clientes atuais
      const [todosPedidos, todosImpressoes, clientesAtuais] = await Promise.all([
        base44.entities.Pedido.list('-created_date', 9999),
        base44.entities.PedidoImpressao.list('-created_date', 9999),
        base44.entities.Cliente.list('-created_date', 9999),
      ]);

      // Monta set de chaves (nome + sobrenome) já cadastradas, ignorando
      // variações como "Atualizado", "Pedido 2", "Pedido 3"
      const nomesExistentes = new Set(clientesAtuais.map(c => chaveNomeCliente(c.nome)).filter(Boolean));
      const telefonesExistentes = new Set(clientesAtuais.map(c => c.telefone?.replace(/\D/g, '')).filter(Boolean));

      // Coleta clientes únicos dos pedidos ainda não cadastrados, agrupando
      // por nome+sobrenome normalizado para não duplicar o mesmo cliente
      const novosMap = {};
      [...todosPedidos, ...todosImpressoes].forEach(p => {
        const chave = chaveNomeCliente(p.cliente);
        if (!chave) return;
        const telPedido = p.telefone?.replace(/\D/g, '') || '';
        if (nomesExistentes.has(chave)) return;
        if (telPedido && telefonesExistentes.has(telPedido)) return;
        const nomeLimpo = limparVariacaoNome(p.cliente);
        if (novosMap[chave]) {
          // atualiza telefone se ainda não tiver
          if (!novosMap[chave].telefone && p.telefone) novosMap[chave].telefone = p.telefone;
        } else {
          novosMap[chave] = { nome: nomeLimpo, telefone: p.telefone || '', classificacao: 'NORMAL' };
        }
      });

      const novos = Object.values(novosMap).filter(n => n.nome);
      if (novos.length > 0) {
        await base44.entities.Cliente.bulkCreate(novos);
      }
      queryClient.invalidateQueries({ queryKey: ['clientes'] });
      setSyncResult({ criados: novos.length, total: novos.length });
    } finally {
      setSyncing(false);
    }
  };

  // Total de clientes únicos: agrupa por nome+sobrenome normalizado para não
  // contar variações como "ATUALIZADO", "PEDIDO 2", "PEDIDO 3" como clientes distintos
  const totalClientesUnicos = useMemo(() => {
    const chaves = new Set(clientes.map(c => chaveNomeCliente(c.nome)).filter(Boolean));
    const semNome = clientes.filter(c => !chaveNomeCliente(c.nome)).length;
    return chaves.size + semNome;
  }, [clientes]);

  // Agrupa clientes cadastrados por chave nome+sobrenome — grupos com mais de
  // 1 registro são variações do mesmo cliente (ATUALIZADO, PEDIDO 2, PEDIDO 3...).
  // Também inclui grupos de 1 registro cujo nome já nasceu com o sufixo colado
  // (ex: "FERNANDA - ATUALIZADO" sem nenhum outro registro "FERNANDA"), para
  // permitir limpar o nome mesmo quando não há duplicata para mesclar.
  const gruposDuplicados = useMemo(() => {
    const grupos = {};
    clientes.forEach(c => {
      const chave = chaveNomeCliente(c.nome);
      if (!chave) return;
      (grupos[chave] = grupos[chave] || []).push(c);
    });
    return Object.values(grupos).filter(g => {
      if (g.length > 1) return true;
      const nomeOriginal = String(g[0].nome || '').trim().toUpperCase();
      return limparVariacaoNome(g[0].nome) !== nomeOriginal;
    });
  }, [clientes]);

  // Escolhe o registro "principal" de um grupo de duplicados: prioriza o nome
  // sem sufixo de variação, depois o registro com mais dados preenchidos
  // (telefone/email/cpf), e por último o mais antigo (created_date)
  const escolherPrincipal = (grupo) => {
    return [...grupo].sort((a, b) => {
      const nomeAOriginal = String(a.nome || '').trim().toUpperCase();
      const nomeBOriginal = String(b.nome || '').trim().toUpperCase();
      const aTemSufixo = limparVariacaoNome(a.nome) !== nomeAOriginal ? 1 : 0;
      const bTemSufixo = limparVariacaoNome(b.nome) !== nomeBOriginal ? 1 : 0;
      if (aTemSufixo !== bTemSufixo) return aTemSufixo - bTemSufixo;
      const scoreA = (a.telefone ? 1 : 0) + (a.email ? 1 : 0) + (a.cpf ? 1 : 0);
      const scoreB = (b.telefone ? 1 : 0) + (b.email ? 1 : 0) + (b.cpf ? 1 : 0);
      if (scoreA !== scoreB) return scoreB - scoreA;
      return String(a.created_date || '').localeCompare(String(b.created_date || ''));
    })[0];
  };

  // Pré-visualização: para cada grupo, mostra o nome principal e quantas
  // variações serão removidas
  const previewMesclagem = useMemo(() => {
    return gruposDuplicados.map(grupo => {
      const principal = escolherPrincipal(grupo);
      return { principal, removidos: grupo.filter(c => c.id !== principal.id) };
    });
  }, [gruposDuplicados]);

  const executarMesclagemDuplicados = async () => {
    setMerging(true);
    try {
      let gruposMesclados = 0;
      let registrosRemovidos = 0;
      for (const grupo of gruposDuplicados) {
        const principal = escolherPrincipal(grupo);
        const outros = grupo.filter(c => c.id !== principal.id);

        // Mescla os dados: mantém o que já existe no principal e completa com
        // o que houver nas variações (telefone, email, cpf, observações).
        // Quando o grupo tem apenas 1 registro (nome com sufixo colado, sem
        // duplicata), isso só limpa o nome do próprio registro — nada é excluído.
        const dadosMesclados = {
          nome: limparVariacaoNome(principal.nome) || principal.nome,
          telefone: principal.telefone || outros.map(o => o.telefone).find(Boolean) || '',
          email: principal.email || outros.map(o => o.email).find(Boolean) || '',
          cpf: principal.cpf || outros.map(o => o.cpf).find(Boolean) || '',
          observacoes: [principal.observacoes, ...outros.map(o => o.observacoes)].filter(Boolean).join(' | '),
        };

        await base44.entities.Cliente.update(principal.id, dadosMesclados);
        if (outros.length > 0) {
          await Promise.all(outros.map(o => base44.entities.Cliente.delete(o.id)));
        }
        gruposMesclados += 1;
        registrosRemovidos += outros.length;
      }
      queryClient.invalidateQueries({ queryKey: ['clientes'] });
      setMergeResult({ grupos: gruposMesclados, removidos: registrosRemovidos });
      setMergePreviewOpen(false);
    } finally {
      setMerging(false);
    }
  };

  const vip = clientesEnriquecidos.filter(c => c.auto_class === 'VIP').length;
  const inativos = clientesEnriquecidos.filter(c => c.auto_class === 'INATIVO').length;
  const risco = clientesEnriquecidos.filter(c => c.auto_class === 'RISCO').length;
  const normal = clientesEnriquecidos.filter(c => c.auto_class === 'NORMAL').length;
  const recorrente = clientesEnriquecidos.filter(c => c.auto_class === 'RECORRENTE').length;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2"><Users className="w-5 h-5 text-primary" />CRM — Clientes</h2>
          <p className="text-sm text-muted-foreground">Gestão inteligente de relacionamento</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {!readOnly && <Button size="sm" variant="outline" onClick={sincronizarClientes} disabled={syncing}>
            <RefreshCw className={`w-4 h-4 mr-1 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Sincronizando...' : 'Sincronizar'}
          </Button>}
          {!readOnly && gruposDuplicados.length > 0 && (
            <Button size="sm" variant="outline" className="border-orange-400 text-orange-700 hover:bg-orange-50" onClick={() => setMergePreviewOpen(true)}>
              <Users className="w-4 h-4 mr-1" />Mesclar Duplicados ({gruposDuplicados.length})
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={exportarCSV}>
            <Download className="w-4 h-4 mr-1" />Exportar CSV
          </Button>
          {!readOnly && <label className="cursor-pointer">
            <Button size="sm" variant="outline" asChild>
              <span><Upload className="w-4 h-4 mr-1" />Importar CSV</span>
            </Button>
            <input type="file" accept=".csv" className="hidden" onChange={importarCSV} />
          </label>}
          {!readOnly && selectedIds.size > 0 && (
            <Button size="sm" variant="destructive" onClick={pedirExclusaoSelecionados}>
              <Trash2 className="w-4 h-4 mr-1" />Excluir selecionados ({selectedIds.size})
            </Button>
          )}
          {!readOnly && <Button size="sm" onClick={openNew}><Plus className="w-4 h-4 mr-1" />Novo Cliente</Button>}
        </div>
      </div>

      {syncResult !== null && (
        <div className={`text-sm rounded-lg px-4 py-2.5 font-medium ${syncResult.criados > 0 ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-blue-50 text-blue-700 border border-blue-200'}`}>
          {syncResult.criados > 0
            ? `✅ ${syncResult.criados} novo(s) cliente(s) importado(s) dos Pedidos com sucesso!`
            : '✅ CRM já está sincronizado — nenhum cliente novo encontrado.'}
          <button className="ml-3 text-xs underline opacity-70" onClick={() => setSyncResult(null)}>fechar</button>
        </div>
      )}

      {mergeResult !== null && (
        <div className="text-sm rounded-lg px-4 py-2.5 font-medium bg-green-50 text-green-700 border border-green-200">
          {mergeResult.grupos > 0
            ? `✅ ${mergeResult.grupos} grupo(s) de duplicados mesclado(s) — ${mergeResult.removidos} registro(s) de variação removido(s).`
            : '✅ Nenhum duplicado encontrado.'}
          <button className="ml-3 text-xs underline opacity-70" onClick={() => setMergeResult(null)}>fechar</button>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="p-4"><p className="text-xs text-muted-foreground">Total</p><p className="text-2xl font-bold">{totalClientesUnicos}</p></Card>
        <Card className="p-4"><div className="flex items-center gap-2"><Star className="w-4 h-4 text-yellow-500" /><div><p className="text-xs text-muted-foreground">VIP</p><p className="text-2xl font-bold text-yellow-600">{vip}</p></div></div></Card>
        <Card className="p-4"><div className="flex items-center gap-2"><Clock className="w-4 h-4 text-gray-400" /><div><p className="text-xs text-muted-foreground">Inativos</p><p className="text-2xl font-bold text-gray-500">{inativos}</p></div></div></Card>
        <Card className="p-4"><div className="flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-orange-500" /><div><p className="text-xs text-muted-foreground">Risco</p><p className="text-2xl font-bold text-orange-600">{risco}</p></div></div></Card>
      </div>

      <div className="flex flex-wrap gap-3 items-center">
        <div className="flex gap-1 border rounded-lg p-1 bg-muted/40">
          {[['todos','Todos'],['ativos','Ativos'],['inativos','Inativos'],['vip','VIP'],['normal','Normal'],['recorrente','Recorrente']].map(([v,l]) => (
            <button key={v} onClick={() => setFiltroStatus(v)}
              className={`px-3 py-1 rounded text-xs font-semibold transition-all ${ filtroStatus === v ? 'bg-primary text-primary-foreground shadow' : 'text-muted-foreground hover:text-foreground' }`}>
              {l}
              {v === 'inativos' && <span className="ml-1 bg-gray-500 text-white rounded-full px-1.5 text-[10px]">{inativos}</span>}
              {v === 'vip' && <span className="ml-1 bg-yellow-500 text-white rounded-full px-1.5 text-[10px]">{vip}</span>}
              {v === 'normal' && <span className="ml-1 bg-blue-500 text-white rounded-full px-1.5 text-[10px]">{normal}</span>}
              {v === 'recorrente' && <span className="ml-1 bg-green-600 text-white rounded-full px-1.5 text-[10px]">{recorrente}</span>}
            </button>
          ))}
        </div>
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Buscar por nome ou telefone..." value={busca} onChange={e => setBusca(e.target.value)} className="pl-9" />
        </div>
        <div className="flex items-center gap-2">
          <Input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)} className="w-36 text-xs" title="Última compra a partir de" />
          <span className="text-xs text-muted-foreground">até</span>
          <Input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)} className="w-36 text-xs" title="Última compra até" />
          {(dataInicio || dataFim) && <button onClick={() => { setDataInicio(''); setDataFim(''); }} className="text-xs text-muted-foreground hover:text-foreground underline">limpar</button>}
        </div>
      </div>

      <div className="rounded-xl border bg-card overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              {!readOnly && (
                <TableHead className="w-10">
                  <Checkbox checked={allPageSelected} onCheckedChange={toggleSelectAll} aria-label="Selecionar todos" />
                </TableHead>
              )}
              <TableHead>Nome</TableHead>
              <TableHead>Telefone</TableHead>
              <TableHead>Classificação</TableHead>
              <TableHead>Pedidos</TableHead>
              <TableHead>Total Gasto</TableHead>
              <TableHead>Última Compra</TableHead>
              <TableHead>Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginados.map(c => (
              <TableRow key={c.id} data-state={selectedIds.has(c.id) ? 'selected' : undefined}>
                {!readOnly && (
                  <TableCell className="w-10">
                    <Checkbox checked={selectedIds.has(c.id)} onCheckedChange={() => toggleSelect(c.id)} aria-label={`Selecionar ${c.nome}`} />
                  </TableCell>
                )}
                <TableCell className="font-medium text-sm">
                  <button className="hover:underline hover:text-primary transition-colors text-left" onClick={() => { setUltimoPedidoData(c); setUltimoPedidoOpen(true); }}>{c.nome}</button>
                </TableCell>
                <TableCell className="text-sm">{c.telefone || '—'}</TableCell>
                <TableCell>
                  <Badge className={`text-xs ${classColor[c.auto_class] || classColor.NORMAL}`}>{c.auto_class}</Badge>
                </TableCell>
                <TableCell className="font-bold">{c.pedidos_count}</TableCell>
                <TableCell className="text-sm text-green-700">R$ {c.total_gasto.toFixed(2)}</TableCell>
                <TableCell className="text-xs">{c.ultima_compra || '—'}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    {!readOnly && <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(c)}><Pencil className="w-3.5 h-3.5 text-amber-600" /></Button>}
                    {!readOnly && <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => pedirExclusao(c)}><Trash2 className="w-3.5 h-3.5 text-red-600" /></Button>}
                    {c.auto_class === 'INATIVO' && !readOnly && (
                      <Button size="sm" variant="outline" className="h-7 text-xs border-green-500 text-green-700 hover:bg-green-50" onClick={() => handleReativar(c)}>REATIVAR</Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {filtrados.length === 0 && <TableRow><TableCell colSpan={readOnly ? 7 : 8} className="text-center py-8 text-muted-foreground">Nenhum cliente cadastrado</TableCell></TableRow>}
          </TableBody>
        </Table>
      </div>

      {filtrados.length > 0 && (
        <div className="flex items-center justify-between flex-wrap gap-3">
          <p className="text-xs text-muted-foreground">
            Mostrando {Math.min((paginaAtual - 1) * ITENS_POR_PAGINA + 1, filtrados.length)}–{Math.min(paginaAtual * ITENS_POR_PAGINA, filtrados.length)} de {filtrados.length} cliente{filtrados.length !== 1 ? 's' : ''}
          </p>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setPaginaAtual(p => Math.max(1, p - 1))}
              disabled={paginaAtual <= 1}
            >
              Anterior
            </Button>
            <span className="text-xs text-muted-foreground px-1">
              Página {paginaAtual} de {totalPaginas}
            </span>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setPaginaAtual(p => Math.min(totalPaginas, p + 1))}
              disabled={paginaAtual >= totalPaginas}
            >
              Próxima
            </Button>
          </div>
        </div>
      )}

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editing ? 'Editar Cliente' : 'Novo Cliente'}</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="space-y-1.5"><Label>Nome *</Label><Input value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} required /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Telefone</Label><Input value={form.telefone} onChange={e => setForm({ ...form, telefone: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>CPF</Label><Input value={form.cpf} onChange={e => setForm({ ...form, cpf: e.target.value })} /></div>
            </div>
            <div className="space-y-1.5"><Label>Email</Label><Input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Classificação</Label>
              <Select value={form.classificacao} onValueChange={v => setForm({ ...form, classificacao: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{CLASSIFICACOES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label>Observações</Label><Input value={form.observacoes} onChange={e => setForm({ ...form, observacoes: e.target.value })} /></div>
            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>Cancelar</Button>
              <Button type="submit">{editing ? 'Salvar' : 'Criar'}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog com todos os pedidos do cliente clicado */}
      <Dialog open={ultimoPedidoOpen} onOpenChange={setUltimoPedidoOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-gray-500" />
              Pedidos — {ultimoPedidoData?.nome}
            </DialogTitle>
          </DialogHeader>
          {ultimoPedidoData?.pedidos_lista?.length > 0 ? (
            <div className="space-y-4">
              {ultimoPedidoData.pedidos_lista.map((p, idx) => {
                const isImpressao = !p.numero_pedido && !!p.numero;
                const itens = p.itens || [];
                return (
                  <div key={p.id || idx} className="rounded-xl border p-3 space-y-2">
                    <div className="grid grid-cols-2 gap-3 bg-muted/40 rounded-lg p-3 text-sm">
                      <div><span className="text-muted-foreground text-xs">Nº Pedido</span><p className="font-mono font-bold">{p.numero || p.numero_pedido || '—'}</p></div>
                      <div><span className="text-muted-foreground text-xs">Tipo</span><p className="font-semibold">{isImpressao ? '🖨️ Impressão' : '🛒 Produto'}</p></div>
                      <div><span className="text-muted-foreground text-xs">Data</span><p>{p.data || '—'}</p></div>
                      <div><span className="text-muted-foreground text-xs">Status</span><p className="font-semibold">{p.status || '—'}</p></div>
                      <div><span className="text-muted-foreground text-xs">Pagamento</span><p>{p.forma_pagamento || '—'}</p></div>
                      <div><span className="text-muted-foreground text-xs">Retirada</span><p>{p.forma_retirada || '—'}</p></div>
                    </div>
                    {itens.length > 0 && (
                      <div className="rounded-xl border overflow-hidden">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-muted/50">
                              <TableHead>Descrição</TableHead>
                              <TableHead className="text-right">Qtd</TableHead>
                              <TableHead className="text-right">Total</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {itens.map((it, i) => (
                              <TableRow key={i}>
                                <TableCell className="text-sm">{isImpressao ? (it.descricao || it.tipo || '—') : (it.produto_nome || '—')}</TableCell>
                                <TableCell className="text-right text-sm">{it.quantidade || 1}</TableCell>
                                <TableCell className="text-right font-bold text-green-700 text-sm">R$ {(it.total || 0).toFixed(2)}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                    <div className="text-right text-sm"><span className="text-muted-foreground">Total: </span><span className="text-lg font-black text-green-700">R$ {(p.total || 0).toFixed(2)}</span></div>
                  </div>
                );
              })}
              <div className="flex justify-end border-t pt-3">
                <Button variant="outline" size="sm" onClick={() => setUltimoPedidoOpen(false)}>Fechar</Button>
              </div>
            </div>
          ) : <div className="text-center py-6 text-muted-foreground text-sm">Nenhum pedido encontrado para este cliente.</div>}
        </DialogContent>
      </Dialog>

      <Dialog open={mergePreviewOpen} onOpenChange={(open) => { if (!merging) setMergePreviewOpen(open); }}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="w-4 h-4 text-orange-600" />
              Mesclar {gruposDuplicados.length} grupo(s) de duplicados
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Cada grupo abaixo representa variações do mesmo cliente (ex: "ATUALIZADO", "PEDIDO 2", "PEDIDO 3", incluindo formatos entre parênteses).
            Quando há mais de um registro, o principal é mantido (com nome limpo e dados completados a partir das variações) e os demais são excluídos permanentemente.
            Quando há apenas 1 registro com o sufixo colado no nome, ele é apenas renomeado — nada é excluído.
          </p>
          <div className="space-y-2 max-h-[45vh] overflow-y-auto">
            {previewMesclagem.map(({ principal, removidos }) => (
              <div key={principal.id} className="rounded-lg border p-3 text-sm">
                <p className="font-semibold">{limparVariacaoNome(principal.nome) || principal.nome}</p>
                <p className="text-xs text-muted-foreground mt-1">Mantém: <span className="font-medium">{limparVariacaoNome(principal.nome) || principal.nome}</span></p>
                {removidos.length > 0 && (
                  <p className="text-xs text-red-600 mt-1">Remove: {removidos.map(r => r.nome).join(', ')}</p>
                )}
              </div>
            ))}
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => setMergePreviewOpen(false)} disabled={merging}>Cancelar</Button>
            <Button type="button" className="bg-orange-600 hover:bg-orange-700" onClick={executarMesclagemDuplicados} disabled={merging}>
              {merging ? 'Mesclando...' : `Mesclar ${gruposDuplicados.length} grupo(s)`}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!confirmDelete} onOpenChange={(open) => { if (!open) setConfirmDelete(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir {confirmDelete?.ids?.length > 1 ? `${confirmDelete.ids.length} clientes` : 'cliente'}?</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmDelete?.nomes?.length > 1
                ? `Esta ação removerá permanentemente ${confirmDelete.nomes.length} clientes selecionados do CRM.`
                : `Esta ação removerá permanentemente "${confirmDelete?.nomes?.[0] || ''}" do CRM.`}
              {' '}Essa ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setConfirmDelete(null)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={confirmarExclusao} disabled={deleteMut.isPending}>
              {deleteMut.isPending ? 'Excluindo...' : 'Excluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}