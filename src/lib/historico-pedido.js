import { base44 } from '@/api/base44Client';
import { setCurrentUserForLog } from '@/lib/audit-log';

let _currentUser = null;

export function setCurrentUserForHistorico(user) {
  _currentUser = user;
  setCurrentUserForLog(user);
}

/**
 * Registra uma entrada no histórico do pedido (timeline).
 * Calcula automaticamente o tempo gasto na etapa anterior.
 * Fire-and-forget: não bloqueia a operação principal.
 */
export function registrarHistorico({ pedido_id, tipo_pedido, status_anterior, status_novo, observacoes }) {
  if (!pedido_id || !status_novo) return;

  const nome = _currentUser?.nome_usuario || _currentUser?.full_name || 'Sistema';
  const agora = new Date().toISOString();

  // Busca o último registro para calcular o tempo da etapa anterior
  base44.entities.HistoricoPedido.filter({ pedido_id })
    .then(regs => {
      const ordenado = (regs || []).sort((a, b) => {
        const da = a.data_hora ? new Date(a.data_hora).getTime() : 0;
        const db = b.data_hora ? new Date(b.data_hora).getTime() : 0;
        return db - da; // descendente — pega o mais recente
      });

      const ultimo = ordenado[0];
      let tempoEtapa = 0;
      if (ultimo?.data_hora) {
        tempoEtapa = (Date.now() - new Date(ultimo.data_hora).getTime()) / 60000;
      }

      return base44.entities.HistoricoPedido.create({
        pedido_id,
        tipo_pedido: tipo_pedido || 'PRODUTO',
        status_anterior: status_anterior || '',
        status_novo,
        usuario: nome,
        usuario_id: _currentUser?.id || '',
        observacoes: observacoes || '',
        tempo_etapa_minutos: Math.round(tempoEtapa),
        data_hora: agora,
      });
    })
    .catch(() => {});
}