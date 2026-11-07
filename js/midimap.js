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
      if (this.learning) { this.capture(m); return true; }
      const b = this.map[m.key], t = b && this.targets.get(b.t);
      if (!t) return false;
      this.drive(t, b, m);
      return true;
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

    clearAll() { this.map = {}; this.last = {}; this.persist(); }

    unbind(id) { Object.keys(this.map).forEach(k => { if (this.map[k].t === id) delete this.map[k]; }); }

    /**
     * Knob sem fim (encoder) manda passos em vez de posicao: 64 +/- n, ou 1..15 e
     * 113..127. Knob comum nunca repete o mesmo valor seguido; encoder repete.
     */
    modeFor(t, c) {
      const v = c.vals;
      if (!c.key.startsWith("c:") || !v.length) return "abs";
      const rel64 = v.every(x => x >= 57 && x <= 71 && x !== 64);
      const rel2c = v.every(x => (x >= 1 && x <= 15) || (x >= 113 && x <= 127));
      const repeats = v.some((x, i) => i > 0 && x === v[i - 1]);
      if (t.kind !== "encoder" && !repeats) return "abs";
      return rel64 ? "rel64" : rel2c ? "rel2c" : "abs";
    }

    mark() {
      document.body.classList.toggle("learning", this.learning);
      this.targets.forEach(t => t.el.classList.toggle("learn-sel", t.id === this.sel));
    }

    /* ----------------------------------------------------- tocar */

    drive(t, b, m) {
      if (t.kind === "button" || t.kind === "pad") {
        if (m.type === "pc") { this.press(t, 1); setTimeout(() => this.release(t), 90); return; }
        const down = m.type === "note" ? m.on : m.v >= 0.5;
        if (down) this.press(t, m.type === "note" ? m.v : 1); else this.release(t);
        return;
      }
      if (m.type === "pc") return;
      if (m.type === "note") { if (m.on) { if (t.kind === "encoder") t.step(1); else t.set(m.v); } return; }
      let d = null;
      if (m.type === "cc" && b.mode === "rel64") d = m.raw - 64;
      else if (m.type === "cc" && b.mode === "rel2c") d = m.raw < 64 ? m.raw : m.raw - 128;
      if (t.kind === "encoder") {
        if (d == null) {
          // knob comum num encoder: anda a diferenca desde a ultima posicao
          const now = m.v * 127, prev = this.last[m.key];
          this.last[m.key] = now;
          if (prev == null) return;
          d = Math.round(now - prev);
        }
        if (d) t.step(d);
        return;
      }
      t.set(d == null ? m.v : clamp(t.get() + d / 100, 0, 1));
    }

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
