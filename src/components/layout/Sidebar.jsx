import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ShoppingCart, Printer, Shield, Bell, Menu, X, Truck, LogOut, ShoppingBag, Eye, EyeOff, Glasses } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { useModoVisitante } from '@/lib/ModoVisitanteContext';
import { useToast } from '@/components/ui/use-toast';
import { podeVer, statusPresenca, presencaCor, ehContaVisitante, EMAIL_VISITANTE, SENHA_VISITANTE } from '@/lib/permissoes';

const navItems = [
  { label: 'Pedidos Loja / WhatsApp', path: '/', icon: ShoppingCart, moduloId: 'pedidos' },
  { label: 'Produção (DTF e Sublimação)', path: '/impressoes', icon: Printer, moduloId: 'producao' },
  { label: 'LOGÍSTICA TESTE', path: '/logistica', icon: Truck, moduloId: 'logistica' },
  { label: 'Administrativo / Executivo', path: '/admin', icon: Shield, moduloId: 'administrativo' },
  { label: 'Gestão Ecommerce', path: '/ecommerce', icon: ShoppingBag, moduloId: 'ecommerce' },
];

export default function Sidebar({ mobileOpen, setMobileOpen }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout, checkUserAuth } = useAuth();
  const { podeAtivar, ativadoPor, ativar, desativar } = useModoVisitante();
  const { toast } = useToast();
  const visitante = ehContaVisitante(user);

  const itensVisiveis = navItems.filter(item => podeVer(user, item.moduloId));

  const [ativando, setAtivando] = useState(false);
  const [desativarOpen, setDesativarOpen] = useState(false);
  const [desativando, setDesativando] = useState(false);
  const [usuarioInput, setUsuarioInput] = useState('');
  const [senhaInput, setSenhaInput] = useState('');
  const [showSenha, setShowSenha] = useState(false);
  const [erroDesativar, setErroDesativar] = useState('');

  const fecharDesativarDialog = () => {
    setDesativarOpen(false);
    // Nunca mantém usuário/senha digitados em memória após fechar o diálogo
    setUsuarioInput('');
    setSenhaInput('');
    setShowSenha(false);
    setErroDesativar('');
  };

  const handleAtivar = async () => {
    setAtivando(true);
    try {
      // 1) Ativa o Modo Visitante globalmente (ainda autenticado como Jocení/Jeyse/Márcio,
      //    é essa sessão que prova a autorização — igual já funcionava antes).
      await ativar();

      // 2) Encerra a sessão atual neste computador...
      await logout(false);

      // 3) ...e entra sozinho na conta fixa "visitante" (somente leitura em Pedidos/Produção),
      //    sem exigir que ninguém digite usuário/senha na tela seguinte.
      await base44.auth.loginViaEmailPassword(EMAIL_VISITANTE, SENHA_VISITANTE);
      await checkUserAuth();
      navigate('/');
    } catch (err) {
      toast({ title: 'Não foi possível ativar', description: err.message || 'Tente novamente.', variant: 'destructive' });
    }
    setAtivando(false);
  };

  const handleConfirmarDesativar = async (e) => {
    e.preventDefault();
    setErroDesativar('');
    setDesativando(true);
    try {
      await desativar({ usuario: usuarioInput, senha: senhaInput });
      await checkUserAuth(); // atualiza a sessão para refletir quem acabou de se autenticar
      toast({ title: 'Modo Visitante desativado', description: 'O acesso normal aos módulos foi restabelecido.' });
      fecharDesativarDialog();
    } catch (err) {
      setErroDesativar(err.message || 'Não foi possível desativar. Tente novamente.');
    }
    setDesativando(false);
  };

  const SidebarContent = () => (
    <div className="flex flex-col h-full bg-sidebar text-sidebar-foreground">
      <div className="p-5 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-primary rounded-lg flex items-center justify-center text-lg">
            🖨️
          </div>
          <div>
            <h1 className="font-bold text-sm text-white">Sublima Mais</h1>
            <p className="text-[11px] text-sidebar-foreground/60">Produtos para Sublimação</p>
          </div>
        </div>
      </div>

      {visitante && (
        <div className="mx-3 mt-3 flex items-start gap-2 rounded-lg border border-amber-400/40 bg-amber-400/10 px-3 py-2">
          <Glasses className="w-4 h-4 text-amber-300 flex-shrink-0 mt-0.5" />
          <p className="text-[11px] leading-snug text-amber-200">
            Modo Visitante ativo nesta máquina{ativadoPor ? ` (por ${ativadoPor})` : ''} — só leitura, demais módulos ocultos.
          </p>
        </div>
      )}

      <nav className="flex-1 p-3 space-y-1">
        {itensVisiveis.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              onClick={() => setMobileOpen(false)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                isActive
                  ? 'bg-primary text-primary-foreground shadow-md'
                  : 'text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent'
              }`}
            >
              <item.icon className="w-4 h-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {visitante ? (
        // Visível só quando ESTA sessão é a conta compartilhada 'visitante' — ou seja,
        // só na máquina que está de fato em Modo Visitante agora.
        <div className="px-4 pb-1">
          <Button
            variant="outline"
            size="sm"
            className="w-full h-8 text-xs border-amber-400/40 text-amber-300 hover:bg-amber-400/10 hover:text-amber-200"
            onClick={() => setDesativarOpen(true)}
          >
            <EyeOff className="w-3.5 h-3.5 mr-1.5" /> Desativar Modo Visitante
          </Button>
        </div>
      ) : podeAtivar ? (
        // Só Jocení/Jeyse/Márcio podem ativar, e só afeta a própria máquina deles
        <div className="px-4 pb-1">
          <Button
            variant="outline"
            size="sm"
            className="w-full h-8 text-xs text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent"
            onClick={handleAtivar}
            disabled={ativando}
          >
            <Eye className="w-3.5 h-3.5 mr-1.5" /> {ativando ? 'Ativando...' : 'Ativar Modo Visitante'}
          </Button>
        </div>
      ) : null}

      <div className="p-4 border-t border-sidebar-border space-y-3">
        {user && (() => {
          const presenca = statusPresenca(user.ultimo_acesso);
          return (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${presencaCor(presenca.status)}`} title={presenca.label} />
                <p className="text-xs text-sidebar-foreground/70 truncate">{user.nome_usuario || user.full_name || 'Usuário'}</p>
              </div>
              <button onClick={() => logout()} className="text-sidebar-foreground/50 hover:text-red-400 transition-colors" title="Sair">
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })()}
        <div className="flex items-center justify-between">
          <p className="text-[11px] text-sidebar-foreground/40">© 2026 Sublima Mais</p>
          <div className="relative">
            <Button variant="ghost" className="relative h-8 w-8 text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent">
              <Bell className="w-4 h-4" />
              <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 rounded-full text-[10px] font-bold flex items-center justify-center px-1 bg-amber-400 text-white">
                1
              </span>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <div className="hidden lg:block fixed left-0 top-0 bottom-0 w-64 z-30">
        <SidebarContent />
      </div>

      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 h-14 bg-card border-b border-border flex items-center px-4 z-40">
        <Button variant="ghost" size="icon" onClick={() => setMobileOpen(true)}>
          <Menu className="w-5 h-5" />
        </Button>
        <span className="ml-3 font-bold text-sm">Sublima Mais</span>
      </div>

      {/* Mobile Overlay */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
          <div className="absolute left-0 top-0 bottom-0 w-64">
            <SidebarContent />
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-3 right-3 text-white hover:bg-sidebar-accent"
              onClick={() => setMobileOpen(false)}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Diálogo de confirmação para desativar o Modo Visitante — renderizado uma única vez
          (fora do SidebarContent) para não duplicar o modal entre as versões desktop/mobile. */}
      <Dialog open={desativarOpen} onOpenChange={(open) => { if (!open) fecharDesativarDialog(); else setDesativarOpen(true); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Desativar Modo Visitante</DialogTitle>
            <DialogDescription>
              Confirme digitando o usuário e a senha de um dos responsáveis autorizados (Jocení, Jeyse ou Márcio).
              Os campos abaixo começam sempre vazios — nada fica salvo ou pré-preenchido.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleConfirmarDesativar} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Usuário</Label>
              <Input
                value={usuarioInput}
                onChange={(e) => setUsuarioInput(e.target.value)}
                placeholder="seu nome de usuário"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label>Senha</Label>
              <div className="relative">
                <Input
                  type={showSenha ? 'text' : 'password'}
                  value={senhaInput}
                  onChange={(e) => setSenhaInput(e.target.value)}
                  placeholder="••••••••••"
                  autoComplete="off"
                  className="pr-10"
                  required
                />
                <button type="button" onClick={() => setShowSenha(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  {showSenha ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            {erroDesativar && <p className="text-sm text-red-600 font-medium">{erroDesativar}</p>}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={fecharDesativarDialog}>Cancelar</Button>
              <Button type="submit" disabled={desativando}>{desativando ? 'Confirmando...' : 'Confirmar e desativar'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
