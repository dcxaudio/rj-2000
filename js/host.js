/* DCX Audio - host
 *
 * Quem monta a pagina (o Studio, ou a pagina solo de um aparelho) cria um host.
 * Cada aparelho recebe so a sua vista do host (host.view(id)), com uma
 * interface pequena e fixa, e nunca o objeto de outro aparelho:
 *
 *   engine          saida comum: ensure(), ctx, ready, limiter
 *   store           IndexedDB com o prefixo da pagina e do aparelho
 *   learn           MIDI Learn da pagina (um mapa por pagina)
 *   on              a regua de tomadas esta ligada
 *   targets()       para onde da para mandar som: [{ id, label }]; sempre tem "file"
 *   send(id, wav)   manda um WAV (File) para outro aparelho; devolve "ok", "off" ou "missing"
 *
 * Audio ao vivo entre aparelhos:
 *   output(id?)     no de saida do aparelho (ganho 1, ligado no limiter)
 *   input(id?)      no de entrada do aparelho (ganho 1; so soa se o aparelho usar)
 *   route(from, to, { dry })  liga output(from) em input(to) ou num AudioNode.
 *                   dry: false tira a saida do limiter enquanto a rota existir.
 *                   Devolve uma funcao que desfaz a rota.
 *
 * Acrescimos (o que o 950 precisava do SP e nao cabia acima):
 *   playing()       o sequenciador da pagina esta tocando (solo: false)
 *   padUsed(i)      o pad i da fonte de pads ja tem som proprio (solo: false)
 *   emit(tipo, ...) / listen(tipo, fn)   recado entre aparelhos sem um conhecer o outro.
 *                   Tipos de hoje: "note" (s, time, vel), "noteOff" (s), "stop", "key" (KeyboardEvent).
 *                   emit devolve true se algum ouvinte devolveu true.
 */
