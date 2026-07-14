import React, { useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { KeyRound } from 'lucide-react';

export default function RedefinirSenha() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const resetToken = searchParams.get('token') || searchParams.get('reset_token') || '';
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmar, setConfirmar] = useState('');
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState(false);
  const [carregando, setCarregando] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErro('');
    if (novaSenha.length < 8) { setErro('A senha precisa ter pelo menos 8 caracteres.'); return; }
    if (novaSenha !== confirmar) { setErro('As senhas não coincidem.'); return; }
    if (!resetToken) { setErro('Link inválido ou expirado. Solicite uma nova redefinição.'); return; }
    setCarregando(true);
    try {
      await base44.auth.resetPassword({ resetToken, newPassword: novaSenha });
      setSucesso(true);
    } catch (err) {
      setErro('Não foi possível redefinir a senha. O link pode ter expirado — solicite um novo.');
    }
    setCarregando(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <div className="w-14 h-14 bg-primary rounded-2xl flex items-center justify-center mx-auto mb-3">
            <KeyRound className="w-7 h-7 text-white" />
          </div>
          <h2 className="text-xl font-bold">Nova Senha</h2>
          <p className="text-sm text-muted-foreground">Defina uma nova senha de acesso</p>
        </div>

        <div className="bg-card border rounded-2xl p-6 shadow-sm">
          {sucesso ? (
            <div className="space-y-4 text-center">
              <p className="text-sm text-green-700">Senha redefinida com sucesso!</p>
              <Button className="w-full" onClick={() => navigate('/login')}>Ir para o login</Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label>Nova senha</Label>
                <Input type="password" value={novaSenha} onChange={e => setNovaSenha(e.target.value)} placeholder="mínimo 8 caracteres" required />
              </div>
              <div className="space-y-1.5">
                <Label>Confirme a nova senha</Label>
                <Input type="password" value={confirmar} onChange={e => setConfirmar(e.target.value)} placeholder="repita a senha" required />
              </div>
              {erro && <p className="text-sm text-red-600 font-medium">{erro}</p>}
              <Button type="submit" className="w-full" disabled={carregando}>{carregando ? 'Salvando...' : 'Redefinir senha'}</Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
