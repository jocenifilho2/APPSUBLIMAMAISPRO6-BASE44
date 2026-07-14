import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { UserCog, UserPlus } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { MODULOS, statusPresenca, presencaCor, usuarioParaEmailAlias } from '@/lib/permissoes';
import { registrarLog } from '@/lib/audit-log';

const STATUS_DOT = {
  online: 'bg-green-500',
  ausente: 'bg-amber-500',
  offline: 'bg-gray-400',
};

export default function ErpUsuarios({ readOnly = false }) {
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteUsuario, setInviteUsuario] = useState('');
  const [inviteRole, setInviteRole] = useState('user');
  const [inviting, setInviting] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: () => base44.entities.User.list(),
    refetchInterval: 15000,
  });

  const updatePermMut = useMutation({
    mutationFn: ({ id, data }) => base44.entities.User.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['users'] }),
  });

  const handleInvite = async (e) => {
    e.preventDefault();
    if (!inviteUsuario.trim()) { toast({ title: 'Erro', description: 'Digite um nome de usuário.', variant: 'destructive' }); return; }
    setInviting(true);
    try {
      const email = usuarioParaEmailAlias(inviteUsuario);
      await base44.users.inviteUser(email, inviteRole);
      toast({ title: 'Convite enviado!', description: `Convite enviado para ${inviteUsuario}.` });
      setInviteOpen(false);
      setInviteUsuario('');
    } catch (err) {
      toast({ title: 'Erro', description: 'Não foi possível enviar o convite.', variant: 'destructive' });
    }
    setInviting(false);
  };

  const handlePermChange = (userId, campo, valor, nomeUsuario) => {
    updatePermMut.mutate({ id: userId, data: { [campo]: valor } });
    registrarLog({ acao: 'EDITAR', entidade: 'User', entidade_id: userId, detalhes: `Permissão ${campo} → ${valor} (${nomeUsuario})` });
  };

  const online = users.filter(u => statusPresenca(u.ultimo_acesso).status === 'online').length;
  const ausente = users.filter(u => statusPresenca(u.ultimo_acesso).status === 'ausente').length;
  const offline = users.filter(u => statusPresenca(u.ultimo_acesso).status === 'offline').length;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2"><UserCog className="w-5 h-5 text-primary" />Usuários do Sistema</h2>
          <p className="text-sm text-muted-foreground">Controle de acesso, permissões e presença</p>
        </div>
        {!readOnly && <Button size="sm" onClick={() => setInviteOpen(true)}>
          <UserPlus className="w-4 h-4 mr-1" />Convidar Usuário
        </Button>}
      </div>

      <div className="grid grid-cols-4 gap-3">
        <Card className="p-4"><p className="text-xs text-muted-foreground">Total</p><p className="text-2xl font-bold">{users.length}</p></Card>
        <Card className="p-4"><div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-green-500" /><p className="text-xs text-muted-foreground">Online</p></div><p className="text-2xl font-bold text-green-600">{online}</p></Card>
        <Card className="p-4"><div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-amber-500" /><p className="text-xs text-muted-foreground">Ausente</p></div><p className="text-2xl font-bold text-amber-600">{ausente}</p></Card>
        <Card className="p-4"><div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-gray-400" /><p className="text-xs text-muted-foreground">Offline</p></div><p className="text-2xl font-bold text-gray-500">{offline}</p></Card>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-32"><div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" /></div>
      ) : (
        <Card className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="min-w-[160px]">Usuário</TableHead>
                <TableHead className="min-w-[120px]">Status</TableHead>
                {MODULOS.map(m => <TableHead key={m.id} className="text-center text-xs whitespace-nowrap">{m.label.split(' ')[0]}</TableHead>)}
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map(u => {
                const presenca = statusPresenca(u.ultimo_acesso);
                const nome = u.nome_usuario || u.full_name || 'Usuário';
                return (
                  <TableRow key={u.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                          {nome.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium text-sm">{nome}</p>
                          {u.role === 'admin' && <Badge className="text-[10px] bg-red-100 text-red-700">Admin</Badge>}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className={`w-2.5 h-2.5 rounded-full ${STATUS_DOT[presenca.status]}`} />
                        <span className="text-xs">{presenca.label}</span>
                      </div>
                    </TableCell>
                    {MODULOS.map(m => {
                      const nivel = u[m.campo] || 'nenhum';
                      return (
                        <TableCell key={m.id} className="text-center">
                          <Select value={nivel} onValueChange={v => handlePermChange(u.id, m.campo, v, nome)} disabled={readOnly}>
                            <SelectTrigger className="h-7 text-xs w-24 mx-auto"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="nenhum">—</SelectItem>
                              <SelectItem value="leitura">Leitura</SelectItem>
                              <SelectItem value="edicao">Edição</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                      );
                    })}
                  </TableRow>
                );
              })}
              {users.length === 0 && <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Nenhum usuário</TableCell></TableRow>}
            </TableBody>
          </Table>
        </Card>
      )}

      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Convidar Usuário</DialogTitle></DialogHeader>
          <form onSubmit={handleInvite} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Nome de usuário</Label>
              <Input value={inviteUsuario} onChange={e => setInviteUsuario(e.target.value)} required placeholder="ex: Jocení" />
              <p className="text-xs text-muted-foreground">O convite será enviado para o e-mail administrativo do sistema.</p>
            </div>
            <div className="space-y-1.5"><Label>Função</Label>
              <Select value={inviteRole} onValueChange={setInviteRole}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">Usuário</SelectItem>
                  <SelectItem value="admin">Administrador</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => setInviteOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={inviting}>{inviting ? 'Enviando...' : 'Enviar Convite'}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}