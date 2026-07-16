import React, { createContext, useState, useContext, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { setCurrentUserForLog } from '@/lib/audit-log';
import { setCurrentUserForHistorico } from '@/lib/historico-pedido';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  // Mantidos por compatibilidade com componentes que ainda checam esses campos.
  // No Base44 eles vinham de configurações públicas do app; no Supabase não existem,
  // então simplificamos: nunca ficam "loading" e nunca têm erro de app.
  const [isLoadingPublicSettings] = useState(false);
  const [authError, setAuthError] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [appPublicSettings] = useState(null);

  // Busca o perfil completo (role, permissões acesso_*) da tabela `usuarios`,
  // que é criada automaticamente pelo trigger quando alguém se cadastra.
  const fetchUserProfile = async (authUser) => {
    if (!authUser) return null;

    const { data: profile, error } = await supabase
      .from('usuarios')
      .select('*')
      .eq('id', authUser.id)
      .single();

    if (error) {
      console.error('Erro ao buscar perfil do usuário:', error);
      // Mesmo sem perfil na tabela `usuarios`, devolve os dados básicos do auth
      // pra não travar o app — mas sem nenhuma permissão liberada.
      return { id: authUser.id, email: authUser.email };
    }

    return { id: authUser.id, email: authUser.email, ...profile };
  };

  const checkUserAuth = async () => {
    setIsLoadingAuth(true);
    setAuthError(null);
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error) throw error;

      if (session?.user) {
        const fullUser = await fetchUserProfile(session.user);
        setUser(fullUser);
        setCurrentUserForLog(fullUser);
        setCurrentUserForHistorico(fullUser);
        setIsAuthenticated(true);
      } else {
        setUser(null);
        setIsAuthenticated(false);
      }
    } catch (error) {
      console.error('Falha ao checar autenticação:', error);
      setUser(null);
      setIsAuthenticated(false);
      setAuthError({ type: 'unknown', message: error.message || 'Erro ao verificar autenticação' });
    } finally {
      setIsLoadingAuth(false);
      setAuthChecked(true);
    }
  };

  // Mantido só por compatibilidade de nome com o código antigo (App.jsx, etc.
  // podem chamar checkAppState() no lugar de checkUserAuth()).
  const checkAppState = () => checkUserAuth();

  useEffect(() => {
    checkUserAuth();

    // Escuta mudanças de sessão em tempo real (login, logout, token renovado
    // em outra aba, etc.) e mantém o estado do app sincronizado.
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      checkUserAuth();
    });

    return () => {
      listener?.subscription?.unsubscribe();
    };
  }, []);

  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setIsAuthenticated(false);
    window.location.href = '/login';
  };

  const navigateToLogin = () => {
    window.location.href = '/login';
  };

  // Heartbeat: atualiza ultimo_acesso periodicamente para status de presença
  useEffect(() => {
    if (!user?.id) return;

    const atualizarPresenca = () =>
      supabase
        .from('usuarios')
        .update({ ultimo_acesso: new Date().toISOString() })
        .eq('id', user.id)
        .then(() => {})
        .catch(() => {});

    atualizarPresenca();
    const interval = setInterval(atualizarPresenca, 90000);
    const onFocus = () => atualizarPresenca();
    window.addEventListener('focus', onFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', onFocus);
    };
  }, [user?.id]);

  return (
    <AuthContext.Provider value={{
      user,
      isAuthenticated,
      isLoadingAuth,
      isLoadingPublicSettings,
      authError,
      appPublicSettings,
      authChecked,
      logout,
      navigateToLogin,
      checkUserAuth,
      checkAppState
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
