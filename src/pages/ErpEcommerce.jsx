import React, { useState } from 'react';
import { ShoppingBag, ExternalLink, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

const ECOMMERCE_URL = 'https://sublimamaisonline.lovable.app/admin';

export default function ErpEcommerce() {
  const [loadError, setLoadError] = useState(false);
  const [loading, setLoading] = useState(true);

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)] lg:h-[calc(100vh-2rem)]">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 bg-primary rounded-lg flex items-center justify-center">
            <ShoppingBag className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="font-bold text-base">Gestão Ecommerce</h1>
            <p className="text-xs text-muted-foreground">Painel administrativo da loja online</p>
          </div>
        </div>
        <a href={ECOMMERCE_URL} target="_blank" rel="noopener noreferrer">
          <Button variant="outline" size="sm">
            <ExternalLink className="w-3.5 h-3.5 mr-1" /> Abrir em nova guia
          </Button>
        </a>
      </div>

      <div className="flex-1 rounded-lg border bg-card overflow-hidden relative">
        {loading && !loadError && (
          <div className="absolute inset-0 flex items-center justify-center bg-card">
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-4 border-slate-200 border-t-primary rounded-full animate-spin"></div>
              <p className="text-sm text-muted-foreground">Carregando painel...</p>
            </div>
          </div>
        )}

        {loadError ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-6">
            <div className="w-14 h-14 bg-amber-100 rounded-2xl flex items-center justify-center mb-4">
              <AlertTriangle className="w-7 h-7 text-amber-600" />
            </div>
            <h2 className="text-lg font-bold">Conteúdo não incorporável</h2>
            <p className="text-sm text-muted-foreground max-w-md mt-1">
              O painel do e-commerce não pôde ser carregado diretamente aqui. Isso pode ocorrer por restrições de segurança do servidor de destino.
            </p>
            <a href={ECOMMERCE_URL} target="_blank" rel="noopener noreferrer" className="mt-5">
              <Button>
                <ExternalLink className="w-4 h-4 mr-2" /> Abrir em nova guia
              </Button>
            </a>
            <button
              onClick={() => { setLoadError(false); setLoading(true); }}
              className="mt-3 text-sm text-muted-foreground hover:text-foreground underline"
            >
              Tentar novamente
            </button>
          </div>
        ) : (
          <iframe
            src={ECOMMERCE_URL}
            title="Gestão Ecommerce"
            className="w-full h-full border-0"
            onLoad={() => setLoading(false)}
            onError={() => { setLoadError(true); setLoading(false); }}
            sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox allow-downloads allow-modals"
            referrerPolicy="no-referrer-when-downgrade"
          />
        )}
      </div>
    </div>
  );
}