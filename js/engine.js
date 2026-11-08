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
 * - Bancos A/B/C/D separados (DCX Studio, RJ-1202): alem da saida de mix, cada banco
 *   (indice do som / 8) pode sair numa saida propria. Um banco "roteado"
 *   (setBankRouted) sai da mix e vai so para a saida dele; sem rota nenhuma o
 *   som e o mesmo de antes, amostra por amostra.
 */
window.RJ = window.RJ || {};

RJ.FILTER = {
  dynOpen: 13000, dynClosed: 700,   // canais 1-2
  low: 6500,                         // canais 3-4
  high: 10500,                       // canais 5-6
};

RJ.Engine = class {
  /**
   * output: saida comum do host (RJ.Output); dest: () => no onde o SP entra (host.output).
   * bankDest: b (0 a 3) => no da saida do banco (host.output("rj2000-A")...); sem ele, nao ha saidas por banco.
   */
  constructor(project, output, dest, bankDest) {
    this.project = project;
    this.output = output || new RJ.Output();
    this.dest = dest || (() => this.output.limiter);
    this.bankDest = bankDest || null;
    this.ctx = null;
    this.graph = null;
    this.cache = new Map();
    this.levelOf = () => 1;          // a interface informa o volume (mix) de cada som
  }

  ensure() {
    if (!this.ctx) {
      this.ctx = this.output.ensure();
      this.graph = this.buildGraph(this.ctx);
      if (this.pendingBanks) { this.pendingBanks.forEach((on, b) => this.setBankRouted(b, on)); this.pendingBanks = null; }
    }
    if (this.ctx.state === "suspended") this.ctx.resume();
    return this.ctx;
  }

  get ready() { return !!this.ctx; }

  buildGraph(ctx) {
    const g = { ctx, inputs: [], filters: [], voices: new Array(8).fill(null) };
    g.mix = ctx.createGain();
    // bancos: por canal, uma porta no caminho da mix (wm, sempre 1 enquanto nenhum banco esta roteado)
    // e uma porta por banco para a saida dele (bt, sempre 0 ate o banco ser roteado)
    g.wm = []; g.bt = []; g.sched = []; g.routed = [false, false, false, false]; g.nRouted = 0;
    g.bankOut = [];
    for (let b = 0; b < 4; b++) {
      const bo = ctx.createGain();
      if (this.bankDest) { const d = this.bankDest(b); if (d) bo.connect(d); }
      g.bankOut.push(bo);
    }
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
      const wm = ctx.createGain();
      last.connect(wm); wm.connect(g.mix);
      g.wm.push(wm);
      g.bt.push([0, 1, 2, 3].map(b => { const t = ctx.createGain(); t.gain.value = 0; last.connect(t); t.connect(g.bankOut[b]); return t; }));
      g.sched.push([{ when: 0, bank: -1 }]);
      g.inputs.push(input);
      g.filters.push(filters);
    }
    g.out = ctx.createGain();
    g.mix.connect(g.out);
    g.met = ctx.createGain();
    g.met.connect(g.out);
    // o limitador agora e da saida comum (core/js/output.js): o SP entra nele pela saida dele
    g.limiter = this.output.limiter;
    g.out.connect(this.dest());
    this.applyVolumes(g);
    return g;
  }

  applyVolumes(g = this.graph) {
    if (!g) return;
    const p = this.project, t = g.ctx.currentTime;
    g.out.gain.setTargetAtTime(Math.pow(p.masterVol, 2) * 1.1, t, 0.01);
    g.bankOut.forEach(bo => bo.gain.setTargetAtTime(Math.pow(p.masterVol, 2) * 1.1, t, 0.01));
    g.met.gain.setTargetAtTime(Math.pow(p.metVol, 2), t, 0.01);
  }

  /**
   * Tira o banco b (0 a 3 = A a D) da mix e manda so para a saida dele, ou devolve para a mix.
   * Quem roteia a saida do banco (host.route(..., { dry: false })) avisa aqui. Vale para o som que toca
   * agora e para os disparos ja agendados.
   */
  setBankRouted(b, on) {
    const g = this.graph;
    on = !!on;
    if (!g) { this.pendingBanks = this.pendingBanks || []; this.pendingBanks[b] = on; return; }
    if (g.routed[b] === on) return;
    g.routed[b] = on;
    g.nRouted += on ? 1 : -1;
    for (let ch = 0; ch < 8; ch++) this.gateChannel(g, ch);
  }

  /** Reescreve as portas do canal ch a partir da lista de disparos (qual banco toca em cada instante). */
  gateChannel(g, ch) {
    const t = g.ctx.currentTime, ev = g.sched[ch];
    while (ev.length > 1 && ev[1].when <= t) ev.shift();
    const params = [g.wm[ch].gain].concat(g.bt[ch].map(x => x.gain));
    params.forEach(p => p.cancelScheduledValues(t));
    ev.forEach((e, i) => {
      const when = i === 0 ? t : e.when, r = e.bank >= 0 && g.routed[e.bank];
      g.wm[ch].gain.setValueAtTime(r ? 0 : 1, when);
      g.bt[ch].forEach((x, b) => x.gain.setValueAtTime(r && b === e.bank ? 1 : 0, when));
    });
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

  /** Anota que, a partir de when, o canal ch toca um som do banco bank. */
  noteBank(g, ch, bank, when) {
    const ev = g.sched[ch];
    let i = ev.length;
    while (i > 0 && ev[i - 1].when > when) i--;
    if (ev[i - 1] && ev[i - 1].bank === bank) return;      // o mesmo banco ja vale daqui em diante
    ev.splice(i, 0, { when, bank });
    if (g.nRouted) this.gateChannel(g, ch);
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
    this.noteBank(g, ch, s >> 3, when);

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
