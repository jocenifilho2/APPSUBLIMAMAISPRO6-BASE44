import React from 'react';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';

/**
 * Paginação simples client-side (sem chamadas extras): recebe o total de
 * itens já filtrados e emite apenas os controles de Anterior/Próxima.
 */
export default function Pagination({ page, pageSize, totalItems, onPageChange }) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  if (totalItems === 0) return null;

  const inicio = (page - 1) * pageSize + 1;
  const fim = Math.min(page * pageSize, totalItems);

  return (
    <div className="flex items-center justify-between flex-wrap gap-3 px-1">
      <p className="text-xs text-muted-foreground">
        Mostrando <strong>{inicio}–{fim}</strong> de <strong>{totalItems}</strong>
      </p>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          <ChevronLeft className="w-3.5 h-3.5 mr-1" /> Anterior
        </Button>
        <span className="text-xs text-muted-foreground min-w-[70px] text-center">
          Página {page} de {totalPages}
        </span>
        <Button
          variant="outline"
          size="sm"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          Próxima <ChevronRight className="w-3.5 h-3.5 ml-1" />
        </Button>
      </div>
    </div>
  );
}
