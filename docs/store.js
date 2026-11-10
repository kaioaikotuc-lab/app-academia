// Armazenamento local (IndexedDB) + sincronização com o Supabase.
// Modelo "local-first": tudo é gravado primeiro no aparelho e enviado ao banco
// quando houver internet. IDs são UUIDs gerados no aparelho (upsert idempotente).
(function () {
  const TABELAS = ["perfis", "pesagens", "exercicios", "fichas", "ficha_exercicios", "sessoes", "series"]; // ordem das FKs
  const cfg = window.APP_CONFIG;
  const sb = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_KEY, {
    db: { schema: cfg.SCHEMA },
    auth: { persistSession: true, autoRefreshToken: true },
  });

  // --- mini wrapper de IndexedDB (chave -> valor) ---
  let _db;
  function idb() {
    if (_db) return _db;
    _db = new Promise((res, rej) => {
      const r = indexedDB.open("app-academia", 1);
      r.onupgradeneeded = () => r.result.createObjectStore("kv");
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    return _db;
  }
  async function kvGet(k) {
    const db = await idb();
    return new Promise((res, rej) => {
      const q = db.transaction("kv").objectStore("kv").get(k);
      q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error);
    });
  }
  async function kvSet(k, v) {
    const db = await idb();
    return new Promise((res, rej) => {
      const t = db.transaction("kv", "readwrite");
      t.objectStore("kv").put(v, k);
      t.oncomplete = () => res(); t.onerror = () => rej(t.error);
    });
  }

  const S = {
    sb, user: null,
    dados: Object.fromEntries(TABELAS.map((t) => [t, {}])), // tabela -> {id: linha}
    fila: [],          // pendências {t, id}
    ultimoPull: {},    // tabela -> ISO
    status: "offline", // 'ok' | 'sincronizando' | 'offline' | 'erro'
    ouvintes: new Set(),
    onChange(fn) { this.ouvintes.add(fn); },
    emit() { this.ouvintes.forEach((f) => { try { f(); } catch (e) { console.error(e); } }); },

    chave(n) { return `u:${this.user.id}:${n}`; },
    async carregarLocal() {
      const d = await kvGet(this.chave("dados"));
      this.dados = Object.assign(Object.fromEntries(TABELAS.map((t) => [t, {}])), d || {});
      this.fila = (await kvGet(this.chave("fila"))) || [];
      this.ultimoPull = (await kvGet(this.chave("pull"))) || {};
    },
    _salvarTimer: null,
    salvarLocal() {
      clearTimeout(this._salvarTimer);
      this._salvarTimer = setTimeout(async () => {
        await kvSet(this.chave("dados"), this.dados);
        await kvSet(this.chave("fila"), this.fila);
        await kvSet(this.chave("pull"), this.ultimoPull);
      }, 150);
    },

    // --- leitura ---
    lista(t, filtro) {
      return Object.values(this.dados[t]).filter((r) => !r.excluido && (!filtro || filtro(r)));
    },
    get(t, id) { return this.dados[t][id]; },

    // --- escrita (local + fila) ---
    salvar(t, linha) {
      const agora = new Date().toISOString();
      const r = Object.assign({}, this.dados[t][linha.id] || {}, linha);
      if (!r.id) r.id = crypto.randomUUID();
      if (r.user_id === undefined) r.user_id = this.user.id; // biblioteca padrão (null) nunca é editada pela UI
      r.criado_em = r.criado_em || agora;
      r.atualizado_em = agora;
      r._local = true;
      this.dados[t][r.id] = r;
      if (!this.fila.some((f) => f.t === t && f.id === r.id)) this.fila.push({ t, id: r.id });
      this.salvarLocal();
      this.emit();
      this.agendarSync();
      return r;
    },
    excluir(t, id) { if (this.dados[t][id]) this.salvar(t, { id, excluido: true }); },

    // --- sincronização ---
    _syncTimer: null,
    agendarSync(ms = 800) { clearTimeout(this._syncTimer); this._syncTimer = setTimeout(() => this.sync(), ms); },
    _sincronizando: false,
    async sync() {
      if (!this.user || this._sincronizando) return;
      if (!navigator.onLine) { this.status = "offline"; this.emit(); return; }
      this._sincronizando = true; this.status = "sincronizando"; this.emit();
      try {
        // 1) envia pendências, em ordem de dependência
        for (const t of TABELAS) {
          const ids = this.fila.filter((f) => f.t === t).map((f) => f.id);
          if (!ids.length) continue;
          const versao = Object.fromEntries(ids.map((id) => [id, this.dados[t][id]?.atualizado_em]));
          const linhas = ids.map((id) => this.dados[t][id]).filter(Boolean)
            .filter((r) => r.user_id) // nunca envia a biblioteca padrão
            .map((r) => { const c = { ...r }; delete c._local; delete c.atualizado_em; return c; });
          for (let i = 0; i < linhas.length; i += 200) {
            const { error } = await sb.from(t).upsert(linhas.slice(i, i + 200), { onConflict: "id", defaultToNull: false });
            if (error) throw error;
          }
          // só tira da fila o que não foi editado de novo enquanto o envio acontecia
          const enviados = ids.filter((id) => this.dados[t][id]?.atualizado_em === versao[id]);
          this.fila = this.fila.filter((f) => !(f.t === t && enviados.includes(f.id)));
          enviados.forEach((id) => { if (this.dados[t][id]) delete this.dados[t][id]._local; });
        }
        // 2) baixa o que mudou no servidor (outros aparelhos / chat)
        for (const t of TABELAS) {
          let desde = this.ultimoPull[t] || "1970-01-01T00:00:00Z";
          for (;;) {
            const { data, error } = await sb.from(t).select("*").gt("atualizado_em", desde)
              .order("atualizado_em", { ascending: true }).limit(1000);
            if (error) throw error;
            for (const r of data) {
              const pend = this.fila.some((f) => f.t === t && f.id === r.id);
              if (!pend) this.dados[t][r.id] = r;
              desde = r.atualizado_em;
            }
            if (data.length < 1000) break;
          }
          this.ultimoPull[t] = desde;
        }
        this.status = "ok";
        this.ultimaSync = new Date();
        if (this.fila.length) this.agendarSync(300);
      } catch (e) {
        console.error("sync", e);
        this.status = navigator.onLine ? "erro" : "offline";
        this.erroSync = e.message || String(e);
        this.agendarSync(15000);
      } finally {
        this._sincronizando = false;
        this.salvarLocal();
        this.emit();
      }
    },

    async iniciar(user) {
      this.user = user;
      await this.carregarLocal();
      this.emit();
      this.sync();
    },
    async sair() {
      await sb.auth.signOut();
      this.user = null;
    },
  };

  window.addEventListener("online", () => S.sync());
  window.addEventListener("offline", () => { S.status = "offline"; S.emit(); });
  document.addEventListener("visibilitychange", () => { if (!document.hidden) S.sync(); });
  setInterval(() => S.sync(), 60000);
  window.Store = S;
})();
