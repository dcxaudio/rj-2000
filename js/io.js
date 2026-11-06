/* RJ-2000 - entradas: microfone (sampling) e MIDI */
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

  process(data) {
    let pk = 0;
    for (let i = 0; i < data.length; i++) { const a = Math.abs(data[i]); if (a > pk) pk = a; }
    this.level = Math.max(pk, this.level * 0.85);
    if (this.onLevel) this.onLevel(this.level, this.state);
    if (this.state === "armed" && pk >= this.threshold) {
      this.state = "recording";
      this.chunks = [];
      this.count = 0;
    }
    if (this.state === "recording") {
      this.chunks.push(new Float32Array(data));
      this.count += data.length;
      if (this.count >= this.maxSamples) this.stop();
    }
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
      if (this.onDone) this.onDone(out, this.engine.ctx.sampleRate);
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
 * MIDI (Chrome, Edge e Opera; Safari e Firefox tem suporte limitado).
 * Notas 36-67 tocam os 32 sons direto (36 = A1 ... 43 = A8, 44 = B1 ...).
 * Assim o banco A de pads de um controlador (36-43) toca o banco A e o
 * banco B do controlador (44-51) toca o banco B.
 * CC 20-27 movem os sliders 1-8 no modo atual.
 */
RJ.Midi = class {
  constructor() {
    this.access = null;
    this.onNote = null;
    this.onSlider = null;
    this.onChange = null;
    this.inputs = [];
  }

  get supported() { return !!navigator.requestMIDIAccess; }

  async enable() {
    if (!this.supported) throw new Error("MIDI nao suportado neste navegador");
    this.access = await navigator.requestMIDIAccess({ sysex: false });
    this.bind();
    this.access.onstatechange = () => { this.bind(); if (this.onChange) this.onChange(this.inputs); };
    return this.inputs;
  }

  bind() {
    this.inputs = [];
    this.access.inputs.forEach(inp => {
      inp.onmidimessage = (m) => this.handle(m.data);
      this.inputs.push(inp.name);
    });
  }

  handle(d) {
    const st = d[0] & 0xf0;
    if (st === 0x90 && d[2] > 0) {
      const n = d[1] - 36;
      if (n >= 0 && n < 32 && this.onNote) this.onNote(n, d[2] / 127, true);
    } else if (st === 0x80 || (st === 0x90 && d[2] === 0)) {
      const n = d[1] - 36;
      if (n >= 0 && n < 32 && this.onNote) this.onNote(n, 0, false);
    } else if (st === 0xb0) {
      const i = d[1] - 20;
      if (i >= 0 && i < 8 && this.onSlider) this.onSlider(i, d[2] / 127);
    }
  }
};
