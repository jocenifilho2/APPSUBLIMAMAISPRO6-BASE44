import { base44 } from '@/api/base44Client';

let _currentUser = null;

export function setCurrentUserForLog(user) {
  _currentUser = user;
}

/**
 * Registra uma entrada no log de alteracoes.
 * Fire-and-forget: nao bloqueia a operacao principal e ignora erros.
 */
export function registrarLog({ acao, entidade, entidade_id, detalhes }) {
  if (!_currentUser) return;
  const nome = _currentUser.nome_usuario || _currentUser.full_name || 'Sistema';
  return base44.entities.LogAlteracao.create({
    usuario: nome,
    usuario_id: _currentUser.id,
    acao,
    entidade,
    entidade_id: entidade_id || '',
    detalhes: detalhes || '',
    data: new Date().toISOString(),
  }).catch(() => {});
}