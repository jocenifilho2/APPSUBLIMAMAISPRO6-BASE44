// Parsing e matching 100% determinísticos — nenhuma chamada de IA/API externa.

// Gera um hash simples e estável para deduplicar lançamentos importados.
export function hashLancamento(data, valor, descricao) {
  const base = `${data}|${Number(valor).toFixed(2)}|${(descricao || '').trim().toLowerCase()}`;
  let hash = 0;
  for (let i = 0; i < base.length; i++) {
    hash = (hash * 31 + base.charCodeAt(i)) >>> 0;
  }
  return `h${hash.toString(36)}_${base.length}`;
}

function parseValorBR(str) {
  if (typeof str === 'number') return str;
  if (!str) return 0;
  let s = String(str).trim().replace(/[^\d,.-]/g, '');
  // Formato BR: 1.234,56  →  1234.56
  if (s.includes(',') && s.lastIndexOf(',') > s.lastIndexOf('.')) {
    s = s.replace(/\./g, '').replace(',', '.');
  }
  return parseFloat(s) || 0;
}

function parseDataFlexivel(str) {
  if (!str) return null;
  const s = String(str).trim();
  // dd/mm/aaaa ou dd-mm-aaaa
  let m = s.match(/^(\d{2})[\/\-](\d{2})[\/\-](\d{4})/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  // aaaa-mm-dd (já ISO)
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  // aaaammdd (OFX)
  m = s.match(/^(\d{4})(\d{2})(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  return null;
}

// Detecta o delimitador mais provável de um CSV bancário.
function detectarDelimitador(linha) {
  const candidatos = [';', ',', '\t'];
  let melhor = ';', maiorContagem = -1;
  for (const c of candidatos) {
    const n = linha.split(c).length;
    if (n > maiorContagem) { maiorContagem = n; melhor = c; }
  }
  return melhor;
}

// Parser de CSV bancário genérico. Tenta identificar colunas de data/descrição/valor
// por cabeçalho; se não houver cabeçalho reconhecível, assume ordem data;descricao;valor.
export function parseCSVExtrato(conteudo) {
  const linhas = conteudo.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (linhas.length === 0) return [];
  const delim = detectarDelimitador(linhas[0]);
  const header = linhas[0].split(delim).map(h => h.trim().toLowerCase());

  const idxData = header.findIndex(h => /data|date/.test(h));
  const idxDesc = header.findIndex(h => /hist|descri|memo|desc/.test(h));
  const idxValor = header.findIndex(h => /valor|amount|montante/.test(h));

  const temHeaderReconhecivel = idxData >= 0 && idxValor >= 0;
  const linhasDados = temHeaderReconhecivel ? linhas.slice(1) : linhas;

  const resultado = [];
  for (const linha of linhasDados) {
    const cols = linha.split(delim).map(c => c.trim().replace(/^"|"$/g, ''));
    const dataRaw = cols[temHeaderReconhecivel ? idxData : 0];
    const descRaw = cols[temHeaderReconhecivel ? (idxDesc >= 0 ? idxDesc : 1) : 1];
    const valorRaw = cols[temHeaderReconhecivel ? idxValor : 2];

    const data = parseDataFlexivel(dataRaw);
    const valor = parseValorBR(valorRaw);
    if (!data || !valor) continue;

    resultado.push({
      data,
      descricao: descRaw || '(sem descrição)',
      valor,
      tipo: valor >= 0 ? 'CREDITO' : 'DEBITO',
    });
  }
  return resultado;
}

// Parser de OFX simplificado via regex — extrai blocos <STMTTRN>.
export function parseOFXExtrato(conteudo) {
  const blocos = conteudo.match(/<STMTTRN>[\s\S]*?<\/STMTTRN>/gi)
    || conteudo.match(/<STMTTRN>[\s\S]*?(?=<STMTTRN>|<\/BANKTRANLIST>)/gi)
    || [];
  const resultado = [];
  for (const bloco of blocos) {
    const get = (tag) => {
      const m = bloco.match(new RegExp(`<${tag}>([^<\r\n]*)`, 'i'));
      return m ? m[1].trim() : '';
    };
    const dataRaw = get('DTPOSTED');
    const valorRaw = get('TRNAMT');
    const memo = get('MEMO') || get('NAME');
    const data = parseDataFlexivel(dataRaw);
    const valor = parseValorBR(valorRaw);
    if (!data || !valorRaw) continue;
    resultado.push({
      data,
      descricao: memo || '(sem descrição)',
      valor,
      tipo: valor >= 0 ? 'CREDITO' : 'DEBITO',
    });
  }
  return resultado;
}

export function parseExtrato(conteudo, nomeArquivo) {
  const isOfx = /\.ofx$/i.test(nomeArquivo) || /<OFX>/i.test(conteudo);
  return isOfx ? parseOFXExtrato(conteudo) : parseCSVExtrato(conteudo);
}

// Similaridade de texto por interseção de tokens (Jaccard) — sem IA.
function similaridadeTexto(a, b) {
  const tok = (s) => new Set(
    (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(w => w.length > 2)
  );
  const ta = tok(a), tb = tok(b);
  if (ta.size === 0 || tb.size === 0) return 0;
  let inter = 0;
  for (const w of ta) if (tb.has(w)) inter++;
  const uniao = new Set([...ta, ...tb]).size;
  return uniao > 0 ? inter / uniao : 0;
}

function diffDias(dataA, dataB) {
  const a = new Date(dataA + 'T12:00:00');
  const b = new Date(dataB + 'T12:00:00');
  return Math.abs((a - b) / (1000 * 60 * 60 * 24));
}

// Para cada item do extrato, procura candidatas em ContaFinanceira e retorna
// um score 0–1 por regras fixas: valor exato (peso 0.55), proximidade de data
// (peso 0.25, dentro de 5 dias), similaridade textual (peso 0.20).
export function sugerirMatches(extratoItem, contasCandidatas, janelaDias = 5) {
  const valorAbs = Math.abs(extratoItem.valor);
  const dataConta = (c) => c.data_pagamento || c.data_vencimento || '';

  const pontuadas = contasCandidatas
    .map(conta => {
      const valorConta = Math.abs(conta.valor || 0);
      const difValor = Math.abs(valorConta - valorAbs);
      const scoreValor = difValor < 0.01 ? 1 : difValor <= valorAbs * 0.02 ? 0.6 : 0;
      if (scoreValor === 0) return null;

      const dConta = dataConta(conta);
      const dif = dConta ? diffDias(extratoItem.data, dConta) : janelaDias + 1;
      const scoreData = dif > janelaDias ? 0 : 1 - (dif / janelaDias) * 0.6;

      const scoreTexto = similaridadeTexto(
        extratoItem.descricao,
        `${conta.descricao || ''} ${conta.categoria || ''} ${conta.referencia || ''}`
      );

      const score = scoreValor * 0.55 + scoreData * 0.25 + scoreTexto * 0.20;
      return { conta, score: Math.round(score * 100) / 100 };
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score);

  return pontuadas;
}
