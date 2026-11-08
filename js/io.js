/* RJ-2000 - entradas do SP: microfone (sampling) e o mapa MIDI padrao */
window.RJ = window.RJ || {};

/**
 * Sampler pelo microfone/entrada de audio.
 * Fluxo: open() pede permissao e liga o medidor; arm() espera o sinal passar
 * do limiar (threshold) e grava ate stop() ou ate o tempo maximo.
 */
RJ.Sampler = class {
  constructor(engine) {
    this.engine = engine;
    this.stream = null;
    this.state = "off"; // off | monitor | armed | recording
    this.level = 0;
    this.threshold = 0.05;
    this.gain = 1;
    this.peak = 0;
    this.onLevel = null;
    this.onDone = null;
  }

  async open() {
    const ctx = this.engine.ensure();
    if (this.stream) return;
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error("Este navegador nao permite gravar audio aqui");
    }
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
    });
    this.src = ctx.createMediaStreamSource(this.stream);
    // ScriptProcessor: antigo, mas funciona em todos os navegadores e ate abrindo o arquivo direto
    this.proc = ctx.createScriptProcessor(2048, 1, 1);
    this.mute = ctx.createGain();
    this.mute.gain.value = 0;
    this.src.connect(this.proc);
    this.proc.connect(this.mute);
    this.mute.connect(ctx.destination);
    this.proc.onaudioprocess = (ev) => this.process(ev.inputBuffer.getChannelData(0));
    this.state = "monitor";
  }

  process(input) {
    const data = new Float32Array(input.length);
    let pk = 0;
    for (let i = 0; i < input.length; i++) {
      const v = Math.max(-1, Math.min(1, input[i] * this.gain));
      data[i] = v;
      const a = Math.abs(v); if (a > pk) pk = a;
    }
    this.level = Math.max(pk, this.level * 0.85);
    this.peak = Math.max(pk, this.peak * 0.97);
    if (this.state === "armed" && pk >= this.threshold) this.begin();
    if (this.state === "recording") {
      this.chunks.push(data);
      this.count += data.length;
      if (pk > this.recPeak) this.recPeak = pk;
      if (this.count >= this.maxSamples) this.stop();
    }
    const now = performance.now();
    if (this.onLevel && now - (this.lastUi || 0) > 50) { this.lastUi = now; this.onLevel(this.level, this.state); }
  }

  begin() {
    this.state = "recording";
    this.chunks = [];
    this.count = 0;
    this.recPeak = 0;
  }

  /** Grava na hora, sem esperar o limiar (SAMPLE 9). */
  force(maxSeconds) {
    if (this.state === "off") return;
    this.maxSamples = Math.floor(maxSeconds * this.engine.ctx.sampleRate);
    this.begin();
  }

  arm(maxSeconds) {
    if (this.state === "off") return;
    this.maxSamples = Math.floor(maxSeconds * this.engine.ctx.sampleRate);
    this.state = "armed";
  }

  stop() {
    if (this.state === "recording") {
      const total = Math.min(this.count, this.maxSamples);
      const out = new Float32Array(total);
      let o = 0;
      for (const c of this.chunks) {
        const n = Math.min(c.length, total - o);
        out.set(c.subarray(0, n), o);
        o += n;
        if (o >= total) break;
      }
      this.chunks = [];
      this.state = "monitor";
      if (this.onDone) this.onDone(out, this.engine.ctx.sampleRate, this.recPeak);
    } else if (this.state === "armed") {
      this.state = "monitor";
    }
  }

  close() {
    if (this.proc) { this.proc.onaudioprocess = null; this.proc.disconnect(); }
    if (this.src) this.src.disconnect();
    if (this.mute) this.mute.disconnect();
    if (this.stream) this.stream.getTracks().forEach(t => t.stop());
    this.stream = null; this.state = "off"; this.level = 0;
  }
};

/**
 * Mapa MIDI padrao do SP. A entrada MIDI e do host (core/js/midi.js); o SP so
 * registra este mapa nela (midi.addDefaults(d => defs.route(d))).
 * Notas 36-67 tocam os 32 sons direto (36 = A1 ... 43 = A8, 44 = B1 ...).
 * Assim o banco A de pads de um controlador (36-43) toca o banco A e o
 * banco B do controlador (44-51) toca o banco B.
 * CC 20-27 movem os sliders 1-8 no modo atual.
 * Depois que qualquer controle aprende uma mensagem, o mapa padrao desliga:
 * so vale o que foi aprendido, sem conflito.
 */
RJ.SpMidiDefaults = class {
  constructor() {
    this.onNote = null;
    this.onSlider = null;
    this.useDefaults = null;
    this.channel = 1;
    this.omni = true;
  }

  /** Devolve para onde a mensagem foi, ou null quando ela nao e do mapa (segue para "Not Mapped"). */
  route(d) {
    const st = d[0] & 0xf0;
    const isNote = st === 0x90 || st === 0x80, isCC = st === 0xb0;
    const n = d[1] - 36, i = d[1] - 20;
    const hit = (isNote && n >= 0 && n < 32) || (isCC && i >= 0 && i < 8);
    if (!hit) return null;
    if (this.useDefaults && !this.useDefaults()) return "Off: Has Learn";
    if (!this.omni && (d[0] & 0x0f) !== this.channel - 1) return "Other Channel";
    const snd = "ABCD"[n >> 3] + ((n & 7) + 1);
    if (st === 0x90 && d[2] > 0) {
      if (this.onNote) this.onNote(n, d[2] / 127, true);
      return "Def: Sound " + snd;
    }
    if (isNote) { if (this.onNote) this.onNote(n, 0, false); return "Def: " + snd + " Off"; }
    if (this.onSlider) this.onSlider(i, d[2] / 127);
    return "Def: Slider " + (i + 1);
  }
};
