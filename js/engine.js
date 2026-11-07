/* RJ-2000 - motor de audio
 *
 * O que imitamos do SP-1200 (aproximacoes):
 * - Sons em 12 bits / 26,04 kHz. A afinacao pula ou repete amostras, sem
 *   interpolacao (drop-sample), e nao ha filtro de reconstrucao: o aliasing e
 *   as imagens acima de Nyquist fazem parte do som.
 * - 8 canais de saida. Cada canal toca um som por vez: um novo disparo no
 *   mesmo canal corta o anterior. O canal de cada som e configuravel (SET-UP 17).
 * - Canais 1 e 2: passa-baixa dinamico (SSM2044), o corte cai junto com o decay.
 *   Canais 3 e 4: passa-baixa fixo, corte mais baixo.
 *   Canais 5 e 6: passa-baixa fixo, corte mais alto.
 *   Canais 7 e 8: sem filtro.
 * - Saida de mix mono.
 */
window.RJ = window.RJ || {};

RJ.FILTER = {
  dynOpen: 13000, dynClosed: 700,   // canais 1-2
  low: 6500,                         // canais 3-4
  high: 10500,                       // canais 5-6
};

RJ.Engine = class {
  constructor(project) {
    this.project = project;
    this.ctx = null;
    this.graph = null;
    this.cache = new Map();
    this.levelOf = () => 1;          // a interface informa o volume (mix) de cada som
  }

  ensure() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC({ latencyHint: "interactive" });
      this.graph = this.buildGraph(this.ctx);
    }
    if (this.ctx.state === "suspended") this.ctx.resume();
    return this.ctx;
  }

  get ready() { return !!this.ctx; }

  buildGraph(ctx) {
    const g = { ctx, inputs: [], filters: [], voices: new Array(8).fill(null) };
    g.mix = ctx.createGain();
    const nyq = ctx.sampleRate * 0.45;
    for (let ch = 0; ch < 8; ch++) {
      const input = ctx.createGain();
      let last = input;
      const filters = [];
      const fc = ch < 2 ? RJ.FILTER.dynOpen : ch < 4 ? RJ.FILTER.low : ch < 6 ? RJ.FILTER.high : 0;
      if (fc) {
        // 4 polos (duas secoes de 2 polos), como os filtros da maquina
        for (const q of [0.54, 1.31]) {
          const f = ctx.createBiquadFilter();
          f.type = "lowpass"; f.Q.value = q; f.frequency.value = Math.min(fc, nyq);
          last.connect(f); last = f; filters.push(f);
        }
      }
      last.connect(g.mix);
      g.inputs.push(input);
      g.filters.push(filters);
    }
    g.out = ctx.createGain();
    g.mix.connect(g.out);
    g.met = ctx.createGain();
    g.met.connect(g.out);
    // saturacao suave so perto de 0 dBFS, para os 8 canais juntos nao estourarem
    g.limiter = ctx.createWaveShaper();
    const curve = new Float32Array(2048);
    for (let i = 0; i < curve.length; i++) {
      const x = (i / (curve.length - 1)) * 2 - 1, a = Math.abs(x);
      curve[i] = a < 0.7 ? x : Math.sign(x) * (0.7 + 0.28 * Math.tanh((a - 0.7) / 0.28));
    }
    g.limiter.curve = curve;
    g.out.connect(g.limiter);
    g.limiter.connect(ctx.destination);
    this.applyVolumes(g);
    return g;
  }

  applyVolumes(g = this.graph) {
    if (!g) return;
    const p = this.project, t = g.ctx.currentTime;
    g.out.gain.setTargetAtTime(Math.pow(p.masterVol, 2) * 1.1, t, 0.01);
    g.met.gain.setTargetAtTime(Math.pow(p.metVol, 2), t, 0.01);
  }

  /** Buffer de reproducao com a afinacao aplicada por drop-sample. */
  playBuffer(ctx, snd, tune) {
    const key = `${ctx.sampleRate}:${snd.id}:${snd.ver}:${snd.start}:${snd.end}:${tune.toFixed(2)}`;
    let buf = this.cache.get(key);
    if (buf) return buf;
    const pcm = snd.pcm;
    if (!pcm) return null;
    const a = Math.max(0, Math.min(snd.start, pcm.length - 1));
    const b = Math.max(a + 1, Math.min(snd.end || pcm.length, pcm.length));
    const ratio = (RJ.RATE * Math.pow(2, tune / 12)) / ctx.sampleRate;
    const outLen = Math.max(1, Math.floor((b - a) / ratio));
    buf = ctx.createBuffer(1, outLen, ctx.sampleRate);
    const out = buf.getChannelData(0);
    for (let i = 0; i < outLen; i++) out[i] = pcm[a + Math.floor(i * ratio)];
    buf.rjRatio = ratio;
    if (this.cache.size > 400) this.cache.clear();
    this.cache.set(key, buf);
    return buf;
  }

  decayTime(decay) { return 0.004 + Math.pow(decay / 31, 2.4) * 1.1; }

  /**
   * Dispara um som.
   * opts: { when, tune, level, velocity, graph }
   */
  trigger(s, opts = {}) {
    const g = opts.graph || this.graph;
    if (!g) return;
    const ctx = g.ctx;
    const snd = this.project.sounds[s];
    if (!snd || !snd.pcm) return;
    const tune = opts.tune != null ? opts.tune : (snd.mode === "tune" ? snd.tune : 0);
    const decay = opts.decay != null ? opts.decay : (snd.mode === "decay" ? snd.decay : 31);
    const buf = this.playBuffer(ctx, snd, tune);
    if (!buf) return;
    const when = Math.max(opts.when || 0, ctx.currentTime);

    const ch = snd.channel & 7;

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
    if (snd.loop != null && snd.loop > snd.start && snd.loop < snd.end) {
      src.loop = true;
      src.loopStart = (snd.loop - snd.start) / buf.rjRatio / ctx.sampleRate;
      src.loopEnd = buf.duration;
    }
    const gain = ctx.createGain();
    const level = this.levelOf(s) * (opts.level != null ? opts.level : 1) * (opts.velocity != null ? opts.velocity : 1);
    gain.gain.setValueAtTime(level, when);
    const tc = decay < 31 ? this.decayTime(decay) : 0;
    if (tc) gain.gain.setTargetAtTime(0, when + 0.003, tc);
    src.connect(gain);
    gain.connect(g.inputs[ch]);

    if (ch < 2) {
      const nyq = ctx.sampleRate * 0.45;
      g.filters[ch].forEach(f => {
        f.frequency.cancelScheduledValues(when);
        f.frequency.setValueAtTime(Math.min(RJ.FILTER.dynOpen, nyq), when);
        if (tc) f.frequency.setTargetAtTime(RJ.FILTER.dynClosed, when + 0.003, tc * 1.3);
      });
    }

    src.start(when);
    if (src.loop && !tc) { /* sustenta ate o proximo disparo no canal */ }
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
    osc.type = "square";
    osc.frequency.value = accent ? 2000 : 1500;
    gain.gain.setValueAtTime(accent ? 0.16 : 0.1, when);
    gain.gain.exponentialRampToValueAtTime(0.0008, when + 0.02);
    osc.connect(gain);
    gain.connect(g.met);
    osc.start(when);
    osc.stop(when + 0.025);
  }

  /** Bipe de aviso (segmento vazio, erro). */
  beep() {
    const g = this.graph;
    if (!g) return;
    const ctx = g.ctx, t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "square";
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.08, t);
    gain.gain.setValueAtTime(0, t + 0.12);
    osc.connect(gain);
    gain.connect(g.out);
    osc.start(t);
    osc.stop(t + 0.13);
  }

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
