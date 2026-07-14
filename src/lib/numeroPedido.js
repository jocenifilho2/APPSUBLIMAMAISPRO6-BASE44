/**
 * Gera o próximo número de pedido Loja/WhatsApp no formato P+MM+SEQ
 * Exemplo: P0501, P0502... P0601, P0602...
 */
export function gerarNumeroPedido(pedidosExistentes = []) {
  const now = new Date();
  const mes = String(now.getMonth() + 1).padStart(2, '0');
  const prefixo = `P${mes}`;

  const nums = pedidosExistentes
    .map(p => p.numero_pedido || '')
    .filter(n => n.startsWith(prefixo))
    .map(n => parseInt(n.slice(prefixo.length), 10))
    .filter(n => !isNaN(n));

  const maxSeq = nums.length > 0 ? Math.max(...nums) : 0;
  const proxSeq = String(maxSeq + 1).padStart(2, '0');
  return `${prefixo}${proxSeq}`;
}

/**
 * Gera o próximo número de pedido de Impressão no formato I+MM+SEQ
 * Exemplo: I0501, I0502... I0601, I0602...
 */
export function gerarNumeroImpressao(pedidosExistentes = []) {
  const now = new Date();
  const mes = String(now.getMonth() + 1).padStart(2, '0');
  const prefixo = `i${mes}`;

  const nums = pedidosExistentes
    .map(p => p.numero || '')
    .filter(n => n.toLowerCase().startsWith(prefixo))
    .map(n => parseInt(n.slice(prefixo.length), 10))
    .filter(n => !isNaN(n));

  const maxSeq = nums.length > 0 ? Math.max(...nums) : 0;
  const proxSeq = String(maxSeq + 1).padStart(2, '0');
  return `${prefixo}${proxSeq}`;
}

// ─── Tinta Sublimática WPrime — preços especiais por cliente ───
const WPRIME_CLIENTES = [
  { tel: '8387317838', nomes: ['KEUBER EMANUEL'], pix: 180 },
  { tel: '8393851576', nomes: ['GEOVANE JORDAO', 'GEOVANE JORDÃO'], pix: 195 },
  { tel: '8197230075', nomes: ['NORDESTE SERVICOS', 'NORDESTE SERVIÇOS'], pix: 380 },
  { tel: '8381152904', nomes: ['MISS PERSONALIZADOS'], pix: 220 },
];

function isWPrime(nome) {
  return (nome || '').toUpperCase().replace(/\s+/g, '').includes('WPRIME');
}

function normalizarTel(tel) {
  return (tel || '').replace(/\D/g, '').slice(-8);
}

function findWPrimeCliente(cliente, telefone) {
  const telNorm = normalizarTel(telefone);
  const nomeNorm = (cliente || '').toUpperCase().trim();
  for (const c of WPRIME_CLIENTES) {
    if (telNorm && telNorm === c.tel.slice(-8)) return c;
    if (nomeNorm && c.nomes.some(n => nomeNorm.includes(n) || n.includes(nomeNorm))) return c;
  }
  return null;
}

/**
 * Calcula o preço PIX/Dinheiro baseado nas regras especiais por produto
 */
export function calcularPrecoDesconto(produtoNome, precoPadrao, quantidade, formaPagamento, cliente = '', telefone = '') {
  if (formaPagamento === 'CARTAO') return precoPadrao;
  if (formaPagamento === 'DUPLICATA') return precoPadrao;

  const nomeUpper = (produtoNome || '').toUpperCase();

  // Tinta Sublimática WPrime — preço fixo por cliente (cartão sempre 249)
  if (isWPrime(nomeUpper)) {
    const cli = findWPrimeCliente(cliente, telefone);
    return cli ? cli.pix : 236.55;
  }

  if (nomeUpper.includes('CAIXA') && nomeUpper.includes('CANECA') && (nomeUpper.includes('PORCELANA') || nomeUpper.includes('PORECLANA'))) {
    return precoPadrao * (1 - 0.0694);
  }
  if (nomeUpper.includes('BANDEJA') && nomeUpper.includes('CANECA')) {
    return precoPadrao * (1 - 0.0667);
  }
  if (nomeUpper.includes('CANECA') && (nomeUpper.includes('PORCELANA') || nomeUpper.includes('PORECLANA'))) {
    if (quantidade >= 36) return precoPadrao * (1 - 0.0694);
    else if (quantidade >= 12) return precoPadrao * (1 - 0.0667);
    else return precoPadrao * (1 - 0.0833);
  }

  return precoPadrao * 0.95;
}