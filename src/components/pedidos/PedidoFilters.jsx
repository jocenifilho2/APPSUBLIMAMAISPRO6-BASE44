import React from 'react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search } from 'lucide-react';

export default function PedidoFilters({ busca, setBusca, statusFilter, setStatusFilter, origemFilter, setOrigemFilter, dataInicio, setDataInicio, dataFim, setDataFim }) {
  return (
    <div className="flex flex-wrap gap-3 items-center">
      <div className="relative flex-1 min-w-[200px]">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por cliente ou número..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          className="pl-9"
        />
      </div>
      <Select value={origemFilter} onValueChange={setOrigemFilter}>
        <SelectTrigger className="w-32"><SelectValue placeholder="Origem" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todas origens</SelectItem>
          <SelectItem value="LOJA">Loja</SelectItem>
          <SelectItem value="WHATSAPP">WhatsApp</SelectItem>
        </SelectContent>
      </Select>
      <Select value={statusFilter} onValueChange={setStatusFilter}>
        <SelectTrigger className="w-36"><SelectValue placeholder="Status" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos</SelectItem>
          <SelectItem value="NOVO">Novo</SelectItem>
          <SelectItem value="PAGO">Pago</SelectItem>
          <SelectItem value="AGUARDANDO_PAGAMENTO">Aguardando</SelectItem>
          <SelectItem value="SEPARACAO">Separação</SelectItem>
          <SelectItem value="PRONTO">Pronto</SelectItem>
          <SelectItem value="ENTREGUE">Entregue</SelectItem>
          <SelectItem value="CANCELADO">Cancelado</SelectItem>
        </SelectContent>
      </Select>
      <input
        type="date"
        value={dataInicio}
        onChange={(e) => setDataInicio(e.target.value)}
        className="flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring w-40"
      />
      <input
        type="date"
        value={dataFim}
        onChange={(e) => setDataFim(e.target.value)}
        className="flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring w-40"
      />
    </div>
  );
}