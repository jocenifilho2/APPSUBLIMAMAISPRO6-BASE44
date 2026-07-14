import React, { useEffect } from 'react';
import confetti from 'canvas-confetti';
import { X, Star } from 'lucide-react';
import { limparVariacaoNome } from '@/lib/cliente-helpers';

export default function EntregueModal({ open, onClose, pedido }) {
  useEffect(() => {
    if (!open) return;
    confetti({ particleCount: 80, spread: 60, origin: { y: 0.6 }, colors: ['#FFD700', '#FF6B35', '#F7931E'] });
    if (navigator.vibrate) navigator.vibrate([300, 100, 300, 100, 300]);
    const timer = setTimeout(onClose, 5000);
    return () => clearTimeout(timer);
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.88)', backdropFilter: 'blur(6px)', animation: 'prontoFade 0.3s ease-out' }}
    >
      <style>{`@keyframes prontoFade { from { opacity:0; transform:scale(0.95); } to { opacity:1; transform:scale(1); } }`}</style>
      <button onClick={onClose} className="absolute top-5 right-5 text-white/70 hover:text-white transition-colors">
        <X className="w-9 h-9" />
      </button>
      <div className="text-center max-w-md w-full">
        <div className="w-24 h-24 rounded-full bg-yellow-400 flex items-center justify-center mx-auto mb-5 shadow-lg shadow-yellow-400/40">
          <Star className="w-12 h-12 text-white fill-white" />
        </div>
        <h1 className="text-3xl font-black text-white mb-2">Entregue! 🎉</h1>
        <p className="text-xl text-white/90 mb-2">Tudo certo! Lhe aguardamos nos próximos pedidos. 😃</p>
        {pedido && (
          <p className="text-white/50 font-mono text-sm mb-6">
            #{pedido.numero_pedido} — {limparVariacaoNome(pedido.cliente) || pedido.cliente}
          </p>
        )}
        <button onClick={onClose}
          className="bg-primary hover:bg-primary/80 text-white px-8 py-3 rounded-xl font-bold text-base transition-colors">
          Fechar
        </button>
        <p className="text-white/30 text-xs mt-3">Fecha automaticamente em 5 segundos</p>
      </div>
    </div>
  );
}