import React, { useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Lock, Eye, EyeOff, ArrowLeft } from 'lucide-react';
import { usuarioParaEmailAlias } from '@/lib/permissoes';

export default function Login() {
  const [modo, setModo] = useState('login'); // login | esqueci | esqueci-enviado
  const [usuario, setUsuario] = useState('');
  const [senha, setSenha] = useState('');
  const [showSenha, setShowSenha] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState('');

  const reset = () => { setErro(''); setSenha(''); };

  const handleLogin = async (e) => {
    e.preventDefault();
    setErro(''); setCarregando(true);
    try {
      const email = usuarioParaEmailAlias(usuario);
      const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
      if (error) throw error;
      window.location.href = '/';
    } catch (err) {
      setErro('Usuário ou senha inválidos.');
    }
    setCarregando(false);
  };

  const handleEsqueciSenha = async (e) => {
    e.preventDefault();
    setErro(''); setCarregando(true);
    try {
      const email = usuarioParaEmailAlias(usuario);
      // O link de redefinição cai na caixa compartilhada (adm.sublimamaispb@gmail.com),
      // igual funcionava no Base44 — quem tem acesso a esse e-mail repassa pro usuário.
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/redefinir-senha`
      });
      if (error) throw error;
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
            <Lock className="w-7 h-7 text-white" />
          </div>
          <h2 className="text-xl font-bold">Sublima Mais PRO</h2>
          <p className="text-sm text-muted-foreground">
            {modo === 'login' && 'Digite suas credenciais para continuar'}
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
              <div className="flex justify-end text-xs pt-1">
                <button type="button" className="text-muted-foreground" onClick={() => { setModo('esqueci'); reset(); }}>Esqueci minha senha</button>
              </div>
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
