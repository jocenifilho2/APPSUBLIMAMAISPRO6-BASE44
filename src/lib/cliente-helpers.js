// Sufixos usados para marcar variações do mesmo pedido (reenvio corrigido,
// segunda via, etc). Não fazem parte do nome real do cliente e devem ser
// ignorados ao comparar/agrupar clientes no CRM. Cobre "ATUALIZADO",
// "PEDIDO 2"/"PEDIDO 3", variações entre parênteses (ex: "(ATUALIZADO)",
// "(PEDIDO 2)"), "ATUALIZADO 3" e também um número solto no final (ex:
// "MICHELLE MATOS 2"), que é a mesma variação só que sem a palavra "PEDIDO"
// na frente.
const SUFIXOS_VARIACAO_REGEX = /\s*[-–—]?\s*\(?\s*(ATUALIZADO(\s*\d+)?|PEDIDO\s*\d+|\d+)\s*\)?\s*$/i;

// Remove sufixos de variação (ex: "MARIA SILVA - ATUALIZADO" -> "MARIA SILVA",
// "MARIA SILVA - PEDIDO 2" -> "MARIA SILVA"). Mantém nome completo, sem reduzir
// a apenas nome/sobrenome — use chaveNomeCliente() para fins de comparação.
export function limparVariacaoNome(nomeRaw) {
  if (!nomeRaw) return '';
  let nome = String(nomeRaw).toUpperCase().trim();
  let anterior;
  do {
    anterior = nome;
    nome = nome.replace(SUFIXOS_VARIACAO_REGEX, '').trim();
  } while (nome !== anterior && nome.length > 0);
  return nome;
}

export function normalizarTelefone(tel) {
  return String(tel || '').replace(/\D/g, '');
}

// Chave de comparação de cliente: considera apenas primeiro nome + último
// sobrenome (ignora nomes do meio) e remove variações como "Atualizado",
// "Pedido 2", "Pedido 3" — evita contar o mesmo cliente mais de uma vez no CRM.
export function chaveNomeCliente(nomeRaw) {
  const nomeLimpo = limparVariacaoNome(nomeRaw);
  const partes = nomeLimpo.split(/\s+/).filter(Boolean);
  if (partes.length === 0) return '';
  if (partes.length === 1) return partes[0];
  return `${partes[0]} ${partes[partes.length - 1]}`;
}

// Compara um pedido (cliente/telefone) com um cliente do CRM (nome/telefone).
// Considera apenas nome + sobrenome e, quando ambos os registros possuem
// telefone, o telefone também precisa bater — evita juntar/contar como o
// mesmo cliente duas pessoas diferentes que só coincidem no nome.
export function clienteCorresponde(nomePedido, telefonePedido, nomeCliente, telefoneCliente) {
  const chavePedido = chaveNomeCliente(nomePedido);
  const chaveCliente = chaveNomeCliente(nomeCliente);
  const nomeBate = !!chavePedido && !!chaveCliente && chavePedido === chaveCliente;

  const telPedido = normalizarTelefone(telefonePedido);
  const telCliente = normalizarTelefone(telefoneCliente);

  if (nomeBate) {
    // Nome+sobrenome bateram: se os dois registros têm telefone, o telefone
    // também precisa coincidir. Se um dos dois não tiver telefone, o nome já basta.
    if (telPedido && telCliente) return telPedido === telCliente;
    return true;
  }

  // Nomes diferentes: ainda considera o mesmo cliente se o telefone
  // (quando existir nos dois) for idêntico.
  if (telPedido && telCliente && telPedido === telCliente) return true;

  return false;
}
