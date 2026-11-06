/* RJ-2000 - sequenciador
 *
 * Segmentos (padroes) de 1 a 99 compassos em 4/4, resolucao de 96 pulsos por
 * seminima. Gravacao em tempo real com auto-correct (quantizacao) e swing
 * aplicados na hora de gravar, como no SP-1200. Song mode encadeia segmentos.
 */
window.RJ = window.RJ || {};

RJ.Sequencer = class {
  constructor(project, engine) {
    this.p = project;
    this.engine = engine;
    this.playing = false;
    this.recArmed = false;
    this.listeners = {};
    this.timer = null;
    this.lookahead = 0.12;
    this.history = [];           // [{time, tick, seg, loop}] para localizar o playhead
    this.repeatPads = new Map(); // soundIndex -> {level, tune}
    this.erasing = new Set();    // sons sendo apagados enquanto tocam
    this.loopId = 0;
  }

  on(ev, fn) { (this.listeners[ev] = this.listeners[ev] || []).push(fn); }
  emit(ev, ...a) { (this.listeners[ev] || []).forEach(fn => fn(...a)); }

  get recording() { return this.playing && this.recArmed && this.p.mode === "segment"; }
  tickDur() { return 60 / (this.p.tempo * RJ.PPQ); }
  acTicks() { return RJ.AUTO_CORRECT[this.p.ac].ticks; }

  /* ----------------------------------------------------------- transporte */

  start() {
    const ctx = this.engine.ensure();
    this.playing = true;
    this.loopId++;
    this.tick = 0;
    this.history = [];
    if (this.p.mode === "song") {
      this.songStep = 0;
      this.songRep = 0;
      const st = this.p.song.steps[0];
      if (!st) { this.playing = false; this.emit("message", "SONG VAZIA", "ADICIONE PASSOS"); return; }
      this.playSeg = st.seg;
    } else {
      this.playSeg = this.p.curSeg;
    }
    RJ.segment(this.p, this.playSeg);
    this.nextTime = ctx.currentTime + 0.06;
    this.timer = setInterval(() => this.schedule(), 20);
    this.schedule();
    this.emit("transport");
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.playing = false;
    this.erasing.clear();
    this.emit("transport");
    this.emit("position", null);
  }

  toggle() { this.playing ? this.stop() : this.start(); }

  /* ----------------------------------------------------------- agendamento */

  schedule() {
    const ctx = this.engine.ctx;
    if (!ctx || !this.playing) return;
    const horizon = ctx.currentTime + this.lookahead;
    let guard = 0;
    while (this.nextTime < horizon && this.playing && guard++ < 5000) {
      this.processTick(this.tick, this.nextTime);
      this.nextTime += this.tickDur();
      this.tick++;
      const seg = RJ.segment(this.p, this.playSeg);
      if (this.tick >= RJ.segTicks(seg)) this.segmentEnd();
    }
  }

  processTick(tick, time) {
    const seg = RJ.segment(this.p, this.playSeg);
    this.history.push({ time, tick, seg: this.playSeg, loop: this.loopId });
    if (this.history.length > 2048) this.history.splice(0, 1024);

    // metronomo
    const met = this.p.metronome;
    if (tick % RJ.PPQ === 0 && (met === "on" || (met === "rec" && this.recording))) {
      this.engine.click(time, tick % (RJ.PPQ * 4) === 0);
    }

    // eventos do segmento
    const evs = seg.events;
    for (let i = 0; i < evs.length; i++) {
      const e = evs[i];
      if (e.t !== tick) continue;
      if (this.erasing.has(e.s)) { evs.splice(i, 1); i--; seg.ver++; this.emit("change"); continue; }
      if (e.born === this.loopId) continue; // acabou de ser gravado ao vivo, ja tocou
      this.engine.trigger(e.s, { when: time, level: e.lvl, tune: e.tune, velocity: e.vel });
      this.emit("hit", e.s, time);
    }

    // note repeat (segurando TAP/REPEAT + pad)
    if (this.repeatPads.size && this.onGrid(tick)) {
      this.repeatPads.forEach((o, s) => {
        this.engine.trigger(s, { when: time, level: o.lvl, tune: o.tune, velocity: o.vel });
        this.emit("hit", s, time);
        if (this.recording) this.insertEvent(this.playSeg, tick, s, o, true);
      });
    }

    if (tick % 24 === 0) {
      const delay = Math.max(0, (time - this.engine.ctx.currentTime) * 1000);
      const seg16 = tick / 24;
      setTimeout(() => this.emit("position", { tick, step: seg16, seg: this.playSeg }), delay);
    }
  }

  /** O tick cai na grade do auto-correct (com swing)? */
  onGrid(tick) {
    const ac = RJ.AUTO_CORRECT[this.p.ac];
    const g = ac.ticks;
    if (g <= 1) return tick % 24 === 0;
    const pair = g * 2;
    const pos = tick % pair;
    const off = ac.swing ? Math.round(g * (2 * this.p.swing / 100 - 1)) : 0;
    return pos === 0 || pos === g + off;
  }

  segmentEnd() {
    this.tick = 0;
    this.loopId++;
    if (this.p.mode !== "song") {
      // troca de segmento durante a reproducao acontece no fim do segmento atual
      this.playSeg = this.p.curSeg;
      RJ.segment(this.p, this.playSeg);
      return;
    }
    {
      this.songRep++;
      const st = this.p.song.steps[this.songStep];
      if (!st || this.songRep >= st.reps) {
        this.songRep = 0;
        this.songStep++;
        if (this.songStep >= this.p.song.steps.length) {
          // fim da song: para (como na maquina)
          const endAt = this.nextTime;
          const delay = Math.max(0, (endAt - this.engine.ctx.currentTime) * 1000);
          this.playing = false;
          clearInterval(this.timer); this.timer = null;
          setTimeout(() => { this.emit("transport"); this.emit("position", null); this.emit("message", "FIM DA SONG", ""); }, delay);
          return;
        }
      }
      this.playSeg = this.p.song.steps[this.songStep].seg;
      RJ.segment(this.p, this.playSeg);
      const step = this.songStep, rep = this.songRep, seg = this.playSeg;
      const delay = Math.max(0, (this.nextTime - this.engine.ctx.currentTime) * 1000);
      setTimeout(() => this.emit("songstep", step, rep, seg), delay);
    }
  }

  /* ----------------------------------------------------------- gravacao */

  /** Posicao atual (em ticks, fracionado) do que esta soando agora. */
  nowPosition() {
    const now = this.engine.ctx.currentTime;
    let h = null;
    for (let i = this.history.length - 1; i >= 0; i--) {
      if (this.history[i].time <= now) { h = this.history[i]; break; }
    }
    if (!h) h = this.history[0];
    if (!h) return null;
    return { tick: h.tick + (now - h.time) / this.tickDur(), seg: h.seg, loop: h.loop };
  }

  quantize(tickF, segLen) {
    const ac = RJ.AUTO_CORRECT[this.p.ac];
    const g = ac.ticks;
    let q;
    if (g <= 1) q = Math.round(tickF);
    else {
      const off = ac.swing ? Math.round(g * (2 * this.p.swing / 100 - 1)) : 0;
      // candidatos: grade normal e contratempo deslocado pelo swing
      const pair = g * 2;
      const base = Math.floor(tickF / pair) * pair;
      const cands = [base - pair + g + off, base, base + g + off, base + pair, base + pair + g + off];
      q = cands.reduce((best, c) => Math.abs(c - tickF) < Math.abs(best - tickF) ? c : best, cands[0]);
    }
    return ((q % segLen) + segLen) % segLen;
  }

  insertEvent(segIndex, tick, s, o = {}, born) {
    const seg = RJ.segment(this.p, segIndex);
    // evita duplicar o mesmo som no mesmo tick
    if (seg.events.some(e => e.t === tick && e.s === s)) return;
    const e = { t: tick, s };
    if (o.lvl != null) e.lvl = o.lvl;
    if (o.tune != null) e.tune = o.tune;
    if (o.vel != null && o.vel !== 1) e.vel = o.vel;
    if (born) e.born = this.loopId;
    seg.events.push(e);
    seg.events.sort((a, b) => a.t - b.t);
    seg.ver++;
    this.emit("change");
  }

  /** Um pad foi tocado ao vivo. Toca na hora e grava (se estiver gravando). */
  liveHit(s, o = {}) {
    this.engine.trigger(s, { level: o.lvl, tune: o.tune, velocity: o.vel });
    this.emit("hit", s, this.engine.ctx.currentTime);
    if (!this.recording) return;
    const pos = this.nowPosition();
    if (!pos) return;
    const seg = RJ.segment(this.p, pos.seg);
    const len = RJ.segTicks(seg);
    const q = this.quantize(pos.tick, len);
    const e = { t: q, s };
    if (o.lvl != null) e.lvl = o.lvl;
    if (o.tune != null) e.tune = o.tune;
    if (o.vel != null && o.vel !== 1) e.vel = o.vel;
    if (seg.events.some(x => x.t === q && x.s === s)) return;
    // O som ja tocou ao vivo. Marcamos o loop em que o sequenciador o tocaria
    // logo em seguida, para nao soar duplicado (flam). Se a quantizacao jogou
    // a nota para o inicio do proximo loop, a marca e o loop seguinte.
    e.born = q < pos.tick - len / 2 ? pos.loop + 1 : pos.loop;
    seg.events.push(e);
    seg.events.sort((a, b) => a.t - b.t);
    seg.ver++;
    this.emit("change");
  }

  /* ----------------------------------------------------------- edicao */

  eraseSound(segIndex, s) {
    const seg = RJ.segment(this.p, segIndex);
    const n = seg.events.length;
    seg.events = seg.events.filter(e => e.s !== s);
    seg.ver++;
    this.emit("change");
    return n - seg.events.length;
  }

  clearSegment(segIndex) {
    const seg = RJ.segment(this.p, segIndex);
    seg.events = [];
    seg.ver++;
    this.emit("change");
  }

  copySegment(from, to) {
    const a = RJ.segment(this.p, from);
    this.p.segments[to] = { bars: a.bars, events: a.events.map(e => { const c = Object.assign({}, e); delete c.born; return c; }), ver: 0 };
    this.emit("change");
  }

  /** Liga ou desliga um passo de 1/16 na grade (edicao por passos). */
  toggleStep(segIndex, s, tick) {
    const seg = RJ.segment(this.p, segIndex);
    const hit = seg.events.filter(e => e.s === s && e.t >= tick && e.t < tick + 24);
    if (hit.length) seg.events = seg.events.filter(e => !hit.includes(e));
    else {
      const ac = RJ.AUTO_CORRECT[this.p.ac];
      let t = tick;
      if (ac.swing && ac.ticks === 24 && (tick / 24) % 2 === 1) t += Math.round(24 * (2 * this.p.swing / 100 - 1));
      if (ac.swing && ac.ticks === 48 && (tick / 48) % 2 === 1) t += Math.round(48 * (2 * this.p.swing / 100 - 1));
      seg.events.push({ t, s });
      seg.events.sort((a, b) => a.t - b.t);
    }
    seg.ver++;
    this.emit("change");
    return !hit.length;
  }

  /* ----------------------------------------------------------- exportacao */

  /** Lista de disparos {time, s, o} para renderizar offline. */
  timeline(kind) {
    const out = [];
    const td = this.tickDur();
    let t0 = 0;
    const pushSeg = (si) => {
      const seg = RJ.segment(this.p, si);
      const len = RJ.segTicks(seg);
      seg.events.forEach(e => { if (e.t < len) out.push({ time: t0 + e.t * td, s: e.s, o: e }); });
      t0 += len * td;
    };
    if (kind === "song") {
      this.p.song.steps.forEach(st => { for (let r = 0; r < st.reps; r++) pushSeg(st.seg); });
    } else {
      pushSeg(this.p.curSeg);
    }
    return { events: out, duration: t0 };
  }

  async renderWav(kind) {
    const { events, duration } = this.timeline(kind);
    if (!events.length) throw new Error("Nada para exportar");
    const rate = 44100;
    const tail = 2.0;
    const octx = new OfflineAudioContext(2, Math.ceil((duration + tail) * rate), rate);
    const g = this.engine.buildGraph(octx);
    events.forEach(ev => this.engine.trigger(ev.s, { when: ev.time, level: ev.o.lvl, tune: ev.o.tune, velocity: ev.o.vel, graph: g }));
    const buf = await octx.startRendering();
    // corta o silencio do final da cauda
    const l = buf.getChannelData(0), r = buf.getChannelData(1);
    let end = l.length;
    const minEnd = Math.ceil(duration * rate);
    while (end > minEnd && Math.abs(l[end - 1]) < 1e-4 && Math.abs(r[end - 1]) < 1e-4) end--;
    return RJ.dsp.encodeWav([l.subarray(0, end), r.subarray(0, end)], rate);
  }
};
