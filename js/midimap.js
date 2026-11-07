/* RJ-2000 - MIDI Learn
 *
 * Qualquer controle do painel (SP e RJ-950) aprende uma mensagem MIDI: nota,
 * CC, pitch bend ou program change. O mapa e do controlador, nao da musica:
 * fica guardado no navegador, fora do projeto.
 *
 * Como aprende (SET-UP 22): toca-se no controle, a ultima mensagem que chegar
 * fica esperando no LCD e o Enter salva. Uma mensagem vale para um controle so,
 * e cada controle guarda uma mensagem.
 */
(function () {
  "use strict";
  const RJ = window.RJ;
  const STORE_KEY = "midimap";
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const two = n => (n < 10 ? "0" : "") + n;

  RJ.MidiMap = class {
    constructor() {
      this.targets = new Map();  // id -> { id, el, name, kind, down, up, get, set, step }
      this.map = {};             // "c:1:82" -> { t: "fader:0", mode: "abs" | "rel64" | "rel2c" }
      this.enabled = false;      // o MIDI ja foi ligado: liga sozinho no proximo boot
      this.learning = false;
      this.sel = null;           // controle escolhido para aprender
      this.cand = null;          // { key, vals } ultima mensagem recebida
      this.last = {};            // ultimo valor de cada CC absoluto ligado a um encoder
      this.pos = {};             // posicao de cada slider ou knob movido por encoder
      this.hist = {};            // ultimos valores de cada CC salvo como posicao (para achar encoder)
      this.held = new Set();     // botoes apertados pelo MIDI
      this.onChange = null;
    }

    /** kind: button (aperta e solta), pad (com forca), value (0 a 1), encoder (passos + e -). */
    add(id, el, name, kind, h) {
      el.dataset.learn = id;
      this.targets.set(id, Object.assign({ id, el, name, kind }, h));
    }

    async load() {
      try {
        const s = await RJ.store.get(STORE_KEY);
        const d = s ? JSON.parse(s) : null;
        if (d && d.map) { this.map = d.map; this.enabled = !!d.enabled; }
      } catch (e) { console.warn("Mapa MIDI ilegivel, comecando vazio", e); }
    }

    persist() {
      try { RJ.store.put(STORE_KEY, JSON.stringify({ v: 1, enabled: this.enabled, map: this.map })); } catch (e) { console.warn(e); }
    }

    /** Mensagem crua -> { key, type, on, v (0 a 1), raw }. Aftertouch, clock e sysex ficam de fora. */
    static parse(d) {
      const st = d[0] & 0xf0, ch = (d[0] & 0x0f) + 1;
      if (st === 0x90 || st === 0x80) {
        const on = st === 0x90 && d[2] > 0;
        return { key: "n:" + ch + ":" + d[1], type: "note", on, v: on ? d[2] / 127 : 0 };
      }
      if (st === 0xb0) return { key: "c:" + ch + ":" + d[1], type: "cc", v: d[2] / 127, raw: d[2] };
      if (st === 0xe0) return { key: "p:" + ch, type: "pb", v: ((d[2] << 7) | d[1]) / 16383 };
      if (st === 0xc0) return { key: "g:" + ch + ":" + d[1], type: "pc", v: 1 };
      return null;
    }

    /** Nome curto para o LCD: "Note 36 Ch10", "CC 82   Ch01". */
    static label(key) {
      const [t, ch, n] = key.split(":");
      const what = { n: "Note " + n, c: "CC " + n, p: "Bend", g: "Prog " + n }[t] || key;
      return (what + "        ").slice(0, 8) + "Ch" + two(+ch);
    }

    /** Devolve true quando a mensagem foi usada (aprendendo ou ligada a um controle). */
    handle(d) {
      const m = RJ.MidiMap.parse(d);
      if (!m) return false;
      if (this.learning) { this.capture(m); return "Learn: Captured"; }
      const b = this.map[m.key], t = b && this.targets.get(b.t);
      if (!t) return false;
      this.drive(t, b, m);
      return t.name;
    }

    /** Algo foi aprendido: o mapa padrao (notas 36-67, CC 20-27) desliga. */
    get custom() { return Object.keys(this.map).length > 0; }

    /* ----------------------------------------------------- arquivo */

    exportData() { return { format: "rj2000-midilearn", version: 1, map: this.map }; }

    /** Troca o mapa pelo do arquivo. So entram controles que existem. Devolve quantos. */
    importData(d) {
      if (!d || d.format !== "rj2000-midilearn" || !d.map || typeof d.map !== "object") throw new Error("Nao e um mapa MIDI");
      const map = {}, used = new Set();
      Object.keys(d.map).forEach(k => {
        const b = d.map[k];
        if (!/^(n:\d+:\d+|c:\d+:\d+|p:\d+|g:\d+:\d+)$/.test(k) || !b || !this.targets.has(b.t) || used.has(b.t)) return;
        used.add(b.t);
        map[k] = { t: b.t, mode: ["abs", "rel64", "rel16", "rel2c"].includes(b.mode) ? b.mode : "abs" };
        if (b.sure) map[k].sure = true;
      });
      this.releaseAll();
      this.map = map; this.last = {}; this.pos = {}; this.hist = {};
      this.persist();
      if (this.onChange) this.onChange();
      return used.size;
    }

    /* ----------------------------------------------------- aprender */

    start() { this.releaseAll(); this.learning = true; this.sel = null; this.cand = null; this.mark(); }
    stop() { this.learning = false; this.sel = null; this.cand = null; this.mark(); }

    select(id) {
      this.sel = this.targets.has(id) ? id : null;
      this.cand = null;
      this.mark();
    }

    /** A ultima mensagem fica: soltar a tecla (note off) nao conta. */
    capture(m) {
      if (m.type === "note" && !m.on) return;
      if (!this.cand || this.cand.key !== m.key) this.cand = { key: m.key, vals: [] };
      if (m.type === "cc") this.cand.vals.push(m.raw);
      if (this.onChange) this.onChange();
    }

    bound(id) { return Object.keys(this.map).find(k => this.map[k].t === id) || null; }

    save() {
      const t = this.sel && this.targets.get(this.sel);
      if (!t || !this.cand) return null;
      this.unbind(t.id);
      this.map[this.cand.key] = { t: t.id, mode: this.modeFor(t, this.cand) };
      this.persist();
      this.select(null);
      return t.name;
    }

    clear(id) {
      const t = this.targets.get(id);
      if (!t || !this.bound(id)) return null;
      this.unbind(id);
      this.persist();
      if (this.onChange) this.onChange();
      return t.name;
    }

    clearAll() { this.map = {}; this.last = {}; this.pos = {}; this.hist = {}; this.persist(); }

    unbind(id) { Object.keys(this.map).forEach(k => { if (this.map[k].t === id) delete this.map[k]; }); }

    /**
     * Knob sem fim (encoder) manda passos em vez de posicao, perto de um centro:
     * 64 +/- n (rel64), 1..15 e 113..127 (rel2c) ou 16 +/- n (rel16). Um knob comum
     * so manda quando muda, entao nunca repete o mesmo valor seguido; um encoder
     * girando devagar repete (65, 65, 65). Duas repeticoes ja dizem que e encoder.
     */
    static relKind(v, sure) {
      if (!v.length) return null;
      const reps = v.reduce((n, x, i) => n + (i > 0 && x === v[i - 1] ? 1 : 0), 0);
      const in2c = v.every(x => (x >= 1 && x <= 15) || (x >= 113 && x <= 127));
      const both2c = in2c && v.some(x => x < 64) && v.some(x => x > 64);
      const ok = sure || reps >= 2;
      if (in2c && (ok || both2c)) return "rel2c";
      if (ok && v.every(x => x >= 57 && x <= 71 && x !== 64)) return "rel64";
      if (ok && v.every(x => x >= 9 && x <= 23 && x !== 16)) return "rel16";
      return null;
    }

    /** Na hora de salvar. O Control do 950 e um encoder, entao basta cair na faixa. */
    modeFor(t, c) {
      if (!c.key.startsWith("c:")) return "abs";
      return RJ.MidiMap.relKind(c.vals, t.kind === "encoder") || "abs";
    }

    /** Passo de um encoder, ou null se a mensagem e uma posicao. */
    static delta(mode, raw) {
      if (mode === "rel64") return raw - 64;
      if (mode === "rel16") return raw - 16;
      if (mode === "rel2c") return raw < 64 ? raw : raw - 128;
      return null;
    }

    mark() {
      document.body.classList.toggle("learning", this.learning);
      this.targets.forEach(t => t.el.classList.toggle("learn-sel", t.id === this.sel));
    }

    /* ----------------------------------------------------- tocar */

    drive(t, b, m) {
      if (m.type === "cc" && b.mode === "abs" && !b.sure) {
        // enquanto nao da para saber se e knob comum ou encoder, slider e knob esperam
        // (senao um encoder faria o slider pular para o meio nos primeiros toques)
        if (this.recheck(b, m) === "wait" && (t.kind === "value" || t.kind === "encoder")) return;
      }
      const d = m.type === "cc" ? RJ.MidiMap.delta(b.mode, m.raw) : null;
      if (t.kind === "button" || t.kind === "pad") {
        // program change ou encoder: cada mensagem e um toque
        if (m.type === "pc" || d != null) { this.release(t); this.press(t, 1); this.release(t); this.blink(t); return; }
        if (m.type === "note") { if (m.on) this.press(t, m.v); else this.release(t); return; }
        // CC: 64 ou mais aperta, menos solta. Um botao que so manda 127 aperta de novo a cada toque.
        if (m.v >= 0.5) { this.release(t); this.press(t, 1); } else this.release(t);
        return;
      }
      if (m.type === "pc") return;
      if (m.type === "note") { if (m.on) { if (t.kind === "encoder") t.step(1); else t.set(m.v); } return; }
      if (t.kind === "encoder") {
        let step = d;
        if (step == null) {
          // knob comum num encoder: anda a diferenca desde a ultima posicao
          const now = m.v * 127, prev = this.last[m.key];
          this.last[m.key] = now;
          if (prev == null) return;
          step = Math.round(now - prev);
        }
        if (step) t.step(step);
        return;
      }
      if (d == null) { t.set(m.v); delete this.pos[t.id]; return; }
      // encoder num slider ou knob: soma numa posicao propria, para os valores em degraus
      // (decay, multi level) andarem tambem quando o encoder gira devagar
      const cur = t.get();
      let p = this.pos[t.id];
      if (p == null || Math.abs(p - cur) > 0.05) p = cur;
      p = clamp(p + d / 64, 0, 1);
      this.pos[t.id] = p;
      t.set(p);
    }

    /**
     * Confere um CC salvo como posicao: se comeca a repetir valores perto do centro, e
     * um encoder e o modo muda sozinho ("rel"). Um valor longe dos centros, ou quatro
     * valores diferentes seguidos, confirmam o knob comum ("abs"). Antes disso, "wait".
     */
    recheck(b, m) {
      const h = this.hist[m.key] || (this.hist[m.key] = []);
      h.push(m.raw);
      if (h.length > 8) h.shift();
      const kind = RJ.MidiMap.relKind(h, false);
      if (kind) { b.mode = kind; delete this.hist[m.key]; this.persist(); return "rel"; }
      const x = m.raw, near = (x >= 1 && x <= 23) || (x >= 57 && x <= 71) || x >= 113;
      const changing = h.length >= 4 && h.slice(-4).every((v, i, a) => i === 0 || v !== a[i - 1]);
      if (!near || changing) { b.sure = true; delete this.hist[m.key]; this.persist(); return "abs"; }
      return "wait";
    }

    blink(t) { t.el.classList.add("down"); clearTimeout(t.blinkTimer); t.blinkTimer = setTimeout(() => t.el.classList.remove("down"), 90); }

    press(t, vel) {
      if (t.kind !== "pad" && this.held.has(t.id)) return;
      this.held.add(t.id);
      t.el.classList.add("down");
      t.down(vel);
    }

    release(t) {
      if (!this.held.has(t.id)) return;
      this.held.delete(t.id);
      t.el.classList.remove("down");
      if (t.up) t.up();
    }

    releaseAll() { this.held.forEach(id => { const t = this.targets.get(id); if (t) this.release(t); }); }
  };
})();
