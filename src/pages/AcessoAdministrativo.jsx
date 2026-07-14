import React, { useState } from 'react';
import {
  ShoppingCart, Layers, Users, DollarSign,
  UserCog, FileText, Settings, Factory, ScrollText
} from 'lucide-react';
import ErpPDV from './admin/ErpPDV';
import EstoqueERP from './admin/EstoqueERP';
import ErpCRM from './admin/ErpCRM';
import ErpFinanceiro from './admin/ErpFinanceiro';
import ErpUsuarios from './admin/ErpUsuarios';
import ErpLogs from './admin/ErpLogs';
import ErpNFe from './admin/ErpNFe';
import ErpConfig from './admin/ErpConfig';
import ErpDashboardOperacional from './admin/ErpDashboardOperacional';
import { useAuth } from '@/lib/AuthContext';
import { podeEditar } from '@/lib/permissoes';

const ALL_MODULES = [
  { id: 'dashboard_op', label: 'Dashboard Operacional', icon: Factory },
  { id: 'pdv', label: 'PDV', icon: ShoppingCart },
  { id: 'estoque', label: 'Estoque / ERP', icon: Layers },
  { id: 'crm', label: 'Clientes CRM', icon: Users },
  { id: 'financeiro', label: 'Financeiro', icon: DollarSign },
  { id: 'usuarios', label: 'Usuários', icon: UserCog },
  { id: 'logs', label: 'Log de Alterações', icon: ScrollText },
  { id: 'nfe', label: 'NF-e', icon: FileText },
  { id: 'config', label: 'Configurações', icon: Settings },
];

const MODULE_COMPONENTS = {
  dashboard_op: ErpDashboardOperacional,
  pdv: ErpPDV,
  estoque: EstoqueERP,
  crm: ErpCRM,
  financeiro: ErpFinanceiro,
  usuarios: ErpUsuarios,
  logs: ErpLogs,
  nfe: ErpNFe,
  config: ErpConfig,
};

export default function AcessoAdministrativo() {
  const { user } = useAuth();
  const [activeModule, setActiveModule] = useState('dashboard_op');
  const somenteLeitura = !podeEditar(user, 'administrativo');

  const ActiveComponent = MODULE_COMPONENTS[activeModule] || ErpFinanceiro;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-primary rounded-xl flex items-center justify-center">
            <Factory className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold">ERP Sublimamais</h1>
            <p className="text-xs text-muted-foreground">
              Sistema de Gestão Integrado{somenteLeitura ? ' · Somente leitura' : ''}
            </p>
          </div>
        </div>
      </div>

      <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
        {ALL_MODULES.map(mod => {
          const Icon = mod.icon;
          const isActive = activeModule === mod.id;
          return (
            <button
              key={mod.id}
              onClick={() => setActiveModule(mod.id)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all flex-shrink-0 border ${
                isActive
                  ? 'bg-primary text-primary-foreground shadow-md border-primary'
                  : 'bg-card text-muted-foreground hover:text-foreground hover:bg-muted border-border'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {mod.label}
            </button>
          );
        })}
      </div>

      <div className="min-h-[500px]">
        <ActiveComponent readOnly={somenteLeitura} />
      </div>
    </div>
  );
}