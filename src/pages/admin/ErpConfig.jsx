import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Settings, Building2, Bell, Palette, CheckCircle } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

export default function ErpConfig({ readOnly = false }) {
  const { toast } = useToast();
  const [empresa, setEmpresa] = useState({ nome: 'Sublimamais', cnpj: '', telefone: '', email: '', endereco: '', cidade: '', uf: 'PB', cep: '' });
  const [notif, setNotif] = useState({ estoque_minimo: true, pedido_novo: true, conta_vencida: true, cliente_inativo: false });
  const [sistema, setSistema] = useState({ moeda: 'BRL', estoque_min_padrao: '5', desconto_pix: '5' });
  const [pix, setPix] = useState({ chave: '', tipo_chave: 'CPF', nome_recebedor: 'Sublima Mais' });

  const salvar = (secao) => toast({ title: `${secao} salvo!`, description: 'Configurações atualizadas com sucesso.' });

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 bg-slate-600 rounded-xl flex items-center justify-center">
          <Settings className="w-5 h-5 text-white" />
        </div>
        <div>
          <h2 className="text-lg font-bold">Configurações do Sistema</h2>
          <p className="text-sm text-muted-foreground">Personalize o ERP conforme sua empresa</p>
        </div>
      </div>

      <Tabs defaultValue="empresa">
        <TabsList>
          <TabsTrigger value="empresa"><Building2 className="w-4 h-4 mr-1" />Empresa</TabsTrigger>
          <TabsTrigger value="sistema"><Settings className="w-4 h-4 mr-1" />Sistema</TabsTrigger>
          <TabsTrigger value="notif"><Bell className="w-4 h-4 mr-1" />Notificações</TabsTrigger>
        </TabsList>

        <TabsContent value="empresa" className="mt-4">
          <Card className="p-5 space-y-4 max-w-lg">
            <h3 className="font-semibold">Dados da Empresa</h3>
            <div className="space-y-1.5"><Label>Nome / Razão Social</Label><Input value={empresa.nome} onChange={e => setEmpresa({ ...empresa, nome: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>CNPJ</Label><Input value={empresa.cnpj} onChange={e => setEmpresa({ ...empresa, cnpj: e.target.value })} placeholder="00.000.000/0001-00" /></div>
              <div className="space-y-1.5"><Label>Telefone</Label><Input value={empresa.telefone} onChange={e => setEmpresa({ ...empresa, telefone: e.target.value })} /></div>
            </div>
            <div className="space-y-1.5"><Label>Email</Label><Input type="email" value={empresa.email} onChange={e => setEmpresa({ ...empresa, email: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Endereço</Label><Input value={empresa.endereco} onChange={e => setEmpresa({ ...empresa, endereco: e.target.value })} /></div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5 col-span-2"><Label>Cidade</Label><Input value={empresa.cidade} onChange={e => setEmpresa({ ...empresa, cidade: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>UF</Label><Input value={empresa.uf} onChange={e => setEmpresa({ ...empresa, uf: e.target.value })} maxLength={2} /></div>
            </div>
            <Button onClick={() => salvar('Dados da empresa')} disabled={readOnly}><CheckCircle className="w-4 h-4 mr-1" />Salvar</Button>
          </Card>
        </TabsContent>

        <TabsContent value="sistema" className="mt-4">
          <Card className="p-5 space-y-4 max-w-lg">
            <h3 className="font-semibold">Pagamento PIX</h3>
            <div className="space-y-1.5"><Label>Tipo de Chave PIX</Label>
              <Select value={pix.tipo_chave} onValueChange={v => setPix({ ...pix, tipo_chave: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="CPF">CPF</SelectItem>
                  <SelectItem value="CNPJ">CNPJ</SelectItem>
                  <SelectItem value="EMAIL">E-mail</SelectItem>
                  <SelectItem value="TELEFONE">Telefone</SelectItem>
                  <SelectItem value="ALEATORIA">Chave Aleatória</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label>Chave PIX</Label><Input value={pix.chave} onChange={e => setPix({ ...pix, chave: e.target.value })} placeholder="Informe a chave PIX" /></div>
            <div className="space-y-1.5"><Label>Nome do Recebedor</Label><Input value={pix.nome_recebedor} onChange={e => setPix({ ...pix, nome_recebedor: e.target.value })} /></div>
            <Button onClick={() => salvar('PIX')} disabled={readOnly}><CheckCircle className="w-4 h-4 mr-1" />Salvar PIX</Button>
            <hr className="my-2" />
            <h3 className="font-semibold">Configurações do Sistema</h3>
            <div className="space-y-1.5"><Label>Estoque Mínimo Padrão (unidades)</Label><Input type="number" value={sistema.estoque_min_padrao} onChange={e => setSistema({ ...sistema, estoque_min_padrao: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Desconto Automático PIX/Dinheiro (%)</Label><Input type="number" value={sistema.desconto_pix} onChange={e => setSistema({ ...sistema, desconto_pix: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Moeda</Label>
              <Select value={sistema.moeda} onValueChange={v => setSistema({ ...sistema, moeda: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="BRL">BRL — Real</SelectItem><SelectItem value="USD">USD — Dólar</SelectItem></SelectContent>
              </Select>
            </div>
            <Button onClick={() => salvar('Configurações do sistema')} disabled={readOnly}><CheckCircle className="w-4 h-4 mr-1" />Salvar</Button>
          </Card>
        </TabsContent>

        <TabsContent value="notif" className="mt-4">
          <Card className="p-5 max-w-lg">
            <h3 className="font-semibold mb-4">Alertas e Notificações</h3>
            <div className="space-y-3">
              {[
                { key: 'estoque_minimo', label: 'Alerta de estoque mínimo' },
                { key: 'pedido_novo', label: 'Novo pedido recebido' },
                { key: 'conta_vencida', label: 'Conta vencida' },
                { key: 'cliente_inativo', label: 'Cliente sem compras (60+ dias)' },
              ].map(n => (
                <div key={n.key} className="flex items-center justify-between py-2 border-b last:border-0">
                  <span className="text-sm">{n.label}</span>
                  <button
                    onClick={() => setNotif({ ...notif, [n.key]: !notif[n.key] })}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${notif[n.key] ? 'bg-primary' : 'bg-muted'}`}
                  >
                    <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${notif[n.key] ? 'translate-x-4' : 'translate-x-0.5'}`} />
                  </button>
                </div>
              ))}
            </div>
            <Button className="mt-4" onClick={() => salvar('Notificações')} disabled={readOnly}><CheckCircle className="w-4 h-4 mr-1" />Salvar</Button>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}