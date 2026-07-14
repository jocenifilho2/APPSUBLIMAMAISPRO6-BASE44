import React from 'react';
import { useAuth } from '@/lib/AuthContext';
import { podeVer, primeiroModuloPermitido, nivelAcesso } from '@/lib/permissoes';
import { ShieldOff } from 'lucide-react';

// Bloqueia o acesso ao módulo se o usuário logado não tiver permissão.
// Também expõe o nível de acesso ('leitura' | 'edicao') via prop de função (render prop),
// para as telas poderem desabilitar ações de edição quando o acesso é só leitura.
// A conta compartilhada 'visitante' (usada pelo Modo Visitante) já tem essa restrição
// embutida em nivelAcesso/podeVer — não depende de nenhum flag passado aqui.
export default function ModuloGate({ moduloId, children }) {
  const { user } = useAuth();

  if (!podeVer(user, moduloId)) {
    const alternativa = primeiroModuloPermitido(user);
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center text-center px-4">
        <div className="w-14 h-14 bg-muted rounded-2xl flex items-center justify-center mb-3">
          <ShieldOff className="w-7 h-7 text-muted-foreground" />
        </div>
        <h2 className="text-lg font-bold">Sem permissão</h2>
        <p className="text-sm text-muted-foreground max-w-xs mt-1">
          Sua conta não tem acesso a este módulo. Fale com um administrador se acha que isso está errado.
        </p>
        {alternativa && (
          <a href={alternativa} className="text-sm text-primary font-medium mt-4">Ir para meu módulo</a>
        )}
      </div>
    );
  }

  const nivel = nivelAcesso(user, moduloId);
  return typeof children === 'function' ? children(nivel) : children;
}
