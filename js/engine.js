/* RJ-2000 - motor de audio
 *
 * Como o SP-1200 funciona (e o que imitamos aqui):
 * - 8 canais de saida, um por posicao de pad. Cada canal toca um som por vez:
 *   um novo disparo no mesmo canal corta o anterior.
 * - Os sons ficam guardados em 12 bits / 26,04 kHz. Na hora de tocar com
 *   afinacao diferente, a maquina pula ou repete amostras (sem interpolacao).
 *   Isso gera o aliasing que da o "grao" caracteristico. Fazemos o mesmo.
 * - Canais 1 e 2 tem filtro passa-baixa que acompanha a afinacao,
 *   canais 3 a 6 tem filtro fixo e canais 7 e 8 saem sem filtro.
 *   (Aproximacao do comportamento da maquina original.)
 */
window.RJ = window.RJ || {};

RJ.Engine = class {
  constructor(project) {
    this.project = project;
    this.ctx = null;
    this.graph = null;
    this.cache = new Map();
  }

  /** Cria o AudioContext. Precisa ser chamado a partir de um gesto do usuario. */
  ensure() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC({ latencyHint: "interactive" });
      this.graph = this.buildGraph(this.ctx);
      this.applyMix();
      this.applyMaster();
    }
    if (this.ctx.state === "suspended") this.ctx.resume();
    return this.ctx;
  }

  get ready() { return !!this.ctx; }

  /** Monta a cadeia: 8 canais -> filtros por canal -> master (filtro S950 opcional) -> saida. */
  buildGraph(ctx) {
    const g = { ctx, inputs: [], filters: [], voices: new Array(8).fill(null) };
    g.master = ctx.createGain();
    for (let ch = 0; ch < 8; ch++) {
      const input = ctx.createGain();
      let last = input;
      const filters = [];
      if (ch < 2) {
        // filtro dinamico (acompanha a afinacao do som disparado)
        for (const q of [0.54, 1.31]) {
          const f = ctx.createBiquadFilter();
          f.type = "lowpass"; f.Q.value = q; f.frequency.value = 9000;
          last.connect(f); last = f; filters.push(f);
        }
      } else if (ch < 6) {
        const f = ctx.createBiquadFilter();
        f.type = "lowpass"; f.Q.value = 0.707; f.frequency.value = 11500;
        last.connect(f); last = f; filters.push(f);
      }
      last.connect(g.master);
      g.inputs.push(input);
      g.filters.push(filters);
    }
    // extra: filtro estilo S950 (3 biquads = 6a ordem Butterworth)
    g.s950 = [];
    let last = g.master;
    for (const q of [0.5176, 0.7071, 1.9319]) {
      const f = ctx.createBiquadFilter();
      f.type = "lowpass"; f.Q.value = q; f.frequency.value = 20000;
      last.connect(f); last = f; g.s950.push(f);
    }
    g.wet = ctx.createGain();
    g.dry = ctx.createGain();
    last.connect(g.wet);
    g.master.connect(g.dry);
    g.out = ctx.createGain();
    g.out.gain.value = 0.6;
    g.wet.connect(g.out);
    g.dry.connect(g.out);
    // saturacao suave no final: so atua perto do 0 dBFS, evita clipping digital
    // quando os 8 canais tocam juntos (sem o ganho automatico de um compressor)
    g.limiter = ctx.createWaveShaper();
    const curve = new Float32Array(2048);
    for (let i = 0; i < curve.length; i++) {
      const x = (i / (curve.length - 1)) * 2 - 1;
      const a = Math.abs(x);
      curve[i] = a < 0.7 ? x : Math.sign(x) * (0.7 + 0.28 * Math.tanh((a - 0.7) / 0.28));
    }
    g.limiter.curve = curve;
    g.limiter.oversample = "2x";
    g.out.connect(g.limiter);
    g.limiter.connect(ctx.destination);
    this.applyMaster(g);
    this.applyMix(g);
    return g;
  }

  applyMix(g = this.graph) {
    if (!g) return;
    const t = g.ctx.currentTime;
    this.project.levels.forEach((lv, ch) => {
      g.inputs[ch].gain.setTargetAtTime(lv * lv, t, 0.01);
    });
  }

  applyMaster(g = this.graph) {
    if (!g) return;
    const s = this.project.settings;
    const t = g.ctx.currentTime;
    const on = s.s950;
    g.wet.gain.setValueAtTime(on ? 1 : 0, t);
    g.dry.gain.setValueAtTime(on ? 0 : 1, t);
    const freq = 200 * Math.pow(90, s.s950Cut / 99);
    g.s950.forEach(f => f.frequency.setValueAtTime(Math.min(freq, g.ctx.sampleRate * 0.45), t));
    g.out.gain.setValueAtTime(Math.pow(10, s.outDb / 20) * 0.6, t);
  }

  /** Gera o buffer de reproducao com afinacao aplicada pelo metodo "drop-sample". */
  playBuffer(ctx, snd, tune) {
    const key = `${ctx.sampleRate}:${snd.id}:${snd.ver}:${tune.toFixed(2)}`;
    let buf = this.cache.get(key);
    if (buf) return buf;
    const pcm = snd.pcm;
    if (!pcm || pcm.length < 2) return null;
    let a = Math.floor(snd.startF * pcm.length);
    let b = Math.max(a + 1, Math.floor(snd.endF * pcm.length));
    const len = b - a;
    const ratio = (snd.rate * Math.pow(2, tune / 12)) / ctx.sampleRate;
    const outLen = Math.max(1, Math.floor(len / ratio));
    buf = ctx.createBuffer(1, outLen, ctx.sampleRate);
    const out = buf.getChannelData(0);
    if (snd.reverse) {
      for (let i = 0; i < outLen; i++) out[i] = pcm[b - 1 - Math.floor(i * ratio)];
    } else {
      for (let i = 0; i < outLen; i++) out[i] = pcm[a + Math.floor(i * ratio)];
    }
    if (this.cache.size > 400) this.cache.clear();
    this.cache.set(key, buf);
    return buf;
  }

  /**
   * Dispara um som.
   * opts: { when, tune, level, velocity, graph }
   * O canal e a posicao do pad (0-7) do som.
   */
  trigger(soundIndex, opts = {}) {
    const g = opts.graph || this.graph;
    if (!g) return;
    const ctx = g.ctx;
    const snd = this.project.sounds[soundIndex];
    if (!snd || !snd.pcm) return;
    const tune = opts.tune != null ? opts.tune : snd.tune;
    const buf = this.playBuffer(ctx, snd, tune);
    if (!buf) return;
    const when = Math.max(opts.when || 0, ctx.currentTime);
    const ch = soundIndex % 8;

    // corta a voz anterior do mesmo canal
    const prev = g.voices[ch];
    if (prev) {
      try {
        prev.gain.gain.cancelScheduledValues(when);
        prev.gain.gain.setTargetAtTime(0, when, 0.002);
        prev.src.stop(when + 0.02);
      } catch (e) { /* voz ja terminou */ }
    }

    const src = ctx.createBufferSource();
    src.buffer = buf;
    const gain = ctx.createGain();
    const level = (opts.level != null ? opts.level : 1) * (opts.velocity != null ? opts.velocity : 1);
    gain.gain.setValueAtTime(level, when);
    if (snd.decay < 0.999) {
      const tc = 0.004 + Math.pow(snd.decay, 2.2) * 0.9;
      gain.gain.setTargetAtTime(0, when + 0.003, tc);
    }
    src.connect(gain);
    gain.connect(g.inputs[ch]);

    // filtro dinamico dos canais 1 e 2
    if (ch < 2 && g.filters[ch].length) {
      const fc = Math.max(250, Math.min(ctx.sampleRate * 0.45, 8500 * Math.pow(2, tune / 12)));
      g.filters[ch].forEach(f => f.frequency.setValueAtTime(fc, when));
    }

    src.start(when);
    const voice = { src, gain };
    g.voices[ch] = voice;
    src.onended = () => { if (g.voices[ch] === voice) g.voices[ch] = null; };
  }

  click(when, accent) {
    const g = this.graph;
    if (!g) return;
    const ctx = g.ctx;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = accent ? 1760 : 1320;
    gain.gain.setValueAtTime(accent ? 0.22 : 0.13, when);
    gain.gain.exponentialRampToValueAtTime(0.0008, when + 0.035);
    osc.connect(gain);
    gain.connect(g.out);
    osc.start(when);
    osc.stop(when + 0.04);
  }

  /** Corta tudo imediatamente. */
  panic() {
    const g = this.graph;
    if (!g) return;
    const t = g.ctx.currentTime;
    g.voices.forEach((v, i) => {
      if (!v) return;
      try { v.gain.gain.cancelScheduledValues(t); v.gain.gain.setValueAtTime(0, t); v.src.stop(t + 0.01); } catch (e) {}
      g.voices[i] = null;
    });
  }

  invalidate() { this.cache.clear(); }
};
