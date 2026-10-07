// Estado ao vivo compartilhado entre o painel e o celular do passageiro.
// BroadcastChannel entre abas + localStorage como reserva. Sem servidor de push.
(function () {
  const CANAL = 'clickbus-informa';
  const CHAVE = 'clickbus-informa-plataformas';
  const ouvintes = new Set();
  let canal = null;

  const ler = () => { try { return JSON.parse(localStorage.getItem(CHAVE) || '{}'); } catch { return {}; } };

  function garantir() {
    if (canal || typeof BroadcastChannel === 'undefined') return;
    canal = new BroadcastChannel(CANAL);
    canal.onmessage = (ev) => ouvintes.forEach((f) => f(ler(), ev.data));
    window.addEventListener('storage', (e) => { if (e.key === CHAVE) ouvintes.forEach((f) => f(ler())); });
  }

  window.LIVE = {
    ler,
    definir(id, plataforma, extra = {}) {
      const mapa = ler(); mapa[id] = plataforma;
      localStorage.setItem(CHAVE, JSON.stringify(mapa));
      const alt = { id, plataforma, em: Date.now(), ...extra };
      garantir(); canal && canal.postMessage(alt);
      ouvintes.forEach((f) => f(mapa, alt));
    },
    assinar(f) { garantir(); ouvintes.add(f); return () => ouvintes.delete(f); },
    limpar() { localStorage.removeItem(CHAVE); },
  };
})();
