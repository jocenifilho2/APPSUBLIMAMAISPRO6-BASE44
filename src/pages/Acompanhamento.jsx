import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { CheckCircle, Circle, XCircle, Clock, Package, X } from 'lucide-react';
import confetti from 'canvas-confetti';

const TIMELINE_PRODUTO = [
  { key: 'NOVO', label: 'Pedido Recebido' },
  { key: 'AGUARDANDO_PAGAMENTO', label: 'Aguardando Pagamento' },
  { key: 'PAGO', label: 'Pagamento Confirmado' },
  { key: 'PRODUCAO', label: 'Em Produção' },
  { key: 'SEPARACAO', label: 'Em Separação' },
  { key: 'PRONTO', label: 'Pronto para Retirada' },
  { key: 'ENTREGUE', label: 'Entregue' },
];

const TIMELINE_IMPRESSAO = [
  { key: 'RECEBIDO', label: 'Pedido Recebido' },
  { key: 'CONFERENCIA', label: 'Em Conferência' },
  { key: 'AGUARDANDO_PAGAMENTO', label: 'Aguardando Pagamento' },
  { key: 'PAGO', label: 'Pagamento Confirmado' },
  { key: 'ARTE_REVISADA', label: 'Arte Revisada' },
  { key: 'EM_IMPRESSAO', label: 'Em Impressão' },
  { key: 'ACABAMENTO', label: 'Em Acabamento' },
  { key: 'QUALIDADE', label: 'Controle de Qualidade' },
  { key: 'PRONTO', label: 'Pronto para Retirada' },
  { key: 'ENTREGUE', label: 'Entregue' },
];

const STATUS_ORDER_PRODUTO = ['NOVO', 'AGUARDANDO_PAGAMENTO', 'PAGO', 'PRODUCAO', 'SEPARACAO', 'PRONTO', 'ENTREGUE'];
const STATUS_ORDER_IMPRESSAO = ['RECEBIDO', 'CONFERENCIA', 'AGUARDANDO_PAGAMENTO', 'PAGO', 'ARTE_REVISADA', 'EM_IMPRESSAO', 'ACABAMENTO', 'QUALIDADE', 'PRONTO', 'ENTREGUE'];

const MOTOBOYS = [
  { nome: 'Girlan', tel: '5583991487691' },
  { nome: 'Marcílio', tel: '5583986364410' },
  { nome: 'John', tel: '5583988066337' },
];

function PremiumModal({ open, onClose, type, link }) {
  useEffect(() => {
    if (!open) return;
    const fire = () => {
      if (type === 'PRONTO') {
        confetti({ particleCount: 80, spread: 60, origin: { y: 0.6 } });
        setTimeout(() => confetti({ particleCount: 50, spread: 40, origin: { y: 0.5, x: 0.2 } }), 600);
        setTimeout(() => confetti({ particleCount: 50, spread: 40, origin: { y: 0.5, x: 0.8 } }), 1000);
      } else {
        confetti({ particleCount: 100, spread: 80, colors: ['#FFD700', '#FF6B35', '#F7931E'], origin: { y: 0.5 } });
        setTimeout(() => confetti({ particleCount: 60, spread: 50, colors: ['#FFD700', '#FF6B35'], origin: { y: 0.4, x: 0.3 } }), 700);
      }
    };
    fire();
    if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
    const timer = setTimeout(onClose, 5000);
    return () => clearTimeout(timer);
  }, [open]);

  if (!open) return null;

  const isPronto = type === 'PRONTO';

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      style={{
        background: 'rgba(0,0,0,0.9)',
        backdropFilter: 'blur(8px)',
        animation: 'premFade 0.3s ease-out'
      }}
    >
      <style>{`
        @keyframes premFade { from { opacity:0; transform:scale(0.95); } to { opacity:1; transform:scale(1); } }
        @keyframes pulse1x { 0%,100% { transform:scale(1); } 50% { transform:scale(1.12); } }
        .pulse1x { animation: pulse1x 0.6s ease-in-out 1; }
      `}</style>
      <button
        onClick={onClose}
        className="absolute top-5 right-5 text-white/70 hover:text-white transition-colors z-10"
      >
        <X className="w-9 h-9" />
      </button>
      <div className="text-center max-w-md w-full px-4">
        <div className={`w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-5 shadow-2xl pulse1x ${
          isPronto ? 'bg-green-400 shadow-green-400/40' : 'bg-yellow-400 shadow-yellow-400/40'
        }`}>
          <CheckCircle className="w-14 h-14 text-white" />
        </div>
        <h1 className="text-3xl font-black text-white mb-3">
          {isPronto ? 'Tudo certo! 🎉' : 'Entregue! 🎊'}
        </h1>
        <p className="text-xl text-white/90 leading-relaxed">
          {isPronto
            ? 'Seu pedido está pronto para retirada. 😃'
            : 'Tudo certo! Lhe aguardamos nos próximos pedidos. 😃'
          }
        </p>
        {link && (
          <p className="text-white/40 font-mono text-sm mt-3">
            Pedido #{link.numero}
          </p>
        )}
        <button
          onClick={onClose}
          className="mt-6 bg-primary hover:bg-primary/80 text-white px-8 py-3 rounded-xl font-bold text-base transition-colors"
        >
          Fechar
        </button>
        <p className="text-white/30 text-xs mt-3">Fecha automaticamente em 5 segundos</p>
      </div>
    </div>
  );
}

