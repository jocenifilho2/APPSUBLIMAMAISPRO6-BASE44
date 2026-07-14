import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { FileText, Settings, AlertTriangle, Info, CheckCircle, Plus, Send, Printer, Ban } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { proximoNumeroNFe, gerarChaveControle, itensDoPedido } from '@/lib/nfe-helpers';
import NotaFiscalDoc from '@/components/financeiro/NotaFiscalDoc';

const UFS = ['AC','AL','AM','AP','BA','CE','DF','ES','GO','MA','MG','MS','MT','PA','PB','PE','PI','PR','RJ','RN','RO','RR','RS','SC','SE','SP','TO'];

export default function ErpNFe({ readOnly = false }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [config, setConfig] = useState({ cnpj: '', razao_social: '', uf: 'PB', ambiente: 'HOMOLOGACAO', serie: '1', numero_inicial: '1' });
  const [docNota, setDocNota] = useState(null);
  const [cancelamentoAlvo, setCancelamentoAlvo] = useState(null);
  const [motivoCancelamento, setMotivoCancelamento] = useState('');

  const { data: notas = [] } = useQuery({
    queryKey: ['nfe_notas'],
    queryFn: () => base44.entities.NotaFiscal.list('-created_date', 200),
  });

  const { data: pedidos = [] } = useQuery({
    queryKey: ['pedidos'],
    queryFn: () => base44.entities.Pedido.list('-created_date', 100),
  });

  const jaTemNota = (pedidoId) => notas.some(n => n.pedido_id === pedidoId && n.status_nfe !== 'CANCELADA');

  const createMut = useMutation({
    mutationFn: (data) => base44.entities.NotaFiscal.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['nfe_notas'] }); toast({ title: 'NF-e criada!', description: 'Nota gerada em modo rascunho com os itens do pedido.' }); },
  });

  const gerarNFe = (pedido) => {
    createMut.mutate({
      pedido_id: pedido.id,
      numero_pedido: pedido.numero_pedido,
      cliente: pedido.cliente,
      valor_total: pedido.total,
      status_nfe: 'RASCUNHO',
      ambiente: config.ambiente,
      serie: config.serie || '1',
      natureza_operacao: 'Venda de mercadoria',
      itens: itensDoPedido(pedido),
      observacoes: `Gerado automaticamente do pedido ${pedido.numero_pedido}`,
    });
  };

  const emitirMut = useMutation({
    mutationFn: async (nota) => {
      const numero_nfe = proximoNumeroNFe(notas, nota.serie || config.serie || '1');
      const chave_acesso = gerarChaveControle({
        cnpj: config.cnpj, uf: config.uf, numero_nfe, serie: nota.serie || config.serie || '1', ambiente: nota.ambiente,
      });
      await base44.entities.NotaFiscal.update(nota.id, {
        status_nfe: 'EMITIDA',
        numero_nfe,
        chave_acesso,
        data_emissao: new Date().toISOString().slice(0, 10),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['nfe_notas'] });
      toast({ title: 'NF-e emitida (controle interno)!', description: 'Numeração e chave de controle atribuídas localmente.' });
    },
  });

  const cancelarMut = useMutation({
    mutationFn: ({ nota, motivo }) => base44.entities.NotaFiscal.update(nota.id, {
      status_nfe: 'CANCELADA',
      data_cancelamento: new Date().toISOString().slice(0, 10),
      motivo_cancelamento: motivo,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['nfe_notas'] });
      setCancelamentoAlvo(null);
      setMotivoCancelamento('');
      toast({ title: 'NF-e cancelada.' });
    },
  });

  const statusColor = {
    RASCUNHO: 'bg-gray-100 text-gray-600',
    EMITIDA: 'bg-green-100 text-green-700',
    CANCELADA: 'bg-red-100 text-red-700',
    REJEITADA: 'bg-orange-100 text-orange-700',
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center">
          <FileText className="w-5 h-5 text-white" />
        </div>
        <div>
          <h2 className="text-lg font-bold">NF-e — Nota Fiscal Eletrônica</h2>
          <p className="text-sm text-muted-foreground">Emissão e controle de notas fiscais</p>
        </div>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3">
        <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-amber-800">Integração SEFAZ — Requer Backend</p>
          <p className="text-xs text-amber-700 mt-1">A emissão real de NF-e diretamente na SEFAZ requer funções de backend (Node.js + certificado A1 .pfx). Esta interface organiza rascunhos, numeração de controle interno e cancelamento. Para ativar transmissão real à SEFAZ, entre em contato com o suporte técnico do sistema.</p>
        </div>
      </div>

      <Tabs defaultValue="notas">
        <TabsList>
          <TabsTrigger value="notas"><FileText className="w-4 h-4 mr-1" />Notas ({notas.length})</TabsTrigger>
          <TabsTrigger value="emitir"><Plus className="w-4 h-4 mr-1" />Gerar Rascunho</TabsTrigger>
          <TabsTrigger value="config"><Settings className="w-4 h-4 mr-1" />Configurações</TabsTrigger>
        </TabsList>

        <TabsContent value="notas" className="mt-4">
          <div className="rounded-xl border bg-card overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Nº NF-e</TableHead>
                  <TableHead>Nº Pedido</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Ambiente</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {notas.map(n => (
                  <TableRow key={n.id}>
                    <TableCell className="text-xs font-mono">{n.numero_nfe || '—'}</TableCell>
                    <TableCell className="font-medium">{n.numero_pedido}</TableCell>
                    <TableCell>{n.cliente}</TableCell>
                    <TableCell className="text-green-700 font-bold">R$ {(n.valor_total || 0).toFixed(2)}</TableCell>
                    <TableCell><Badge className={n.ambiente === 'PRODUCAO' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'} variant="outline">{n.ambiente}</Badge></TableCell>
                    <TableCell><Badge className={`text-xs ${statusColor[n.status_nfe] || ''}`}>{n.status_nfe}</Badge></TableCell>
                    <TableCell className="text-right space-x-1 whitespace-nowrap">
                      {n.status_nfe === 'RASCUNHO' && !readOnly && (
                        <Button size="sm" variant="outline" onClick={() => emitirMut.mutate(n)} disabled={emitirMut.isPending}>
                          <Send className="w-3.5 h-3.5 mr-1" />Emitir
                        </Button>
                      )}
                      <Button size="sm" variant="outline" onClick={() => setDocNota(n)}><Printer className="w-3.5 h-3.5" /></Button>
                      {n.status_nfe === 'EMITIDA' && !readOnly && (
                        <Button size="sm" variant="ghost" onClick={() => setCancelamentoAlvo(n)}><Ban className="w-3.5 h-3.5" /></Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {notas.length === 0 && <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Nenhuma nota fiscal</TableCell></TableRow>}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="emitir" className="mt-4">
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Selecione um pedido para gerar uma NF-e em rascunho (itens copiados automaticamente):</p>
            <div className="grid gap-2 max-h-96 overflow-y-auto">
              {pedidos.filter(p => p.status === 'ENTREGUE').map(p => (
                <div key={p.id} className="flex items-center justify-between p-3 border rounded-xl bg-card hover:border-primary transition-all">
                  <div>
                    <p className="font-medium text-sm">Pedido #{p.numero_pedido} — {p.cliente}</p>
                    <p className="text-xs text-muted-foreground">{p.data} · {p.forma_pagamento} · R$ {(p.total || 0).toFixed(2)}</p>
                  </div>
                  <Button size="sm" variant="outline" disabled={readOnly || jaTemNota(p.id)} onClick={() => gerarNFe(p)}>
                    <Send className="w-3.5 h-3.5 mr-1" />{jaTemNota(p.id) ? 'Já possui nota' : 'Gerar NF-e'}
                  </Button>
                </div>
              ))}
              {pedidos.filter(p => p.status === 'ENTREGUE').length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-8">Nenhum pedido entregue disponível</p>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="config" className="mt-4">
          <Card className="p-6 space-y-4 max-w-lg">
            <h3 className="font-semibold flex items-center gap-2"><Settings className="w-4 h-4" />Configuração do Emitente</h3>
            <div className="space-y-1.5"><Label>CNPJ</Label><Input placeholder="00.000.000/0001-00" value={config.cnpj} onChange={e => setConfig({ ...config, cnpj: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Razão Social</Label><Input value={config.razao_social} onChange={e => setConfig({ ...config, razao_social: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>UF</Label>
                <Select value={config.uf} onValueChange={v => setConfig({ ...config, uf: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{UFS.map(uf => <SelectItem key={uf} value={uf}>{uf}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5"><Label>Ambiente</Label>
                <Select value={config.ambiente} onValueChange={v => setConfig({ ...config, ambiente: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="HOMOLOGACAO">Homologação</SelectItem><SelectItem value="PRODUCAO">Produção</SelectItem></SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Série</Label><Input value={config.serie} onChange={e => setConfig({ ...config, serie: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>Número Inicial</Label><Input value={config.numero_inicial} onChange={e => setConfig({ ...config, numero_inicial: e.target.value })} /></div>
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex gap-2">
              <Info className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-blue-700">Estes dados (CNPJ/UF) são usados para gerar a chave de controle interno ao "Emitir" uma nota. Para emissão real: faça upload do certificado A1 (.pfx) e configure a senha via suporte técnico. Recomendado usar modo Homologação para testes.</p>
            </div>
            <Button onClick={() => toast({ title: 'Configurações aplicadas nesta sessão.', description: 'Serão usadas nas próximas emissões enquanto a página estiver aberta.' })}>
              <CheckCircle className="w-4 h-4 mr-1" />Aplicar Configurações
            </Button>
          </Card>
        </TabsContent>
      </Tabs>

      <NotaFiscalDoc open={!!docNota} onOpenChange={(v) => !v && setDocNota(null)} nota={docNota} />

      <Dialog open={!!cancelamentoAlvo} onOpenChange={(v) => !v && setCancelamentoAlvo(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Cancelar NF-e</DialogTitle></DialogHeader>
          {cancelamentoAlvo && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">Cancelar a NF-e nº <strong>{cancelamentoAlvo.numero_nfe}</strong> — {cancelamentoAlvo.cliente}?</p>
              <div className="space-y-1.5"><Label>Motivo do cancelamento *</Label><Textarea rows={3} value={motivoCancelamento} onChange={e => setMotivoCancelamento(e.target.value)} placeholder="Ex: Erro de digitação no valor, devolução da mercadoria..." /></div>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setCancelamentoAlvo(null)}>Voltar</Button>
                <Button variant="destructive" className="flex-1" disabled={!motivoCancelamento.trim() || cancelarMut.isPending} onClick={() => cancelarMut.mutate({ nota: cancelamentoAlvo, motivo: motivoCancelamento })}>Confirmar Cancelamento</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}