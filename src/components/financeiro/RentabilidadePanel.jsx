import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Package, TrendingUp, Download } from 'lucide-react';
import { calcularRentabilidadeProduto, formatCurrency, formatPercent, RENTABILIDADE_COLOR, exportarCSV } from '@/lib/financeiro-helpers';

export default function RentabilidadePanel({ readOnly = false }) {
  const [busca, setBusca] = useState('');
  const { data: produtos = [] } = useQuery({
    queryKey: ['produtos'],
    queryFn: () => base44.entities.Produto.list(),
    refetchInterval: 30000
  });

  const dados = useMemo(() => {
    return produtos
      .filter(p => !busca || (p.nome || '').toLowerCase().includes(busca.toLowerCase()))
      .map(p => ({ ...p, rent: calcularRentabilidadeProduto(p) }))
      .sort((a, b) => b.rent.rentPix.margem - a.rent.rentPix.margem);
  }, [produtos, busca]);

  const ranking = useMemo(() => [...dados].sort((a, b) => b.rent.rentPix.lucroBruto - a.rent.rentPix.lucroBruto), [dados]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold flex items-center gap-2"><TrendingUp className="w-4 h-4" />Rentabilidade por Produto</h3>
        <Button variant="outline" size="sm" onClick={() => exportarCSV(dados, [
          { label: 'Produto', key: 'nome' }, { label: 'Custo', key: d => d.custo?.toFixed(2) },
          { label: 'Preço PIX', key: d => d.preco_pix?.toFixed(2) }, { label: 'Preço Cartão', key: d => d.preco_cartao?.toFixed(2) },
          { label: 'Lucro PIX', key: d => d.rent.rentPix.lucroBruto?.toFixed(2) },
          { label: 'Margem PIX', key: d => d.rent.rentPix.margem },
          { label: 'Rentabilidade', key: d => d.rent.rentPix.rentabilidade }
        ], 'rentabilidade-produtos.csv')}><Download className="w-3.5 h-3.5 mr-1" />CSV</Button>
      </div>

      <Input placeholder="Buscar produto..." value={busca} onChange={e => setBusca(e.target.value)} className="max-w-xs" />

      {/* Top 5 mais lucrativos */}
      <div className="grid md:grid-cols-5 gap-3">
        {ranking.slice(0, 5).map((p, i) => (
          <Card key={p.id} className="p-3">
            <div className="flex items-center gap-2 mb-1">
              <Badge className="bg-primary text-xs">#{i + 1}</Badge>
              <span className="text-xs font-medium truncate">{p.nome}</span>
            </div>
            <p className="text-sm font-bold text-green-600">{formatCurrency(p.rent.rentPix.lucroBruto)}</p>
            <p className="text-xs text-muted-foreground">{formatPercent(p.rent.rentPix.margem)} margem</p>
          </Card>
        ))}
      </div>

      <Card>
        <Table>
          <TableHeader><TableRow className="bg-muted/50">
            <TableHead>Produto</TableHead><TableHead>Categoria</TableHead>
            <TableHead className="text-right">Custo</TableHead><TableHead className="text-right">Preço PIX</TableHead>
            <TableHead className="text-right">Preço Cartão</TableHead><TableHead className="text-right">Lucro PIX</TableHead>
            <TableHead className="text-right">Margem</TableHead><TableHead>Rentab.</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {dados.map(p => (
              <TableRow key={p.id}>
                <TableCell className="text-sm font-medium">{p.nome}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{p.categoria || '—'}</TableCell>
                <TableCell className="text-right text-xs">{formatCurrency(p.custo)}</TableCell>
                <TableCell className="text-right text-xs">{formatCurrency(p.preco_pix)}</TableCell>
                <TableCell className="text-right text-xs">{formatCurrency(p.preco_cartao)}</TableCell>
                <TableCell className={`text-right text-sm font-medium ${p.rent.rentPix.lucroBruto >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatCurrency(p.rent.rentPix.lucroBruto)}</TableCell>
                <TableCell className="text-right text-xs">{formatPercent(p.rent.rentPix.margem)}</TableCell>
                <TableCell><Badge className={`text-xs ${RENTABILIDADE_COLOR[p.rent.rentPix.rentabilidade]}`}>{p.rent.rentPix.rentabilidade}</Badge></TableCell>
              </TableRow>
            ))}
            {dados.length === 0 && <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Nenhum produto.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}