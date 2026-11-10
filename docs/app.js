// App Academia — interface (vanilla JS, sem build). Telas por hash (#treinar, #fichas ...).
(function () {
  const S = window.Store, sb = S.sb;
  const $ = (sel, el = document) => el.querySelector(sel);
  const main = () => $("#main");
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const num = (v) => { const n = parseFloat(String(v).replace(",", ".")); return isNaN(n) ? 0 : n; };
  const fmtKg = (v) => (Math.round(num(v) * 10) / 10).toLocaleString("pt-BR") + " kg";
  const rm1 = (carga, reps) => (reps > 0 ? num(carga) * (1 + reps / 30) : 0); // fórmula de Epley
  const fmtData = (iso) => new Date(iso).toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "short" });
  const fmtHora = (iso) => new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const GRUPOS = ["Peito", "Costas", "Ombros", "Bíceps", "Tríceps", "Pernas", "Glúteos", "Panturrilha", "Abdômen", "Antebraço", "Cardio", "Outros"];
  function toast(msg) {
    const t = $("#toast"); t.textContent = msg; t.classList.add("on");
    clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove("on"), 2200);
  }

  // ---------- consultas sobre os dados locais ----------
  const Q = {
    exercicios: () => S.lista("exercicios").sort((a, b) => a.grupo.localeCompare(b.grupo) || a.nome.localeCompare(b.nome)),
    fichas: () => S.lista("fichas").sort((a, b) => a.ordem - b.ordem || a.nome.localeCompare(b.nome)),
    itensFicha: (fid) => S.lista("ficha_exercicios", (r) => r.ficha_id === fid).sort((a, b) => a.ordem - b.ordem),
    sessoes: () => S.lista("sessoes").sort((a, b) => b.iniciada_em.localeCompare(a.iniciada_em)),
    sessaoAtiva: () => S.lista("sessoes", (s) => !s.finalizada_em).sort((a, b) => b.iniciada_em.localeCompare(a.iniciada_em))[0],
    seriesSessao: (sid) => S.lista("series", (r) => r.sessao_id === sid).sort((a, b) => a.ordem_exercicio - b.ordem_exercicio || a.numero - b.numero),
    // séries feitas de um exercício agrupadas por sessão (mais recente primeiro)
    historicoEx(exId, excetoSessao) {
      const porSessao = {};
      for (const r of S.lista("series", (r) => r.exercicio_id === exId && r.feita && r.sessao_id !== excetoSessao)) {
        const s = S.get("sessoes", r.sessao_id); if (!s || s.excluido) continue;
        (porSessao[r.sessao_id] ||= { sessao: s, series: [] }).series.push(r);
      }
      return Object.values(porSessao).map((g) => { g.series.sort((a, b) => a.numero - b.numero); return g; })
        .sort((a, b) => b.sessao.iniciada_em.localeCompare(a.sessao.iniciada_em));
    },
    recordes(exId) {
      let maxCarga = 0, max1rm = 0, maxVol = 0;
      for (const g of Q.historicoEx(exId)) {
        let vol = 0;
        for (const r of g.series) { maxCarga = Math.max(maxCarga, num(r.carga_kg)); max1rm = Math.max(max1rm, rm1(r.carga_kg, r.reps)); vol += num(r.carga_kg) * r.reps; }
        maxVol = Math.max(maxVol, vol);
      }
      return { maxCarga, max1rm, maxVol };
    },
  };

  // ---------- cronômetro de descanso ----------
  const Timer = {
    fim: 0, total: 0, _i: null,
    iniciar(seg) {
      this.total = seg; this.fim = Date.now() + seg * 1000;
      localStorage.setItem("timerFim", this.fim); localStorage.setItem("timerTotal", seg);
      this.loop(); $("#timer").classList.add("on");
    },
    ajustar(d) { if (!this.fim) return; this.fim += d * 1000; this.total = Math.max(1, this.total + d); localStorage.setItem("timerFim", this.fim); this.tick(); },
    parar() { this.fim = 0; localStorage.removeItem("timerFim"); clearInterval(this._i); $("#timer").classList.remove("on"); },
    loop() { clearInterval(this._i); this._i = setInterval(() => this.tick(), 250); this.tick(); },
    tick() {
      const rest = Math.ceil((this.fim - Date.now()) / 1000);
      if (rest <= 0) { this.parar(); alarme(); toast("⏰ Descanso acabou! Bora pra próxima série"); return; }
      $("#timer-txt").textContent = `${Math.floor(rest / 60)}:${String(rest % 60).padStart(2, "0")}`;
      $("#timer-bar").style.width = `${100 * (1 - rest / this.total)}%`;
    },
    restaurar() {
      const f = +localStorage.getItem("timerFim");
      if (f && f > Date.now()) { this.fim = f; this.total = +localStorage.getItem("timerTotal") || 90; $("#timer").classList.add("on"); this.loop(); }
    },
  };
  function alarme() {
    try { navigator.vibrate && navigator.vibrate([300, 150, 300, 150, 300]); } catch {}
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      [0, 0.35, 0.7].forEach((t) => {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.frequency.value = 880; o.connect(g); g.connect(ctx.destination);
        g.gain.setValueAtTime(0.25, ctx.currentTime + t); g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.3);
        o.start(ctx.currentTime + t); o.stop(ctx.currentTime + t + 0.3);
      });
    } catch {}
    if (document.hidden && "Notification" in window && Notification.permission === "granted") {
      navigator.serviceWorker?.ready.then((r) => r.showNotification("Descanso acabou!", { body: "Hora da próxima série 💪", icon: "icons/icon-192.png", vibrate: [300, 150, 300] }));
    }
  }

  // ---------- telas ----------
  const telas = {};

  telas.treinar = () => {
    const ativa = Q.sessaoAtiva();
    const fichas = Q.fichas();
    const ult = Q.sessoes().filter((s) => s.finalizada_em)[0];
    return `
      ${ativa ? `<button class="card destaque" data-go="ativo"><div class="t">▶ Treino em andamento</div><div class="sub">${esc(ativa.nome)} · desde ${fmtHora(ativa.iniciada_em)}</div></button>` : ""}
      <h2>Começar treino</h2>
      ${fichas.length ? fichas.map((f) => {
        const n = Q.itensFicha(f.id).length;
        const ultF = Q.sessoes().find((s) => s.ficha_id === f.id && s.finalizada_em);
        return `<button class="card" data-act="iniciar" data-id="${f.id}"><div class="t">${esc(f.nome)}</div>
          <div class="sub">${n} exercício${n === 1 ? "" : "s"}${f.descricao ? " · " + esc(f.descricao) : ""}${ultF ? " · último: " + fmtData(ultF.iniciada_em) : ""}</div></button>`;
      }).join("") : `<p class="vazio">Você ainda não tem fichas. Crie seu Treino A, B, C em <b>Fichas</b>.</p>`}
      <button class="btn sec" data-act="iniciar-livre">+ Treino livre (sem ficha)</button>
      ${ult ? `<h2>Último treino</h2><button class="card" data-go="sessao/${ult.id}"><div class="t">${esc(ult.nome)}</div><div class="sub">${fmtData(ult.iniciada_em)} · ${resumoSessao(ult.id)}</div></button>` : ""}
    `;
  };

  function resumoSessao(sid) {
    const ss = Q.seriesSessao(sid).filter((r) => r.feita);
    const ex = new Set(ss.map((r) => r.exercicio_id)).size;
    const vol = ss.reduce((a, r) => a + num(r.carga_kg) * r.reps, 0);
    return `${ex} exerc. · ${ss.length} séries · ${Math.round(vol).toLocaleString("pt-BR")} kg volume`;
  }

  // sugere carga/reps com base na última vez que o exercício foi feito
  function sugestao(exId, numero, sessaoAtual) {
    const h = Q.historicoEx(exId, sessaoAtual)[0];
    if (!h) return null;
    const r = h.series.find((x) => x.numero === numero) || h.series[h.series.length - 1];
    return { carga: num(r.carga_kg), reps: r.reps, data: h.sessao.iniciada_em };
  }

  function iniciarSessao(fichaId) {
    const ativa = Q.sessaoAtiva();
    if (ativa && !confirm("Já existe um treino em andamento. Finalizar ele e começar outro?")) { location.hash = "ativo"; return; }
    if (ativa) finalizarSessao(ativa.id, true);
    const f = fichaId ? S.get("fichas", fichaId) : null;
    const s = S.salvar("sessoes", { nome: f ? f.nome : "Treino livre", ficha_id: fichaId || null, origem: "app", iniciada_em: new Date().toISOString(), finalizada_em: null });
    if (f) Q.itensFicha(f.id).forEach((it, i) => {
      for (let n = 1; n <= it.series; n++) {
        const sg = sugestao(it.exercicio_id, n, s.id);
        const repsAlvo = parseInt(it.reps_alvo) || 10;
        S.salvar("series", { sessao_id: s.id, exercicio_id: it.exercicio_id, ordem_exercicio: i, numero: n, carga_kg: sg ? sg.carga : 0, reps: sg ? sg.reps : repsAlvo, feita: false });
      }
    });
    if ("Notification" in window && Notification.permission === "default") Notification.requestPermission().catch(() => {});
    location.hash = "ativo";
  }

  function finalizarSessao(sid, silencioso) {
    Q.seriesSessao(sid).filter((r) => !r.feita).forEach((r) => S.excluir("series", r.id));
    S.salvar("sessoes", { id: sid, finalizada_em: new Date().toISOString() });
    Timer.parar();
    if (!silencioso) { toast("Treino salvo! 💪"); location.hash = "sessao/" + sid; }
  }

  function descansoDe(sessao, exId) {
    if (!sessao.ficha_id) return 90;
    const it = Q.itensFicha(sessao.ficha_id).find((i) => i.exercicio_id === exId);
    return it ? it.descanso_seg : 90;
  }

  telas.ativo = () => {
    const s = Q.sessaoAtiva();
    if (!s) return `<p class="vazio">Nenhum treino em andamento.</p><button class="btn" data-go="treinar">Ir para Treinar</button>`;
    const series = Q.seriesSessao(s.id);
    const grupos = [];
    for (const r of series) {
      let g = grupos.find((x) => x.ex === r.exercicio_id);
      if (!g) grupos.push((g = { ex: r.exercicio_id, ordem: r.ordem_exercicio, series: [] }));
      g.series.push(r);
    }
    const feitas = series.filter((r) => r.feita).length;
    const min = Math.round((Date.now() - new Date(s.iniciada_em)) / 60000);
    return `
      <div class="topo-sessao"><div><div class="t">${esc(s.nome)}</div><div class="sub">${feitas}/${series.length} séries · ${min} min</div></div>
        <button class="btn ok mini" data-act="finalizar" data-id="${s.id}">Finalizar</button></div>
      ${grupos.map((g) => {
        const ex = S.get("exercicios", g.ex) || { nome: "?" };
        const sg = Q.historicoEx(g.ex, s.id)[0];
        const pr = Q.recordes(g.ex);
        const it = s.ficha_id ? Q.itensFicha(s.ficha_id).find((i) => i.exercicio_id === g.ex) : null;
        return `<div class="exbloco">
          <div class="exhead"><div><div class="t">${esc(ex.nome)}</div>
            <div class="sub">${it ? `Meta: ${it.series}×${esc(it.reps_alvo)} · ` : ""}${sg ? `Última: ${sg.series.map((x) => `${fmtKg(x.carga_kg).replace(" kg", "")}×${x.reps}`).join(", ")} (${fmtData(sg.sessao.iniciada_em)})` : "Primeira vez 🎉"}${pr.maxCarga ? ` · PR ${fmtKg(pr.maxCarga)}` : ""}</div></div>
            <button class="ic" data-go="progresso/${g.ex}" title="Evolução">📈</button></div>
          <div class="serie cab"><span>#</span><span>kg</span><span>reps</span><span></span></div>
          ${g.series.map((r) => `
            <div class="serie ${r.feita ? "feita" : ""}">
              <span class="n">${r.numero}</span>
              <span class="step"><button data-act="d" data-id="${r.id}" data-c="carga_kg" data-v="-2.5">−</button><input inputmode="decimal" data-campo="carga_kg" data-id="${r.id}" value="${num(r.carga_kg)}"><button data-act="d" data-id="${r.id}" data-c="carga_kg" data-v="2.5">+</button></span>
              <span class="step"><button data-act="d" data-id="${r.id}" data-c="reps" data-v="-1">−</button><input inputmode="numeric" data-campo="reps" data-id="${r.id}" value="${r.reps}"><button data-act="d" data-id="${r.id}" data-c="reps" data-v="1">+</button></span>
              <button class="check" data-act="feita" data-id="${r.id}">${r.feita ? "✓" : ""}</button>
            </div>`).join("")}
          <div class="linha-btn"><button class="btn sec mini" data-act="add-serie" data-ex="${g.ex}" data-ord="${g.ordem}">+ Série</button>
            <button class="btn sec mini perigo" data-act="rm-serie" data-ex="${g.ex}">− Série</button></div>
        </div>`;
      }).join("")}
      <button class="btn sec" data-act="add-ex-sessao">+ Adicionar exercício</button>
      <div class="linha-btn"><button class="btn sec mini" data-act="timer" data-v="60">⏱ 1:00</button><button class="btn sec mini" data-act="timer" data-v="90">⏱ 1:30</button><button class="btn sec mini" data-act="timer" data-v="120">⏱ 2:00</button><button class="btn sec mini" data-act="timer" data-v="180">⏱ 3:00</button></div>
      <button class="btn perigo sec" data-act="cancelar-sessao" data-id="${s.id}">Descartar treino</button>
    `;
  };

  telas.fichas = () => {
    const fs = Q.fichas();
    return `<h2>Fichas de treino</h2>
      ${fs.map((f) => `<button class="card" data-go="ficha/${f.id}"><div class="t">${esc(f.nome)}</div><div class="sub">${Q.itensFicha(f.id).map((i) => esc(S.get("exercicios", i.exercicio_id)?.nome)).join(", ") || "sem exercícios"}</div></button>`).join("") || `<p class="vazio">Nenhuma ficha ainda.</p>`}
      <button class="btn" data-act="nova-ficha">+ Nova ficha</button>
      ${fs.length === 0 ? `<button class="btn sec" data-act="modelo-abc">Criar modelo pronto A/B/C</button>` : ""}`;
  };

  telas.ficha = (id) => {
    const f = S.get("fichas", id);
    if (!f || f.excluido) return `<p class="vazio">Ficha não encontrada.</p>`;
    const itens = Q.itensFicha(id);
    return `<button class="voltar" data-go="fichas">‹ Fichas</button>
      <label>Nome<input data-ficha="nome" data-id="${id}" value="${esc(f.nome)}"></label>
      <label>Descrição<input data-ficha="descricao" data-id="${id}" value="${esc(f.descricao || "")}" placeholder="ex.: Peito, ombro e tríceps"></label>
      <h2>Exercícios</h2>
      ${itens.map((it, i) => `<div class="exbloco">
        <div class="exhead"><div class="t">${i + 1}. ${esc(S.get("exercicios", it.exercicio_id)?.nome)}</div>
          <div><button class="ic" data-act="mover" data-id="${it.id}" data-v="-1">▲</button><button class="ic" data-act="mover" data-id="${it.id}" data-v="1">▼</button><button class="ic" data-act="rm-item" data-id="${it.id}">🗑</button></div></div>
        <div class="grade3">
          <label>Séries<input inputmode="numeric" data-item="series" data-id="${it.id}" value="${it.series}"></label>
          <label>Reps<input data-item="reps_alvo" data-id="${it.id}" value="${esc(it.reps_alvo)}"></label>
          <label>Descanso (s)<input inputmode="numeric" data-item="descanso_seg" data-id="${it.id}" value="${it.descanso_seg}"></label>
        </div></div>`).join("")}
      <button class="btn sec" data-act="add-ex-ficha" data-id="${id}">+ Adicionar exercício</button>
      <button class="btn" data-act="iniciar" data-id="${id}">▶ Começar este treino</button>
      <button class="btn sec perigo" data-act="rm-ficha" data-id="${id}">Excluir ficha</button>`;
  };

  telas.exercicios = () => {
    const filtro = (telas.exercicios.busca || "").toLowerCase();
    const lista = Q.exercicios().filter((e) => !filtro || e.nome.toLowerCase().includes(filtro) || e.grupo.toLowerCase().includes(filtro));
    let g0 = "";
    return `<h2>Exercícios</h2>
      <input id="busca-ex" placeholder="🔍 Buscar exercício ou grupo" value="${esc(telas.exercicios.busca || "")}">
      <button class="btn" data-act="novo-ex">+ Novo exercício</button>
      <div class="lista">${lista.map((e) => {
        const cab = e.grupo !== g0 ? `<div class="grupo">${esc((g0 = e.grupo))}</div>` : "";
        const pr = Q.recordes(e.id);
        return `${cab}<div class="item"><button class="item-main" data-go="progresso/${e.id}"><span>${esc(e.nome)}</span><span class="sub">${pr.maxCarga ? "PR " + fmtKg(pr.maxCarga) : ""}${e.user_id ? " · meu" : ""}</span></button>
          ${e.user_id ? `<button class="ic" data-act="editar-ex" data-id="${e.id}">✏️</button>` : ""}</div>`;
      }).join("")}</div>`;
  };

  telas.historico = () => {
    const ss = Q.sessoes().filter((s) => s.finalizada_em);
    if (!ss.length) return `<h2>Histórico</h2><p class="vazio">Nenhum treino finalizado ainda.</p>`;
    // frequência das últimas semanas
    const semana = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x.getTime(); };
    const hoje = semana(new Date()); const freq = [];
    for (let i = 7; i >= 0; i--) { const w = hoje - i * 7 * 864e5; freq.push(ss.filter((s) => semana(s.iniciada_em) === w).length); }
    const mx = Math.max(3, ...freq);
    return `<h2>Histórico</h2>
      <div class="freq">${freq.map((n, i) => `<div class="fcol"><div class="fbar" style="height:${(n / mx) * 100}%"></div><span>${n}</span></div>`).join("")}</div>
      <div class="sub centro">treinos por semana (últimas 8)</div>
      ${ss.map((s) => `<button class="card" data-go="sessao/${s.id}"><div class="t">${esc(s.nome)} ${s.origem === "chat" ? "💬" : ""}</div><div class="sub">${fmtData(s.iniciada_em)} ${fmtHora(s.iniciada_em)} · ${resumoSessao(s.id)}</div></button>`).join("")}`;
  };

  telas.sessao = (id) => {
    const s = S.get("sessoes", id);
    if (!s || s.excluido) return `<p class="vazio">Treino não encontrado.</p>`;
    const series = Q.seriesSessao(id).filter((r) => r.feita);
    const porEx = {};
    series.forEach((r) => (porEx[r.exercicio_id] ||= []).push(r));
    const dur = s.finalizada_em ? Math.round((new Date(s.finalizada_em) - new Date(s.iniciada_em)) / 60000) : null;
    return `<button class="voltar" data-go="historico">‹ Histórico</button>
      <h2>${esc(s.nome)}</h2><div class="sub">${fmtData(s.iniciada_em)} ${fmtHora(s.iniciada_em)}${dur ? ` · ${dur} min` : ""} · ${resumoSessao(id)}</div>
      ${s.notas ? `<p>${esc(s.notas)}</p>` : ""}
      ${Object.entries(porEx).map(([ex, rs]) => `<div class="exbloco"><div class="exhead"><div class="t">${esc(S.get("exercicios", ex)?.nome)}</div><button class="ic" data-go="progresso/${ex}">📈</button></div>
        ${rs.map((r) => `<div class="sub">Série ${r.numero}: <b>${fmtKg(r.carga_kg)} × ${r.reps}</b> · 1RM≈${fmtKg(rm1(r.carga_kg, r.reps))}</div>`).join("")}</div>`).join("")}
      <label>Anotações<textarea data-notas="${id}" rows="3" placeholder="Como foi o treino?">${esc(s.notas || "")}</textarea></label>
      <button class="btn sec perigo" data-act="rm-sessao" data-id="${id}">Excluir este treino</button>`;
  };

  telas.progresso = (exId) => {
    if (!exId) {
      const usados = Q.exercicios().filter((e) => Q.historicoEx(e.id).length);
      return `<h2>Evolução</h2>${usados.length ? usados.map((e) => { const pr = Q.recordes(e.id); return `<button class="card" data-go="progresso/${e.id}"><div class="t">${esc(e.nome)}</div><div class="sub">PR ${fmtKg(pr.maxCarga)} · 1RM est. ${fmtKg(pr.max1rm)}</div></button>`; }).join("") : `<p class="vazio">Registre treinos para ver sua evolução.</p>`}`;
    }
    const ex = S.get("exercicios", exId);
    const h = Q.historicoEx(exId).reverse();
    const pr = Q.recordes(exId);
    const pts = h.map((g) => ({ d: g.sessao.iniciada_em, carga: Math.max(...g.series.map((r) => num(r.carga_kg))), rm: Math.max(...g.series.map((r) => rm1(r.carga_kg, r.reps))) }));
    return `<button class="voltar" data-go="progresso">‹ Evolução</button>
      <h2>${esc(ex?.nome)}</h2><div class="sub">${esc(ex?.grupo)}</div>
      <div class="kpis"><div><b>${fmtKg(pr.maxCarga)}</b><span>Maior carga (PR)</span></div><div><b>${fmtKg(pr.max1rm)}</b><span>1RM estimado</span></div><div><b>${h.length}</b><span>Treinos</span></div></div>
      ${pts.length >= 1 ? grafico(pts) : ""}
      <div class="legenda"><span class="l1">■ Carga máxima</span> <span class="l2">■ 1RM estimado</span></div>
      <h2>Histórico</h2>
      ${h.slice().reverse().map((g) => `<div class="sub hist"><b>${fmtData(g.sessao.iniciada_em)}</b> — ${g.series.map((r) => `${fmtKg(r.carga_kg).replace(" kg", "")}×${r.reps}`).join(" · ")}</div>`).join("") || `<p class="vazio">Sem registros ainda.</p>`}
      <p class="sub">1RM estimado pela fórmula de Epley: carga × (1 + reps/30).</p>`;
  };

  function grafico(pts, unico) {
    const W = 340, H = 180, P = 30;
    const vals = pts.flatMap((p) => [p.carga, p.rm]);
    let mn = Math.min(...vals), mx = Math.max(...vals);
    if (mx === mn) { mx += 5; mn = Math.max(0, mn - 5); }
    const x = (i) => P + (pts.length === 1 ? (W - 2 * P) / 2 : (i * (W - 2 * P)) / (pts.length - 1));
    const y = (v) => H - P + 10 - ((v - mn) / (mx - mn)) * (H - 2 * P);
    const linha = (k, cls) => `<polyline class="${cls}" points="${pts.map((p, i) => `${x(i)},${y(p[k])}`).join(" ")}"/>` + pts.map((p, i) => `<circle class="${cls}" cx="${x(i)}" cy="${y(p[k])}" r="3"/>`).join("");
    const ticks = [mn, (mn + mx) / 2, mx].map((v) => `<text x="2" y="${y(v) + 4}">${Math.round(v)}</text><line x1="${P}" x2="${W - 5}" y1="${y(v)}" y2="${y(v)}"/>`).join("");
    const datas = [0, pts.length - 1].filter((v, i, a) => a.indexOf(v) === i).map((i) => `<text x="${Math.min(W - 40, Math.max(P - 10, x(i) - 18))}" y="${H - 2}">${new Date(pts[i].d).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}</text>`).join("");
    return `<svg class="graf" viewBox="0 0 ${W} ${H}">${ticks}${datas}${unico ? "" : linha("rm", "l2")}${linha("carga", "l1")}</svg>`;
  }

  // ---------- perfil: idade, altura, peso, IMC ----------
  const P = {
    perfil: () => S.get("perfis", S.user.id),
    pesagens: () => S.lista("pesagens").sort((a, b) => a.data.localeCompare(b.data)),
    idadeAtual(p) {
      if (!p?.idade) return null;
      if (!p.idade_em) return p.idade;
      const anos = (Date.now() - new Date(p.idade_em + "T12:00:00")) / (365.25 * 864e5);
      return p.idade + Math.floor(anos);
    },
    imc: (peso, alturaCm) => (peso && alturaCm ? peso / Math.pow(alturaCm / 100, 2) : null),
    faixa(imc) {
      if (imc == null) return "";
      return imc < 18.5 ? "Abaixo do peso" : imc < 25 ? "Peso normal" : imc < 30 ? "Sobrepeso" : imc < 35 ? "Obesidade grau I" : imc < 40 ? "Obesidade grau II" : "Obesidade grau III";
    },
  };
  const hojeISO = () => { const d = new Date(); return new Date(d - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10); };

  telas.perfil = () => {
    const p = P.perfil() || {};
    const ps = P.pesagens();
    const atual = ps[ps.length - 1];
    const imc = P.imc(atual && num(atual.peso_kg), num(p.altura_cm));
    const primeiro = ps[0];
    const dif = atual && primeiro && ps.length > 1 ? num(atual.peso_kg) - num(primeiro.peso_kg) : null;
    const pts = ps.map((x) => ({ d: x.data + "T12:00:00", carga: num(x.peso_kg), rm: num(x.peso_kg) }));
    return `<h2>Meu perfil</h2>
      <div class="kpis"><div><b>${atual ? fmtKg(atual.peso_kg) : "—"}</b><span>Peso atual</span></div>
        <div><b>${imc ? imc.toFixed(1).replace(".", ",") : "—"}</b><span>IMC${imc ? " · " + P.faixa(imc) : ""}</span></div>
        <div><b>${P.idadeAtual(p) ?? "—"}</b><span>Idade</span></div></div>
      ${dif != null ? `<p class="sub centro">Variação desde ${new Date(primeiro.data + "T12:00:00").toLocaleDateString("pt-BR")}: <b>${dif > 0 ? "+" : ""}${dif.toFixed(1).replace(".", ",")} kg</b></p>` : ""}
      <div class="grade3">
        <label>Idade<input inputmode="numeric" data-perfil="idade" value="${p.idade ? P.idadeAtual(p) : ""}"></label>
        <label>Altura (cm)<input inputmode="decimal" data-perfil="altura_cm" value="${p.altura_cm ? num(p.altura_cm) : ""}"></label>
        <label>Meta (kg)<input inputmode="decimal" data-perfil="meta_peso_kg" value="${p.meta_peso_kg ? num(p.meta_peso_kg) : ""}"></label>
      </div>
      <label>Nome<input data-perfil="nome" value="${esc(p.nome || "")}"></label>
      <h2>Peso corporal</h2>
      <div class="linha-btn"><input id="novo-peso" inputmode="decimal" placeholder="Peso hoje (kg)" value=""><button class="btn mini" data-act="add-peso">Registrar</button></div>
      ${pts.length ? grafico(pts, true) : `<p class="vazio">Registre seu peso para ver o gráfico.</p>`}
      ${ps.slice().reverse().slice(0, 30).map((x) => { const i = P.imc(num(x.peso_kg), num(p.altura_cm)); return `<div class="item"><span class="item-main"><span>${new Date(x.data + "T12:00:00").toLocaleDateString("pt-BR")}</span><span class="sub"><b>${fmtKg(x.peso_kg)}</b>${i ? " · IMC " + i.toFixed(1).replace(".", ",") : ""}</span></span><button class="ic" data-act="rm-peso" data-id="${x.id}">🗑</button></div>`; }).join("")}
      <p class="sub">IMC = peso ÷ altura². É só uma referência — não considera massa muscular.</p>
      ${telas.conta()}`;
  };

  telas.conta = () => `<h2>Conta</h2>
    <div class="card"><div class="t">${esc(S.user?.email)}</div><div class="sub">Sincronização: ${statusTxt()}${S.ultimaSync ? " · " + S.ultimaSync.toLocaleTimeString("pt-BR") : ""}${S.fila.length ? ` · ${S.fila.length} pendente(s)` : ""}</div>
    ${S.status === "erro" ? `<div class="sub erro">${esc(S.erroSync)}</div>` : ""}</div>
    <button class="btn sec" data-act="sync">🔄 Sincronizar agora</button>
    <button class="btn sec" data-act="instalar">📲 Como instalar no celular</button>
    <button class="btn sec" data-act="senha">🔑 Trocar senha</button>
    <button class="btn sec" data-act="exportar">⬇️ Exportar meus dados (CSV)</button>
    <button class="btn sec perigo" data-act="sair">Sair</button>
    <p class="sub centro">App Academia v${window.APP_CONFIG.VERSAO}</p>`;

  function statusTxt() { return { ok: "✅ em dia", sincronizando: "⏳ sincronizando…", offline: "📴 offline (salvo no aparelho)", erro: "⚠️ erro" }[S.status] || S.status; }

  // ---------- modal de escolha de exercício ----------
  function escolherExercicio(cb) {
    const m = $("#modal");
    const render = (f = "") => {
      const lista = Q.exercicios().filter((e) => !f || e.nome.toLowerCase().includes(f.toLowerCase()) || e.grupo.toLowerCase().includes(f.toLowerCase()));
      $("#modal-lista").innerHTML = lista.map((e) => `<button class="item-main" data-pick="${e.id}"><span>${esc(e.nome)}</span><span class="sub">${esc(e.grupo)}</span></button>`).join("") +
        (f ? `<button class="btn sec" data-pick-novo="${esc(f)}">+ Criar "${esc(f)}"</button>` : "");
    };
    m.innerHTML = `<div class="modal-box"><div class="exhead"><div class="t">Escolher exercício</div><button class="ic" data-fechar>✕</button></div>
      <input id="modal-busca" placeholder="🔍 Buscar"><div id="modal-lista" class="lista"></div></div>`;
    m.classList.add("on"); render();
    $("#modal-busca").oninput = (e) => render(e.target.value);
    m.onclick = (e) => {
      const p = e.target.closest("[data-pick]"), n = e.target.closest("[data-pick-novo]");
      if (e.target.closest("[data-fechar]") || e.target === m) m.classList.remove("on");
      else if (p) { m.classList.remove("on"); cb(p.dataset.pick); }
      else if (n) { const g = prompt("Grupo muscular:\n" + GRUPOS.join(", "), "Outros"); if (g === null) return; const ex = S.salvar("exercicios", { nome: n.dataset.pickNovo, grupo: g || "Outros" }); m.classList.remove("on"); cb(ex.id); }
    };
  }

  // ---------- ações ----------
  const acoes = {
    iniciar: (el) => iniciarSessao(el.dataset.id),
    "iniciar-livre": () => iniciarSessao(null),
    finalizar: (el) => { if (confirm("Finalizar e salvar o treino? Séries não marcadas serão descartadas.")) finalizarSessao(el.dataset.id); },
    "cancelar-sessao": (el) => { if (confirm("Descartar este treino inteiro?")) { Q.seriesSessao(el.dataset.id).forEach((r) => S.excluir("series", r.id)); S.excluir("sessoes", el.dataset.id); Timer.parar(); location.hash = "treinar"; } },
    d: (el) => { const r = S.get("series", el.dataset.id); const c = el.dataset.c; let v = num(r[c]) + num(el.dataset.v); if (v < 0) v = 0; S.salvar("series", { id: r.id, [c]: c === "reps" ? Math.round(v) : v }); },
    feita: (el) => {
      const r = S.get("series", el.dataset.id); const feita = !r.feita;
      S.salvar("series", { id: r.id, feita, feita_em: feita ? new Date().toISOString() : null });
      if (feita) {
        const s = S.get("sessoes", r.sessao_id);
        const pr = Q.recordes(r.exercicio_id);
        Timer.iniciar(descansoDe(s, r.exercicio_id));
        if (num(r.carga_kg) > 0 && num(r.carga_kg) >= pr.maxCarga && Q.historicoEx(r.exercicio_id, r.sessao_id).length && num(r.carga_kg) > Q.historicoEx(r.exercicio_id, r.sessao_id).reduce((m, g) => Math.max(m, ...g.series.map((x) => num(x.carga_kg))), 0)) toast("🏆 Novo recorde de carga!");
      }
    },
    "add-serie": (el) => {
      const s = Q.sessaoAtiva(); const rs = Q.seriesSessao(s.id).filter((r) => r.exercicio_id === el.dataset.ex);
      const ult = rs[rs.length - 1];
      S.salvar("series", { sessao_id: s.id, exercicio_id: el.dataset.ex, ordem_exercicio: +el.dataset.ord, numero: (ult?.numero || 0) + 1, carga_kg: ult ? ult.carga_kg : 0, reps: ult ? ult.reps : 10, feita: false });
    },
    "rm-serie": (el) => {
      const s = Q.sessaoAtiva(); const rs = Q.seriesSessao(s.id).filter((r) => r.exercicio_id === el.dataset.ex);
      const alvo = rs.filter((r) => !r.feita).pop() || rs.pop();
      if (alvo && (!alvo.feita || confirm("Remover a última série (já feita)?"))) S.excluir("series", alvo.id);
    },
    "add-ex-sessao": () => escolherExercicio((exId) => {
      const s = Q.sessaoAtiva(); const ord = Math.max(-1, ...Q.seriesSessao(s.id).map((r) => r.ordem_exercicio)) + 1;
      for (let n = 1; n <= 3; n++) { const sg = sugestao(exId, n, s.id); S.salvar("series", { sessao_id: s.id, exercicio_id: exId, ordem_exercicio: ord, numero: n, carga_kg: sg ? sg.carga : 0, reps: sg ? sg.reps : 10, feita: false }); }
    }),
    timer: (el) => Timer.iniciar(+el.dataset.v),
    "nova-ficha": () => { const n = prompt("Nome da ficha (ex.: Treino A — Peito e Tríceps)"); if (n) { const f = S.salvar("fichas", { nome: n, ordem: Q.fichas().length }); location.hash = "ficha/" + f.id; } },
    "modelo-abc": () => {
      const acha = (nome) => Q.exercicios().find((e) => e.nome === nome)?.id;
      const modelos = {
        "Treino A": ["Peito e Tríceps", ["Supino reto com barra", "Supino inclinado com halteres", "Crucifixo com halteres", "Tríceps na polia (pulley)", "Tríceps testa"]],
        "Treino B": ["Costas e Bíceps", ["Puxada frontal (pulldown)", "Remada curvada com barra", "Remada baixa no cabo", "Rosca direta com barra", "Rosca martelo"]],
        "Treino C": ["Pernas e Ombros", ["Agachamento livre", "Leg press 45°", "Cadeira extensora", "Mesa flexora", "Desenvolvimento com halteres", "Elevação lateral", "Panturrilha em pé"]],
      };
      Object.entries(modelos).forEach(([nome, [desc, exs]], i) => {
        const f = S.salvar("fichas", { nome, descricao: desc, ordem: i });
        exs.map(acha).filter(Boolean).forEach((exId, j) => S.salvar("ficha_exercicios", { ficha_id: f.id, exercicio_id: exId, ordem: j, series: 3, reps_alvo: "8-12", descanso_seg: 90 }));
      });
      toast("Fichas A/B/C criadas. Ajuste como quiser!");
    },
    "add-ex-ficha": (el) => escolherExercicio((exId) => S.salvar("ficha_exercicios", { ficha_id: el.dataset.id, exercicio_id: exId, ordem: Q.itensFicha(el.dataset.id).length, series: 3, reps_alvo: "10", descanso_seg: 90 })),
    mover: (el) => {
      const it = S.get("ficha_exercicios", el.dataset.id); const itens = Q.itensFicha(it.ficha_id);
      const i = itens.findIndex((x) => x.id === it.id), j = i + +el.dataset.v; if (j < 0 || j >= itens.length) return;
      [itens[i], itens[j]] = [itens[j], itens[i]]; itens.forEach((x, k) => x.ordem !== k && S.salvar("ficha_exercicios", { id: x.id, ordem: k }));
    },
    "rm-item": (el) => S.excluir("ficha_exercicios", el.dataset.id),
    "rm-ficha": (el) => { if (confirm("Excluir esta ficha? (o histórico de treinos continua salvo)")) { Q.itensFicha(el.dataset.id).forEach((i) => S.excluir("ficha_exercicios", i.id)); S.excluir("fichas", el.dataset.id); location.hash = "fichas"; } },
    "novo-ex": () => { const n = prompt("Nome do exercício"); if (!n) return; const g = prompt("Grupo muscular:\n" + GRUPOS.join(", "), "Outros"); S.salvar("exercicios", { nome: n.trim(), grupo: (g || "Outros").trim() }); toast("Exercício criado"); },
    "editar-ex": (el) => {
      const e = S.get("exercicios", el.dataset.id);
      const n = prompt("Nome do exercício (deixe vazio para excluir)", e.nome); if (n === null) return;
      if (!n.trim()) { if (confirm("Excluir este exercício?")) S.excluir("exercicios", e.id); return; }
      const g = prompt("Grupo muscular", e.grupo); S.salvar("exercicios", { id: e.id, nome: n.trim(), grupo: (g || e.grupo).trim() });
    },
    "rm-sessao": (el) => { if (confirm("Excluir este treino do histórico?")) { Q.seriesSessao(el.dataset.id).forEach((r) => S.excluir("series", r.id)); S.excluir("sessoes", el.dataset.id); location.hash = "historico"; } },
    "add-peso": () => {
      const v = num($("#novo-peso").value); if (!v || v < 20 || v > 400) { toast("Digite um peso válido"); return; }
      const hoje = hojeISO(); const ex = S.lista("pesagens", (x) => x.data === hoje)[0];
      S.salvar("pesagens", ex ? { id: ex.id, peso_kg: v } : { data: hoje, peso_kg: v }); toast("Peso registrado");
    },
    "rm-peso": (el) => { if (confirm("Excluir esta pesagem?")) S.excluir("pesagens", el.dataset.id); },
    sync: () => S.sync().then(() => toast(statusTxt())),
    sair: async () => { if (confirm("Sair da conta neste aparelho?")) { await S.sair(); location.hash = ""; location.reload(); } },
    instalar: () => mostrarInstalar(),
    senha: async () => {
      const s = prompt("Nova senha (mínimo 6 caracteres)"); if (!s) return;
      if (s.length < 6) { toast("Senha muito curta"); return; }
      const { error } = await sb.auth.updateUser({ password: s });
      toast(error ? "Erro: " + error.message : "Senha alterada ✅");
    },
    exportar: () => {
      const linhas = [["data", "treino", "exercicio", "grupo", "serie", "carga_kg", "reps", "1rm_estimado"]];
      Q.sessoes().forEach((s) => Q.seriesSessao(s.id).filter((r) => r.feita).forEach((r) => { const e = S.get("exercicios", r.exercicio_id); linhas.push([s.iniciada_em, s.nome, e?.nome, e?.grupo, r.numero, r.carga_kg, r.reps, rm1(r.carga_kg, r.reps).toFixed(1)]); }));
      const csv = linhas.map((l) => l.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(";")).join("\n");
      const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob(["\ufeff" + csv], { type: "text/csv" })); a.download = "treinos.csv"; a.click();
    },
  };

  function mostrarInstalar() {
    const m = $("#modal");
    m.innerHTML = `<div class="modal-box"><div class="exhead"><div class="t">Instalar no celular</div><button class="ic" data-fechar>✕</button></div>
      ${window._promptInstalar ? `<button class="btn" id="btn-inst">📲 Instalar agora</button>` : ""}
      <p><b>Android (Chrome):</b> menu ⋮ → <i>Instalar app</i> (ou <i>Adicionar à tela inicial</i>).</p>
      <p><b>iPhone (Safari):</b> botão Compartilhar ⬆️ → <i>Adicionar à Tela de Início</i> → Adicionar.</p>
      <p><b>Computador (Chrome/Edge):</b> ícone de instalar na barra de endereço.</p></div>`;
    m.classList.add("on");
    m.onclick = (e) => { if (e.target.closest("[data-fechar]") || e.target === m) m.classList.remove("on"); if (e.target.id === "btn-inst") { window._promptInstalar.prompt(); m.classList.remove("on"); } };
  }
  window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); window._promptInstalar = e; });

  // ---------- roteamento / render ----------
  function render() {
    if (!S.user) return;
    const [nome, arg] = (location.hash.slice(1) || "treinar").split("/");
    const fn = telas[nome] || telas.treinar;
    // preserva foco/rolagem ao re-renderizar enquanto digita
    const ativo = document.activeElement;
    if (ativo && ativo.matches("input,textarea") && main().contains(ativo)) { atualizarStatus(); return; }
    const y = window.scrollY;
    main().innerHTML = fn(arg);
    if (render._ultima === location.hash) window.scrollTo(0, y); else window.scrollTo(0, 0);
    render._ultima = location.hash;
    document.querySelectorAll("nav button").forEach((b) => b.classList.toggle("on", b.dataset.go === (nome === "ficha" ? "fichas" : nome === "sessao" ? "historico" : nome === "ativo" ? "treinar" : nome === "conta" ? "perfil" : nome)));
    atualizarStatus();
    const busca = $("#busca-ex");
    if (busca) busca.oninput = (e) => { telas.exercicios.busca = e.target.value; const pos = e.target.selectionStart; main().innerHTML = telas.exercicios(); const b = $("#busca-ex"); b.focus(); b.setSelectionRange(pos, pos); render(); };
  }
  function atualizarStatus() {
    const el = $("#sync"); if (!el) return;
    el.textContent = { ok: "●", sincronizando: "◌", offline: "○", erro: "!" }[S.status] || "";
    el.className = "sync " + S.status; el.title = statusTxt();
  }

  document.addEventListener("click", (e) => {
    const go = e.target.closest("[data-go]");
    if (go) { location.hash = go.dataset.go; return; }
    const a = e.target.closest("[data-act]");
    if (a && acoes[a.dataset.act]) acoes[a.dataset.act](a);
  });
  document.addEventListener("change", (e) => {
    const el = e.target;
    if (el.dataset.campo) S.salvar("series", { id: el.dataset.id, [el.dataset.campo]: el.dataset.campo === "reps" ? Math.round(num(el.value)) : num(el.value) });
    else if (el.dataset.ficha) S.salvar("fichas", { id: el.dataset.id, [el.dataset.ficha]: el.value });
    else if (el.dataset.item) S.salvar("ficha_exercicios", { id: el.dataset.id, [el.dataset.item]: el.dataset.item === "reps_alvo" ? el.value : parseInt(el.value) || 0 });
    else if (el.dataset.perfil) {
      const k = el.dataset.perfil; const v = k === "nome" ? el.value : num(el.value) || null;
      const extra = k === "idade" ? { idade: v ? Math.round(v) : null, idade_em: hojeISO() } : { [k]: v };
      S.salvar("perfis", Object.assign({ id: S.user.id, user_id: S.user.id }, extra));
    }
    else if (el.dataset.notas) S.salvar("sessoes", { id: el.dataset.notas, notas: el.value });
    setTimeout(render, 0);
  });
  document.addEventListener("focusin", (e) => { if (e.target.matches("input[inputmode]")) setTimeout(() => e.target.select(), 0); });
  document.addEventListener("focusout", () => setTimeout(render, 50));
  window.addEventListener("hashchange", render);
  S.onChange(render);
  $("#t-menos").onclick = () => Timer.ajustar(-15); $("#t-mais").onclick = () => Timer.ajustar(15); $("#t-parar").onclick = () => Timer.parar();

  // ---------- login ----------
  function telaLogin(msg = "") {
    document.body.classList.add("deslogado");
    $("#login").innerHTML = `<div class="logo">🏋️</div><h1>Academia</h1><p class="sub centro">Controle de cargas, séries e evolução</p>
      <form id="f-login"><label>E-mail<input type="email" name="email" autocomplete="email" required></label>
      <label>Senha<input type="password" name="senha" autocomplete="current-password" minlength="6" required></label>
      <div class="erro">${esc(msg)}</div>
      <button class="btn" name="acao" value="entrar">Entrar</button>
      <button class="btn sec" name="acao" value="criar">Criar conta</button></form>
      <p class="sub centro">Seus dados ficam salvos na nuvem e sincronizam entre celular e computador.</p>`;
    $("#f-login").onsubmit = async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target), email = fd.get("email").trim(), senha = fd.get("senha");
      const acao = e.submitter?.value || "entrar";
      const err = $("#f-login .erro"); err.textContent = acao === "criar" ? "Criando conta…" : "Entrando…";
      try {
        if (acao === "criar") {
          const r = await fetch(window.APP_CONFIG.SUPABASE_URL + "/functions/v1/academia-cadastro", { method: "POST", headers: { "Content-Type": "application/json", apikey: window.APP_CONFIG.SUPABASE_KEY }, body: JSON.stringify({ email, senha }) });
          const j = await r.json(); if (!r.ok) throw new Error(j.erro || "Falha ao criar conta");
        }
        const { error } = await sb.auth.signInWithPassword({ email, password: senha });
        if (error) throw new Error(error.message === "Invalid login credentials" ? "E-mail ou senha incorretos" : error.message);
      } catch (ex) { err.textContent = navigator.onLine ? ex.message : "Sem internet. Para o primeiro login é preciso estar conectado."; }
    };
  }

  async function entrar(user) {
    if (S.user?.id === user.id) return;
    document.body.classList.remove("deslogado");
    await S.iniciar(user);
    Timer.restaurar();
    render();
  }

  sb.auth.onAuthStateChange((ev, session) => {
    if (session?.user) entrar(session.user);
    else if (ev === "SIGNED_OUT") telaLogin();
  });
  sb.auth.getSession().then(({ data }) => { if (data.session?.user) entrar(data.session.user); else telaLogin(); });

  if ("serviceWorker" in navigator) navigator.serviceWorker.register("./sw.js").catch(console.error);
})();
