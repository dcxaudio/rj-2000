/* RJ-2000 - sequenciador
 *
 * Segment mode: toca o segmento atual em loop (com metronomo). Gravacao em
 * tempo real com AUTO CORRECT e SWING aplicados na hora de gravar.
 * Song mode: toca a lista de passos da song (segmentos, repeticoes, mudanca
 * de tempo e de mix, subsongs e END).
 */
window.RJ = window.RJ || {};

RJ.Sequencer = class {
  constructor(project, engine) {
    this.p = project;
    this.engine = engine;
    this.playing = false;
    this.recArmed = false;
    this.sizing = false;
    this.listeners = {};
    this.timer = null;
    this.lookahead = 0.12;
    this.history = [];
    this.repeatPads = new Map();
    this.erasing = new Set();
    this.loopId = 0;
    this.mixOverride = null;
  }

  on(ev, fn) { (this.listeners[ev] = this.listeners[ev] || []).push(fn); }
  emit(ev, ...a) { (this.listeners[ev] || []).forEach(fn => fn(...a)); }
  later(time, fn) { setTimeout(fn, Math.max(0, (time - this.engine.ctx.currentTime) * 1000)); }

  get recording() { return this.playing && this.recArmed && this.p.mode === "segment" && !this.sizing; }

  get tempo() {
    if (this.p.mode === "song" && this.playing) return this.songTempo;
    return RJ.segment(this.p, this.p.curSeg).tempo;
  }

  tickDur() { return 60 / (this.tempo * RJ.PPQ); }

  /* ----------------------------------------------------------- transporte */

  /**
   * opts.sizing: dimensionar o segmento em tempo real (SEGMENT LENGTH + RUN).
   * opts.countIn: tempos de contagem antes de comecar (diferenca nossa: o
   * Record/Edit faz 1 compasso de contagem e ja comeca a gravar).
   */
  start(opts = {}) {
    const ctx = this.engine.ensure();
    this.sizing = !!opts.sizing;
    this.loopId++;
    this.countBeats = 0;
    this.tick = 0;
    this.history = [];
    this.mixOverride = null;
    if (this.p.mode === "song" && !this.sizing) {
      if (!this.songInit()) { this.emit("message", "Song Empty", ""); return false; }
    } else {
      this.playSeg = this.p.curSeg;
      const seg = RJ.segment(this.p, this.playSeg);
      if (opts.countIn && !this.sizing) {
        this.countBeats = opts.countIn;
        this.tick = -opts.countIn * RJ.beatTicks(seg);
      }
    }
    this.playing = true;
    this.nextTime = ctx.currentTime + 0.06;
    this.timer = setInterval(() => this.schedule(), 20);
    this.schedule();
    this.emit("transport");
    return true;
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    const sized = this.sizing ? this.tick : null;
    this.playing = false;
    this.sizing = false;
    this.erasing.clear();
    this.mixOverride = null;
    this.emit("transport");
    this.emit("position", null);
    return sized;
  }

  /* ----------------------------------------------------------- agendamento */

  schedule() {
    const ctx = this.engine.ctx;
    if (!ctx || !this.playing) return;
    const horizon = ctx.currentTime + this.lookahead;
    let guard = 0;
    while (this.nextTime < horizon && this.playing && guard++ < 5000) {
      this.processTick(this.tick, this.nextTime);
      if (this.ramp) this.stepRamp();
      this.nextTime += this.tickDur();
      this.tick++;
      if (!this.sizing && this.tick >= RJ.segTicks(RJ.segment(this.p, this.playSeg))) this.segmentEnd();
    }
  }

  processTick(tick, time) {
    const seg = RJ.segment(this.p, this.playSeg);
    this.history.push({ time, tick, seg: this.playSeg, loop: this.loopId });
    if (this.history.length > 4096) this.history.splice(0, 2048);

    // contagem antes de gravar: so o clique, com acento no primeiro tempo
    if (tick < 0) {
      const bt = RJ.beatTicks(seg);
      if (tick % bt === 0) {
        const left = -tick / bt;
        this.engine.click(time, left === this.countBeats);
        const pos = { tick, seg: this.playSeg, count: left };
        this.later(time, () => { if (this.playing) this.emit("position", pos); });
      }
      return;
    }

    // metronomo (so no segment mode)
    const met = RJ.METRONOME[this.p.metronome];
    if ((this.p.mode === "segment" || this.sizing) && met && met.ticks) {
      const bt = RJ.beatTicks(seg);
      const sub = this.sizing ? bt : met.ticks;
      if (tick % sub === 0) this.engine.click(time, tick % RJ.barTicks(seg) === 0);
    }

    if (!this.sizing) {
      const evs = seg.events;
      for (let i = 0; i < evs.length; i++) {
        const e = evs[i];
        if (e.t !== tick) continue;
        if (this.erasing.has(e.s)) { evs.splice(i, 1); i--; seg.ver++; this.emit("change"); continue; }
        if (e.born === this.loopId) continue; // gravado ao vivo neste loop: ja soou
        this.engine.trigger(e.s, { when: time, level: e.lvl, tune: e.tune, velocity: e.vel });
        this.emit("hit", e.s, time, e.vel);
      }
      if (this.repeatPads.size && this.onGrid(tick)) {
        this.repeatPads.forEach((o, s) => {
          this.engine.trigger(s, { when: time, level: o.lvl, tune: o.tune, velocity: o.vel });
          this.emit("hit", s, time, o.vel);
          if (this.recording) this.insertEvent(this.playSeg, tick, s, o, true);
        });
      }
    }

    const bt = RJ.beatTicks(seg);
    if (tick % bt === 0) {
      const beat = tick / bt;
      const pos = { tick, seg: this.playSeg, bar: Math.floor(beat / seg.num) + 1, beat: (beat % seg.num) + 1, beats: beat, songStep: this.songStepIdx };
      this.later(time, () => { if (this.playing) this.emit("position", pos); });
    }
  }

  swingOffset(ticks) { return Math.round(2 * ticks * this.p.swing / 100) - ticks; }

  onGrid(tick) {
    const ac = RJ.AUTO_CORRECT[this.p.ac];
    const g = ac.ticks;
    if (!ac.swing) return tick % g === 0;
    const pos = tick % (g * 2);
    return pos === 0 || pos === g + this.swingOffset(g);
  }

  segmentEnd() {
    this.tick = 0;
    this.loopId++;
    if (this.p.mode !== "song") {
      this.playSeg = this.p.curSeg;   // troca de segmento so no fim do atual
      RJ.segment(this.p, this.playSeg);
      return;
    }
    const next = this.songNext();
    if (next == null) {
      const endAt = this.nextTime;
      this.playing = false;
      clearInterval(this.timer); this.timer = null;
      this.later(endAt, () => { this.mixOverride = null; this.emit("transport"); this.emit("position", null); });
      return;
    }
    this.playSeg = next;
    RJ.segment(this.p, next);
  }

  /* ----------------------------------------------------------- song mode */

  songInit() {
    const p = this.p;
    this.songIdx = p.curSong;
    const song = RJ.song(p, this.songIdx);
    this.songPc = Math.max(0, (song.first || 1) - 1);
    this.repStack = [];
    this.callStack = [];
    this.songTempo = song.tempo;
    this.ramp = null;
    const first = this.songNext();
    if (first == null) return false;
    this.playSeg = first;
    RJ.segment(p, first);
    return true;
  }

  /** Avanca na song ate o proximo segmento. null = fim. */
  songNext() {
    const p = this.p;
    for (let guard = 0; guard < 2000; guard++) {
      const song = RJ.song(p, this.songIdx);
      const steps = song.steps;
      if (this.songPc >= steps.length) {
        if (this.callStack.length) { const c = this.callStack.pop(); this.songIdx = c.song; this.songPc = c.pc; continue; }
        return null;
      }
      const idx = this.songPc++;
      const st = steps[idx];
      switch (st.type) {
        case "seg":
          this.songStepIdx = idx;
          this.emit("songstep", this.songIdx, idx);
          return st.seg;
        case "repStart":
          this.repStack.push({ song: this.songIdx, pc: this.songPc, left: null });
          break;
        case "repEnd": {
          const top = this.repStack[this.repStack.length - 1];
          if (!top) break;
          if (top.left == null) top.left = Math.max(1, st.count | 0) - 1;
          if (top.left > 0) { top.left--; this.songPc = top.pc; }
          else this.repStack.pop();
          break;
        }
        case "tempo": {
          const to = Math.max(40, Math.min(240, this.songTempo + st.dir * st.bpm));
          this.ramp = { from: this.songTempo, to, ticks: Math.max(1, st.beats * RJ.PPQ), done: 0 };
          break;
        }
        case "mix":
          this.mixOverride = p.mixes[st.mix] || null;
          break;
        case "sub":
          if (this.callStack.length < 4 && st.song !== this.songIdx) {
            this.callStack.push({ song: this.songIdx, pc: this.songPc });
            this.songIdx = st.song; this.songPc = 0;
          }
          break;
        case "end":
          if (st.kind === "repeat") { this.songPc = 0; this.repStack = []; break; }
          if (st.kind === "link" && st.song != null) {
            this.songIdx = st.song;
            const s2 = RJ.song(p, st.song);
            this.songPc = Math.max(0, (s2.first || 1) - 1);
            this.songTempo = s2.tempo;
            this.repStack = [];
            this.emit("songlink", st.song);
            break;
          }
          if (this.callStack.length) { const c = this.callStack.pop(); this.songIdx = c.song; this.songPc = c.pc; break; }
          return null;
        default: break; // trigger: sem efeito (saidas de trigger nao existem no navegador)
      }
    }
    return null;
  }

  stepRamp() {
    const r = this.ramp;
    r.done++;
    this.songTempo = r.from + (r.to - r.from) * Math.min(1, r.done / r.ticks);
    if (r.done >= r.ticks) this.ramp = null;
  }

  /* ----------------------------------------------------------- gravacao */

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
    if (!ac.swing) q = Math.round(tickF / g) * g;
    else {
      const off = this.swingOffset(g);
      const pair = g * 2;
      const base = Math.floor(tickF / pair) * pair;
      const cands = [base - pair + g + off, base, base + g + off, base + pair];
      q = cands.reduce((best, c) => Math.abs(c - tickF) < Math.abs(best - tickF) ? c : best, cands[0]);
    }
    return ((q % segLen) + segLen) % segLen;
  }

  insertEvent(segIndex, tick, s, o = {}, born) {
    const seg = RJ.segment(this.p, segIndex);
    if (seg.events.some(e => e.t === tick && e.s === s)) return false;
    const e = { t: tick, s };
    if (o.lvl != null) e.lvl = o.lvl;
    if (o.tune != null) e.tune = o.tune;
    if (o.vel != null && o.vel !== 1) e.vel = o.vel;
    if (born) e.born = this.loopId;
    seg.events.push(e);
    seg.events.sort((a, b) => a.t - b.t);
    seg.ver++;
    this.emit("change");
    return true;
  }

  /** Pad tocado ao vivo: toca na hora e grava, se estiver gravando. */
  liveHit(s, o = {}) {
    this.engine.trigger(s, { level: o.lvl, tune: o.tune, velocity: o.vel });
    this.emit("hit", s, this.engine.ctx.currentTime, o.vel);
    if (!this.recording) return;
    const pos = this.nowPosition();
    if (!pos) return;
    const seg = RJ.segment(this.p, pos.seg);
    const len = RJ.segTicks(seg);
    if (pos.tick < 0) {
      // tocou um pouco antes do fim da contagem: entra no tempo 1
      if (pos.tick < -RJ.AUTO_CORRECT[this.p.ac].ticks / 2) return;
      pos.tick = 0;
    }
    const q = this.quantize(pos.tick, len);
    if (seg.events.some(x => x.t === q && x.s === s)) return;
    const e = { t: q, s };
    if (o.lvl != null) e.lvl = o.lvl;
    if (o.tune != null) e.tune = o.tune;
    if (o.vel != null && o.vel !== 1) e.vel = o.vel;
    // ja tocou ao vivo: nao tocar de novo neste loop (ou no proximo, se a
    // quantizacao jogou a nota para o inicio do loop seguinte)
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
    this.p.segments[segIndex] = null;
    this.emit("change");
  }

  copySegment(from, to) {
    const a = RJ.segment(this.p, from);
    const b = RJ.loadSegment(a);
    b.events.forEach(e => delete e.born);
    this.p.segments[to] = b;
    this.emit("change");
  }

  /** Emenda o segmento nele mesmo `times` vezes (COPY com origem = destino). */
  appendSegment(i, times) {
    const seg = RJ.segment(this.p, i);
    const len = RJ.segTicks(seg);
    const totalBeats = (seg.bars * seg.num + seg.beats) * (times + 1);
    const bars = Math.floor(totalBeats / seg.num);
    if (bars > 99) return false;
    const base = seg.events.map(e => { const c = Object.assign({}, e); delete c.born; return c; });
    for (let k = 1; k <= times; k++) base.forEach(e => seg.events.push(Object.assign({}, e, { t: e.t + len * k })));
    seg.events.forEach(e => delete e.born);
    seg.bars = bars;
    seg.beats = totalBeats % seg.num;
    seg.events.sort((a, b) => a.t - b.t);
    seg.ver++;
    this.emit("change");
    return true;
  }

  /** Muda o tamanho; ao diminuir, descarta as notas que ficaram de fora. */
  setLength(i, bars, beats) {
    const seg = RJ.segment(this.p, i);
    seg.bars = bars; seg.beats = beats;
    const len = RJ.segTicks(seg);
    seg.events = seg.events.filter(e => e.t < len);
    seg.ver++;
    this.emit("change");
  }
};
