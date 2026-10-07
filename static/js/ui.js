// Componentes de interface: toast, combobox, sparkline, gráfico de barras, tabela.
(function () {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  window.$ = $; window.$$ = $$;

  // ---------- toast ----------
  const toastEl = () => $('#toast');
  window.toast = (texto, ok = true) => {
    const t = toastEl(); if (!t) return;
    t.textContent = texto; t.className = 'toast show' + (ok ? '' : ' error');
    clearTimeout(t._h); t._h = setTimeout(() => (t.className = 'toast'), 3600);
  };

  // ---------- combobox (sem select nativo) ----------
  window.combo = (el, opcoes, valor, onChange) => {
    let atual = valor;
    const render = () => {
      el.classList.add('combo');
      el.innerHTML = `
        <button type="button" class="combo-trigger" aria-haspopup="listbox" aria-expanded="false">
          <span>${atual}</span>${ICON('chevdown', 'chev')}
        </button>
        <div class="combo-menu" role="listbox">
          ${opcoes.map((o) => `<button type="button" role="option" aria-selected="${o === atual}" data-v="${o}">${o}${o === atual ? ICON('check') : ''}</button>`).join('')}
        </div>`;
      const trig = $('.combo-trigger', el);
      trig.addEventListener('click', () => {
        const aberto = el.classList.toggle('open');
        trig.setAttribute('aria-expanded', String(aberto));
      });
      $$('.combo-menu button', el).forEach((b) => b.addEventListener('click', () => {
        atual = b.dataset.v; el.classList.remove('open'); render(); onChange && onChange(atual);
      }));
    };
    document.addEventListener('mousedown', (e) => { if (!el.contains(e.target)) { el.classList.remove('open'); const t = $('.combo-trigger', el); t && t.setAttribute('aria-expanded', 'false'); } });
    render();
    return { get: () => atual, set: (v) => { atual = v; render(); } };
  };

  // ---------- sparkline ----------
  window.sparkline = (serie, cor = '#a528ff') => {
    const w = 130, h = 66, pad = 3;
    const min = Math.min(...serie), max = Math.max(...serie), rng = max - min || 1;
    const pts = serie.map((v, i) => [pad + (i * (w - pad * 2)) / (serie.length - 1), h - pad - ((v - min) / rng) * (h - pad * 2)]);
    const line = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
    const area = `${line} L${w - pad} ${h} L${pad} ${h} Z`;
    const id = 'g' + Math.random().toString(36).slice(2, 8);
    return `<svg class="spark" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true">
      <defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="${cor}" stop-opacity=".28"/><stop offset="100%" stop-color="${cor}" stop-opacity="0"/></linearGradient></defs>
      <path d="${area}" fill="url(#${id})"/><path d="${line}" fill="none" stroke="${cor}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/></svg>`;
  };

  // ---------- KPI ----------
  window.kpi = ({ titulo, valor, variacao, legenda, icone, serie }) => `
    <div class="kpi">
      <div class="kpi-head"><span>${titulo}</span>${ICON(icone)}</div>
      <div class="kpi-body">
        <div><div class="kpi-value">${valor}</div><div class="kpi-meta"><span class="change">${variacao}</span><span class="caption">${legenda}</span></div></div>
        ${sparkline(serie)}
      </div>
    </div>`;

  // ---------- barras ----------
  window.barChart = (el, dados, { altura = 160, cor = '#a528ff', corComp = '#e6e8ec', sufixo = '' } = {}) => {
    const max = Math.max(...dados.map((d) => Math.max(d.valor, d.comparativo ?? 0)), 1);
    el.innerHTML = `
      <div class="bars" style="height:${altura}px">
        ${dados.map((d) => `<div class="col">
          ${d.comparativo !== undefined ? `<span style="height:${(d.comparativo / max) * 100}%;background:${corComp}" title="Esperado: ${d.comparativo}${sufixo}"></span>` : ''}
          <span style="height:${(d.valor / max) * 100}%;background:${cor}" title="${d.label}: ${d.valor}${sufixo}"></span>
        </div>`).join('')}
      </div>
      <div class="bars-x">${dados.map((d) => `<span>${d.label}</span>`).join('')}</div>`;
  };

  // ---------- tabela com ordenação, busca e paginação ----------
  window.dataTable = (el, { colunas, linhas, porPagina = 5, busca }) => {
    let ordem = { col: colunas[0].id, dir: 'asc' }, pagina = 0, termo = '', pp = porPagina;
    const filtrar = () => {
      const q = termo.trim().toLowerCase();
      let base = q ? linhas.filter((l) => (busca ? busca(l) : Object.values(l)).some((v) => String(v).toLowerCase().includes(q))) : [...linhas];
      const c = colunas.find((x) => x.id === ordem.col);
      base.sort((a, b) => { const r = c.sort ? c.sort(a, b) : String(a[c.id]).localeCompare(String(b[c.id]), 'pt-BR'); return ordem.dir === 'asc' ? r : -r; });
      return base;
    };
    const render = () => {
      const lista = filtrar(), total = Math.max(1, Math.ceil(lista.length / pp)); pagina = Math.min(pagina, total - 1);
      const ini = pagina * pp, pag = lista.slice(ini, ini + pp);
      el.innerHTML = `
        <div class="table-wrap"><table>
          <thead><tr>${colunas.map((c) => `<th><button type="button" data-col="${c.id}" class="${ordem.col === c.id ? 'sorted' : ''}">${c.label}${ICON('updown')}</button></th>`).join('')}</tr></thead>
          <tbody>${pag.length ? pag.map((l) => `<tr>${colunas.map((c) => `<td>${c.render ? c.render(l) : l[c.id]}</td>`).join('')}</tr>`).join('') : `<tr><td colspan="${colunas.length}" style="text-align:center;padding:40px;color:#9ca3af">Nada encontrado</td></tr>`}</tbody>
        </table></div>
        <div class="table-foot">
          <div style="display:flex;gap:12px;align-items:center">
            <span>${lista.length ? `Mostrando ${ini + 1}–${Math.min(ini + pp, lista.length)} de ${lista.length}` : 'Nenhum registro'}</span>
            <span style="width:1px;height:14px;background:#e6e8ec"></span>
            <div class="pp"></div>
          </div>
          <div class="pager">
            <button type="button" data-p="prev" ${pagina === 0 ? 'disabled' : ''} aria-label="Página anterior">${ICON('chevleft')}</button>
            ${Array.from({ length: total }).map((_, i) => `<button type="button" data-p="${i}" ${i === pagina ? 'aria-current="page"' : ''}>${i + 1}</button>`).join('')}
            <button type="button" data-p="next" ${pagina >= total - 1 ? 'disabled' : ''} aria-label="Próxima página">${ICON('chevright')}</button>
          </div>
        </div>`;
      $$('th button', el).forEach((b) => b.addEventListener('click', () => { const col = b.dataset.col; ordem = { col, dir: ordem.col === col && ordem.dir === 'asc' ? 'desc' : 'asc' }; render(); }));
      $$('.pager button', el).forEach((b) => b.addEventListener('click', () => { const p = b.dataset.p; pagina = p === 'prev' ? pagina - 1 : p === 'next' ? pagina + 1 : +p; render(); }));
      combo($('.pp', el), ['5 por página', '10 por página', '20 por página'], `${pp} por página`, (v) => { pp = parseInt(v); pagina = 0; render(); });
      $('.pp .combo-trigger', el).style.height = '30px';
      $('.pp .combo-menu', el).style.top = 'auto'; $('.pp .combo-menu', el).style.bottom = 'calc(100% + 6px)'; $('.pp .combo-menu', el).style.width = '150px';
    };
    render();
    return { buscar: (t) => { termo = t; pagina = 0; render(); }, atualizar: (novas) => { linhas = novas; render(); } };
  };
})();
