/* RJ-2000 - interface
 *
 * Funciona como o SP-1200: quase tudo passa pelo LCD de 2 x 16.
 * - Os modulos SET-UP, DISK, SYNC e SAMPLE abrem uma pagina; o numero da
 *   funcao e digitado no teclado.
 * - Os botoes de PROGRAMMING tem duas funcoes: a de baixo no segment mode e
 *   a de cima no song mode (editando a song com RECORD/EDIT).
 * - No teclado numerico, 7 tambem e NO e 9 tambem e YES.
 */
window.RJ = window.RJ || {};

(function () {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const pad2 = n => String(Math.max(0, n | 0)).padStart(2, "0");
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const L = RJ.soundLabel;
  const VERSION = "b0.3";
  const fmtTempo = t => { const v = Math.round(t * 10) / 10; return String(Math.floor(v)).padStart(3, "0") + "." + Math.round((v % 1) * 10); };
  const BAR = k => String.fromCharCode(0x2581 + clamp(Math.round(k * 7), 0, 7));
  const fit = (s, n = 16) => (s + " ".repeat(n)).slice(0, n);

  const PROG_SEG = ["metronome", "swing", "copy", "timesig", "length", "erase", "autocorrect", "step"];
  const PROG_SONG = ["trigger", "repeat", "subsong", "end", "insert", "delete", "tempochange", "mixchange"];

  // nomes no LCD do MIDI Learn
  const ACT_NAMES = { setup: "Set-up", disk: "Disk", sample: "Sample", tempo: "Tempo", songseg: "Song/Segment", perfmode: "Tune/Mix/Multi", bank: "Bank" };
  const KEY_NAMES = { dec: "Key <", inc: "Key >", enter: "Enter", 7: "Key 7/No", 9: "Key 9/Yes" };
  const PROG_NAMES = ["Trigger/Metro", "Repeat/Swing", "Subsong/Copy", "End/Time Sig", "Insert/Length", "Delete/Erase", "TempoChg/AutoCor", "MixChg/StepProg"];

  class App {
    constructor() {
      this.p = RJ.createProject();
      this.engine = new RJ.Engine(this.p);
      this.seq = new RJ.Sequencer(this.p, this.engine);
      this.sampler = new RJ.Sampler(this.engine);
      this.midi = new RJ.Midi();
      this.learn = new RJ.MidiMap();
      this.engine.levelOf = s => this.levelOf(s);
      // o rack que fica embaixo: recebe as notas dos pads, como pelo MIDI
      this.s950 = new RJ.S950(this);

      this.bank = 0;
      this.perf = "mix";       // mix | tune | multi
      this.sel = 0;            // ultimo som tocado
      this.page = null;        // pagina aberta no LCD (null = tela principal)
      this.homeEntry = "";     // digitos do numero de segmento/song
      this.flashUntil = 0;
      this.tapHeld = false; this.tapUsed = false; this.taps = [];
      this.eraseHeld = false; this.eraseUsed = false;
      this.recHeld = false;
      this.heldPads = new Map();
      this.pos = null;
      this.sliderShowUntil = 0;
      this.on = false;
    }

    /* =========================================================== montagem */

    build() {
      const faders = $("#faders"), pads = $("#pads");
      for (let i = 0; i < 8; i++) {
        const fc = document.createElement("div");
        fc.className = "fcol";
        fc.innerHTML = `<div class="fader" id="fd-${i}" role="slider" tabindex="0" aria-label="Slider ${i + 1}" aria-valuemin="0" aria-valuemax="100"><div class="cap-f"></div></div><span class="cap">${i + 1}</span>`;
        faders.appendChild(fc);
        const pc = document.createElement("div");
        pc.className = "pcol";
        pc.innerHTML = `<button class="pad" data-pad="${i}" aria-label="Pad ${i + 1}"></button><span class="cap">${i + 1}</span>`;
        pads.appendChild(pc);
      }
      this.bindUI();
      this.bindKeyboard();
      this.s950.build();
      this.renderLEDs();
      this.lcd("", "");
    }

    async powerOn() {
      if (this.on) return;
      this.on = true;
      this.engine.ensure();
      $("#power").classList.add("off");
      this.s950.boot();             // o RJ-950 liga junto (mesma regua de tomadas)
      this.learn.load().then(() => { if (this.learn.enabled) this.enableMidi(); });
      const wait = ms => new Promise(r => setTimeout(r, ms));
      this.lcd(" RJ-2000  " + VERSION, " Insert Diskette");
      await wait(700);
      this.lcd(" RJ-2000  " + VERSION, "Loading Software");
      await wait(450);
      let restored = false;
      try {
        const saved = await RJ.store.get("autosave");
        if (saved) { this.useProject(RJ.deserialize(saved)); restored = true; }
      } catch (e) { console.warn("Autosave de outra versao, carregando o kit padrao", e); }
      this.lcd(" RJ-2000  " + VERSION, "Loading Sequences");
      await wait(350);
      this.lcd(" RJ-2000  " + VERSION, "Loading Sounds");
      if (!restored) {
        // como colocar o disquete: so os sons. Segmentos e songs comecam vazios.
        await RJ.loadDefaultKit(this.p, this.engine.ctx);
      }
      await wait(300);
      this.engine.applyVolumes();
      this.refreshAll();
      this.saveNow();
    }

    useProject(np) {
      if (this.seq.playing) this.seq.stop();
      Object.keys(this.p).forEach(k => delete this.p[k]);
      Object.assign(this.p, np);
      this.engine.invalidate();
      this.engine.applyVolumes();
      this.sel = 0; this.bank = 0; this.page = null;
      this.perf = this.p.multi ? "multi" : "mix";
      this.applyMidiChannel();
    }

    /* =========================================================== eventos */

    bindUI() {
      $("#power-btn").addEventListener("click", () => this.powerOn());
      const press = (el, down, up) => {
        el.addEventListener("pointerdown", e => {
          e.preventDefault();
          if (!this.on) return;
          try { el.setPointerCapture(e.pointerId); } catch (_) {}
          el.classList.add("down");
          down(e);
        });
        const end = () => { if (!el.classList.contains("down")) return; el.classList.remove("down"); if (up && this.on) up(); };
        el.addEventListener("pointerup", end);
        el.addEventListener("pointercancel", end);
        el.addEventListener("contextmenu", e => e.preventDefault());
      };

      // MIDI Learn: cada controle diz o que fazer quando chegar a mensagem que ele aprendeu
      const learn = (id, el, name, down, up, kind = "button") =>
        this.learn.add(id, el, name, kind, { down: v => { if (this.on) down(v); }, up: () => { if (this.on && up) up(); } });

      $$("[data-act]").forEach(b => {
        const a = b.dataset.act;
        press(b, () => this.action(a));
        if (ACT_NAMES[a]) learn("act:" + a, b, ACT_NAMES[a], () => this.action(a));
      });
      $$("[data-key]").forEach(b => {
        const k = b.dataset.key;
        press(b, () => this.key(k), () => this.keyUp(k));
        // pelo MIDI as setas andam um passo por toque: um botao que fica preso nao corre sozinho
        learn("key:" + k, b, KEY_NAMES[k] || "Key " + k, () => { this.key(k); if (k === "inc" || k === "dec") this.keyUp(); });
      });
      $$("[data-prog]").forEach(b => {
        const n = +b.dataset.prog;
        press(b, () => this.progDown(n), () => this.progUp(n));
        learn("prog:" + n, b, PROG_NAMES[n], () => this.progDown(n), () => this.progUp(n));
      });
      const recDown = () => { this.recHeld = true; this.recordEdit(); }, recUp = () => { this.recHeld = false; };
      press($("#btn-run"), () => this.runStop());
      press($("#btn-rec"), recDown, recUp);
      press($("#btn-tap"), () => this.tapDown(), () => this.tapUp());
      learn("run", $("#btn-run"), "Run/Stop", () => this.runStop());
      learn("rec", $("#btn-rec"), "Record/Edit", recDown, recUp);
      learn("tap", $("#btn-tap"), "Tap/Repeat", () => this.tapDown(), () => this.tapUp());

      $$(".pad[data-pad]").forEach(pad => {
        const i = +pad.dataset.pad;
        press(pad, e => {
          const vel = this.p.dynamic && e.pressure && e.pointerType !== "mouse" ? clamp(e.pressure * 1.4, 0.15, 1) : 1;
          this.padDown(i, vel);
        }, () => this.padUp(i));
        learn("pad:" + i, pad, "Pad " + (i + 1), vel => this.padDown(i, this.p.dynamic ? vel : 1), () => this.padUp(i), "pad");
        // arrastar um arquivo de audio para o pad = SAMPLE 8 naquele pad
        pad.addEventListener("dragenter", e => { e.preventDefault(); if (this.on) pad.classList.add("drop"); });
        pad.addEventListener("dragover", e => { e.preventDefault(); e.dataTransfer.dropEffect = this.on ? "copy" : "none"; });
        pad.addEventListener("dragleave", () => pad.classList.remove("drop"));
        pad.addEventListener("drop", e => {
          e.preventDefault();
          pad.classList.remove("drop");
          if (!this.on) return;
          this.loadAudioFiles(Array.from(e.dataTransfer.files || []), this.bank * 8 + i);
        });
      });
      // soltar fora de um pad nao deixa o navegador abrir o arquivo
      window.addEventListener("dragover", e => e.preventDefault());
      window.addEventListener("drop", e => e.preventDefault());

      for (let i = 0; i < 8; i++) this.bindFader(i);
      this.bindKnob($("#knob-mix"), () => this.p.masterVol, v => { this.p.masterVol = v; this.engine.applyVolumes(); this.dirty(); }, "knob:mix", "Mix Volume");
      this.bindKnob($("#knob-met"), () => this.p.metVol, v => { this.p.metVol = v; this.engine.applyVolumes(); this.dirty(); }, "knob:met", "Metronome Vol");
      this.bindKnob($("#knob-gain"), () => this.p.sample.fine, v => { this.p.sample.fine = v; this.applyGain(); this.dirty(); if (this.page && this.page.module === "sample") this.renderLCD(); }, "knob:gain", "Gain");

      // no MIDI Learn, tocar num controle escolhe o que ele vai aprender (a funcao nao roda).
      // Nos seletores (Song/Segment, modo de performance, bancos), as luzes e os nomes valem como o botao.
      const grab = e => {
        if (!this.learn.learning || !e.target.closest || !e.target.closest(".unit")) return;
        const box = e.target.closest(".selector");
        const el = e.target.closest("[data-learn]") || (box && box.querySelector("[data-learn]"));
        if (e.type === "wheel") { if (el) { e.preventDefault(); e.stopPropagation(); } return; }
        e.preventDefault();
        e.stopPropagation();
        if (e.type === "pointerdown" && el) this.learnTouch(el.dataset.learn);
      };
      ["pointerdown", "click", "dblclick"].forEach(ev => window.addEventListener(ev, grab, true));
      window.addEventListener("wheel", grab, { capture: true, passive: false });

      $("#file-pick").addEventListener("change", e => {
        const files = Array.from(e.target.files || []);
        e.target.value = "";
        if (files.length && this.onFiles) this.onFiles(files);
      });

      this.seq.on("transport", () => { if (!this.seq.playing) this.s950.stopAll(); this.renderLEDs(); this.renderLCD(); });
      this.seq.on("position", pos => { const was = this.pos && this.pos.count; this.pos = pos; if (was && !(pos && pos.count)) this.renderLEDs(); this.renderLCD(); });
      this.seq.on("change", () => this.dirty());
      this.seq.on("hit", (s, time, vel) => { this.onHit(s, time); this.s950.note(s, time, vel); });
      this.seq.on("message", (a, b) => this.flash(a, b));

      this.sampler.onLevel = () => { if (this.page && this.page.module === "sample") this.renderLCD(); };
      this.sampler.onDone = (raw, rate, peak) => this.sampleDone(raw, rate, peak);

      this.midi.onMessage = d => this.on && this.learn.handle(d);
      this.midi.onNote = (n, vel, on) => { if (on && this.on) this.hitSound(n, { vel: this.p.dynamic ? vel : 1 }); };
      this.midi.onSlider = (i, v) => { if (this.on) this.faderInput(i, v); };
      this.midi.onChange = ins => { this.midiStatus = ins.length ? fit(ins[0], 16) : "No MIDI Input"; this.renderLCD(); };
      this.learn.onChange = () => this.renderLCD();

      document.addEventListener("visibilitychange", () => { if (document.hidden) { this.saveNow(); this.s950.saveNow(); } });
    }

    bindFader(i) {
      const el = $(`#fd-${i}`);
      this.learn.add("fader:" + i, el, "Slider " + (i + 1), "value", {
        get: () => this.faderValue(i),
        set: v => { if (this.on) this.faderInput(i, v); },
      });
      const setFrom = e => {
        const r = el.getBoundingClientRect();
        const v = clamp(1 - (e.clientY - r.top - 11) / (r.height - 22), 0, 1);
        this.faderInput(i, v);
      };
      el.addEventListener("pointerdown", e => {
        e.preventDefault();
        if (!this.on) return;
        el.setPointerCapture(e.pointerId);
        el.dataset.drag = "1";
        setFrom(e);
      });
      el.addEventListener("pointermove", e => { if (el.dataset.drag) setFrom(e); });
      ["pointerup", "pointercancel"].forEach(ev => el.addEventListener(ev, () => { delete el.dataset.drag; }));
      el.addEventListener("keydown", e => {
        if (!this.on) return;
        const d = { ArrowUp: 0.02, ArrowDown: -0.02, PageUp: 0.1, PageDown: -0.1 }[e.key];
        if (d == null) return;
        e.preventDefault(); e.stopPropagation();
        this.faderInput(i, clamp(this.faderValue(i) + d, 0, 1));
      });
    }

    bindKnob(el, get, set, id, name) {
      const draw = () => { el.querySelector("i").style.transform = `rotate(${-135 + get() * 270}deg)`; };
      el.rjDraw = draw;
      if (id) this.learn.add(id, el, name, "value", { get, set: v => { if (this.on) { set(v); draw(); } } });
      let startY = 0, startV = 0;
      el.addEventListener("pointerdown", e => { e.preventDefault(); el.setPointerCapture(e.pointerId); startY = e.clientY; startV = get(); el.dataset.drag = "1"; });
      el.addEventListener("pointermove", e => { if (!el.dataset.drag) return; set(clamp(startV + (startY - e.clientY) / 160, 0, 1)); draw(); });
      ["pointerup", "pointercancel"].forEach(ev => el.addEventListener(ev, () => { delete el.dataset.drag; }));
      el.addEventListener("wheel", e => { e.preventDefault(); set(clamp(get() - Math.sign(e.deltaY) * 0.03, 0, 1)); draw(); }, { passive: false });
      el.addEventListener("keydown", e => {
        const d = { ArrowUp: 0.03, ArrowRight: 0.03, ArrowDown: -0.03, ArrowLeft: -0.03 }[e.key];
        if (d == null) return;
        e.preventDefault(); e.stopPropagation(); set(clamp(get() + d, 0, 1)); draw();
      });
      draw();
    }

    bindKeyboard() {
      const padKeys = ["KeyA", "KeyS", "KeyD", "KeyF", "KeyG", "KeyH", "KeyJ", "KeyK"];
      const bankKeys = ["KeyZ", "KeyX", "KeyC", "KeyV"];
      window.addEventListener("keydown", e => {
        if (e.metaKey || e.ctrlKey || e.altKey) return;
        if (!this.on) { if (e.code === "Space" || e.code === "Enter") { e.preventDefault(); this.powerOn(); } return; }
        // no MIDI Learn: Enter salva, Delete apaga o do controle escolhido, Esc sai
        if (this.learn.learning) {
          if (e.code === "Tab") return;
          e.preventDefault();
          if (e.repeat) return;
          if (e.code === "Enter" || e.code === "NumpadEnter") this.learnEnter();
          else if (e.code === "Escape") this.exitPage();
          else if ((e.code === "Backspace" || e.code === "Delete") && this.learn.sel) { const n = this.learn.clear(this.learn.sel); if (n) this.flash("Cleared", n, 1000); }
          return;
        }
        // depois de um clique no RJ-950, numeros, setas e Enter vao para ele
        if (this.s950.focused && this.s950.keyEvent(e)) { e.preventDefault(); return; }
        if (this.page && this.page.text && this.page.text(e)) { e.preventDefault(); return; }
        const pi = padKeys.indexOf(e.code);
        if (pi >= 0) { e.preventDefault(); if (!e.repeat) { this.padDown(pi, 1); this.padEl(pi).classList.add("down"); } return; }
        const bi = bankKeys.indexOf(e.code);
        if (bi >= 0) { e.preventDefault(); this.setBank(bi); return; }
        if (e.code === "ArrowLeft") { e.preventDefault(); this.key("dec"); return; }
        if (e.code === "ArrowRight") { e.preventDefault(); this.key("inc"); return; }
        if (e.repeat) return;
        if (e.code === "Space") { e.preventDefault(); this.runStop(); }
        else if (e.code === "KeyR") { this.recHeld = true; this.recordEdit(); }
        else if (e.code === "KeyT") this.tapDown();
        else if (e.code === "Enter" || e.code === "NumpadEnter") { e.preventDefault(); this.key("enter"); }
        else if (e.code === "Escape") this.exitPage();
        else if (e.code === "KeyY") this.key("9");
        else if (e.code === "KeyN") this.key("7");
        else if (/^[0-9]$/.test(e.key)) this.key(e.key);
      });
      window.addEventListener("keyup", e => {
        if (!this.on) return;
        const pi = padKeys.indexOf(e.code);
        if (pi >= 0) { this.padUp(pi); this.padEl(pi).classList.remove("down"); }
        if (e.code === "KeyT") this.tapUp();
        if (e.code === "KeyR") this.recHeld = false;
        if (e.code === "ArrowLeft" || e.code === "ArrowRight") this.keyUp();
      });
    }

    /* =========================================================== pads e sons */

    padEl(i) { return $(`.pad[data-pad="${i}"]`); }

    /** Som e opcoes que um pad toca (no multi mode, o mesmo som com afinacoes/volumes diferentes). */
    padSound(i) {
      const p = this.p;
      if (this.perf === "multi" && p.multi) {
        const src = p.multi.src, o = {};
        if (p.multi.type === "level") o.lvl = p.multiLevel[i];
        else if (p.sounds[src].mode === "decay") o.decay = Math.round((p.multiPitch[i] + RJ.TUNE_RANGE) / (2 * RJ.TUNE_RANGE) * 31);
        else o.tune = p.multiPitch[i];
        return { s: src, o };
      }
      return { s: this.bank * 8 + i, o: {} };
    }

    padDown(i, vel) {
      this.engine.ensure();
      const { s, o } = this.padSound(i);
      if (vel !== 1) o.vel = vel;
      // paginas que esperam um pad (selecionar som, step program...)
      if (this.page && this.page.pad && this.page.pad(this.bank * 8 + i, i, o) !== false) { this.renderLCD(); return; }
      this.heldPads.set(i, s);
      this.hitSound(s, o, true);
    }

    padUp(i) {
      const s = this.heldPads.get(i);
      this.heldPads.delete(i);
      if (s == null) return;
      this.seq.repeatPads.delete(s);
      this.seq.erasing.delete(s);
    }

    hitSound(s, o = {}, fromPad) {
      this.engine.ensure();
      if (this.eraseHeld) {
        this.eraseUsed = true;
        if (this.seq.playing) this.seq.erasing.add(s);
        return;
      }
      if (this.tapHeld && this.seq.playing) {
        this.tapUsed = true;
        if (fromPad) this.seq.repeatPads.set(s, o);
        this.sel = s;
        return;
      }
      this.sel = s;
      if (o.decay != null) { this.engine.trigger(s, o); this.seq.emit("hit", s, this.engine.ctx.currentTime, o.vel); }
      else this.seq.liveHit(s, o);
      if (this.page && this.page.module === "sample") this.renderLCD();
    }

    onHit(s, time) {
      if (Math.floor(s / 8) !== this.bank || this.perf === "multi") return;
      const el = this.padEl(s % 8);
      this.seq.later(time, () => { el.classList.add("hit"); setTimeout(() => el.classList.remove("hit"), 90); });
    }

    setBank(b) {
      this.bank = ((b % 4) + 4) % 4;
      this.renderFaders();
      this.renderLEDs();
      this.renderLCD();
    }

    levelOf(s) {
      const mix = this.seq.mixOverride || RJ.workMix(this.p);
      return Math.pow(mix[s] != null ? mix[s] : 0.8, 1.6);
    }

    /* =========================================================== sliders */

    faderInput(i, v) {
      if (this.page && this.page.slider && this.page.slider(i, v) !== false) { this.renderFader(i, v); this.renderLCD(); this.dirty(); return; }
      const p = this.p;
      const s = p.sounds[this.bank * 8 + i];
      if (this.perf === "mix") RJ.workMix(p)[this.bank * 8 + i] = v;
      else if (this.perf === "tune") {
        if (s.mode === "decay") s.decay = Math.round(v * 31);
        else s.tune = Math.round((v * 2 - 1) * RJ.TUNE_RANGE * 10) / 10;
      } else if (this.perf === "multi" && p.multi) {
        if (p.multi.type === "level") p.multiLevel[i] = Math.round(v * 31) / 31;
        else p.multiPitch[i] = Math.round((v * 2 - 1) * RJ.TUNE_RANGE * 10) / 10;
      }
      this.renderFader(i);
      this.sliderShowUntil = performance.now() + 1500;   // tocando, o grafico dos sliders aparece por um instante
      clearTimeout(this.sliderTimer);
      this.sliderTimer = setTimeout(() => this.renderLCD(), 1600);
      this.renderLCD();
      this.dirty();
    }

    faderValue(i) {
      const p = this.p, s = p.sounds[this.bank * 8 + i];
      if (this.page && this.page.sliderValue) { const v = this.page.sliderValue(i); if (v != null) return v; }
      if (this.perf === "mix") return RJ.workMix(p)[this.bank * 8 + i];
      if (this.perf === "tune") return s.mode === "decay" ? s.decay / 31 : (s.tune / RJ.TUNE_RANGE + 1) / 2;
      if (this.perf === "multi" && p.multi) return p.multi.type === "level" ? p.multiLevel[i] : (p.multiPitch[i] / RJ.TUNE_RANGE + 1) / 2;
      return 0;
    }

    renderFader(i, v) {
      const val = clamp(v != null ? v : this.faderValue(i), 0, 1);
      const el = $(`#fd-${i}`);
      el.style.setProperty("--v", val);
      el.setAttribute("aria-valuenow", Math.round(val * 100));
    }

    renderFaders() { for (let i = 0; i < 8; i++) this.renderFader(i); }

    barGraph() { let s = ""; for (let i = 0; i < 8; i++) s += BAR(this.faderValue(i)); return s; }

    /* =========================================================== botoes */

    blocked() {
      if (this.seq.playing) { this.engine.beep(); return true; }
      return false;
    }

    action(a) {
      switch (a) {
        case "setup": return this.togglePage("setup", () => this.setupPage());
        case "disk": if (this.blocked()) return; return this.togglePage("disk", () => this.diskPage());
        case "sample": if (this.blocked()) return; return this.togglePage("sample", () => this.samplePage());
        case "tempo": return this.togglePage("tempo", () => this.tempoPage());
        case "songseg": return this.toggleSongSeg();
        case "perfmode": return this.cyclePerf();
        case "bank": return this.setBank(this.bank + 1);
      }
    }

    togglePage(module, make) {
      if (this.page && this.page.module === module) { this.exitPage(); return; }
      this.exitPage(true);
      this.flashUntil = 0;
      this.page = make();
      this.page.module = module;
      if (this.page.enter) this.page.enter();
      this.renderAll();
    }

    openPage(pg, module) {
      this.exitPage(true);
      this.flashUntil = 0;   // uma pagina nova (pergunta) aparece na hora, por cima de qualquer aviso
      this.page = pg;
      pg.module = module || pg.module || "prog";
      if (pg.enter) pg.enter();
      this.renderAll();
    }

    exitPage(silent) {
      const pg = this.page;
      if (!pg) return;
      this.page = null;
      if (pg.exit) pg.exit();
      if (!silent) this.renderAll();
    }

    cyclePerf() {
      const order = this.p.multi ? ["mix", "tune", "multi"] : ["mix", "tune"];
      this.perf = order[(order.indexOf(this.perf) + 1) % order.length];
      this.renderAll();
    }

    toggleSongSeg() {
      if (this.blocked()) return;
      this.exitPage(true);
      this.p.mode = this.p.mode === "song" ? "segment" : "song";
      this.seq.recArmed = false;
      this.homeEntry = "";
      this.renderAll();
      this.dirty();
    }

    progDown(n) {
      if (this.p.mode === "song") {
        if (this.page && this.page.songEdit) { this.page.prog(PROG_SONG[n]); this.renderLCD(); }
        else this.flash("Song Mode:", "Press Record/Edit");
        return;
      }
      const fn = PROG_SEG[n];
      if (fn === "erase") { this.eraseHeld = true; this.eraseUsed = false; return; }
      if (this.page && this.page.fn === fn) { this.exitPage(); return; }
      if (this.seq.playing && fn !== "autocorrect") { this.engine.beep(); return; }
      const make = {
        metronome: () => this.listPage("metronome", "Metronome", RJ.METRONOME.map(m => m.label), () => this.p.metronome, v => { this.p.metronome = v; }),
        swing: () => this.listPage("swing", "Swing", RJ.SWING.map(v => v + "%"), () => RJ.SWING.indexOf(this.p.swing), v => { this.p.swing = RJ.SWING[v]; }),
        autocorrect: () => this.listPage("autocorrect", "Auto Correct", RJ.AUTO_CORRECT.map(a => a.label), () => this.p.ac, v => { this.p.ac = v; }),
        copy: () => this.copyPage(),
        timesig: () => this.timeSigPage(),
        length: () => this.lengthPage(),
        step: () => this.stepPage(),
      }[fn];
      if (make) this.openPage(make(), "prog");
    }

    progUp(n) {
      if (this.p.mode === "song" || PROG_SEG[n] !== "erase") return;
      this.eraseHeld = false;
      this.seq.erasing.clear();
      if (this.eraseUsed || this.seq.playing) return;
      if (this.page && this.page.fn === "erase") { this.exitPage(); return; }
      this.openPage(this.erasePage(), "prog");
    }

    /* ----- teclado */

    key(k) {
      this.engine.ensure();
      if (k === "inc" || k === "dec") this.startRepeat(k);
      if (this.page) {
        if (this.page.key && this.page.key(k) !== false) { this.renderLCD(); return; }
        if (k === "enter") { this.exitPage(); return; }
        return;
      }
      this.homeKey(k);
    }

    keyUp() { clearTimeout(this.repTimer); clearInterval(this.repInt); }

    /** Segurar as setas corre os valores. */
    startRepeat(k) {
      this.keyUp();
      this.repTimer = setTimeout(() => {
        this.repInt = setInterval(() => {
          if (this.page && this.page.key) { this.page.key(k, true); this.renderLCD(); }
          else this.homeKey(k);
        }, 60);
      }, 420);
    }

    homeKey(k) {
      const song = this.p.mode === "song";
      if (/^[0-9]$/.test(k)) {
        this.homeEntry += k;
        if (this.homeEntry.length >= 2) {
          const n = parseInt(this.homeEntry, 10);
          this.homeEntry = "";
          if (song) { if (this.seq.playing) { this.engine.beep(); } else this.p.curSong = n; }
          else this.selectSegment(n);
          this.renderFaders();
          this.dirty();
        }
        this.renderLCD();
        return;
      }
      if (k === "inc" || k === "dec") {
        const d = k === "inc" ? 1 : -1;
        this.homeEntry = "";
        if (song) { if (!this.seq.playing) this.p.curSong = clamp(this.p.curSong + d, 0, 99); }
        else this.selectSegment(clamp(this.p.curSeg + d, 0, 99));
        this.renderFaders();
        this.renderLCD();
        this.dirty();
      }
    }

    selectSegment(n) {
      this.p.curSeg = clamp(n, 0, 99);
      const seg = RJ.segment(this.p, this.p.curSeg);
      if (!seg.events.length && !this.seq.playing) seg.tempo = seg.tempo || this.p.defaultTempo;
    }

    /* ----- transporte */

    runStop() {
      this.engine.ensure();
      if (this.page && this.page.run && this.page.run() !== false) { this.renderAll(); return; }
      if (this.seq.playing) {
        this.seq.stop();
        this.seq.recArmed = false;
        this.renderAll();
        return;
      }
      if (this.page && this.page.songEdit) this.exitPage(true);
      if (this.recHeld && this.p.mode === "segment") { this.startRecording(); return; }
      if (this.p.mode === "segment" && !this.seq.recArmed && RJ.isEmptySeg(this.p, this.p.curSeg)) {
        this.engine.beep();
        this.flash("Segment " + pad2(this.p.curSeg), "Is Empty");
        return;
      }
      if (this.page && !this.page.keepOnRun) this.exitPage(true);
      this.seq.start();
      this.renderAll();
    }

    recordEdit() {
      if (this.p.mode === "song") {
        if (this.seq.playing) { this.engine.beep(); return; }
        if (this.page && this.page.songEdit) { this.exitPage(); return; }
        this.openPage(this.songEditPage(), "prog");
        return;
      }
      if (this.seq.playing) {
        if (this.seq.tick < 0 && this.seq.recArmed) { this.seq.stop(); this.seq.recArmed = false; this.renderAll(); return; } // cancela a contagem
        this.seq.recArmed = !this.seq.recArmed;   // tocando: punch in/out
        this.renderAll();
        return;
      }
      this.startRecording();
    }

    /**
     * Diferenca nossa em relacao ao SP-1200: com a maquina parada, o
     * Record/Edit volta para a tela principal, conta 1 compasso com o
     * metronomo e ja comeca a gravar (no original: segurar Record e apertar Run).
     */
    startRecording() {
      this.exitPage(true);
      this.homeEntry = "";
      this.seq.recArmed = true;
      const seg = RJ.segment(this.p, this.p.curSeg);
      this.pos = null;
      this.seq.start({ countIn: seg.num });
      this.renderAll();
    }

    tapDown() { this.tapHeld = true; this.tapUsed = false; }

    tapUp() {
      this.tapHeld = false;
      this.seq.repeatPads.clear();
      if (this.tapUsed) return;
      const now = performance.now();
      this.taps = this.taps.filter(t => now - t < 2500);
      this.taps.push(now);
      if (this.taps.length < 2) return;
      const iv = [];
      for (let i = 1; i < this.taps.length; i++) iv.push(this.taps[i] - this.taps[i - 1]);
      const avg = iv.slice(-4).reduce((a, b) => a + b, 0) / Math.min(4, iv.length);
      this.setTempo(60000 / avg);
      this.renderLCD();
    }

    get tempo() { return this.p.mode === "song" ? RJ.song(this.p, this.p.curSong).tempo : RJ.segment(this.p, this.p.curSeg).tempo; }

    setTempo(t) {
      t = Math.round(clamp(t, 40, 240) * 10) / 10;
      if (this.p.mode === "song") RJ.song(this.p, this.p.curSong).tempo = t;
      else { RJ.segment(this.p, this.p.curSeg).tempo = t; this.p.defaultTempo = t; }
      this.dirty();
    }

    /* =========================================================== paginas: utilitarios */

    /** Campo numerico de n digitos com cursor piscando. */
    numField(n) {
      return { n, buf: "", push(k) { this.buf += k; return this.buf.length >= this.n; }, clear() { this.buf = ""; },
        show(v) { return this.buf ? (this.buf + "_".repeat(this.n)).slice(0, this.n) : String(v).padStart(this.n, "0"); } };
    }

    listPage(fn, title, list, get, set) {
      const app = this;
      return {
        fn,
        render() { return [title, list[get()] || ""]; },
        key(k) {
          if (k === "inc" || k === "dec") { set(clamp(get() + (k === "inc" ? 1 : -1), 0, list.length - 1)); app.dirty(); return; }
          if (/^[1-9]$/.test(k) && +k <= list.length) { set(+k - 1); app.dirty(); return; }
          if (k === "0" && list.length >= 10) { set(9); app.dirty(); return; }
          return false;
        },
      };
    }

    /** Pede um pad e chama fn(soundIndex). */
    selectSound(title, fn, prompt = "Select Sound") {
      return { render: () => [title, prompt], pad: s => { fn(s); } };
    }

    confirmPage(l1, l2, onYes, onNo) {
      const app = this;
      return {
        render: () => [l1, l2 || "Yes/No?"],
        key(k) {
          if (k === "9") { app.exitPage(true); onYes(); app.renderAll(); return; }
          if (k === "7" || k === "enter") { app.exitPage(true); if (onNo) onNo(); app.renderAll(); return; }
          return true;
        },
      };
    }

    /* =========================================================== tempo */

    tempoPage() {
      const app = this, f = this.numField(4);
      return {
        cursor: () => [0, 9 + Math.min(f.buf.length, 3) + (f.buf.length >= 3 ? 1 : 0)],
        render() {
          const t = f.buf ? f.show(0).slice(0, 3) + "." + f.show(0)[3] : fmtTempo(app.tempo);
          return [(app.p.mode === "song" ? "Song " + pad2(app.p.curSong) + " " : "Seg " + pad2(app.p.curSeg) + "  ") + "♩=" + t, "Tempo"];
        },
        key(k, rep) {
          if (k === "inc" || k === "dec") { f.clear(); app.setTempo(app.tempo + (k === "inc" ? 1 : -1) * (rep ? 1 : 1)); return; }
          if (/^[0-9]$/.test(k)) { if (f.push(k)) { app.setTempo(parseInt(f.buf, 10) / 10); f.clear(); } return; }
          if (k === "enter") { f.clear(); app.exitPage(); return; }
        },
        slider(i, v) { if (i !== 0) return false; f.clear(); app.setTempo(40 + v * 200); },
        sliderValue(i) { return i === 0 ? (app.tempo - 40) / 200 : null; },
        keepOnRun: true, run: () => false,
      };
    }

    /* =========================================================== segment mode */

    copyPage() {
      const app = this, p = this.p;
      const src = this.numField(2), dst = this.numField(2), times = this.numField(2);
      let stage = "src", from = p.curSeg, to = null;
      return {
        fn: "copy",
        cursor: () => stage === "src" ? [0, 9 + src.buf.length] : stage === "dst" ? [1, 9 + dst.buf.length] : stage === "times" ? [1, 11 + times.buf.length] : null,
        render() {
          if (stage === "times") return ["Append Seg " + pad2(from), "Times x " + times.show(1) + "  Ent"];
          if (stage === "ready") return ["Copy Seg " + pad2(from), "To Seg " + pad2(to) + "  Enter"];
          return ["Copy Seg " + src.show(from), "  to Seg " + (stage === "dst" ? dst.show(0) : "__")];
        },
        key(k) {
          if (/^[0-9]$/.test(k)) {
            if (stage === "src" && src.push(k)) { from = parseInt(src.buf, 10); stage = "dst"; }
            else if (stage === "dst" && dst.push(k)) {
              to = parseInt(dst.buf, 10);
              if (RJ.isEmptySeg(p, from)) { app.flash("Seg " + pad2(from), "Is Empty"); stage = "src"; src.clear(); dst.clear(); return; }
              stage = to === from ? "times" : "ready";
            } else if (stage === "times") times.push(k);
            return;
          }
          if (k === "enter") {
            if (stage === "src") { stage = "dst"; return; }
            if (stage === "times") {
              const n = clamp(parseInt(times.buf || "1", 10), 1, 99);
              app.exitPage(true);
              if (app.seq.appendSegment(from, n)) app.flash("Seg " + pad2(from) + " Appended", "x" + n);
              else app.flash("Too Long", "Max 99 Bars");
              app.renderAll();
              return;
            }
            if (stage === "ready") {
              const go = () => { app.seq.copySegment(from, to); app.flash("Copied Seg " + pad2(from), "to Seg " + pad2(to)); };
              if (!RJ.isEmptySeg(p, to)) app.openPage(app.confirmPage("Seg " + pad2(to) + " Not Empty", "Replace? Yes/No", go), "prog");
              else { app.exitPage(true); go(); app.renderAll(); }
              return;
            }
          }
          return true;
        },
      };
    }

    timeSigPage() {
      const app = this, seg = RJ.segment(this.p, this.p.curSeg);
      const f = this.numField(2);
      let num = seg.num, den = seg.den, stage = "num";
      return {
        fn: "timesig",
        cursor: () => stage === "num" ? [0, 9 + f.buf.length] : [0, 12],
        render: () => ["Time Sig " + f.show(num) + "/" + pad2(den), "Seg " + pad2(app.p.curSeg) + "     Enter"],
        key(k) {
          if (/^[0-9]$/.test(k) && stage === "num") { if (f.push(k)) { num = clamp(parseInt(f.buf, 10), 1, 99); f.clear(); stage = "den"; } return; }
          if ((k === "inc" || k === "dec") && stage === "den") { const i = RJ.DENOMS.indexOf(den); den = RJ.DENOMS[clamp(i + (k === "inc" ? 1 : -1), 0, 3)]; return; }
          if ((k === "inc" || k === "dec") && stage === "num") { num = clamp(num + (k === "inc" ? 1 : -1), 1, 99); return; }
          if (k === "enter") {
            if (stage === "num") { if (f.buf) num = clamp(parseInt(f.buf, 10) || 1, 1, 99); f.clear(); stage = "den"; return; }
            seg.num = num; seg.den = den; seg.ver++;
            app.exitPage(true); app.flash("Time Signature", pad2(num) + "/" + pad2(den)); app.renderAll(); app.dirty();
            return;
          }
          return true;
        },
      };
    }

    lengthPage() {
      const app = this, p = this.p, seg = RJ.segment(p, p.curSeg);
      const fb = this.numField(2), fbt = this.numField(2);
      let bars = seg.bars, beats = seg.beats, stage = "bars", sizing = false;
      return {
        fn: "length", keepOnRun: true,
        cursor: () => sizing ? null : stage === "bars" ? [1, fb.buf.length] : [1, 8 + fbt.buf.length],
        render() {
          if (sizing) {
            const b = app.pos ? app.pos.beats + 1 : 0;
            return ["Length Seg " + pad2(p.curSeg), "Beats " + String(b).padStart(3, "0") + "  Stop"];
          }
          const plus = (bars * seg.num + beats) % seg.num ? "+" : "";
          return ["Length Seg " + pad2(p.curSeg) + plus, fb.show(bars) + " Bars " + fbt.show(beats) + " Beats"];
        },
        key(k) {
          if (sizing) return true;
          if (/^[0-9]$/.test(k)) {
            if (stage === "bars" && fb.push(k)) { bars = parseInt(fb.buf, 10); fb.clear(); stage = "beats"; }
            else if (stage === "beats" && fbt.push(k)) { beats = parseInt(fbt.buf, 10); fbt.clear(); stage = "bars"; }
            return;
          }
          if (k === "inc" || k === "dec") { const d = k === "inc" ? 1 : -1; if (stage === "bars") bars = clamp(bars + d, 0, 99); else beats = clamp(beats + d, 0, 99); return; }
          if (k === "enter") {
            if ((bars * seg.num + beats) < 1) { app.engine.beep(); return; }
            if (bars > 99) bars = 99;
            const oldLen = RJ.segTicks(seg);
            const newLen = (bars * seg.num + beats) * RJ.beatTicks(seg);
            const apply = () => { app.seq.setLength(p.curSeg, bars, beats); app.flash("Seg " + pad2(p.curSeg) + " Length", pad2(bars) + " Bars " + pad2(beats) + " Beats"); };
            if (!seg.events.length) { app.exitPage(true); apply(); app.renderAll(); return; }
            if (newLen < oldLen) { app.openPage(app.confirmPage("Truncate Length?", "Yes/No", apply), "prog"); return; }
            if (newLen > oldLen) { app.exitPage(true); app.flash("Use Copy to", "Lengthen Segment"); app.renderAll(); return; }
            app.exitPage();
            return;
          }
          return true;
        },
        // RUN/STOP nesta pagina: dimensionar em tempo real (segmento vazio)
        run() {
          if (!sizing) {
            if (seg.events.length) { app.flash("Segment Not Empty", ""); return; }
            sizing = app.seq.start({ sizing: true });
            return;
          }
          const ticks = app.seq.stop();
          sizing = false;
          const total = Math.max(1, Math.round(ticks / RJ.beatTicks(seg)));
          bars = Math.min(99, Math.floor(total / seg.num)); beats = total % seg.num;
          app.seq.setLength(p.curSeg, bars, beats);
          app.flash("Seg " + pad2(p.curSeg) + " Length", pad2(bars) + " Bars " + pad2(beats) + " Beats");
          app.exitPage(true);
        },
        exit() { if (sizing) app.seq.stop(); },
      };
    }

    erasePage() {
      const app = this, p = this.p, f = this.numField(2);
      return {
        fn: "erase",
        cursor: () => [1, 4 + f.buf.length],
        render: () => ["Erase: Press Pad", "Seg " + f.show(p.curSeg) + " or Sound"],
        key(k) {
          if (/^[0-9]$/.test(k)) {
            if (f.push(k)) {
              const n = parseInt(f.buf, 10);
              f.clear();
              app.openPage(app.confirmPage("Erase Seg " + pad2(n) + "?", "Yes/No", () => { app.seq.clearSegment(n); app.flash("Seg " + pad2(n), "Erased"); }), "prog");
            }
            return;
          }
          return true;
        },
        pad(s) {
          const { s: snd } = app.padSound(s % 8);
          app.openPage(app.confirmPage("Erase " + L(snd) + " in " + pad2(p.curSeg) + "?", "Yes/No", () => {
            const n = app.seq.eraseSound(p.curSeg, snd);
            app.flash(L(snd) + " Erased", n + " Notes");
          }), "prog");
        },
      };
    }

    stepPage() {
      const app = this, p = this.p, seg = RJ.segment(p, p.curSeg);
      let tick = 0, autoTimer = null;
      const step = () => RJ.AUTO_CORRECT[p.ac].ticks;
      const at = () => seg.events.filter(e => e.t >= tick && e.t < tick + step());
      const audition = () => at().forEach(e => app.engine.trigger(e.s, { level: e.lvl, tune: e.tune, velocity: e.vel }));
      const move = d => { const len = RJ.segTicks(seg); tick = ((tick + d * step()) % len + len) % len; tick -= tick % step(); audition(); };
      return {
        fn: "step", keepOnRun: true,
        render() {
          const bt = RJ.beatTicks(seg);
          const bar = Math.floor(tick / RJ.barTicks(seg)) + 1;
          const beat = Math.floor((tick % RJ.barTicks(seg)) / bt) + 1;
          const sub = tick % bt;
          const evs = at();
          const names = evs.slice(0, 4).map(e => L(e.s)).join(" ") + (evs.length > 4 ? "+" : "");
          return [pad2(bar) + "." + beat + "." + pad2(sub) + "  " + RJ.AUTO_CORRECT[p.ac].label, names || "-- Empty --"];
        },
        key(k) {
          if (k === "inc" || k === "dec") { move(k === "inc" ? 1 : -1); return; }
          if (k === "enter") { app.exitPage(); return; }
          return true;
        },
        pad(s, i, o) {
          const { s: snd, o: po } = app.padSound(i);
          if (app.eraseHeld) {
            app.eraseUsed = true;
            const before = seg.events.length;
            seg.events = seg.events.filter(e => !(e.s === snd && e.t >= tick && e.t < tick + step()));
            if (seg.events.length !== before) { seg.ver++; app.dirty(); }
            return;
          }
          app.engine.trigger(snd, Object.assign({}, po, o));
          app.seq.insertEvent(p.curSeg, tick, snd, Object.assign({}, po, o));
          app.sel = snd;
        },
        // segurar RUN/STOP avanca sozinho
        run() {
          if (autoTimer) return;
          move(1);
          const btn = $("#btn-run");
          const loop = () => { move(1); app.renderLCD(); };
          autoTimer = setInterval(loop, Math.max(60, 60000 / seg.tempo / (RJ.PPQ / step())));
          const stop = () => { clearInterval(autoTimer); autoTimer = null; btn.removeEventListener("pointerup", stop); window.removeEventListener("keyup", stop); };
          btn.addEventListener("pointerup", stop);
          window.addEventListener("keyup", stop);
        },
        exit() { clearInterval(autoTimer); autoTimer = null; },
      };
    }

    /* =========================================================== song mode: edicao */

    songEditPage() {
      const app = this, p = this.p, song = RJ.song(p, p.curSong);
      const f = this.numField(2);
      let cur = 0, pending = null; // pending: "end" | "repeatEnd" | "tempo1" | "tempo2" | "mix" | "sub"
      let tdir = 1, tbpm = 0;
      const steps = () => song.steps;
      const desc = st => {
        if (!st) return "End of Song";
        switch (st.type) {
          case "seg": return "Segment " + pad2(st.seg) + (RJ.isEmptySeg(p, st.seg) ? " (E)" : "");
          case "repStart": return "|- Repeat Start";
          case "repEnd": return "-| Repeat x" + pad2(st.count);
          case "tempo": return "Tempo " + (st.dir > 0 ? "+" : "-") + pad2(st.bpm) + "/" + pad2(st.beats);
          case "mix": return "Mix Change " + (st.mix + 1);
          case "sub": return "Subsong " + pad2(st.song);
          case "trigger": return "Trigger";
          case "end": return st.kind === "repeat" ? "End: Repeat" : st.kind === "link" ? "End: Link " + pad2(st.song) : "End: Stop";
        }
        return "?";
      };
      const insert = st => { steps().splice(cur, 0, st); cur++; app.dirty(); };
      const openRepeat = () => {
        let depth = 0;
        for (let i = 0; i < cur; i++) { const t = steps()[i].type; if (t === "repStart") depth++; if (t === "repEnd") depth--; }
        return depth > 0;
      };
      return {
        songEdit: true,
        cursor: () => pending ? [1, { tempo2: 10 + f.buf.length, repeatEnd: 11 + f.buf.length, mix: 11, sub: 8 + f.buf.length, end: 14 + f.buf.length }[pending] || null] : (f.buf ? [1, 8 + f.buf.length] : null),
        render() {
          const l1 = "Song " + pad2(p.curSong) + " Step " + pad2(cur + 1);
          if (pending === "end") return [l1, "End:End/Rpt/" + (f.buf ? f.show(0) : "##")];
          if (pending === "repeatEnd") return [l1, "-| Repeat x" + f.show(2)];
          if (pending === "tempo1") return [l1, "1=Accel 2=Rit"];
          if (pending === "tempo2") return [l1, "Tempo " + (tdir > 0 ? "+" : "-") + (f.buf.length < 2 ? f.show(0) + "/00" : pad2(tbpm) + "/" + (f.buf.slice(2) + "__").slice(0, 2))];
          if (pending === "mix") return [l1, "Mix Change # _"];
          if (pending === "sub") return [l1, "Subsong " + f.show(0)];
          if (f.buf) return [l1, "Segment " + f.show(0)];
          return [l1, desc(steps()[cur])];
        },
        key(k) {
          const isNum = /^[0-9]$/.test(k);
          if (pending === "end") {
            if (isNum && f.push(k)) { const n = parseInt(f.buf, 10); f.clear(); pending = null; this.setEnd({ type: "end", kind: "link", song: n }); }
            return;
          }
          if (pending === "repeatEnd") {
            if (isNum && f.push(k)) { insert({ type: "repEnd", count: clamp(parseInt(f.buf, 10), 1, 99) }); f.clear(); pending = null; }
            else if (k === "enter") { insert({ type: "repEnd", count: 2 }); f.clear(); pending = null; }
            return;
          }
          if (pending === "tempo1") { if (k === "1" || k === "2") { tdir = k === "1" ? 1 : -1; pending = "tempo2"; f.n = 4; f.clear(); } return; }
          if (pending === "tempo2") {
            if (isNum) {
              const done = f.push(k);
              if (f.buf.length === 2) tbpm = parseInt(f.buf, 10);
              if (done) { insert({ type: "tempo", dir: tdir, bpm: tbpm, beats: clamp(parseInt(f.buf.slice(2), 10), 1, 32) }); f.n = 2; f.clear(); pending = null; }
            }
            return;
          }
          if (pending === "mix") { if (/^[1-8]$/.test(k)) { insert({ type: "mix", mix: +k - 1 }); pending = null; } return; }
          if (pending === "sub") { if (isNum && f.push(k)) { insert({ type: "sub", song: parseInt(f.buf, 10) }); f.clear(); pending = null; } return; }
          if (isNum) {
            if (f.push(k)) {
              const n = parseInt(f.buf, 10);
              f.clear();
              const st = steps()[cur];
              if (st && st.type === "seg") st.seg = n; else if (!st) steps().push({ type: "seg", seg: n }); else steps().splice(cur, 0, { type: "seg", seg: n });
              cur++;
              app.dirty();
            }
            return;
          }
          if (k === "inc" || k === "enter") { f.clear(); cur = Math.min(steps().length, cur + 1); return; }
          if (k === "dec") { f.clear(); cur = Math.max(0, cur - 1); return; }
          return true;
        },
        prog(fn) {
          f.clear();
          if (pending === "end" && fn === "end") { pending = null; this.setEnd({ type: "end", kind: "stop" }); return; }
          if (pending === "end" && fn === "repeat") { pending = null; this.setEnd({ type: "end", kind: "repeat" }); return; }
          pending = null;
          switch (fn) {
            case "insert": steps().splice(cur, 0, { type: "seg", seg: (steps()[cur - 1] && steps()[cur - 1].seg) || 0 }); app.dirty(); break;
            case "delete": if (steps()[cur]) { steps().splice(cur, 1); app.dirty(); } break;
            case "repeat": if (openRepeat()) { pending = "repeatEnd"; f.n = 2; } else insert({ type: "repStart" }); break;
            case "end": pending = "end"; f.n = 2; break;
            case "tempochange": pending = "tempo1"; break;
            case "mixchange": pending = "mix"; break;
            case "subsong": pending = "sub"; f.n = 2; break;
            case "trigger": insert({ type: "trigger" }); break;
          }
        },
        setEnd(st) {
          const after = steps().length - cur;
          const doIt = () => { song.steps = steps().slice(0, cur); song.steps.push(st); app.dirty(); };
          if (after > 0 && !(after === 1 && steps()[cur].type === "end")) {
            const back = app.page;
            app.page = app.confirmPage("End Here?", "Yes/No", () => { doIt(); app.page = back; }, () => { app.page = back; });
            app.page.module = "prog";
            app.page.exit = null;
            const origKey = app.page.key;
            app.page.key = k => { const r = origKey(k); if (app.page === null) { app.page = back; } return r; };
            return;
          }
          doIt();
          cur = Math.min(steps().length, cur + 1);
        },
      };
    }

    /* =========================================================== SET-UP */

    setupPage() {
      const app = this, p = this.p, f = this.numField(2);
      const sub = n => {
        const back = () => app.openPage(app.setupPage(), "setup");
        switch (n) {
          case 11: case 12:
            return app.selectSound(n === 11 ? "Multi Pitch" : "Multi Level", s => {
              p.multi = { type: n === 11 ? "pitch" : "level", src: s };
              app.perf = "multi";
              app.exitPage(true);
              app.flash(n === 11 ? "Multi Pitch" : "Multi Level", L(s) + " " + p.sounds[s].name);
              app.renderAll(); app.dirty();
            });
          case 13:
            if (!p.multi) { app.flash("Not In", "Multi Mode"); return null; }
            return app.confirmPage("Exit Multi Mode?", "Yes/No", () => { p.multi = null; if (app.perf === "multi") app.perf = "mix"; app.dirty(); });
          case 14: return app.confirmPage("Dynamic Buttons?", "Yes/No (" + (p.dynamic ? "Yes" : "No") + ")", () => { p.dynamic = true; app.dirty(); }, () => { p.dynamic = false; app.dirty(); });
          case 15: case 16: return {
            render: () => [n === 15 ? "Define Mix" : "Select Mix", "Mix # _ (1-8)"], cursor: () => [1, 6],
            key(k) {
              if (!/^[1-8]$/.test(k)) return true;
              const i = +k - 1, mix = RJ.workMix(p);
              if (n === 15) { p.mixes[i] = mix.slice(); app.flash("Mix " + k, "Defined"); }
              else if (p.mixes[i]) { p.mixes[i].forEach((v, j) => { mix[j] = v; }); app.flash("Mix " + k, "Selected"); }
              else app.flash("Mix " + k, "Is Empty");
              app.exitPage(true); app.renderAll(); app.dirty();
            },
          };
          case 17: {
            let s = null;
            return {
              render: () => s == null ? ["Channel Assign", "Select Sound"] : ["Channel Assign", L(s) + "  Channel " + (p.sounds[s].channel + 1)],
              pad: x => { s = x; },
              key(k) { if (s != null && /^[1-8]$/.test(k)) { p.sounds[s].channel = +k - 1; app.dirty(); return; } return k === "enter" ? false : true; },
            };
          }
          case 18: {
            let s = null;
            return {
              render: () => s == null ? ["Decay/Tune Select", "Select Sound"] : [L(s) + " " + (p.sounds[s].mode === "tune" ? "Tune" : "Decay"), "1=Tune  2=Decay"],
              pad: x => { s = x; app.engine.trigger(x); },
              key(k) { if (s != null && (k === "1" || k === "2")) { p.sounds[s].mode = k === "1" ? "tune" : "decay"; app.renderFaders(); app.dirty(); return; } return k === "enter" ? false : true; },
            };
          }
          case 19: return app.selectSound("Loop/Truncate", s => {
            if (!p.sounds[s].pcm) { app.flash(L(s), "Is Empty"); return; }
            app.openPage(app.truncPage(s), "setup");
          });
          case 20: return app.selectSound("Delete Sound", s => {
            app.openPage(app.confirmPage("Delete " + L(s) + "?", "Yes/No", () => { RJ.clearSound(p, s); app.engine.invalidate(); app.flash(L(s), "Deleted"); app.dirty(); }), "setup");
          });
          case 22: return app.learnPage();
          case 23: return app.specialPage();
        }
        app.flash("Set-up " + n, "Invalid");
        return null;
      };
      return {
        cursor: () => [1, 7 + f.buf.length],
        render: () => ["Set-up", "Select " + (f.buf ? f.show(0) : "__")],
        key(k) {
          if (/^[0-9]$/.test(k)) {
            if (f.push(k)) {
              const n = parseInt(f.buf, 10);
              f.clear();
              if (app.seq.playing && n !== 11 && n !== 12 && n !== 13) { app.engine.beep(); return; }
              const pg = sub(n);
              if (pg) app.openPage(pg, "setup");
            }
            return;
          }
          if (k === "enter") return false;
          return true;
        },
      };
    }

    truncPage(s) {
      const app = this, snd = this.p.sounds[s];
      const len = snd.pcm.length;
      const st = { s: [snd.start / len, 0.5], e: [snd.end / len, 0.5], l: [snd.loop == null ? 0 : snd.loop / len, 0.5] };
      const val = ([c, f]) => clamp(Math.round(c * len + (f - 0.5) * len / 32), 0, len);
      const apply = () => {
        let a = val(st.s), b = val(st.e);
        if (b <= a + 1) b = Math.min(len, a + 2);
        snd.start = a; snd.end = b;
        snd.loop = st.l[0] < 0.01 && st.l[1] <= 0.5 ? null : clamp(val(st.l), a, b - 1);
        snd.ver++;
      };
      return {
        render: () => ["S=" + String(snd.start).padStart(5, "0") + " E=" + String(snd.end).padStart(5, "0"), "L=" + (snd.loop == null ? "-----" : String(snd.loop).padStart(5, "0")) + "  " + L(s) + " Ent"],
        slider(i, v) {
          if (i > 5) return true;
          const k = ["s", "s", "e", "e", "l", "l"][i];
          st[k][i % 2] = v;
          apply();
          app.dirty();
        },
        sliderValue: i => i > 5 ? null : st[["s", "s", "e", "e", "l", "l"][i]][i % 2],
        pad: () => { app.engine.trigger(s); },
        key(k) {
          if (k === "enter") {
            app.openPage(app.confirmPage("Make Truncation", "Permanent? Y/N", () => { RJ.makeTruncPermanent(snd); app.engine.invalidate(); app.flash(L(s) + " " + RJ.soundSeconds(snd).toFixed(2) + " Sec", "Memory Freed"); app.dirty(); }), "setup");
            return;
          }
          return true;
        },
        exit() { app.renderFaders(); },
      };
    }

    specialPage() {
      const app = this, p = this.p;
      const totalNotes = () => p.segments.reduce((a, s) => a + (s ? s.events.length : 0), 0);
      const items = [
        { n: "Clear All Memory", go: () => app.openPage(app.confirmPage("Clear All Memory?", "Yes/No", () => { app.useProject(RJ.createProject()); app.flash("Memory", "Cleared"); app.dirty(); }), "setup") },
        { n: "Memory Remaining", go: () => {
          const snd = RJ.BANKS.reduce((a, b, i) => a + RJ.bankFree(p, i), 0);
          app.flash("Sq " + Math.max(0, Math.round(100 - totalNotes() / 50)) + "%  Sn " + snd.toFixed(1) + "s",
            RJ.BANKS.map((b, i) => b + RJ.bankFree(p, i).toFixed(1)).join(" ").replace(/0\./g, "."), 3500);
        } },
        { n: "Clear Sound Mem", go: () => app.openPage(app.confirmPage("Clear Sounds?", "Yes/No", () => { for (let i = 0; i < 32; i++) RJ.clearSound(p, i); app.engine.invalidate(); app.dirty(); }), "setup") },
        { n: "Clear Seq Mem", go: () => app.openPage(app.confirmPage("Clear Sequences?", "Yes/No", () => { p.segments.fill(null); p.songs.fill(null); app.dirty(); }), "setup") },
        { n: "Copy Sound", go: () => app.openPage(app.twoPads("Copy Sound", (a, b) => {
          const src = p.sounds[a];
          if (!src.pcm) { app.flash(L(a), "Is Empty"); return; }
          if (Math.floor(a / 8) !== Math.floor(b / 8) && RJ.soundSeconds(src) > RJ.bankFree(p, Math.floor(b / 8), b)) { app.flash("Not Enough", "Memory"); return; }
          const c = Object.assign(RJ.newSound(b), src, { id: b, pcm: src.pcm.slice(), ver: p.sounds[b].ver + 1, channel: p.sounds[b].channel });
          p.sounds[b] = c; app.flash("Copied " + L(a), "to " + L(b)); app.dirty();
        }), "setup") },
        { n: "Swap Sounds", go: () => app.openPage(app.twoPads("Swap Sounds", (a, b) => {
          const A = p.sounds[a], B = p.sounds[b];
          const ba = Math.floor(a / 8), bb = Math.floor(b / 8);
          if (ba !== bb && (RJ.bankUsage(p, ba) - RJ.soundSeconds(A) + RJ.soundSeconds(B) > RJ.bankSeconds(p) || RJ.bankUsage(p, bb) - RJ.soundSeconds(B) + RJ.soundSeconds(A) > RJ.bankSeconds(p))) { app.flash("Not Enough", "Memory"); return; }
          p.sounds[a] = Object.assign(B, { id: a, ver: B.ver + 1 });
          p.sounds[b] = Object.assign(A, { id: b, ver: A.ver + 1 });
          app.engine.invalidate(); app.flash("Swapped " + L(a), "and " + L(b)); app.dirty();
        }), "setup") },
        { n: "Default Decay", go: () => app.openPage(app.defaultDecayPage(), "setup") },
        { n: "Name Sound", go: () => app.openPage(app.selectSound("Name Sound", s => app.openPage(app.namePage(s), "setup")), "setup") },
        { n: "Sample Time", go: () => app.openPage(app.sampleTimePage(), "setup") },
        { n: "MIDI Channel", go: () => app.openPage(app.midiChannelPage(), "setup") },
        { n: "Clear MIDI Learn", go: () => app.openPage(app.confirmPage("Clear MIDI Learn?", "Yes/No", () => { app.learn.clearAll(); app.flash("MIDI Learn", "Cleared"); }), "setup") },
      ];
      let i = 0;
      return {
        render: () => ["Special " + (i + 1) + "/" + items.length, items[i].n],
        key(k) {
          if (k === "inc" || k === "dec") { i = clamp(i + (k === "inc" ? 1 : -1), 0, items.length - 1); return; }
          if (k === "enter") { items[i].go(); return; }
          return true;
        },
        slider(n, v) { if (n !== 0) return false; i = clamp(Math.floor(v * items.length), 0, items.length - 1); },
        sliderValue: n => n === 0 ? (i + 0.5) / items.length : null,
      };
    }

    /** 10 s como no SP-1200, ou 20 s como na reedicao da Rossum (o motor original ja suportava). */
    sampleTimePage() {
      const app = this, p = this.p;
      return {
        render: () => ["Sample Time " + (p.memory === 20 ? "20s" : "10s"), "1=10s 2=20s Bank"],
        key(k) {
          if (k === "2") { if (p.memory !== 20 && p.sample.length >= 2.5) p.sample.length = 5; p.memory = 20; app.exitPage(true); app.flash("Sample Time 20s", "5.0s Per Bank"); app.renderAll(); app.dirty(); return; }
          if (k === "1") {
            const full = RJ.BANKS.find((b, i) => RJ.bankUsage(p, i) > 2.5 + 1e-6);
            if (full) { app.engine.beep(); app.flash("Bank " + full + " Over 2.5s", "Truncate/Delete"); return; }
            p.memory = 10; p.sample.length = Math.min(p.sample.length, 2.5);
            app.exitPage(true); app.flash("Sample Time 10s", "2.5s Per Bank"); app.renderAll(); app.dirty(); return;
          }
          return k === "enter" ? false : true;
        },
      };
    }

    twoPads(title, fn) {
      let a = null;
      return {
        render: () => [title, a == null ? "From: Press Pad" : "From " + L(a) + " To: Pad"],
        pad: s => { if (a == null) { a = s; return; } this.exitPage(true); fn(a, s); this.renderAll(); },
      };
    }

    defaultDecayPage() {
      const app = this, p = this.p;
      let d = 31;
      return {
        render: () => ["Default Decay", "Decay " + pad2(d) + "  Enter"],
        slider(i, v) { if (i !== 0) return false; d = Math.round(v * 31); },
        sliderValue: i => i === 0 ? d / 31 : null,
        key(k) {
          if (k === "inc" || k === "dec") { d = clamp(d + (k === "inc" ? 1 : -1), 0, 31); return; }
          if (k === "enter") { p.sounds.forEach(s => { s.decay = d; }); app.exitPage(true); app.flash("All Sounds", "Decay " + pad2(d)); app.renderAll(); app.dirty(); return; }
          return true;
        },
      };
    }

    namePage(s) {
      const app = this, snd = this.p.sounds[s];
      const chars = " ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-#";
      let name = fit(snd.name || "", 12).toUpperCase().split(""), pos = 0;
      const save = () => { snd.name = name.join("").trim(); app.dirty(); };
      return {
        cursor: () => [1, pos],
        render: () => ["Name " + L(s), name.join("") + " Ent"],
        slider(i, v) { if (i !== 0) return false; name[pos] = chars[clamp(Math.floor(v * chars.length), 0, chars.length - 1)]; save(); },
        sliderValue: i => i === 0 ? (Math.max(0, chars.indexOf(name[pos])) + 0.5) / chars.length : null,
        key(k) {
          if (k === "inc") { pos = Math.min(11, pos + 1); app.renderFaders(); return; }
          if (k === "dec") { pos = Math.max(0, pos - 1); app.renderFaders(); return; }
          if (k === "enter") { save(); app.exitPage(); return; }
          return true;
        },
        // o teclado do computador tambem escreve o nome
        text(e) {
          if (e.key.length === 1 && /[a-z0-9 #-]/i.test(e.key)) { name[pos] = e.key.toUpperCase(); pos = Math.min(11, pos + 1); save(); app.renderLCD(); return true; }
          if (e.key === "Backspace") { pos = Math.max(0, pos - 1); name[pos] = " "; save(); app.renderLCD(); return true; }
          return false;
        },
      };
    }

    /* =========================================================== DISK
     * No navegador o "disquete" e um arquivo no computador. */

    diskPage() {
      const app = this, p = this.p;
      const sub = n => {
        switch (n) {
          case 1: app.download(RJ.serializeSeq(p), "rj2000-sequencias.rjseq.json"); app.flash("Saving Sequences", "Done"); return null;
          case 2: app.download(RJ.serializeSnd(p), "rj2000-sons.rjsnd.json"); app.flash("Saving Sounds", "Done"); return null;
          case 3: app.pickFiles(".json", false, fs => app.loadFiles(fs, "seq")); app.flash("Load Sequences", "Choose File"); return null;
          case 4: {
            const g = app.numField(2);
            return {
              render: () => ["Load Segment #", "Segment " + g.show(0)], cursor: () => [1, 8 + g.buf.length],
              key(k) {
                if (/^[0-9]$/.test(k) && g.push(k)) {
                  const n = parseInt(g.buf, 10);
                  app.exitPage(true);
                  app.pickFiles(".json", false, fs => app.loadFiles(fs, "seg", n));
                  app.flash("Load Segment " + pad2(n), "Choose File");
                }
                return true;
              },
            };
          }
          case 5: app.pickFiles(".json", false, fs => app.loadFiles(fs, "snd")); app.flash("Load Sounds", "Choose File"); return null;
          case 6: return app.selectSound("Load Sound #", s => {
            app.exitPage(true);
            app.pickFiles("audio/*,.wav,.aif,.aiff,.mp3,.ogg,.flac,.m4a,.json", false, fs => {
              if (fs.length === 1 && /\.json$/i.test(fs[0].name)) app.loadFiles(fs, "one", s);
              else app.loadAudioFiles(fs, s);
            });
            app.flash("Load Sound " + L(s), "Choose File");
            app.renderAll();
          });
          case 9: return app.confirmPage("New Project?", "Yes/No", () => app.newProject());
          case 0: app.pickFiles(".json", true, fs => app.loadFiles(fs, "all")); app.flash("Load Seq & Sounds", "Choose File(s)"); return null;
        }
        return null;
      };
      return {
        render: () => ["Disk", "Select _ (0-9)"], cursor: () => [1, 7],
        key(k) {
          if (/^[0-69]$/.test(k)) { const pg = sub(+k); if (pg) app.openPage(pg, "disk"); else { app.exitPage(true); app.renderAll(); } return; }
          if (k === "enter") return false;
          return true;
        },
      };
    }

    /**
     * DISK 9: comecar do zero, como ao ligar a maquina pela primeira vez: kit padrao
     * nos pads e segmentos, songs e mixes vazios. Canal MIDI e tempo de sample ficam.
     */
    async newProject() {
      if (this.seq.playing) this.seq.stop();
      const keep = { midi: Object.assign({}, this.p.midi), memory: this.p.memory };
      this.useProject(Object.assign(RJ.createProject(), keep));
      this.lcd("New Project", "Loading Sounds");
      this.flashUntil = performance.now() + 60000;
      await RJ.loadDefaultKit(this.p, this.engine.ctx);
      this.engine.invalidate();
      this.engine.applyVolumes();
      this.flashUntil = 0;
      this.refreshAll();
      this.flash("New Project", "Ready");
      this.dirty();
    }

    download(obj, name) {
      RJ.dsp.downloadBlob(new Blob([JSON.stringify(obj)], { type: "application/json" }), name);
    }

    pickFiles(accept, multiple, fn) {
      const inp = $("#file-pick");
      inp.accept = accept;
      inp.multiple = multiple;
      this.onFiles = fn;
      // no celular o seletor de arquivos so abre no fim do toque
      const ua = navigator.userActivation;
      if (ua && !ua.isActive) window.addEventListener("pointerup", () => inp.click(), { once: true });
      else inp.click();
    }

    /**
     * SAMPLE 8 (ou arrastar um arquivo para o pad): o arquivo faz o papel da
     * entrada de audio, como no SP-1200. O sample comeca quando o som passa do
     * limiar (como no Arm) e para no Sample Length (SAMPLE 5) ou quando a
     * memoria do banco acaba. Um arquivo por pad. Antes, pergunta se o "disco"
     * toca em 45 RPM.
     */
    loadAudioFiles(files, slot) {
      const file = files.find(f => /^audio\//.test(f.type) || /\.(wav|wave|aif|aiff|aifc|mp3|ogg|oga|flac|m4a|aac|opus)$/i.test(f.name));
      if (!file) { this.engine.beep(); this.flash("Not Audio File", "WAV MP3 AIFF ..."); return; }
      const name = file.name.replace(/\.[^.]+$/, "");
      const go = async speed => {
        const p = this.p, bank = Math.floor(slot / 8);
        const max = Math.min(p.sample.length, RJ.bankFree(p, bank, slot));
        if (max < 0.05) { this.engine.beep(); this.flash("Bank " + RJ.BANKS[bank] + " Full", "Truncate/Delete"); return; }
        this.flash("Sampling " + L(slot), "Please Wait", 60000);
        let dec;
        try { dec = await RJ.decodeAudio(this.engine.ctx, await file.arrayBuffer()); }
        catch (e) { console.warn(e); this.engine.beep(); this.flash(L(slot) + " Load Error", "Format?"); return; }
        const raw = RJ.trimLeading(dec.raw, dec.rate);
        // no 45 RPM o disco passa 1,35x mais rapido: cabe mais musica no mesmo tempo
        const take = Math.min(raw.length, Math.floor(max * dec.rate * speed));
        const cut = take < raw.length;
        const r = RJ.assignSound(p, slot, raw.subarray(0, take), dec.rate, name, { speed, trim: false, fadeOut: cut ? 0.004 : 0 });
        this.engine.invalidate();
        this.sel = slot;
        this.flash(L(slot) + " " + r.seconds.toFixed(2) + " Sec", cut ? "Length Reached" : (speed > 1 ? "Loaded at 45" : "Sample is good"), 2500);
        this.renderAll();
        this.dirty();
      };
      this.openPage(this.confirmPage("Load at 45 RPM?", "Y/N " + L(slot) + " " + name, () => go(RJ.SPEED_45), () => go(1)), this.page ? this.page.module : "disk");
    }

    async loadFiles(files, mode, arg) {
      const p = this.p;
      try {
        for (const file of files) {
          if (mode === "one" && !/\.json$/i.test(file.name)) {
            const { raw, rate } = await RJ.decodeAudio(this.engine.ctx, await file.arrayBuffer());
            const r = RJ.assignSound(p, arg, raw, rate, file.name.replace(/\.[^.]+$/, ""));
            this.flash(L(arg) + " " + r.seconds.toFixed(2) + " Sec", r.cut ? "Bank Full: Cut" : "Loaded");
            continue;
          }
          const d = JSON.parse(await file.text());
          if (mode === "seg") {
            if (d.format !== "rj2000-seq" || !d.segments || !d.segments[arg]) throw new Error("Segmento nao encontrado");
            p.segments[arg] = RJ.loadSegment(d.segments[arg]);
            this.flash("Segment " + pad2(arg), "Loaded");
          } else if (mode === "one") {
            RJ.applySnd(p, d, arg);
            this.flash(L(arg), "Loaded");
          } else if (d.format === "rj2000-seq" && mode !== "snd") {
            RJ.applySeq(p, d);
            this.flash("Sequences", "Loaded");
          } else if (d.format === "rj2000-snd" && mode !== "seq") {
            RJ.applySnd(p, d);
            this.flash("Sounds", "Loaded");
          } else throw new Error("Formato");
        }
        this.engine.invalidate();
        this.engine.applyVolumes();
        this.renderAll();
        this.dirty();
      } catch (e) {
        console.warn(e);
        this.engine.beep();
        this.flash("Disk Error", "Wrong File");
      }
    }

    /* =========================================================== SYNC */

    /* =========================================================== SAMPLE */

    /** Knob Gain: de -12 a +36 dB (substitui o Level do original). */
    gainDb() { return Math.round(-12 + this.p.sample.fine * 48); }

    applyGain() { this.sampler.gain = Math.pow(10, this.gainDb() / 20); }

    nextEmptySlot() {
      const p = this.p;
      for (let k = 0; k < 32; k++) { const i = (p.sample.slot + k) % 32; if (!p.sounds[i].pcm) return i; }
      return p.sample.slot;
    }

    /**
     * SAMPLE enxuto (diferenca nossa): 1 VU, 2 escolher pad, 4 limiar,
     * 5 tamanho, 7 armar, 8 carregar arquivo, 9 gravar na hora.
     * Sairam o 3 (Level: fica so o knob Gain) e o 6 (Re-Sample, igual ao 7).
     * O microfone so e pedido quando uma funcao de gravacao e usada.
     */
    samplePage() {
      const app = this, p = this.p, sm = p.sample;
      let fn = 0; // 0 = menu
      const vu = (marks) => {
        const lv = clamp(app.sampler.level, 0, 1), pk = clamp(app.sampler.peak, 0, 1);
        let s = "";
        for (let i = 0; i < 16; i++) {
          const x = (i + 1) / 16;
          s += lv >= x ? "\u2588" : (Math.abs(pk - x) < 1 / 32 ? "|" : (marks && Math.abs(sm.threshold - x) < 1 / 32 ? ":" : " "));
        }
        return s;
      };
      const freeFor = () => RJ.bankFree(p, Math.floor(sm.slot / 8), sm.slot);
      let micAsked = false;
      const mic = () => {
        if (micAsked) return;
        micAsked = true;
        app.applyGain();
        app.sampler.open().then(() => app.renderLCD()).catch(e => { console.warn(e); app.flash("No Audio Input", "Allow Microphone", 3000); });
      };
      const go = force => {
        if (app.sampler.state === "off") { mic(); app.flash("Opening Mic", "Try Again"); return; }
        const max = Math.min(sm.length, freeFor());
        if (max < 0.05) { app.flash("Bank " + RJ.BANKS[Math.floor(sm.slot / 8)] + " Full", "Truncate/Delete"); return; }
        app.applyGain();
        app.sampler.threshold = sm.threshold;
        if (force) app.sampler.force(max); else app.sampler.arm(max);
      };
      const slotTxt = () => L(sm.slot) + (p.sounds[sm.slot].pcm ? "*" : " ");
      return {
        enter() { sm.slot = app.nextEmptySlot(); },
        exit() { app.sampler.close(); },
        render() {
          const st = app.sampler.state;
          if (st === "armed") return ["Sample Armed " + slotTxt(), vu(true)];
          if (st === "recording") return ["Sampling...  " + slotTxt(), vu(false)];
          const noMic = st === "off" ? (micAsked ? "No Audio Input" : "Opening Mic") : null;
          switch (fn) {
            case 1: { const g = app.gainDb(); return [slotTxt() + " Gain " + (g >= 0 ? "+" : "") + g + "dB", noMic || vu(true)]; }
            case 2: return ["Assign Voice " + slotTxt(), "Press Pad  Ch " + (p.sounds[sm.slot].channel + 1)];
            case 4: return ["Threshold " + pad2(Math.round(sm.threshold * 99)), noMic || vu(true)];
            case 5: return ["Sample Length", Math.min(sm.length, freeFor()).toFixed(1) + " Sec (" + freeFor().toFixed(1) + ")"];
            default: return ["Sample " + slotTxt() + "  Pad", "8=File 7/9=Mic"];
          }
        },
        key(k) {
          const busy = app.sampler.state === "armed" || app.sampler.state === "recording";
          if (/^[0-9]$/.test(k) && !busy) {
            const n = +k;
            if (n === 8) {
              app.pickFiles("audio/*,.wav,.aif,.aiff,.mp3,.ogg,.flac,.m4a", false, fs => app.loadAudioFiles(fs, sm.slot));
              return;
            }
            if (n === 7) { go(false); return; }
            if (n === 9) { go(true); return; }
            if (n === 1 || n === 2 || n === 4 || n === 5) { fn = n; if (n === 1 || n === 4) mic(); return; }
            return true;
          }
          if (k === "inc" || k === "dec") {
            const d = k === "inc" ? 1 : -1;
            if (fn === 4) sm.threshold = clamp(Math.round((sm.threshold + d / 32) * 32) / 32, 1 / 32, 1);
            else if (fn === 5) sm.length = clamp(Math.round((sm.length + d * 0.1) * 10) / 10, 0.1, RJ.bankSeconds(p));
            else sm.slot = (sm.slot + d + 32) % 32;
            app.dirty();
            return;
          }
          if (k === "enter") {
            if (busy) { app.sampler.stop(); return; }
            if (fn) { fn = 0; return; }
            return false;
          }
          return true;
        },
        // tocar um pad escolhe o destino (e deixa ouvir o que ja esta nele)
        pad(s) { sm.slot = s; if (p.sounds[s].pcm) app.engine.trigger(s); app.dirty(); },
        slider(i, v) {
          if (i !== 0) return false;
          if (fn === 4) sm.threshold = clamp(v, 1 / 32, 1);
          else if (fn === 5) sm.length = clamp(Math.round(v * RJ.bankSeconds(p) * 10) / 10, 0.1, RJ.bankSeconds(p));
          else return false;
        },
        sliderValue: i => i !== 0 ? null : fn === 4 ? sm.threshold : fn === 5 ? sm.length / RJ.bankSeconds(p) : null,
      };
    }

    sampleDone(raw, rate, peak) {
      const p = this.p, slot = p.sample.slot;
      const r = RJ.assignSound(p, slot, raw, rate, "Sample " + L(slot));
      this.engine.invalidate();
      this.sel = slot;
      this.flash(peak >= 0.99 ? "Sample Overload" : "Sample is good", L(slot) + " " + r.seconds.toFixed(2) + " Sec", 2500);
      this.dirty();
    }

    /* =========================================================== MIDI */

    /** Liga o MIDI do navegador. Depois da primeira vez, liga sozinho a cada boot. */
    async enableMidi() {
      try {
        const ins = await this.midi.enable();
        this.applyMidiChannel();
        this.midiStatus = ins.length ? fit(ins[0], 16) : "No MIDI Input";
        if (!this.learn.enabled) { this.learn.enabled = true; this.learn.persist(); }
      } catch (e) {
        this.midiStatus = "MIDI Unavailable";
      }
      this.renderLCD();
    }

    /** Canal do mapa padrao (notas 36-67 e CC 20-27). O que foi aprendido ja traz o canal. */
    applyMidiChannel() {
      this.midi.channel = this.p.midi.channel;
      this.midi.omni = this.p.midi.mode === "omni";
    }

    midiChannelPage() {
      const app = this, p = this.p;
      const list = ["Omni"].concat(Array.from({ length: 16 }, (_, i) => pad2(i + 1)));
      return {
        render: () => ["MIDI Channel", p.midi.mode === "omni" ? "Omni (All)" : "Channel " + list[p.midi.channel]],
        key(k) {
          if (k !== "inc" && k !== "dec") return k === "enter" ? false : true;
          const i = clamp((p.midi.mode === "omni" ? 0 : p.midi.channel) + (k === "inc" ? 1 : -1), 0, 16);
          if (i === 0) p.midi.mode = "omni"; else { p.midi.mode = "poly"; p.midi.channel = i; }
          app.applyMidiChannel();
          app.dirty();
        },
      };
    }

    /**
     * SET-UP 22: toca-se num controle do SP ou do RJ-950, a ultima mensagem MIDI
     * que chegar aparece no LCD e o Enter salva. Depois e so tocar em outro.
     */
    learnPage() {
      const app = this, L = this.learn, label = RJ.MidiMap.label;
      return {
        enter() { L.start(); app.enableMidi(); },
        exit() { L.stop(); },
        render: () => {
          if (!app.midi.access) return ["MIDI Learn", app.midiStatus || "Starting MIDI"];
          const t = L.sel && L.targets.get(L.sel);
          if (!t) return ["MIDI Learn", L.cand ? label(L.cand.key) : app.midi.inputs.length ? "Touch a Control" : "No MIDI Input"];
          if (L.cand) return [t.name, label(L.cand.key) + " Ent"];
          const b = L.bound(t.id);
          return [t.name, b ? "Now " + label(b) : "Send MIDI..."];
        },
        key(k) { if (k === "enter") { app.learnEnter(); return; } return true; },
      };
    }

    /** Toque num controle durante o Learn. O Enter do painel salva quando ha mensagem esperando. */
    learnTouch(id) {
      const L = this.learn;
      if (id === "key:enter" && L.sel && L.cand) { this.learnEnter(); return; }
      // Set-up sai do Learn quando nada esta escolhido (ou quando ele mesmo ja estava escolhido).
      // Para ensinar o Set-up: escolha outro controle antes e depois toque no Set-up.
      if (id === "act:setup" && !L.cand && (!L.sel || L.sel === "act:setup")) { this.exitPage(); return; }
      L.select(id);
      this.flashUntil = 0;
      this.renderLCD();
    }

    learnEnter() {
      const name = this.learn.save();
      if (name) this.flash("Saved", name, 1000);
    }

    /* =========================================================== salvar */

    dirty() {
      clearTimeout(this.saveTimer);
      this.saveTimer = setTimeout(() => this.saveNow(), 1200);
    }

    saveNow() {
      clearTimeout(this.saveTimer);
      if (!this.on || !this.engine.ready) return;
      try { RJ.store.put("autosave", RJ.serialize(this.p)); } catch (e) { console.warn(e); }
    }

    /* =========================================================== desenho */

    refreshAll() { this.renderAll(); $$(".knob").forEach(k => k.rjDraw && k.rjDraw()); }

    renderAll() { this.renderFaders(); this.renderLEDs(); this.renderLCD(); }

    renderLEDs() {
      const p = this.p, mod = this.page && this.page.module;
      const on = {
        setup: mod === "setup", disk: mod === "disk", sample: mod === "sample",
        song: p.mode === "song", segment: p.mode === "segment",
        mix: this.perf === "mix", tune: this.perf === "tune", multi: !!p.multi,
        bankA: this.bank === 0, bankB: this.bank === 1, bankC: this.bank === 2, bankD: this.bank === 3,
        run: this.seq.playing, rec: this.seq.recArmed || (this.page && this.page.songEdit),
      };
      $$("[data-led]").forEach(el => {
        el.classList.toggle("on", !!on[el.dataset.led]);
        el.classList.toggle("blink", el.dataset.led === "rec" && this.seq.recArmed && (!this.seq.playing || (this.pos && this.pos.count > 0)));
      });
    }

    lcd(a, b, cur) {
      [a, b].forEach((txt, row) => {
        const el = row ? $("#lcd2") : $("#lcd1");
        const s = fit(txt || "");
        let html = "";
        for (let i = 0; i < 16; i++) {
          const c = s[i];
          const code = c.charCodeAt(0);
          const isCur = cur && cur[0] === row && cur[1] === i;
          if (code >= 0x2581 && code <= 0x2588) html += `<span class="bar${isCur ? " cur" : ""}" style="--h:${(code - 0x2580) / 8 * 100}"></span>`;
          else html += `<span${isCur ? ' class="cur"' : ""}>${c === " " ? "&nbsp;" : c.replace(/[<>&]/g, m => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[m]))}</span>`;
        }
        el.innerHTML = html;
      });
    }

    flash(a, b, ms = 1500) {
      this.flashUntil = performance.now() + ms;
      this.lcd(a, b);
      clearTimeout(this.flashTimer);
      this.flashTimer = setTimeout(() => { this.flashUntil = 0; this.renderLCD(); }, ms);
    }

    renderLCD() {
      if (!this.on || performance.now() < this.flashUntil) return;
      if (this.page) {
        const [a, b] = this.page.render();
        this.lcd(a, b, this.page.cursor ? this.page.cursor() : null);
        this.renderLEDs();
        return;
      }
      const p = this.p, song = p.mode === "song";
      const num = song ? p.curSong : p.curSeg;
      const numTxt = this.homeEntry ? (this.homeEntry + "_").slice(0, 2) : pad2(num);
      const tempo = this.seq.playing ? this.seq.tempo : this.tempo;
      const l1 = (song ? "Song " + numTxt + " " : "Seg " + numTxt + "  ") + "♩=" + fmtTempo(tempo);
      let l2;
      const pos = this.pos;
      if (song && this.seq.playing) {
        l2 = "Step " + pad2((this.seq.songStepIdx || 0) + 1) + " Seg " + pad2(this.seq.playSeg);
      } else if (this.seq.playing && pos && performance.now() > this.sliderShowUntil) {
        if (pos.count) l2 = "Count-In      " + pos.count + " ";
        else l2 = (this.seq.recording ? "Rec " : "Play") + "  Bar " + pad2(pos.bar) + "." + pos.beat + " ";
      } else {
        const mode = this.perf === "mix" ? "Mix" : this.perf === "tune" ? "Tun" : "Mlt";
        l2 = this.barGraph() + " " + mode + " " + RJ.BANKS[this.bank] + (this.seq.recArmed ? "R" : "");
      }
      this.lcd(l1, l2, this.homeEntry ? [0, (song ? 5 : 4) + this.homeEntry.length] : null);
    }
  }

  RJ.App = App;
  window.addEventListener("DOMContentLoaded", () => {
    const app = new App();
    RJ.app = app;
    app.build();
  });
})();
