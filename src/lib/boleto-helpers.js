// Cálculos 100% locais — numeração e encargos são regras simples, sem IA/API.

export function proximoNossoNumero(boletosExistentes) {
  let max = 0;
  for (const b of boletosExistentes) {
    const n = parseInt(String(b.nosso_numero || '').replace(/\D/g, ''), 10);
    if (!isNaN(n) && n > max) max = n;
  }
  return String(max + 1).padStart(6, '0');
}

// Retorna { diasAtraso, valorMulta, valorJuros, valorAtualizado, vencido }
export function calcularEncargos(boleto, hoje = new Date().toISOString().slice(0, 10)) {
  const valorOriginal = Number(boleto.valor_original) || 0;
  const desconto = Number(boleto.desconto) || 0;
  const multaPct = Number(boleto.multa_percentual ?? 2);
  const jurosDiaPct = Number(boleto.juros_dia_percentual ?? 0.033);

  const vencido = boleto.status !== 'PAGO' && boleto.status !== 'CANCELADO' && boleto.data_vencimento < hoje;
  const diasAtraso = vencido
    ? Math.max(0, Math.round((new Date(hoje + 'T12:00:00') - new Date(boleto.data_vencimento + 'T12:00:00')) / (1000 * 60 * 60 * 24)))
    : 0;

  const valorMulta = vencido ? valorOriginal * (multaPct / 100) : 0;
  const valorJuros = vencido ? valorOriginal * (jurosDiaPct / 100) * diasAtraso : 0;
  const valorAtualizado = Math.max(0, valorOriginal - desconto + valorMulta + valorJuros);

  return { diasAtraso, valorMulta, valorJuros, valorAtualizado, vencido };
}

export function statusEfetivo(boleto, hoje = new Date().toISOString().slice(0, 10)) {
  if (boleto.status === 'PAGO' || boleto.status === 'CANCELADO') return boleto.status;
  return boleto.data_vencimento < hoje ? 'VENCIDO' : 'EMITIDO';
}
