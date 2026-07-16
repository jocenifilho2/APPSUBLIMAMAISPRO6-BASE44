import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, useLocation } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import { ModoVisitanteProvider } from '@/lib/ModoVisitanteContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import AppLayout from './components/layout/AppLayout';
import Pedidos from './pages/Pedidos';
import GestaoImpressoes from './pages/GestaoImpressoes';

import AcessoAdministrativo from './pages/AcessoAdministrativo';
import Acompanhamento from './pages/Acompanhamento';
import ErpLogisticaPage from './pages/ErpLogisticaPage';
import Login from './pages/Login';
import RedefinirSenha from './pages/RedefinirSenha';
import ErpEcommerce from './pages/ErpEcommerce';
import ModuloGate from './components/ModuloGate';

// Rotas que precisam funcionar mesmo sem sessão/login (ex: link público enviado ao cliente)
const PUBLIC_ROUTE_PREFIXES = ['/acompanhamento/', '/redefinir-senha'];

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, isAuthenticated } = useAuth();
  const location = useLocation();

  const isPublicRoute = PUBLIC_ROUTE_PREFIXES.some((prefix) => location.pathname.startsWith(prefix));

  // Rotas públicas (ex: acompanhamento de pedido) nunca ficam presas em loading/telas de login,
  // pois precisam funcionar para visitantes sem sessão autenticada.
  if (isPublicRoute) {
    return (
      <Routes>
        <Route path="/redefinir-senha" element={<RedefinirSenha />} />
        <Route path="/acompanhamento/:token" element={<Acompanhamento />} />
        <Route path="*" element={<PageNotFound />} />
      </Routes>
    );
  }

  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (authError?.type === 'user_not_registered') {
    return <UserNotRegisteredError />;
  }

  if (!isAuthenticated) {
    return (
      <Routes>
        <Route path="/redefinir-senha" element={<RedefinirSenha />} />
        <Route path="*" element={<Login />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<ModuloGate moduloId="pedidos"><Pedidos /></ModuloGate>} />
        <Route path="/impressoes" element={<ModuloGate moduloId="producao"><GestaoImpressoes /></ModuloGate>} />

        <Route path="/admin" element={<ModuloGate moduloId="administrativo"><AcessoAdministrativo /></ModuloGate>} />
        <Route path="/ecommerce" element={<ModuloGate moduloId="ecommerce"><ErpEcommerce /></ModuloGate>} />
        <Route path="/logistica" element={<ModuloGate moduloId="logistica"><ErpLogisticaPage /></ModuloGate>} />
      </Route>
      <Route path="/redefinir-senha" element={<RedefinirSenha />} />
      <Route path="/acompanhamento/:token" element={<Acompanhamento />} />
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};

function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <ModoVisitanteProvider>
          <Router>
            <AuthenticatedApp />
          </Router>
          <Toaster />
        </ModoVisitanteProvider>
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App