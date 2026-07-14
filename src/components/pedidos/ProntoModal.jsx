import React, { useEffect } from 'react';
import confetti from 'canvas-confetti';
import { X, CheckCircle } from 'lucide-react';
import { limparVariacaoNome } from '@/lib/cliente-helpers';

const MOTOBOYS = [
  { nome: 'Girlan', tel: '5583991487691' },
  { nome: 'Marcílio', tel: '5583986364410' },
  { nome: 'John', tel: '5583988066337' },
];

export default function ProntoModal({ open, onClose, pedido }) {
  useEffect(() => {
    if (!open) return;
    confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
    setTimeout(() => confetti({ particleCount: 60, spread: 50, origin: { y: 0.5, x: 0.3 } }), 700);
    setTimeout(() => confetti({ particleCount: 60, spread: 50, origin: { y: 0.5, x: 0.7 } }), 1000);
    if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
    const timer = setTimeout(onClose, 5000);
    return () => clearTimeout(timer);
  }, [open]);

  if (!open) return null;

  const handleMotoboy = (tel, nome) => {
    const itensTexto = pedido?.itens?.map(i => `• ${i.quantidade}x ${i.produto_nome}`).join('\n') || '';
    const msg = `Olá ${nome}. Tenho um pedido separado para retirada na Sublima Mais.\n${itensTexto}\nPode me confirmar a entrega e o valor, por favor?`;
    window.open(`https://wa.me/${tel}?text=${encodeURIComponent(msg)}`, '_blank');
  };

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
        <div className="w-24 h-24 rounded-full bg-green-400 flex items-center justify-center mx-auto mb-5 shadow-lg shadow-green-400/40">
          <CheckCircle className="w-12 h-12 text-white" />
        </div>
        <h1 className="text-3xl font-black text-white mb-2">Tudo certo!</h1>
        <p className="text-xl text-white/90 mb-2">Seu pedido está pronto para retirada. 😃</p>
        {pedido && (
          <p className="text-white/50 font-mono text-sm mb-6">
            #{pedido.numero_pedido} — {limparVariacaoNome(pedido.cliente) || pedido.cliente}
          </p>
        )}

        <div className="bg-white/10 rounded-2xl p-5 text-left mb-4 space-y-3">
          <p className="text-white font-bold text-sm">🚗 Chamar Motorista Parceiro</p>
          <div className="flex flex-wrap gap-2">
            {MOTOBOYS.map(m => (
              <button key={m.nome} onClick={() => handleMotoboy(m.tel, m.nome)}
                className="bg-green-500 hover:bg-green-400 text-white px-3 py-2 rounded-lg text-sm font-bold transition-colors">
                💬 {m.nome}
              </button>
            ))}
          </div>
          <div className="flex gap-2 pt-1">
            <button
              onClick={() => window.open('https://m.uber.com/ul/?action=setPickup&pickup[formatted_address]=Sublima+Mais+Av+D+Pedro+I+776+Centro+Joao+Pessoa', '_blank')}
              className="bg-black hover:bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-bold transition-colors">
              🟢 Uber
            </button>
            <button onClick={() => window.open('https://99app.com', '_blank')}
              className="bg-yellow-400 hover:bg-yellow-300 text-black px-4 py-2 rounded-lg text-sm font-bold transition-colors">
              🟡 99
            </button>
          </div>
        </div>

        <p className="text-white/30 text-xs">Fecha automaticamente em 5 segundos</p>
      </div>
    </div>
  );
}