export default function Acompanhamento() {
  const { token } = useParams();
  const [link, setLink] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [modal, setModal] = useState(null); // 'PRONTO' | 'ENTREGUE' | null
  const [corridaInput, setCorridaInput] = useState('');
  const [corridaSalva, setCorridaSalva] = useState(false);
  const [salvandoCorrida, setSalvandoCorrida] = useState(false);
  const [comprovante, setComprovante] = useState(null);
  const [enviandoComp, setEnviandoComp] = useState(false);
  const [compEnviado, setCompEnviado] = useState(false);
  const [retiradaConfirmada, setRetiradaConfirmada] = useState(false);
  const [salvandoRetirada, setSalvandoRetirada] = useState(false);
  const [motoboyEscolhido, setMotoboyEscolhido] = useState('');
  const prevStatusRef = useRef(null);

  const fetchLink = async () => {
    const links = await base44.entities.LinkAcompanhamento.filter({ token });
    if (links.length === 0) { setError(true); setLoading(false); return; }
    const data = links[0];
    
    // Trigger modal on status change
    if (prevStatusRef.current !== null && prevStatusRef.current !== data.status) {
      if (data.status === 'PRONTO') setModal('PRONTO');
      if (data.status === 'ENTREGUE') setModal('ENTREGUE');
    }
    // Also trigger on first load if already PRONTO/ENTREGUE
    if (prevStatusRef.current === null) {
      if (data.status === 'PRONTO') setModal('PRONTO');
      if (data.status === 'ENTREGUE') setModal('ENTREGUE');
    }
    prevStatusRef.current = data.status;
    setLink(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchLink();
    const interval = setInterval(fetchLink, 8000);
    return () => clearInterval(interval);
  }, [token]);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
    </div>
  );

  if (error || !link) return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center p-8">
        <XCircle className="w-12 h-12 text-red-400 mx-auto mb-3" />
        <h2 className="text-xl font-bold">Link não encontrado</h2>
        <p className="text-muted-foreground mt-1">Este link de acompanhamento não existe ou expirou.</p>
      </div>
    </div>
  );

  const aguardandoPagamento = link.status === 'AGUARDANDO_PAGAMENTO';
  const isProduto = link.tipo === 'PRODUTO';
  const timeline = isProduto ? TIMELINE_PRODUTO : TIMELINE_IMPRESSAO;
  const order = isProduto ? STATUS_ORDER_PRODUTO : STATUS_ORDER_IMPRESSAO;
  const currentIdx = order.indexOf(link.status);
  const cancelado = link.status === 'CANCELADO';
  const isPronto = link.status === 'PRONTO';

  const handleMotoboy = async (tel, nome) => {
    const itensTexto = link.itens_texto || '';
    const msg = `Olá ${nome}. Tenho um pedido separado para retirada na Sublima Mais.\nItens: ${itensTexto}\nPode me confirmar a entrega e o valor, por favor?`;
    window.open(`https://wa.me/${tel}?text=${encodeURIComponent(msg)}`, '_blank');
    // Salvar motoboy escolhido
    setMotoboyEscolhido(nome);
    await base44.entities.LinkAcompanhamento.update(link.id, { motoboy_nome: nome });
    if (isProduto) {
      await base44.entities.Pedido.update(link.pedido_id, { forma_retirada: 'MOTOBOY PARCEIRO' }).catch(() => {});
    } else {
      await base44.entities.PedidoImpressao.update(link.pedido_id, { forma_retirada: 'MOTOBOY PARCEIRO' }).catch(() => {});
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <PremiumModal open={!!modal} type={modal} link={link} onClose={() => setModal(null)} />

      <div className="max-w-lg mx-auto p-6">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center mx-auto mb-4 text-2xl">🖨️</div>
          <h1 className="text-xl font-black">Sublima Mais</h1>
          <p className="text-muted-foreground text-sm">Acompanhamento do Pedido</p>
        </div>

        {/* Pedido Info */}
        <div className="bg-card border rounded-2xl p-5 mb-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Pedido</p>
              <p className="font-black font-mono text-xl">{link.numero || '—'}</p>
            </div>
            <div className={`px-3 py-1 rounded-full text-xs font-bold ${
              cancelado ? 'bg-red-100 text-red-700' :
              link.status === 'ENTREGUE' ? 'bg-emerald-100 text-emerald-700' :
              isPronto ? 'bg-blue-100 text-blue-700' :
              'bg-amber-100 text-amber-700'
            }`}>
              {cancelado ? 'CANCELADO' : isPronto ? 'PRONTO PARA RETIRADA' : link.status?.replace('_', ' ')}
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Package className="w-4 h-4 text-muted-foreground" />
            <span className="font-semibold">{link.cliente}</span>
          </div>
          {link.data && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
              <Clock className="w-3.5 h-3.5" />
              {link.data}
            </div>
          )}
          {link.itens_texto && (
            <div className="mt-3 pt-3 border-t">
              <p className="text-xs font-semibold text-muted-foreground mb-1">Itens</p>
              <p className="text-sm whitespace-pre-line">{link.itens_texto}</p>
            </div>
          )}
        </div>

        {/* Timeline */}
        {!cancelado && (
          <div className="bg-card border rounded-2xl p-5 mb-6">
            <h3 className="font-bold mb-5">Linha do Tempo</h3>
            <div className="space-y-0">
              {timeline.map((step, i) => {
                const done = currentIdx >= i;
                const current = currentIdx === i;
                return (
                  <div key={step.key} className="flex gap-4">
                    <div className="flex flex-col items-center">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 transition-all ${
                        done ? 'bg-primary' : 'bg-muted'
                      }`}>
                        {done ? (
                          <CheckCircle className="w-5 h-5 text-white" />
                        ) : (
                          <Circle className="w-5 h-5 text-muted-foreground/40" />
                        )}
                      </div>
                      {i < timeline.length - 1 && (
                        <div className={`w-0.5 h-8 my-1 ${done && currentIdx > i ? 'bg-primary' : 'bg-muted'}`} />
                      )}
                    </div>
                    <div className="pb-8 flex-1">
                      <p className={`font-semibold text-sm leading-none mt-1.5 ${
                        current ? 'text-primary' : done ? 'text-foreground' : 'text-muted-foreground'
                      }`}>
                        {step.label}
                        {current && <span className="ml-2 text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">Atual</span>}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Card CHAMAR MOTORISTA — exibido apenas quando PRONTO */}
        {isPronto && (
          <div className="bg-card border-2 border-green-200 rounded-2xl p-5 mb-4">
            {(link.motoboy_nome || motoboyEscolhido) && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-3 text-sm text-green-700 font-semibold flex items-center gap-2">
                🏍️ Retirada via motoboy parceiro: <strong>{link.motoboy_nome || motoboyEscolhido}</strong>
              </div>
            )}
            <h3 className="font-bold mb-3 flex items-center gap-2 text-green-700">
              🚗 Chamar Motorista
            </h3>
            <p className="text-xs text-muted-foreground mb-3">Seu pedido está pronto! Escolha como deseja receber:</p>
            <div className="flex flex-wrap gap-2 mb-3">
              <button
                onClick={() => window.open('https://m.uber.com/ul/?action=setPickup&pickup[formatted_address]=Sublima+Mais+Av+D+Pedro+I+776+Centro+Joao+Pessoa+CEP+58013-020', '_blank')}
                className="bg-black text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-gray-900 transition-colors">
                🟢 Uber
              </button>
              <button
                onClick={() => window.open('https://99app.com', '_blank')}
                className="bg-yellow-400 text-black px-4 py-2 rounded-lg text-sm font-bold hover:bg-yellow-300 transition-colors">
                🟡 99
              </button>
            </div>
            <div className="border-t pt-3">
              <p className="text-xs font-semibold text-muted-foreground mb-2">💬 Motoboy Parceiro</p>
              <div className="flex flex-wrap gap-2">
                {MOTOBOYS.map(m => (
                  <button key={m.nome}
                    onClick={() => handleMotoboy(m.tel, m.nome)}
                    className="bg-green-500 hover:bg-green-400 text-white px-3 py-2 rounded-lg text-sm font-bold transition-colors">
                    {m.nome}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Card: Comprovante de pagamento — aguardando pagamento (produto e impressão) */}
        {aguardandoPagamento && (
          <div className="bg-card border-2 border-amber-200 rounded-2xl p-5 mb-4">
            <h3 className="font-bold mb-1 text-amber-700">💳 Enviar Comprovante</h3>
            <p className="text-xs text-muted-foreground mb-3">Seu pedido aguarda pagamento. Faça o pagamento via PIX ou transferência e envie o comprovante aqui para agilizarmos a confirmação.</p>
            {(compEnviado || link.comprovante_url) ? (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-700 font-semibold">
                ✅ Comprovante recebido! Estamos verificando o pagamento.
              </div>
            ) : (
              <div className="space-y-2">
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  className="w-full text-sm border border-input rounded-lg p-2 bg-transparent"
                  onChange={e => setComprovante(e.target.files[0])}
                />
                <button
                  disabled={enviandoComp || !comprovante}
                  onClick={async () => {
                    if (!comprovante) return;
                    setEnviandoComp(true);
                    const { file_url } = await base44.integrations.Core.UploadFile({ file: comprovante });
                    await base44.entities.LinkAcompanhamento.update(link.id, { comprovante_url: file_url });
                    setCompEnviado(true);
                    setEnviandoComp(false);
                  }}
                  className="w-full bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-white py-2 rounded-lg text-sm font-bold transition-colors"
                >
                  {enviandoComp ? 'Enviando...' : 'Enviar Comprovante'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Card: Retirada em Loja */}
        {isPronto && (
          <div className="bg-card border-2 border-slate-200 rounded-2xl p-5 mb-4">
            <h3 className="font-bold mb-1 text-slate-700">🏪 Retirada em Loja</h3>
            <p className="text-xs text-muted-foreground mb-3">Prefere retirar pessoalmente? Clique abaixo para confirmar e nossa equipe ficará ciente.</p>
            {(retiradaConfirmada || link.retirada_loja) ? (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-700 font-semibold">
                ✅ Retirada em loja confirmada! Te esperamos aqui.
              </div>
            ) : (
              <button
                disabled={salvandoRetirada}
                onClick={async () => {
                  setSalvandoRetirada(true);
                  await base44.entities.LinkAcompanhamento.update(link.id, { retirada_loja: true });
                  if (isProduto) {
                    await base44.entities.Pedido.update(link.pedido_id, { forma_retirada: 'RETIRADA EM LOJA' });
                  } else {
                    await base44.entities.PedidoImpressao.update(link.pedido_id, { forma_retirada: 'RETIRADA EM LOJA' });
                  }
                  setRetiradaConfirmada(true);
                  setSalvandoRetirada(false);
                }}
                className="w-full bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-white py-2 rounded-lg text-sm font-bold transition-colors"
              >
                {salvandoRetirada ? 'Confirmando...' : '✅ Confirmar Retirada em Loja'}
              </button>
            )}
          </div>
        )}

        {/* Card: Compartilhe sua corrida — exibido quando PRONTO */}
        {isPronto && (
          <div className="bg-card border-2 border-blue-200 rounded-2xl p-5 mb-4">
            <h3 className="font-bold mb-1 flex items-center gap-2 text-blue-700">🔗 Compartilhe sua corrida</h3>
            <p className="text-xs text-muted-foreground mb-3">Cole aqui o link da corrida Uber/99 para que nossa equipe acompanhe.</p>
            {corridaSalva || link?.link_corrida ? (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-700 font-semibold">
                ✅ Link recebido! Nossa equipe já está acompanhando.
              </div>
            ) : (
              <div className="flex gap-2">
                <input
                  className="flex-1 h-10 rounded-lg border border-input bg-transparent px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                  placeholder="Cole o link da corrida aqui..."
                  value={corridaInput}
                  onChange={e => setCorridaInput(e.target.value)}
                />
                <button
                  disabled={salvandoCorrida || !corridaInput}
                  onClick={async () => {
                    if (!corridaInput || !link?.pedido_id) return;
                    setSalvandoCorrida(true);
                    if (isProduto) {
                      await base44.entities.Pedido.update(link.pedido_id, { link_corrida: corridaInput });
                    } else {
                      await base44.entities.PedidoImpressao.update(link.pedido_id, { link_corrida: corridaInput });
                    }
                    setCorridaSalva(true);
                    setSalvandoCorrida(false);
                  }}
                  className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-4 h-10 rounded-lg text-sm font-bold transition-colors"
                >
                  {salvandoCorrida ? '...' : 'Enviar'}
                </button>
              </div>
            )}
          </div>
        )}

        <p className="text-center text-xs text-muted-foreground mt-2">
          Atualiza automaticamente a cada 8 segundos
        </p>
      </div>
    </div>
  );
}