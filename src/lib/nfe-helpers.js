// Numeração e chave de controle 100% locais — não é comunicação com a SEFAZ.
// Servem apenas para organizar o rascunho/controle interno até que a emissão
// fiscal real (backend + certificado A1) seja configurada.

export function proximoNumeroNFe(notasExistentes, serie = '1') {
  let max = 0;
  for (const n of notasExistentes) {
    if (String(n.serie || '1') !== String(serie)) continue;
    const v = parseInt(String(n.numero_nfe || '').replace(/\D/g, ''), 10);
    if (!isNaN(v) && v > max) max = v;
  }
  return String(max + 1).padStart(9, '0');
}

// Gera uma "chave de controle" de 44 dígitos no formato visual de uma chave
// de acesso NF-e, mas 100% derivada localmente (hash determinístico) — não é
// uma chave de acesso válida perante a SEFAZ. Serve só para identificar o
// documento de forma única no controle interno.
export function gerarChaveControle({ cnpj, uf, numero_nfe, serie, ambiente }) {
  const base = `${cnpj || '00000000000000'}|${uf || 'PB'}|${serie || '1'}|${numero_nfe || '0'}|${ambiente || 'HOMOLOGACAO'}`;
  let h1 = 0, h2 = 0;
  for (let i = 0; i < base.length; i++) {
    h1 = (h1 * 31 + base.charCodeAt(i)) >>> 0;
    h2 = (h2 * 131 + base.charCodeAt(i)) >>> 0;
  }
  const digits = `${h1}${h2}`.replace(/\D/g, '');
  const padded = (digits + '00000000000000000000000000000000000000000000').slice(0, 44);
  return padded;
}

export function itensDoPedido(pedido) {
  if (!pedido || !Array.isArray(pedido.itens)) return [];
  return pedido.itens.map(it => {
    const unit = it.preco_unitario_pix ?? it.preco_unitario_cartao ?? 0;
    const qtd = Number(it.quantidade) || 0;
    return {
      produto_nome: it.produto_nome || '(item)',
      quantidade: qtd,
      valor_unitario: unit,
      valor_total: Math.round(unit * qtd * 100) / 100,
    };
  });
}
