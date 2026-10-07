// Mapa do terminal com Leaflet: pinos que expandem, gaveta lateral com busca, filtros e status.
(function () {
  const STATUS = {
    patio: { label: 'No pátio', cor: '#10b981' },
    caminho: { label: 'A caminho', cor: '#3b82f6' },
    embarcando: { label: 'Embarcando', cor: '#a528ff' },
    atrasado: { label: 'Atrasado', cor: '#f59e0b' },
    encerrado: { label: 'Encerrado', cor: '#9ca3af' },
  };
  const FILTROS = [['todos', 'Todos'], ['patio', 'No pátio'], ['caminho', 'A caminho'], ['embarcando', 'Embarcando'], ['atrasado', 'Atrasados']];

  const busSvg = (cor) => `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="${cor}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 6 2 7"/><path d="M10 6h4"/><path d="m22 7-2-1"/><rect width="16" height="16" x="4" y="3" rx="2"/><path d="M4 11h16"/><path d="M8 15h.01"/><path d="M16 15h.01"/><path d="M6 19v2"/><path d="M18 21v-2"/></svg>`;

  window.montarMapa = (root, terminal, partidas) => {
    let filtro = 'todos', termo = '', marcadores = [], plataformas = LIVE.ler();
    const centro = [terminal.lat, terminal.lng];

    root.innerHTML = `
      <div class="card map-card">
        <div class="card-head"><span class="title">Mapa do terminal</span>${ICON('map')}</div>
        <div class="map-body">
          <div class="leaflet-holder" style="position:absolute;inset:0;z-index:0"></div>
          <div class="map-top">
            <button type="button" class="icon-btn menu" aria-label="Abrir lista" aria-expanded="false" title="Lista de ônibus">${ICON('menu')}</button>
            <div style="display:flex;gap:6px">
              <button type="button" class="icon-btn center" title="Centralizar no terminal" aria-label="Centralizar no terminal">${ICON('locate')}</button>
              <button type="button" class="icon-btn full" title="Tela cheia" aria-label="Tela cheia">${ICON('maximize')}</button>
            </div>
          </div>
          <div class="drawer hidden" aria-hidden="true">
            <div class="drawer-in">
              <div class="drawer-head"><span>Ônibus <span class="muted count"></span></span><button type="button" class="x" aria-label="Fechar lista">${ICON('x')}</button></div>
              <div class="drawer-tools">
                <div class="field">${ICON('search')}<input class="input busca" placeholder="Buscar" aria-label="Buscar ônibus"></div>
                <button type="button" class="icon-btn filtros" aria-label="Filtros" aria-expanded="false" title="Filtros">${ICON('filter')}</button>
              </div>
              <div class="drawer-filters"><div class="box"></div></div>
              <div class="drawer-status"><div class="dist"></div><div class="legend"></div></div>
              <ul class="drawer-list"></ul>
            </div>
          </div>
        </div>
      </div>`;

    const holder = root.querySelector('.leaflet-holder');
    const map = L.map(holder, { center: centro, zoom: 14, zoomControl: false });
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; OpenStreetMap' }).addTo(map);
    L.marker(centro, { icon: L.divIcon({ className: 'cb-pin', html: `<div class="cb-pin-inner" style="background:#1f2937;color:#fff"><div class="cb-pin-head"><span style="width:6px;height:6px;border-radius:9999px;background:#a528ff"></span>${terminal.nome}</div></div>` }), zIndexOffset: 1000, interactive: false }).addTo(map);
    new ResizeObserver(() => map.invalidateSize()).observe(holder);
    setTimeout(() => map.invalidateSize(), 80);

    const platDe = (p) => plataformas[p.id] || p.plataforma;
    const visiveis = () => {
      const q = termo.trim().toLowerCase();
      return partidas.filter((p) => (filtro === 'todos' || p.status === filtro) && (!q || [p.destino, p.viacao, platDe(p), p.id].some((v) => String(v).toLowerCase().includes(q))));
    };
    const contagem = () => Object.fromEntries(Object.keys(STATUS).map((k) => [k, partidas.filter((p) => p.status === k).length]));

    function desenharPinos() {
      marcadores.forEach((m) => m.remove()); marcadores = [];
      visiveis().forEach((p) => {
        const s = STATUS[p.status];
        const pct = Math.round((p.a_bordo / p.total) * 100);
        const icon = L.divIcon({ className: 'cb-pin', html: `
          <div class="cb-pin-inner" style="background:#fff;color:#1f2937">
            <div class="cb-pin-head">${busSvg(s.cor)}${p.destino}<span style="color:#9ca3af">${p.eta}</span></div>
            <div class="cb-pin-details">
              <div class="cb-pin-sep"></div>
              <div class="cb-pin-row"><span class="cb-pin-key">Status</span><span style="color:${s.cor}">${s.label}</span></div>
              <div class="cb-pin-row"><span class="cb-pin-key">Viação</span><span>${p.viacao} · ${p.id}</span></div>
              <div class="cb-pin-row"><span class="cb-pin-key">Plataforma</span><span>${platDe(p)}</span></div>
              <div class="cb-pin-row"><span class="cb-pin-key">A bordo</span><span>${p.a_bordo} de ${p.total}</span></div>
              <div class="cb-pin-bar"><span style="display:block;height:100%;width:${pct}%;background:${s.cor}"></span></div>
            </div>
          </div>` });
        const m = L.marker([p.lat, p.lng], { icon }).addTo(map);
        m.on('mouseover', () => m.setZIndexOffset(2000));
        m.on('mouseout', () => m.setZIndexOffset(0));
        m.on('click', () => { const el = m.getElement(); const abrindo = !el.classList.contains('is-open'); marcadores.forEach((x) => x.getElement()?.classList.remove('is-open')); abrindo && el.classList.add('is-open'); });
        m._pid = p.id; marcadores.push(m);
      });
    }

    function desenharGaveta() {
      const lista = visiveis(), cnt = contagem();
      root.querySelector('.count').textContent = `(${lista.length})`;
      root.querySelector('.drawer-filters .box').innerHTML = FILTROS.map(([id, label]) => `
        <button type="button" data-f="${id}" aria-pressed="${filtro === id}">
          ${id !== 'todos' ? `<i style="background:${STATUS[id].cor}"></i>` : ''}<span>${label}</span>
          <span class="n">${id === 'todos' ? partidas.length : cnt[id]}</span>${filtro === id ? ICON('check') : ''}
        </button>`).join('');
      root.querySelectorAll('.drawer-filters button').forEach((b) => b.addEventListener('click', () => { filtro = b.dataset.f; atualizar(); }));
      root.querySelector('.filtros').classList.toggle('on', filtro !== 'todos');

      const total = Object.values(cnt).reduce((a, b) => a + b, 0) || 1;
      root.querySelector('.dist').innerHTML = Object.keys(STATUS).filter((k) => cnt[k]).map((k) => `<span style="background:${STATUS[k].cor};flex-grow:${cnt[k]}" title="${STATUS[k].label}: ${cnt[k]}"></span>`).join('');
      root.querySelector('.drawer-status .legend').innerHTML = Object.keys(STATUS).filter((k) => k !== 'encerrado').map((k) => `<span><svg viewBox="0 0 24 24" fill="none" stroke="${STATUS[k].cor}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6 2 7"/><path d="M10 6h4"/><path d="m22 7-2-1"/><rect width="16" height="16" x="4" y="3" rx="2"/><path d="M4 11h16"/><path d="M8 15h.01"/><path d="M16 15h.01"/><path d="M6 19v2"/><path d="M18 21v-2"/></svg>${STATUS[k].label}<b>${cnt[k]}</b></span>`).join('');

      root.querySelector('.drawer-list').innerHTML = lista.length ? lista.map((p) => `
        <li><button type="button" data-id="${p.id}">
          <div class="l1">${busSvg(STATUS[p.status].cor)}<span>${p.destino}</span><span class="eta">${p.eta}</span></div>
          <div class="l2">${p.viacao} · plataforma <span style="color:#374151">${platDe(p)}</span> · ${p.a_bordo} de ${p.total}</div>
        </button></li>`).join('') : '<li style="padding:24px;text-align:center;color:#9ca3af;font-size:12px">Nenhum ônibus encontrado</li>';
      root.querySelectorAll('.drawer-list button').forEach((b) => b.addEventListener('click', () => {
        const p = partidas.find((x) => x.id === b.dataset.id); map.setView([p.lat, p.lng], 15, { animate: true });
        marcadores.forEach((m) => m.getElement()?.classList.toggle('is-open', m._pid === p.id));
      }));
    }

    const atualizar = () => { desenharPinos(); desenharGaveta(); };

    const drawer = root.querySelector('.drawer'), menu = root.querySelector('.menu');
    const abrir = (v) => { drawer.classList.toggle('hidden', !v); drawer.setAttribute('aria-hidden', String(!v)); menu.setAttribute('aria-expanded', String(v)); menu.classList.toggle('on', v); menu.setAttribute('aria-label', v ? 'Fechar lista' : 'Abrir lista'); };
    menu.addEventListener('click', () => abrir(drawer.classList.contains('hidden')));
    root.querySelector('.drawer-head .x').addEventListener('click', () => abrir(false));
    root.querySelector('.busca').addEventListener('input', (e) => { termo = e.target.value; atualizar(); });
    root.querySelector('.filtros').addEventListener('click', (e) => { const f = root.querySelector('.drawer-filters'); const on = f.classList.toggle('open'); e.currentTarget.setAttribute('aria-expanded', String(on)); });
    root.querySelector('.center').addEventListener('click', () => map.setView(centro, 14, { animate: true }));
    root.querySelector('.full').addEventListener('click', () => root.querySelector('.map-body').requestFullscreen?.());

    LIVE.assinar((m) => { plataformas = m; atualizar(); });
    atualizar();
    return { map, atualizar };
  };

  window.MAP_STATUS = STATUS;
})();
