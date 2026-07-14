import React, { createContext, useContext } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { registrarLog } from '@/lib/audit-log';
import {
  usuarioParaEmailAlias,
  slugificarUsuario,
  USUARIOS_MODO_VISITANTE,
  podeAtivarModoVisitante,
} from '@/lib/permissoes';

const ModoVisitanteContext = createContext(null);

// Busca (ou garante a existência de) o registro único que guarda o estado do Modo Visitante.
async function buscarOuCriarRegistro() {
  const registros = await base44.entities.ModoVisitante.list('-created_date', 1);
  if (registros.length > 0) return registros[0];
  return base44.entities.ModoVisitante.create({ ativo: false });
}

export const ModoVisitanteProvider = ({ children }) => {
  const { user, isAuthenticated } = useAuth();
  const queryClient = useQueryClient();

  const { data: registro, isLoading } = useQuery({
    queryKey: ['modo_visitante'],
    queryFn: buscarOuCriarRegistro,
    enabled: !!isAuthenticated,
    refetchInterval: 5000, // mantém todas as sessões sincronizadas rapidamente
    refetchOnWindowFocus: true,
  });

  const ativo = !!registro?.ativo;
  const podeAtivar = podeAtivarModoVisitante(user);

  const invalidar = () => queryClient.invalidateQueries({ queryKey: ['modo_visitante'] });

  // Ativação: só exige que o usuário já logado seja um dos 3 autorizados —
  // ele já provou identidade ao entrar na sessão atual.
  const ativar = async () => {
    if (!podeAtivarModoVisitante(user)) {
      throw new Error('Apenas Jocení, Jeyse ou Márcio podem ativar o Modo Visitante.');
    }
    const atual = await buscarOuCriarRegistro();
    const atualizado = await base44.entities.ModoVisitante.update(atual.id, {
      ativo: true,
      ativado_por: user.nome_usuario || '',
      ativado_em: new Date().toISOString(),
    });
    registrarLog({
      acao: 'OUTRO',
      entidade: 'ModoVisitante',
      entidade_id: atualizado?.id,
      detalhes: `Modo Visitante ATIVADO por ${user.nome_usuario || ''} — apenas Pedidos e Produção ficam visíveis (somente leitura) para todos.`,
    });
    await invalidar();
    return atualizado;
  };

  // Desativação: exige reconfirmação explícita de usuário + senha (não pré-preenchidos),
  // validada de fato contra a senha da conta — e só é aceita se for um dos 3 autorizados.
  const desativar = async ({ usuario, senha }) => {
    const slug = slugificarUsuario(usuario);
    if (!USUARIOS_MODO_VISITANTE.includes(slug)) {
      throw new Error('Usuário não autorizado a desativar o Modo Visitante.');
    }
    try {
      const email = usuarioParaEmailAlias(usuario);
      await base44.auth.loginViaEmailPassword(email, senha);
    } catch (err) {
      throw new Error('Usuário ou senha inválidos.');
    }
    const atual = await buscarOuCriarRegistro();
    const atualizado = await base44.entities.ModoVisitante.update(atual.id, {
      ativo: false,
      desativado_por: usuario,
      desativado_em: new Date().toISOString(),
    });
    registrarLog({
      acao: 'OUTRO',
      entidade: 'ModoVisitante',
      entidade_id: atualizado?.id,
      detalhes: `Modo Visitante DESATIVADO por ${usuario} — acesso normal restabelecido.`,
    });
    await invalidar();
    return atualizado;
  };

  return (
    <ModoVisitanteContext.Provider
      value={{
        ativo,
        isLoading,
        podeAtivar,
        ativadoPor: registro?.ativado_por || '',
        ativadoEm: registro?.ativado_em || '',
        ativar,
        desativar,
      }}
    >
      {children}
    </ModoVisitanteContext.Provider>
  );
};

// Fora do AuthProvider/ModoVisitanteProvider (ex.: usuário deslogado), retorna estado neutro.
export function useModoVisitante() {
  const context = useContext(ModoVisitanteContext);
  if (!context) {
    return { ativo: false, isLoading: false, podeAtivar: false, ativadoPor: '', ativadoEm: '', ativar: async () => {}, desativar: async () => {} };
  }
  return context;
}
