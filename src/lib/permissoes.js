// Configuração central de módulos, permissões e login por "usuário" (sem e-mail visível).
//
// Como funciona o login sem e-mail visível:
// O Base44 exige um e-mail real por trás de cada conta (é pra lá que vai o link de
// redefinição de senha). Usamos o alias "+" do Gmail: todo mundo usa o mesmo Gmail
// (adm.sublimamaispb@gmail.com), mas cada pessoa tem um "apelido" próprio
// (ex: adm.sublimamaispb+joceni@gmail.com) — todos caem na mesma caixa de entrada.
// A pessoa nunca vê nem digita esse e-mail: só o nome de usuário.

export const DOMINIO_ALIAS_BASE = 'adm.sublimamaispb';
export const DOMINIO_ALIAS_PROVEDOR = 'gmail.com';

export function slugificarUsuario(nomeUsuario) {
  return (nomeUsuario || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove acentos
    .toLowerCase()
    .replace(/[^a-z0-9]/g, ''); // só letras/números
}

export function usuarioParaEmailAlias(nomeUsuario) {
  const slug = slugificarUsuario(nomeUsuario);
  return `${DOMINIO_ALIAS_BASE}+${slug}@${DOMINIO_ALIAS_PROVEDOR}`;
}

// Módulos do sistema — cada um corresponde a uma rota e a um campo de permissão no User
export const MODULOS = [
  { id: 'pedidos', campo: 'acesso_pedidos', label: 'Pedidos Loja / WhatsApp', path: '/' },
  { id: 'producao', campo: 'acesso_producao', label: 'Produção (DTF e Sublimação)', path: '/impressoes' },
  { id: 'logistica', campo: 'acesso_logistica', label: 'Logística', path: '/logistica' },
  { id: 'administrativo', campo: 'acesso_administrativo', label: 'Administrativo / Executivo', path: '/admin' },
  { id: 'ecommerce', campo: 'acesso_ecommerce', label: 'Gestão Ecommerce', path: '/ecommerce' },
];

// Matriz de permissões iniciais — aplicada automaticamente na primeira vez que a pessoa
// confirma o cadastro (via updateMe, na própria conta dela). Alterações posteriores
// devem ser feitas na tela de Gestão de Usuários (módulo Administrativo).
// Chave = nome de usuário normalizado (mesma função slugificarUsuario)
const TUDO_EDICAO = { acesso_pedidos: 'edicao', acesso_producao: 'edicao', acesso_separacao: 'edicao', acesso_logistica: 'edicao', acesso_administrativo: 'edicao', acesso_ecommerce: 'edicao' };

export const PERFIS_INICIAIS = {
  marcio: TUDO_EDICAO,
  jeyse: TUDO_EDICAO,
  joceni: TUDO_EDICAO,
  romualdo: { acesso_pedidos: 'leitura', acesso_producao: 'edicao', acesso_separacao: 'edicao', acesso_logistica: 'edicao', acesso_administrativo: 'nenhum', acesso_ecommerce: 'nenhum' },
  alysson: { acesso_pedidos: 'nenhum', acesso_producao: 'edicao', acesso_separacao: 'edicao', acesso_logistica: 'edicao', acesso_administrativo: 'nenhum', acesso_ecommerce: 'nenhum' },
  yan: { acesso_pedidos: 'edicao', acesso_producao: 'edicao', acesso_separacao: 'edicao', acesso_logistica: 'edicao', acesso_administrativo: 'nenhum', acesso_ecommerce: 'nenhum' },
  raquel: { acesso_pedidos: 'nenhum', acesso_producao: 'edicao', acesso_separacao: 'edicao', acesso_logistica: 'edicao', acesso_administrativo: 'nenhum', acesso_ecommerce: 'nenhum' },
  andre: { acesso_pedidos: 'nenhum', acesso_producao: 'edicao', acesso_separacao: 'edicao', acesso_logistica: 'edicao', acesso_administrativo: 'nenhum', acesso_ecommerce: 'nenhum' },
  vitor: { acesso_pedidos: 'leitura', acesso_producao: 'edicao', acesso_separacao: 'edicao', acesso_logistica: 'edicao', acesso_administrativo: 'nenhum', acesso_ecommerce: 'nenhum' },
  jo: { acesso_pedidos: 'nenhum', acesso_producao: 'nenhum', acesso_separacao: 'nenhum', acesso_logistica: 'nenhum', acesso_administrativo: 'edicao', acesso_ecommerce: 'edicao' },
  // Conta compartilhada e de baixo privilégio usada exclusivamente pelo Modo Visitante
  // (ver ModoVisitanteContext.jsx). Mesmo com esse perfil fixo em leitura, enquanto o
  // Modo Visitante está ativo a restrição global (nivelAcesso) já sobrepõe qualquer
  // permissão individual — isto aqui é só uma segunda camada de segurança (defesa em profundidade)
  // caso essa conta seja usada fora do Modo Visitante por engano.
  visitante: { acesso_pedidos: 'leitura', acesso_producao: 'leitura', acesso_separacao: 'nenhum', acesso_logistica: 'nenhum', acesso_administrativo: 'nenhum', acesso_ecommerce: 'nenhum' },
};

export function perfilInicialPara(nomeUsuario) {
  const slug = slugificarUsuario(nomeUsuario);
  return PERFIS_INICIAIS[slug] || { acesso_pedidos: 'nenhum', acesso_producao: 'nenhum', acesso_separacao: 'nenhum', acesso_logistica: 'nenhum', acesso_administrativo: 'nenhum', acesso_ecommerce: 'nenhum' };
}

// Nível de acesso do usuário logado a um módulo: 'nenhum' | 'leitura' | 'edicao'
// A restrição do Modo Visitante NÃO é mais um flag global — ela é amarrada à própria
// conta 'visitante' (ver ehContaVisitante abaixo). Isso garante que a restrição vale
// só na máquina onde essa conta está logada; qualquer outro usuário, em qualquer outra
// máquina, continua vendo exatamente os módulos já configurados para ele.
export function nivelAcesso(user, moduloId) {
  if (!user) return 'nenhum';
  if (ehContaVisitante(user)) {
    return MODULOS_MODO_VISITANTE.includes(moduloId) ? 'leitura' : 'nenhum';
  }
  if (user.role === 'admin') return 'edicao';
  if (moduloId === 'ecommerce') return 'edicao';
  const modulo = MODULOS.find(m => m.id === moduloId);
  if (!modulo) return 'nenhum';
  return user[modulo.campo] || 'nenhum';
}

export function podeVer(user, moduloId) {
  return nivelAcesso(user, moduloId) !== 'nenhum';
}

export function podeEditar(user, moduloId) {
  return nivelAcesso(user, moduloId) === 'edicao';
}

// Hook para uso em componentes React: retorna true se o usuário logado pode editar o módulo.
// Considera automaticamente a conta 'visitante' (edição sempre revogada para ela).
import { useAuth } from '@/lib/AuthContext';
export function usePodeEditar(moduloId) {
  const { user } = useAuth();
  return podeEditar(user, moduloId);
}

export function primeiroModuloPermitido(user) {
  const m = MODULOS.find(m => podeVer(user, m.id));
  return m ? m.path : null;
}

// ── Modo Visitante ─────────────────────────────────────────────────────────
// Restrição por MÁQUINA/SESSÃO (não mais um flag global): quando Jocení/Jeyse/Márcio
// ativam o Modo Visitante, só a própria sessão deles é trocada pela conta 'visitante'
// (leitura em Pedidos/Produção). Todo mundo logado em outras máquinas continua vendo
// exatamente os módulos já configurados para cada um — nada muda para eles.
export const USUARIOS_MODO_VISITANTE = ['joceni', 'jeyse', 'marcio'];

// Únicos módulos que continuam visíveis (em leitura) para a conta 'visitante'
export const MODULOS_MODO_VISITANTE = ['pedidos', 'producao'];

// ── Conta compartilhada "visitante" ────────────────────────────────────────
// Ao ativar o Modo Visitante, Jocení/Jeyse/Márcio são deslogados automaticamente
// e o app já entra sozinho nesta conta fixa (sem precisar digitar nada), landando
// direto na tela restrita de Pedidos/Produção somente leitura.
// IMPORTANTE: a conta 'visitante' precisa existir de fato no Base44 (criada via
// "Criar conta" na tela de login, ou via convite em Gestão de Usuários) com essas
// permissões (acesso_pedidos: 'leitura', acesso_producao: 'leitura').
export const USUARIO_VISITANTE = 'visitante';
export const EMAIL_VISITANTE = usuarioParaEmailAlias(USUARIO_VISITANTE);
export const SENHA_VISITANTE = 'visitante';

// true quando a conta atualmente logada É a conta compartilhada 'visitante'
// (ou seja: esta máquina específica está em Modo Visitante agora).
export function ehContaVisitante(user) {
  if (!user) return false;
  return slugificarUsuario(user.nome_usuario) === USUARIO_VISITANTE;
}

export function podeAtivarModoVisitante(user) {
  if (!user) return false;
  const slug = slugificarUsuario(user.nome_usuario);
  return USUARIOS_MODO_VISITANTE.includes(slug);
}

// Status de presença a partir do timestamp de último acesso
export function statusPresenca(ultimoAcessoISO) {
  if (!ultimoAcessoISO) return { status: 'offline', label: 'Offline' };
  const diffMs = Date.now() - new Date(ultimoAcessoISO).getTime();
  const diffMin = diffMs / 60000;
  if (diffMin < 2) return { status: 'online', label: 'Online' };
  if (diffMin < 15) return { status: 'ausente', label: `Ausente há ${Math.round(diffMin)} min` };
  if (diffMin < 60) return { status: 'offline', label: `Online há ${Math.round(diffMin)} min` };
  const diffH = diffMin / 60;
  if (diffH < 24) return { status: 'offline', label: `Online há ${Math.round(diffH)}h` };
  return { status: 'offline', label: 'Offline' };
}

export function presencaCor(status) {
  switch (status) {
    case 'online': return 'bg-green-500';
    case 'ausente': return 'bg-amber-500';
    default: return 'bg-gray-400';
  }
}
