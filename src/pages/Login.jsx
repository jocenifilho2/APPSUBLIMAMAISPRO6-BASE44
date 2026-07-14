import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Lock, Eye, EyeOff, Factory, ArrowLeft } from 'lucide-react';
import { usuarioParaEmailAlias, perfilInicialPara } from '@/lib/permissoes';

export default function Login() {
  const [modo, setModo] = useState('login'); // login | cadastro | cadastro-otp | esqueci | esqueci-enviado
  const [usuario, setUsuario] = useState('');
  const [senha, setSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [otp, setOtp] = useState('');
  const [showSenha, setShowSenha] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState('');

  const reset = () => { setErro(''); setSenha(''); setConfirmarSenha(''); setOtp(''); };

  const handleLogin = async (e) => {
    e.preventDefault();
    setErro(''); setCarregando(true);
    try {
      const email = usuarioParaEmailAlias(usuario);
      await base44.auth.loginViaEmailPassword(email, senha);
      window.location.href = '/';
    } catch (err) {
      setErro('Usuário ou senha inválidos.');
    }
    setCarregando(false);
  };

  const handleCadastro = async (e) => {
    e.preventDefault();
    setErro('');
    if (!usuario.trim()) { setErro('Digite um nome de usuário.'); return; }
    if (senha.length < 8) { setErro('A senha precisa ter pelo menos 8 caracteres.'); return; }
    if (senha !== confirmarSenha) { setErro('As senhas não coincidem.'); return; }
    setCarregando(true);
    try {
      const email = usuarioParaEmailAlias(usuario);
      await base44.auth.register({ email, password: senha });
      setModo('cadastro-otp');
    } catch (err) {
      setErro(err?.message?.includes('exist') ? 'Esse usuário já existe. Tente entrar ou recuperar a senha.' : 'Não foi possível criar a conta. Tente novamente.');
    }
    setCarregando(false);
  };

  const handleConfirmarOtp = async (e) => {
    e.preventDefault();
    setErro(''); setCarregando(true);
    try {
      const email = usuarioParaEmailAlias(usuario);
      await base44.auth.verifyOtp({ email, otpCode: otp });
      await base44.auth.loginViaEmailPassword(email, senha);
      // Aplica o perfil de permissões inicial na própria conta, na primeira vez
      const perfil = perfilInicialPara(usuario);
      await base44.auth.updateMe({ nome_usuario: usuario, ...perfil, ultimo_acesso: new Date().toISOString() });
      window.location.href = '/';
    } catch (err) {
      setErro('Código inválido ou expirado. Confira com quem tem acesso ao e-mail administrativo.');
    }
    setCarregando(false);
  };

  const handleEsqueciSenha = async (e) => {
    e.preventDefault();
    setErro(''); setCarregando(true);
    try {
      const email = usuarioParaEmailAlias(usuario);
      await base44.auth.resetPasswordRequest(email);
      setModo('esqueci-enviado');
    } catch (err) {
      setErro('Não foi possível solicitar a redefinição. Confira o nome de usuário.');
    }
    setCarregando(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <div className="w-14 h-14 bg-primary rounded-2xl flex items-center justify-center mx-auto mb-3">
            {modo === 'login' ? <Lock className="w-7 h-7 text-white" /> : <Factory className="w-7 h-7 text-white" />}
          </div>
          <h2 className="text-xl font-bold">Sublima Mais PRO</h2>
          <p className="text-sm text-muted-foreground">
            {modo === 'login' && 'Digite suas credenciais para continuar'}
            {modo === 'cadastro' && 'Criar minha conta'}
            {modo === 'cadastro-otp' && 'Confirme seu cadastro'}
            {modo === 'esqueci' && 'Recuperar senha'}
            {modo === 'esqueci-enviado' && 'Verifique com o responsável'}
          </p>
        </div>

        <div className="bg-card border rounded-2xl p-6 shadow-sm space-y-4">

          {modo === 'login' && (
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-1.5">
                <Label>Usuário</Label>
                <Input value={usuario} onChange={e => setUsuario(e.target.value)} placeholder="seu nome de usuário" autoComplete="username" required />
              </div>
              <div className="space-y-1.5">
                <Label>Senha</Label>
                <div className="relative">
                  <Input type={showSenha ? 'text' : 'password'} value={senha} onChange={e => setSenha(e.target.value)} placeholder="••••••••••" required className="pr-10" autoComplete="current-password" />
                  <button type="button" onClick={() => setShowSenha(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    {showSenha ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              {erro && <p className="text-sm text-red-600 font-medium">{erro}</p>}
              <Button type="submit" className="w-full" disabled={carregando}>{carregando ? 'Entrando...' : 'Entrar'}</Button>
              <div className="flex justify-between text-xs pt-1">
                <button type="button" className="text-primary font-medium" onClick={() => { setModo('cadastro'); reset(); }}>Criar conta</button>
                <button type="button" className="text-muted-foreground" onClick={() => { setModo('esqueci'); reset(); }}>Esqueci minha senha</button>
              </div>
            </form>
          )}

          {modo === 'cadastro' && (
            <form onSubmit={handleCadastro} className="space-y-4">
              <div className="space-y-1.5">
                <Label>Escolha seu nome de usuário</Label>
                <Input value={usuario} onChange={e => setUsuario(e.target.value)} placeholder="ex: Jocení" autoComplete="off" required />
              </div>
              <div className="space-y-1.5">
                <Label>Crie sua senha</Label>
                <Input type={showSenha ? 'text' : 'password'} value={senha} onChange={e => setSenha(e.target.value)} placeholder="mínimo 8 caracteres" required autoComplete="new-password" />
              </div>
              <div className="space-y-1.5">
                <Label>Confirme sua senha</Label>
                <Input type={showSenha ? 'text' : 'password'} value={confirmarSenha} onChange={e => setConfirmarSenha(e.target.value)} placeholder="repita a senha" required autoComplete="new-password" />
              </div>
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <input type="checkbox" checked={showSenha} onChange={e => setShowSenha(e.target.checked)} /> Mostrar senha
              </label>
              {erro && <p className="text-sm text-red-600 font-medium">{erro}</p>}
              <Button type="submit" className="w-full" disabled={carregando}>{carregando ? 'Criando...' : 'Criar conta'}</Button>
              <button type="button" className="w-full text-xs text-muted-foreground flex items-center justify-center gap-1 pt-1" onClick={() => { setModo('login'); reset(); }}>
                <ArrowLeft className="w-3 h-3" />Voltar para o login
              </button>
            </form>
          )}

          {modo === 'cadastro-otp' && (
            <form onSubmit={handleConfirmarOtp} className="space-y-4">
              <p className="text-xs text-muted-foreground bg-blue-50 border border-blue-200 rounded-lg p-3">
                Foi enviado um código de confirmação para o e-mail administrativo do sistema. Peça pra quem tem acesso a ele (adm.sublimamaispb@gmail.com) te passar o código.
              </p>
              <div className="space-y-1.5">
                <Label>Código de confirmação</Label>
                <Input value={otp} onChange={e => setOtp(e.target.value)} placeholder="000000" required autoComplete="one-time-code" />
              </div>
              {erro && <p className="text-sm text-red-600 font-medium">{erro}</p>}
              <Button type="submit" className="w-full" disabled={carregando}>{carregando ? 'Confirmando...' : 'Confirmar e entrar'}</Button>
            </form>
          )}

          {modo === 'esqueci' && (
            <form onSubmit={handleEsqueciSenha} className="space-y-4">
              <div className="space-y-1.5">
                <Label>Seu nome de usuário</Label>
                <Input value={usuario} onChange={e => setUsuario(e.target.value)} placeholder="ex: Jocení" autoComplete="username" required />
              </div>
              {erro && <p className="text-sm text-red-600 font-medium">{erro}</p>}
              <Button type="submit" className="w-full" disabled={carregando}>{carregando ? 'Enviando...' : 'Enviar link de redefinição'}</Button>
              <button type="button" className="w-full text-xs text-muted-foreground flex items-center justify-center gap-1 pt-1" onClick={() => { setModo('login'); reset(); }}>
                <ArrowLeft className="w-3 h-3" />Voltar para o login
              </button>
            </form>
          )}

          {modo === 'esqueci-enviado' && (
            <div className="space-y-4 text-center">
              <p className="text-sm text-muted-foreground">
                Um link de redefinição de senha foi enviado para o e-mail administrativo do sistema (adm.sublimamaispb@gmail.com). Peça pra quem tem acesso a ele te repassar o link pra criar uma nova senha.
              </p>
              <Button variant="outline" className="w-full" onClick={() => { setModo('login'); reset(); }}>Voltar para o login</Button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
