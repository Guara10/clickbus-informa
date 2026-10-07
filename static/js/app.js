// Aplicação: navegação por abas, trilha, KPIs, tabelas, plataformas ao vivo e simulador de SMS.
(function () {
  const D = window.DADOS;
  const PLATS = Array.from({ length: D.terminal.plataformas }, (_, i) => String(i + 1).padStart(2, '0'));
  const PASSAGEM = { id: '#1042', passageiro: 'Marina Costa', origem: 'São Paulo · Tietê', destino: 'Rio de Janeiro', viacao: 'Cometa', horario: '16:40', poltrona: '14A' };

  // ---------------- navegação ----------------
  const NAV = {
    gestao: {
      label: 'Gestão', icon: 'building',
      sections: [
        { title: 'Painel', items: [{ id: 'dashboard', label: 'Dashboard', icon: 'dashboard' }] },
        { title: 'Fluxo', items: [{ id: 'departures', label: 'Partidas', icon: 'bus' }, { id: 'delays', label: 'Atrasos', icon: 'clock' }, { id: 'platforms', label: 'Plataformas', icon: 'grid' }] },
        { title: 'Base de dados', items: [{ id: 'contacts', label: 'Contatos', icon: 'userplus' }, { id: 'sources', label: 'Fontes de dados', icon: 'db' }] },
      ],
    },
    operacional: {
      label: 'Operacional', icon: 'users',
      sections: [
        { title: 'Agora', items: [{ id: 'live', label: 'Ao vivo', icon: 'radio' }] },
        { title: 'Comunicação', items: [{ id: 'sms', label: 'Disparo de avisos', icon: 'send' }] },
        { title: 'Meu trabalho', items: [{ id: 'incidents', label: 'Ocorrências', icon: 'alert' }] },
      ],
    },
  };
  let modo = 'gestao', aba = 'dashboard';
  const acharItem = (id) => { for (const m of Object.keys(NAV)) for (const s of NAV[m].sections) { const it = s.items.find((i) => i.id === id); if (it) return { it, m }; } return null; };

  function renderNav() {
    $('#nav').innerHTML = NAV[modo].sections.map((s, i) => `
      <div class="nav-section">
        <div class="nav-title">${s.title}</div>
        ${s.items.map((it) => `<button type="button" class="nav-item ${it.id === aba ? 'active' : ''}" data-view="${it.id}" title="${it.label}"><span>${ICON(it.icon)}<span class="label">${it.label}</span></span></button>`).join('')}
        ${i < NAV[modo].sections.length - 1 ? '<div class="nav-divider"></div>' : ''}
      </div>`).join('');
    $$('#nav .nav-item').forEach((b) => b.addEventListener('click', () => irPara(b.dataset.view)));
  }

  const inicializados = new Set();
  function irPara(id) {
    aba = id; const f = acharItem(id); if (f && f.m !== modo) { modo = f.m; $$('[data-mode]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.mode === modo))); }
    $$('.view').forEach((v) => v.classList.toggle('active', v.dataset.view === id));
    $('#crumb-mode').textContent = NAV[modo].label; $('#crumb-label').textContent = f ? f.it.label : id; $('#crumb-icon').innerHTML = f ? ICON(f.it.icon) : '';
    renderNav();
    if (!inicializados.has(id)) { inicializados.add(id); (VIEWS[id] || (() => {}))(); }
    else if (id === 'dashboard' || id === 'live') setTimeout(() => window.dispatchEvent(new Event('resize')), 60);
    history.replaceState(null, '', '#' + id);
  }

  $$('[data-mode]').forEach((b) => b.addEventListener('click', () => { modo = b.dataset.mode; $$('[data-mode]').forEach((x) => x.setAttribute('aria-pressed', String(x === b))); irPara(NAV[modo].sections[0].items[0].id); }));
  $('[data-mode="gestao"]').innerHTML = ICON('building'); $('[data-mode="operacional"]').innerHTML = ICON('users');
  $('#collapse').innerHTML = ICON('collapse'); $('#collapse').addEventListener('click', () => $('#sidebar').classList.add('collapsed'));
  $('#expand').addEventListener('click', () => $('#sidebar').classList.remove('collapsed'));
  $('.topbar .history button:first-child').innerHTML = ICON('arrowleft'); $('.topbar .history button:last-child').innerHTML = ICON('arrowright');
  $('.crumbs .sep').innerHTML = ICON('chevright'); $('#top-search').innerHTML = ICON('search'); $('#top-bell').innerHTML += ICON('bell');
  $$('[data-icon]').forEach((el) => (el.innerHTML = ICON(el.dataset.icon)));

  // ---------------- helpers ----------------
  const ST = { embarcando: ['Embarcando', 'door', 'bg-green'], patio: ['No pátio', 'bus', 'bg-blue'], caminho: ['A caminho', 'bus', 'bg-blue'], atrasado: ['Atrasado', 'clock', 'bg-amber'], encerrado: ['Encerrado', 'checkcheck', 'bg-gray'] };
  const SIT = { embarcando: ['No horário', 'circlecheck', 'ok'], patio: ['Aguardando', 'hourglass', 'warn'], caminho: ['No horário', 'circlecheck', 'ok'], atrasado: ['Atrasado', 'alert', 'bad'], encerrado: ['Concluído', 'checkcheck', 'done'] };
  const iniciais = (n) => n.split(' ').slice(0, 2).map((p) => p[0]).join('');
  let plataformas = LIVE.ler();
  const platDe = (p) => plataformas[p.id] || p.plataforma;

  const tabelaPartidas = (el, buscaEl) => {
    const t = dataTable(el, {
      colunas: [
        { id: 'id', label: 'Partida' },
        { id: 'destino', label: 'Destino', render: (r) => `${r.destino} <span class="sub">· ${r.viacao}</span>` },
        { id: 'plataforma', label: 'Plataforma', render: (r) => `<span class="chip accent" style="padding:3px 8px">${platDe(r)}</span>` },
        { id: 'operador', label: 'Operador', render: (r) => `<span style="display:inline-flex;align-items:center;gap:8px"><span class="initials">${iniciais(r.operador)}</span>${r.operador}</span>` },
        { id: 'status', label: 'Status', render: (r) => `<span style="display:inline-flex;align-items:center;gap:8px"><span class="${ST[r.status][2]}" style="display:inline-flex;width:16px;height:16px;background:none">${ICON(ST[r.status][1])}</span>${ST[r.status][0]}</span>` },
        { id: 'horario', label: 'Horário' },
        { id: 'situacao', label: 'Situação', sort: (a, b) => SIT[a.status][0].localeCompare(SIT[b.status][0]), render: (r) => `<span class="chip ${SIT[r.status][2]}">${ICON(SIT[r.status][1])}${SIT[r.status][0]}</span>` },
        {
          id: 'risco', label: 'Risco (motor preditivo)',
          sort: (a, b) => (b.risco ? b.risco.probabilidade_atraso : 0) - (a.risco ? a.risco.probabilidade_atraso : 0),
          render: (r) => {
            if (!r.risco) return '<span class="muted small">—</span>';
            const cor = r.risco.nivel === 'critico' ? 'bad' : r.risco.nivel === 'atencao' ? 'warn' : 'ok';
            return `<span class="chip ${cor}" title="${r.risco.motivo}">${r.risco.probabilidade_atraso}%</span>`;
          },
        },
      ],
      linhas: D.partidas, porPagina: 5,
      busca: (r) => [r.id, r.destino, r.viacao, r.operador, platDe(r)],
    });
    buscaEl && buscaEl.addEventListener('input', (e) => t.buscar(e.target.value));
    return t;
  };

  const feedPartidas = (el) => {
    let filtro = 'hour', termo = '';
    const render = () => {
      const base = filtro === 'delayed' ? D.partidas.filter((p) => p.status === 'atrasado') : D.partidas;
      const q = termo.trim().toLowerCase();
      const lista = q ? base.filter((p) => [p.destino, p.viacao, platDe(p), p.horario].some((v) => String(v).toLowerCase().includes(q))) : base;
      const escopo = filtro === 'delayed' ? 'atrasadas agora' : filtro === 'today' ? 'partidas hoje' : 'partidas na próxima hora';
      el.innerHTML = `
        <div class="card">
          <div class="card-head"><span class="title">Partidas ao vivo</span>${ICON('radio')}</div>
          <div class="card-body">
            <div class="segmented">${[['hour', 'Próxima hora'], ['today', 'Hoje'], ['delayed', 'Atrasadas']].map(([id, l]) => `<button type="button" data-f="${id}" aria-pressed="${filtro === id}">${l}</button>`).join('')}</div>
            <div class="field" style="margin-top:12px">${ICON('search')}<input class="input fb" placeholder="Buscar destino, viação, plataforma..." aria-label="Buscar partidas" value="${termo}"></div>
            <p class="count-line"><b>${lista.length}</b> ${escopo}</p>
            <div class="dashed"></div>
            <ul class="feed">${lista.map((p) => { const s = ST[p.status]; const cor = { 'bg-green': '#10b981', 'bg-blue': '#3b82f6', 'bg-amber': '#f59e0b', 'bg-gray': '#9ca3af' }[s[2]]; return `
              <li><span class="badge-ic" style="border-color:${cor}33;color:${cor}">${ICON(s[1])}</span>
                <div class="fm"><div class="l1"><span>${p.destino}</span><span class="tm">${p.horario}</span></div>
                <div class="l2">${p.viacao} · plataforma <b class="pl" data-id="${p.id}">${platDe(p)}</b> · ${p.status === 'atrasado' ? '<span style="color:#ef4444">Atrasado</span>' : `<b>${p.a_bordo} de ${p.total}</b> a bordo`}</div></div></li>`; }).join('') || '<li class="muted small" style="justify-content:center">Nenhuma partida encontrada</li>'}</ul>
          </div>
        </div>`;
      $$('.segmented button', el).forEach((b) => b.addEventListener('click', () => { filtro = b.dataset.f; render(); }));
      const inp = $('.fb', el); inp.addEventListener('input', (e) => { termo = e.target.value; const pos = e.target.selectionStart; render(); const n = $('.fb', el); n.focus(); n.setSelectionRange(pos, pos); });
    };
    render();
    return { render };
  };

  // ---------------- views ----------------
  const VIEWS = {
    dashboard() {
      $('#kpi-dashboard').innerHTML = [
        { titulo: 'Partidas na próxima hora', valor: D.partidas.length, variacao: '+3', legenda: 'vs. hora anterior', icone: 'bus', serie: [11, 13, 12, 15, 14, 16, 15, 18] },
        { titulo: 'Passageiros presentes', valor: D.totais.presentes, variacao: '+8,4%', legenda: 'vs. hora anterior', icone: 'users', serie: [140, 158, 152, 176, 190, 184, 201, 214] },
        { titulo: 'Atrasos ativos', valor: D.totais.atrasos, variacao: '-2', legenda: 'vs. hora anterior', icone: 'clock', serie: [7, 6, 8, 6, 5, 5, 4, 3] },
        { titulo: 'Plataformas ocupadas', valor: `${D.totais.ocupadas} de ${D.terminal.plataformas}`, variacao: '+1', legenda: 'vs. hora anterior', icone: 'grid', serie: [5, 6, 6, 7, 8, 8, 9, 9] },
      ].map(kpi).join('');
      montarMapa($('#mapa-dashboard'), D.terminal, D.partidas);
      const feed = feedPartidas($('#feed-dashboard'));
      const tab = tabelaPartidas($('#tabela-partidas'), $('#busca-partidas'));
      LIVE.assinar(() => { plataformas = LIVE.ler(); feed.render(); tab.atualizar(D.partidas); });

      const rodarMotor = (btnMotor, cenario) => btnMotor && btnMotor.addEventListener('click', async () => {
        btnMotor.disabled = true; const rotuloOriginal = btnMotor.textContent; btnMotor.textContent = cenario ? 'Simulando temporal…' : 'Consultando clima e trânsito…';
        try {
          const r = await fetch('/api/motor/recalcular', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cenario ? { cenario } : {}) });
          const d = await r.json();
          if (!d.ok) { toast(d.erro, false); return; }
          D.partidas = d.partidas; D.avisos = d.avisos;
          tab.atualizar(D.partidas); feed.render();
          if (d.escalonadas.length) {
            toast(`Motor preditivo: ${d.escalonadas.length} partida(s) com risco crítico — aviso e WhatsApp disparados (${d.escalonadas[0].envios[0]?.modo || 'SIMULACAO'})`);
          } else {
            toast('Motor preditivo: nenhuma partida cruzou o limiar de risco agora.');
          }
        } catch (e) {
          toast('Falha ao consultar o motor preditivo.', false);
        } finally {
          btnMotor.disabled = false; btnMotor.textContent = rotuloOriginal;
        }
      });
      rodarMotor($('#btn-recalcular-motor'), null);
      rodarMotor($('#btn-motor-temporal'), 'temporal');
    },
    departures() {
      $('#kpi-departures').innerHTML = [
        { titulo: 'Partidas hoje', valor: '32', variacao: '+4', legenda: 'vs. ontem', icone: 'bus', serie: [24, 26, 25, 28, 29, 30, 31, 32] },
        { titulo: 'Passageiros embarcados', valor: '1.284', variacao: '+9,2%', legenda: 'vs. ontem', icone: 'users', serie: [980, 1020, 1075, 1110, 1160, 1198, 1240, 1284] },
        { titulo: 'Pontualidade do dia', valor: '93,7%', variacao: '+1,4%', legenda: 'vs. ontem', icone: 'clock', serie: [88, 89, 90, 91, 92, 92.5, 93, 93.7] },
        { titulo: 'Plataformas usadas', valor: '12 de 14', variacao: '+1', legenda: 'vs. ontem', icone: 'grid', serie: [8, 9, 9, 10, 11, 11, 12, 12] },
      ].map(kpi).join('');
      barChart($('#bars-departures'), [['06h', 2], ['08h', 4], ['10h', 3], ['12h', 5], ['14h', 4], ['16h', 7], ['18h', 5], ['20h', 2]].map(([label, valor]) => ({ label, valor })), { altura: 150, sufixo: ' partidas' });
      const tab = tabelaPartidas($('#tabela-partidas-2'), $('#busca-partidas-2'));
      LIVE.assinar(() => { plataformas = LIVE.ler(); tab.atualizar(D.partidas); });
    },
    delays() {
      $('#kpi-delays').innerHTML = [
        { titulo: 'Atrasos ativos', valor: D.totais.atrasos, variacao: '-2', legenda: 'vs. hora anterior', icone: 'alert', serie: [7, 6, 8, 6, 5, 5, 4, 3] },
        { titulo: 'Atraso médio', valor: '18 min', variacao: '-4 min', legenda: 'vs. ontem', icone: 'timer', serie: [28, 26, 25, 23, 22, 20, 19, 18] },
        { titulo: 'Passageiros afetados', valor: '146', variacao: '-32', legenda: 'vs. ontem', icone: 'users', serie: [220, 208, 196, 184, 176, 164, 152, 146] },
        { titulo: 'Avisos disparados', valor: '412', variacao: '+38', legenda: 'vs. ontem', icone: 'bell', serie: [280, 300, 318, 340, 356, 372, 392, 412] },
      ].map(kpi).join('');
      const causas = [['Trânsito na chegada', 14, '#f59e0b'], ['Fila na plataforma', 8, '#a528ff'], ['Problema mecânico', 5, '#ef4444'], ['Troca de motorista', 3, '#3b82f6']];
      const tot = causas.reduce((s, c) => s + c[1], 0);
      $('#lista-atrasos').innerHTML = D.partidas.filter((p) => p.status === 'atrasado').map((p) => `
        <li><span class="row-icon bg-red">${ICON('alert')}</span>
          <div class="row-main"><div class="t">${p.destino} <span class="dim">· ${p.horario}</span></div><div class="s">${p.viacao} · ${p.id} · ${p.total} passageiros</div></div>
          <span class="chip warn">Trânsito na chegada</span><span style="color:#ef4444;width:64px;text-align:right">+${p.eta}</span><span class="chip done">avisados</span></li>`).join('');
      $('#causas-atrasos').innerHTML = `<div class="dist">${causas.map((c) => `<span style="background:${c[2]};flex-grow:${c[1]}" title="${c[0]}: ${c[1]}"></span>`).join('')}</div>
        <ul class="rows" style="margin-top:12px">${causas.map((c) => `<li style="padding:6px 0;border:0"><i style="width:10px;height:10px;border-radius:9999px;background:${c[2]}"></i><span style="flex:1;font-size:12.5px;color:#374151">${c[0]}</span><span>${c[1]}</span><span class="muted" style="width:40px;text-align:right">${Math.round((c[1] / tot) * 100)}%</span></li>`).join('')}</ul>
        <p class="note">Trânsito na chegada responde por ${Math.round((causas[0][1] / tot) * 100)}% dos atrasos. É o alvo com maior retorno.</p>`;
    },
    platforms() {
      let piscando = null, hist = [];
      const ocupadas = () => new Set(D.partidas.map(platDe));
      const render = () => {
        const occ = ocupadas();
        $('#lista-plataformas').innerHTML = D.partidas.slice(0, 6).map((p) => `
          <li><span class="row-icon ${p.id === PASSAGEM.id ? 'bg-accent' : 'bg-gray'}">${ICON('bus')}</span>
            <div class="row-main" style="min-width:210px;flex:0 1 auto"><div class="t">${p.destino} <span class="dim">· ${p.horario}</span></div><div class="s">${p.viacao} · ${p.id} · ${p.total} passageiros</div></div>
            <div class="plat-picker">${PLATS.map((n) => { const cur = platDe(p) === n; const busy = !cur && occ.has(n); return `<button type="button" data-id="${p.id}" data-n="${n}" class="${cur ? 'cur' : ''} ${cur && piscando === p.id ? 'flash' : ''} ${busy ? 'busy' : ''}" title="${busy ? `Plataforma ${n} ocupada por outra partida` : `Mover ${p.destino} para a plataforma ${n}`}">${n}</button>`; }).join('')}</div></li>`).join('');
        $$('#lista-plataformas .plat-picker button').forEach((b) => b.addEventListener('click', () => trocar(b.dataset.id, b.dataset.n)));
        $('#hist-plataformas').innerHTML = hist.length ? hist.map((h) => `<li style="padding:6px 0;border:0"><span style="display:inline-flex;color:#10b981;width:14px;height:14px">${ICON('check')}</span><span>${h.destino}</span><span class="muted">movida para a plataforma ${h.plataforma}</span><span class="muted" style="margin-left:auto">${h.avisados} avisados · ${h.hora}</span></li>`).join('') : '<li class="muted small" style="border:0">Nenhum aviso ainda. Troque uma plataforma para disparar a notificação.</li>';
      };
      async function trocar(id, n) {
        const r = await fetch('/api/plataforma', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ partida: id, plataforma: n }) });
        const d = await r.json(); if (!d.ok) return toast(d.erro, false);
        const p = D.partidas.find((x) => x.id === id); p.plataforma = d.plataforma;
        LIVE.definir(id, d.plataforma, { sms: d.sms, destino: p.destino });
        hist.unshift({ destino: p.destino, plataforma: d.plataforma, avisados: d.avisados, hora: d.aviso.hora }); hist = hist.slice(0, 6);
        piscando = id; render(); setTimeout(() => { piscando = null; render(); }, 1500);
        toast(`${d.avisados} passageiros avisados · plataforma ${d.anterior} → ${d.plataforma}`);
      }
      LIVE.assinar((m) => { plataformas = m; render(); });
      montarCelular($('#phone-app'));
      render();
    },
    contacts() {
      $('#kpi-contacts').innerHTML = [
        { titulo: 'Contatos cadastrados', valor: D.totais.contatos, variacao: '+1', legenda: 'base fictícia', icone: 'userplus', serie: [2, 3, 3, 4, 4, 4, 5, 5] },
        { titulo: 'Contatos ativos', valor: D.totais.ativos, variacao: '+1', legenda: 'elegíveis para envio', icone: 'users', serie: [2, 2, 3, 3, 3, 4, 4, 4] },
        { titulo: 'Municípios cobertos', valor: new Set(D.contatos.map((c) => c.cidade)).size, variacao: '+2', legenda: 'no Estado de SP', icone: 'pin', serie: [1, 2, 2, 3, 3, 4, 5, 5] },
        { titulo: 'Conexão Oracle', valor: 'simulada', variacao: 'ok', legenda: 'Azure · sandbox', icone: 'db', serie: [1, 1, 1, 1, 1, 1, 1, 1] },
      ].map(kpi).join('');
      dataTable($('#tabela-contatos'), {
        colunas: [
          { id: 'id', label: 'ID', render: (c) => `#${c.id}` },
          { id: 'nome', label: 'Nome', render: (c) => `<span style="display:inline-flex;align-items:center;gap:8px"><span class="initials">${iniciais(c.nome)}</span>${c.nome}</span>` },
          { id: 'telefone', label: 'Telefone' }, { id: 'cidade', label: 'Município' },
          { id: 'status', label: 'Status', render: (c) => `<span class="chip ${c.status === 'Ativo' ? 'done' : 'muted'}">${ICON(c.status === 'Ativo' ? 'circlecheck' : 'x')}${c.status}</span>` },
        ], linhas: D.contatos, porPagina: 5,
      });
      $('#testDb').addEventListener('click', async () => { const r = await fetch('/api/status'); const d = await r.json(); toast(`Oracle Azure: conexão ${d.oracle} · ${d.apis} APIs · SMS ${d.sms}`); });
    },
    sources() {
      $('#kpi-sources').innerHTML = [
        { titulo: 'APIs catalogadas', valor: D.apis.length, variacao: '+1', legenda: 'fontes do protótipo', icone: 'db', serie: [2, 3, 3, 4, 4, 5, 5, 5] },
        { titulo: 'Disponíveis agora', valor: D.apis.filter((a) => a.status === 'Disponivel').length, variacao: '+1', legenda: 'sem token', icone: 'plug', serie: [1, 2, 2, 2, 3, 3, 3, 3] },
        { titulo: 'Categorias', valor: new Set(D.apis.map((a) => a.tipo)).size, variacao: '', legenda: 'clima, saúde, trânsito...', icone: 'grid', serie: [3, 3, 4, 4, 5, 5, 5, 5] },
        { titulo: 'Cobertura', valor: 'SP', variacao: '', legenda: 'estado e capital', icone: 'pin', serie: [1, 1, 1, 1, 1, 1, 1, 1] },
      ].map(kpi).join('');
    },
    live() {
      const tick = () => ($('#relogio').textContent = new Date().toLocaleTimeString('pt-BR')); tick(); setInterval(tick, 1000);
      $('#kpi-live').innerHTML = [
        { titulo: 'Ônibus no pátio', valor: D.partidas.filter((p) => ['patio', 'embarcando'].includes(p.status)).length, variacao: '+2', legenda: 'nos últimos 15 min', icone: 'bus', serie: [5, 6, 6, 7, 7, 8, 8, 9] },
        { titulo: 'Embarques abertos', valor: D.partidas.filter((p) => p.status === 'embarcando').length, variacao: '+1', legenda: 'nos últimos 15 min', icone: 'door', serie: [2, 2, 3, 3, 3, 4, 4, 4] },
        { titulo: 'Passageiros no saguão', valor: D.totais.presentes, variacao: '+18', legenda: 'nos últimos 15 min', icone: 'users', serie: [150, 162, 174, 182, 190, 198, 206, 214] },
        { titulo: 'Ocorrências abertas', valor: D.ocorrencias.filter((o) => o.estado !== 'resolvida').length, variacao: '-1', legenda: 'nos últimos 15 min', icone: 'alert', serie: [4, 4, 3, 3, 3, 2, 2, 2] },
      ].map(kpi).join('');
      montarMapa($('#mapa-live'), D.terminal, D.partidas);
      const feed = feedPartidas($('#feed-live'));
      LIVE.assinar(() => { plataformas = LIVE.ler(); feed.render(); });
    },
    sms() {
      $('#kpi-sms').innerHTML = [
        { titulo: 'Avisos enviados hoje', valor: '412', variacao: '+38', legenda: 'vs. ontem', icone: 'send', serie: [280, 300, 318, 340, 356, 372, 392, 412] },
        { titulo: 'Passageiros alcançados', valor: '1.106', variacao: '+12,4%', legenda: 'vs. ontem', icone: 'users', serie: [820, 870, 910, 960, 1000, 1040, 1075, 1106] },
        { titulo: 'Taxa de entrega', valor: '98,1%', variacao: '+0,6%', legenda: 'gateway sandbox', icone: 'circlecheck', serie: [95, 96, 96, 97, 97, 97.5, 98, 98.1] },
        { titulo: 'Tempo até o aviso', valor: '8 s', variacao: '-3 s', legenda: 'vs. ontem', icone: 'timer', serie: [18, 16, 15, 13, 12, 10, 9, 8] },
      ].map(kpi).join('');
      const cidades = ['Todas', ...new Set(D.contatos.filter((c) => c.status === 'Ativo').map((c) => c.cidade))];
      const cat = combo($('#cb-categoria'), D.apis.map((a) => a.tipo), D.apis[0].tipo);
      const cid = combo($('#cb-cidade'), cidades, 'Todas');
      const msg = $('#mensagem'), prev = $('#preview'), cnt = $('#count');
      msg.addEventListener('input', () => { cnt.textContent = msg.value.length; prev.textContent = msg.value || 'Sua mensagem aparecerá aqui.'; });
      $('#smsForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const r = await fetch('/api/simular-sms', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ categoria: cat.get(), cidade: cid.get(), mensagem: msg.value }) });
        const d = await r.json();
        if (d.ok) { toast(`${d.destinatarios} SMS simulado(s) · protocolo ${d.protocolo}`); renderAvisos([{ hora: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }), tipo: 'sms', titulo: `${d.categoria} · ${d.cidade}`, detalhe: d.mensagem, alcance: d.destinatarios }, ...D.avisos]); }
        else toast(d.erro, false);
      });
      const TIPO = { plataforma: ['pin', '#a528ff'], atraso: ['clock', '#f59e0b'], embarque: ['door', '#10b981'], sms: ['msg', '#3b82f6'] };
      const renderAvisos = (lista) => { D.avisos = lista; $('#lista-avisos').innerHTML = lista.map((a) => { const [ic, cor] = TIPO[a.tipo] || TIPO.sms; return `<li><span class="row-icon" style="background:${cor}1a;color:${cor}">${ICON(ic)}</span><div class="row-main"><div class="t">${a.titulo}</div><div class="s">${a.detalhe}</div></div><span class="small muted">${a.alcance} avisados</span><span class="tiny muted" style="width:44px;text-align:right">${a.hora}</span></li>`; }).join(''); };
      renderAvisos(D.avisos);
      LIVE.assinar(async (_, alt) => { if (!alt) return; const r = await fetch('/api/avisos'); const d = await r.json(); renderAvisos(d.avisos); });
    },
    incidents() {
      $('#kpi-incidents').innerHTML = [
        { titulo: 'Ocorrências abertas', valor: D.ocorrencias.filter((o) => o.estado !== 'resolvida').length, variacao: '-1', legenda: 'vs. turno anterior', icone: 'alert', serie: [5, 5, 4, 4, 3, 3, 2, 2] },
        { titulo: 'Resolvidas hoje', valor: '11', variacao: '+4', legenda: 'vs. ontem', icone: 'circlecheck', serie: [4, 5, 6, 7, 8, 9, 10, 11] },
        { titulo: 'Tempo médio de resolução', valor: '12 min', variacao: '-3 min', legenda: 'vs. ontem', icone: 'timer', serie: [20, 19, 18, 16, 15, 14, 13, 12] },
        { titulo: 'Críticas no mês', valor: '3', variacao: '-2', legenda: 'vs. mês anterior', icone: 'alert', serie: [6, 6, 5, 5, 4, 4, 3, 3] },
      ].map(kpi).join('');
      let filtro = 'abertas';
      const GR = { critica: ['Crítica', 'bad', 'bg-red'], alta: ['Alta', 'warn', 'bg-amber'], media: ['Média', 'info', 'bg-blue'] };
      const ES = { aberta: ['Aberta', 'bad'], andamento: ['Em andamento', 'warn'], resolvida: ['Resolvida', 'done'] };
      const render = () => {
        const lista = D.ocorrencias.filter((o) => filtro === 'abertas' ? o.estado !== 'resolvida' : filtro === 'resolvidas' ? o.estado === 'resolvida' : true);
        $('#lista-oc').innerHTML = lista.map((o) => `<li><span class="row-icon ${GR[o.gravidade][2]}">${ICON('alert')}</span><div class="row-main"><div class="t">${o.titulo}</div><div class="s">${o.id} · ${o.local} · ${o.responsavel}</div></div><span class="chip ${GR[o.gravidade][1]}">${GR[o.gravidade][0]}</span><span class="chip ${ES[o.estado][1]}" style="border:0">${ES[o.estado][0]}</span><span class="small muted" style="width:52px;text-align:right">${o.hora}</span><button type="button" class="btn small" data-id="${o.id}">${o.estado === 'resolvida' ? 'Reabrir' : 'Resolver'}</button></li>`).join('') || '<li class="muted small" style="justify-content:center">Nenhuma ocorrência</li>';
        $$('#lista-oc .btn').forEach((b) => b.addEventListener('click', () => { const o = D.ocorrencias.find((x) => x.id === b.dataset.id); o.estado = o.estado === 'resolvida' ? 'aberta' : 'resolvida'; render(); }));
      };
      $$('#filtro-oc button').forEach((b) => b.addEventListener('click', () => { filtro = b.dataset.f; $$('#filtro-oc button').forEach((x) => x.setAttribute('aria-pressed', String(x === b))); render(); }));
      render();
    },
  };

  // ---------------- celular do passageiro ----------------
  function montarCelular(el) {
    let atual = plataformas[PASSAGEM.id] || '12', mensagens = [];
    const render = (hot = false, aviso = null) => {
      el.innerHTML = `
        <div class="top"><div class="t1"><span>ClickBus</span>${ICON('bell')}</div><div class="t2">Sua viagem</div><div class="t3">${PASSAGEM.passageiro}</div></div>
        <div class="alert ${aviso ? 'on' : ''} ${hot ? 'hot' : ''}">${ICON('pin')}<span>${aviso || ''}</span></div>
        <div class="body">
          <div class="line">${ICON('bus')}${PASSAGEM.viacao} · ${PASSAGEM.id}</div>
          <div class="city">${PASSAGEM.origem}</div><div class="to">para</div><div class="city">${PASSAGEM.destino}</div>
          <div class="facts"><div><p>Horário</p><b>${PASSAGEM.horario}</b></div><div><p>Poltrona</p><b>${PASSAGEM.poltrona}</b></div><div><p>Plataforma</p><b class="${hot ? 'hot' : ''}">${atual}</b></div></div>
          ${mensagens.length ? `<div class="sms"><div class="lbl">SMS recebido</div>${mensagens.map((m, i) => `<div class="bubble ${i === 0 && hot ? 'new' : ''}">${m}</div>`).join('')}</div>` : `<div class="qr">${ICON('qr')}<div><div class="a">Embarque</div><div class="b">Apresente este código na plataforma ${atual}</div></div></div>`}
        </div>`;
    };
    LIVE.assinar((m, alt) => { const nova = m[PASSAGEM.id]; if (!nova) return; const mudou = nova !== atual; if (alt && alt.sms && alt.id === PASSAGEM.id && !mensagens.includes(alt.sms)) mensagens = [alt.sms, ...mensagens].slice(0, 2); if (!mudou && !(alt && alt.sms)) return; atual = nova; render(true, `Sua plataforma mudou para ${nova}`); clearTimeout(window._pt); window._pt = setTimeout(() => render(false, `Sua plataforma mudou para ${nova}`), 2600); });
    render();
  }
  window.montarCelular = montarCelular;

  // ---------------- início ----------------
  const inicial = location.hash.replace('#', '');
  renderNav(); irPara(acharItem(inicial) ? inicial : 'dashboard');
})();