(function () {
  "use strict";
  const RJ = window.RJ;

  /* ------------------------------------------------------------ saida comum */

  RJ.makeLimiter = function (ctx) {
    // saturacao suave so perto de 0 dBFS, para os aparelhos juntos nao estourarem
    const lim = ctx.createWaveShaper();
    const curve = new Float32Array(2048);
    for (let i = 0; i < curve.length; i++) {
      const x = (i / (curve.length - 1)) * 2 - 1, a = Math.abs(x);
      curve[i] = a < 0.7 ? x : Math.sign(x) * (0.7 + 0.28 * Math.tanh((a - 0.7) / 0.28));
    }
    lim.curve = curve;
    return lim;
  };

  RJ.Output = class {
    constructor() { this.ctx = null; this.limiter = null; }
    ensure() {
      if (!this.ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        this.ctx = new AC({ latencyHint: "interactive" });
        this.limiter = RJ.makeLimiter(this.ctx);
        this.limiter.connect(this.ctx.destination);
      }
      if (this.ctx.state === "suspended") this.ctx.resume();
      return this.ctx;
    }
    get ready() { return !!this.ctx; }
  };

  /* ------------------------------------------------------------ store com prefixo */

  /** Prefixa as chaves de RJ.store. Le e grava so depois da migracao (ready). */
  RJ.prefixedStore = function (prefix, ready) {
    const wait = () => ready || Promise.resolve();
    return {
      prefix,
      key: k => prefix + k,
      async get(k) { await wait(); return RJ.store.get(prefix + k); },
      async put(k, v) { await wait(); return RJ.store.put(prefix + k, v); },
    };
  };

  /**
   * Copia chaves antigas para as novas uma vez so. Nao apaga as antigas e nao
   * sobrescreve uma chave nova que ja exista. A marca fica em "<page>/migrated".
   */
  RJ.migrateStore = async function (page, map) {
    if (!map || !Object.keys(map).length) return;
    const mark = page + "/migrated";
    try {
      if (await RJ.store.get(mark)) return;
      for (const [from, to] of Object.entries(map)) {
        const old = await RJ.store.get(from);
        if (old == null) continue;
        if ((await RJ.store.get(to)) != null) continue;
        await RJ.store.put(to, old);
      }
      await RJ.store.put(mark, JSON.stringify({ v: 1, at: new Date().toISOString(), keys: map }));
    } catch (e) { console.warn("Migracao do armazenamento nao terminou", e); }
  };

  /* ------------------------------------------------------------ host */

  RJ.Host = class {
    /**
     * opts.page       nome da pagina, prefixo do armazenamento ("studio", "rj2000")
     * opts.migrate    { chaveAntiga: chaveNova } copiado na primeira abertura
     * opts.playing    () => bool
     * opts.padUsed    i => bool
     */
    constructor(opts = {}) {
      this.page = opts.page || "studio";
      this.ready = RJ.migrateStore(this.page, opts.migrate);
      this.engine = new RJ.Output();
      this.store = RJ.prefixedStore(this.page + "/", this.ready);
      this.learn = new RJ.MidiMap(this.store);
      this.on = false;
      this.devices = new Map();   // id -> { dev, label, receive }
      this.outs = new Map();
      this.ins = new Map();
      this.listeners = {};
      this.playing = opts.playing || (() => false);
      this.padUsed = opts.padUsed || (() => false);
      document.addEventListener("visibilitychange", () => { if (document.hidden) this.saveAll(); });
    }

    /** Pagina com um aparelho so: targets() devolve so "file". */
    static solo(page, opts = {}) { return new RJ.Host(Object.assign({ page }, opts)); }

    /** Registra o aparelho. receive(wav) recebe o que outro mandar com send(id, wav). */
    add(id, dev, o = {}) {
      this.devices.set(id, { dev, label: o.label || id, receive: o.receive || null });
      return dev;
    }

    /** Liga a regua: todos os aparelhos, na ordem em que entraram. */
    power() {
      if (this.on) return;
      this.on = true;
      this.engine.ensure();
      this.devices.forEach(d => d.dev.boot && d.dev.boot());
    }

    saveAll() { this.devices.forEach(d => { try { d.dev.saveNow && d.dev.saveNow(); } catch (e) { console.warn(e); } }); }

    targets(from) {
      const t = [];
      this.devices.forEach((d, id) => { if (id !== from && d.receive) t.push({ id, label: d.label }); });
      t.push({ id: "file", label: "File" });
      return t;
    }

    send(id, wav) {
      if (id === "file") { RJ.dsp.downloadBlob(wav, wav.name || "loop.wav"); return "ok"; }
      const d = this.devices.get(id);
      if (!d || !d.receive) return "missing";
      return d.receive(wav) || "ok";
    }

    /* ---------------------------------------------- audio entre aparelhos */

    output(id) {
      const ctx = this.engine.ensure();
      let n = this.outs.get(id);
      if (!n || n.context !== ctx) {
        n = ctx.createGain();
        n.gain.value = 1;
        n.connect(this.engine.limiter);
        n.rjDry = 1;
        this.outs.set(id, n);
      }
      return n;
    }

    input(id) {
      const ctx = this.engine.ensure();
      let n = this.ins.get(id);
      if (!n || n.context !== ctx) {
        n = ctx.createGain();
        n.gain.value = 1;
        this.ins.set(id, n);
      }
      return n;
    }

    route(from, to, o = {}) {
      const src = this.output(from);
      const dst = typeof to === "string" ? this.input(to) : to;
      src.connect(dst);
      const dry = o.dry !== false;
      if (!dry && src.rjDry++ === 1) src.disconnect(this.engine.limiter);
      let done = false;
      return () => {
        if (done) return;
        done = true;
        try { src.disconnect(dst); } catch (e) { /* ja desligado */ }
        if (!dry && --src.rjDry === 1) src.connect(this.engine.limiter);
      };
    }

    /* ---------------------------------------------- recados */

    listen(type, fn) {
      (this.listeners[type] = this.listeners[type] || []).push(fn);
      return () => { this.listeners[type] = this.listeners[type].filter(f => f !== fn); };
    }

    emit(type, ...args) {
      let used = false;
      (this.listeners[type] || []).forEach(fn => { if (fn(...args)) used = true; });
      return used;
    }

    /** A vista que o aparelho recebe: so a interface, com o id dele embutido. */
    view(id) {
      const h = this;
      const prefix = h.page === id ? h.page + "/" : h.page + "/" + id + "/";
      return {
        id,
        engine: h.engine,
        store: RJ.prefixedStore(prefix, h.ready),
        learn: h.learn,
        get on() { return h.on; },
        power: () => h.power(),
        targets: () => h.targets(id),
        send: (to, wav) => h.send(to, wav),
        output: (x = id) => h.output(x),
        input: (x = id) => h.input(x),
        route: (from, to, o) => h.route(from, to, o),
        playing: () => h.playing(),
        padUsed: i => h.padUsed(i),
        emit: (t, ...a) => h.emit(t, ...a),
        listen: (t, fn) => h.listen(t, fn),
      };
    }
  };
})();
