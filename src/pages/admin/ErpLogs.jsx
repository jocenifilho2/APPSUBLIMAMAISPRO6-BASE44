import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollText, Search } from 'lucide-react';

const ACAO_COLORS = {
  CRIAR: 'bg-green-100 text-green-700',
  EDITAR: 'bg-blue-100 text-blue-700',
  EXCLUIR: 'bg-red-100 text-red-700',
  STATUS: 'bg-amber-100 text-amber-700',
  EMITIR: 'bg-purple-100 text-purple-700',
  CANCELAR: 'bg-red-100 text-red-700',
  OUTRO: 'bg-gray-100 text-gray-600',
};

function formatData(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function ErpLogs() {
  const [busca, setBusca] = useState('');
  const [filtroAcao, setFiltroAcao] = useState('TODAS');
  const [filtroEntidade, setFiltroEntidade] = useState('TODAS');

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['logs_alteracao'],
    queryFn: () => base44.entities.LogAlteracao.list('-created_date', 500),
    refetchInterval: 10000,
  });

  const entidades = useMemo(() => {
    const set = new Set(logs.map(l => l.entidade).filter(Boolean));
    return Array.from(set).sort();
  }, [logs]);

  const filtered = useMemo(() => {
    return logs.filter(l => {
      const matchBusca = !busca ||
        l.usuario?.toLowerCase().includes(busca.toLowerCase()) ||
        l.detalhes?.toLowerCase().includes(busca.toLowerCase()) ||
        l.entidade_id?.includes(busca);
      const matchAcao = filtroAcao === 'TODAS' || l.acao === filtroAcao;
      const matchEntidade = filtroEntidade === 'TODAS' || l.entidade === filtroEntidade;
      return matchBusca && matchAcao && matchEntidade;
    });
  }, [logs, busca, filtroAcao, filtroEntidade]);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold flex items-center gap-2"><ScrollText className="w-5 h-5 text-primary" />Log de Alterações</h2>
        <p className="text-sm text-muted-foreground">Quem alterou o quê e quando</p>
      </div>

      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar por usuário, detalhe ou ID..." className="pl-9" />
        </div>
        <Select value={filtroAcao} onValueChange={setFiltroAcao}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="TODAS">Todas ações</SelectItem>
            <SelectItem value="CRIAR">Criar</SelectItem>
            <SelectItem value="EDITAR">Editar</SelectItem>
            <SelectItem value="EXCLUIR">Excluir</SelectItem>
            <SelectItem value="STATUS">Status</SelectItem>
            <SelectItem value="EMITIR">Emitir</SelectItem>
            <SelectItem value="CANCELAR">Cancelar</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filtroEntidade} onValueChange={setFiltroEntidade}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="TODAS">Todas entidades</SelectItem>
            {entidades.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-32"><div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" /></div>
      ) : (
        <Card className="overflow-hidden">
          <div className="max-h-[600px] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50 sticky top-0">
                  <TableHead>Data/Hora</TableHead>
                  <TableHead>Usuário</TableHead>
                  <TableHead>Ação</TableHead>
                  <TableHead>Entidade</TableHead>
                  <TableHead>Detalhes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(l => (
                  <TableRow key={l.id}>
                    <TableCell className="text-xs whitespace-nowrap">{formatData(l.data || l.created_date)}</TableCell>
                    <TableCell className="font-medium text-sm">{l.usuario}</TableCell>
                    <TableCell><Badge className={`text-xs ${ACAO_COLORS[l.acao] || ACAO_COLORS.OUTRO}`}>{l.acao}</Badge></TableCell>
                    <TableCell className="text-xs">{l.entidade}</TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-md">{l.detalhes || '—'}</TableCell>
                  </TableRow>
                ))}
                {filtered.length === 0 && <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Nenhum registro</TableCell></TableRow>}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}
    </div>
  );
}