/* RJ-2000 - interface */
window.RJ = window.RJ || {};

(function () {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const pad2 = n => String(n).padStart(2, "0");
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const soundLabel = i => RJ.BANKS[Math.floor(i / 8)] + ((i % 8) + 1);

  class App {
    constructor() {
      this.p = RJ.createProject();
      this.engine = new RJ.Engine(this.p);
      this.seq = new RJ.Sequencer(this.p, this.engine);
      this.sampler = new RJ.Sampler(this.engine);
      this.midi = new RJ.Midi();

      this.bank = 0;
      this.sliderMode = "mix";
      this.prevMode = "mix";
      this.sel = 0;            // som selecionado (ultimo tocado)
      this.multiSrc = 0;
      this.param = "segment";
      this.entry = "";
      this.flashUntil = 0;
      this.repeatHeld = false;
      this.eraseHeld = false;
      this.usedWhileHeld = false;
      this.taps = [];
      this.heldPads = new Map(); // pad -> sound
      this.gridBar = 0;
      this.confirm = null;
      this.pos = null;
      this.saveTimer = null;
    }

    /* =========================================================== montagem */

    build() {
      const sliders = $("#sliders");
      const pads = $("#pads");
      for (let i = 0; i < 8; i++) {
        const col = document.createElement("div");
        col.className = "slider";
        col.innerHTML = `<span class="sv" id="sv-${i}">0</span>
          <div class="track"><input type="range" min="0" max="1000" value="800" id="sl-${i}" aria-label="Slider ${i + 1}"></div>
          <span class="sn">${i + 1}</span>`;
        sliders.appendChild(col);
        const pad = document.createElement("button");
        pad.className = "pad";
        pad.dataset.pad = i;
        pad.innerHTML = `<i class="pad-led"></i><span class="pad-num">${i + 1}</span><span class="pad-name" id="pn-${i}"></span>`;
        pads.appendChild(pad);
      }
      this.buildGrid();
      this.bindUI();
      this.bindKeyboard();
      this.renderLCD();
    }

    buildGrid() {
      const grid = $("#grid");
      grid.innerHTML = "";
      for (let r = 0; r < 8; r++) {
        const row = document.createElement("div");
        row.className = "g-row";
        const lbl = document.createElement("button");
        lbl.className = "g-lbl";
        lbl.dataset.row = r;
        row.appendChild(lbl);
        for (let c = 0; c < 16; c++) {
          const cell = document.createElement("button");
          cell.className = "g-cell" + (c % 4 === 0 ? " beat" : "");
          cell.dataset.row = r;
          cell.dataset.col = c;
          row.appendChild(cell);
        }
        grid.appendChild(row);
      }
    }

    /* =========================================================== ligar */

    async powerOn() {
      this.engine.ensure();
      $("#power").classList.add("off");
      this.lcd("RJ-2000  V0.0", "CARREGANDO...");
      let restored = false;
      try {
        const saved = await RJ.store.get("autosave");
        if (saved) {
          this.useProject(RJ.deserialize(saved));
          restored = true;
        }
      } catch (e) { console.warn("Autosave invalido", e); }
      if (!restored) {
        await RJ.loadDefaultKit(this.p, this.engine.ctx);
        RJ.loadDemoPattern(this.p);
      }
      this.refreshAll();
      this.flash("RJ-2000  V0.0", restored ? "PROJETO RESTAURADO" : "APERTE RUN/STOP", 2200);
    }

    useProject(np) {
      if (this.seq.playing) this.seq.stop();
      // mantem as mesmas referencias de objeto usadas pelo motor e sequenciador
      Object.keys(this.p).forEach(k => delete this.p[k]);
      Object.assign(this.p, np);
      this.engine.invalidate();
      this.engine.applyMix();
      this.engine.applyMaster();
      this.sel = 0; this.bank = 0; this.gridBar = 0;
    }

    /* =========================================================== eventos */

    bindUI() {
      $("#power-btn").addEventListener("click", () => this.powerOn());

      // botoes de acao
      $$("[data-act]").forEach(b => b.addEventListener("click", () => this.action(b.dataset.act)));

      // botoes de segurar (repeat / erase)
      $$("[data-hold]").forEach(b => {
        const kind = b.dataset.hold;
        b.addEventListener("pointerdown", e => { e.preventDefault(); this.hold(kind, true); });
        ["pointerup", "pointercancel", "pointerleave"].forEach(ev => b.addEventListener(ev, () => this.hold(kind, false)));
      });

      // teclado numerico
      $$("#keypad [data-key]").forEach(b => b.addEventListener("click", () => this.key(b.dataset.key)));

      // pads
      $$(".pad").forEach(pad => {
        const i = +pad.dataset.pad;
        pad.addEventListener("pointerdown", e => {
          e.preventDefault();
          try { pad.setPointerCapture(e.pointerId); } catch (_) {}
          const vel = e.pointerType === "pen" && e.pressure ? clamp(e.pressure * 1.3, 0.1, 1) : 1;
          this.padDown(i, vel);
        });
        ["pointerup", "pointercancel"].forEach(ev => pad.addEventListener(ev, () => this.padUp(i)));
        pad.addEventListener("contextmenu", e => e.preventDefault());
        pad.addEventListener("dragover", e => { e.preventDefault(); pad.classList.add("drop"); });
        pad.addEventListener("dragleave", () => pad.classList.remove("drop"));
        pad.addEventListener("drop", e => {
          e.preventDefault(); pad.classList.remove("drop");
          const f = e.dataTransfer.files && e.dataTransfer.files[0];
          if (f) this.loadSoundFile(this.bank * 8 + i, f);
        });
      });

      // sliders
      for (let i = 0; i < 8; i++) {
        $(`#sl-${i}`).addEventListener("input", e => this.sliderInput(i, e.target.value / 1000));
      }

      // abas
      $$(".tabs [data-tab]").forEach(b => b.addEventListener("click", () => this.tab(b.dataset.tab)));

      // grade
      $("#grid").addEventListener("pointerdown", e => {
        const t = e.target.closest(".g-cell, .g-lbl");
        if (!t) return;
        if (t.classList.contains("g-cell")) {
          e.preventDefault();
          this.engine.ensure();
          const s = this.bank * 8 + (+t.dataset.row);
          const tick = this.gridBar * 4 * RJ.PPQ + (+t.dataset.col) * 24;
          const seg = RJ.segment(this.p, this.p.curSeg);
          if (tick >= RJ.segTicks(seg)) return;
          const on = this.seq.toggleStep(this.p.curSeg, s, tick);
          if (on) this.engine.trigger(s);
          this.dirty();
        } else if (t.classList.contains("g-lbl")) {
          this.engine.ensure();
          const s = this.bank * 8 + (+t.dataset.row);
          this.engine.trigger(s);
          this.select(s);
        }
      });
      $("#grid-prev").addEventListener("click", () => { this.gridBar = Math.max(0, this.gridBar - 1); $("#grid-follow").checked = false; this.renderGrid(); });
      $("#grid-next").addEventListener("click", () => {
        const bars = RJ.segment(this.p, this.p.curSeg).bars;
        this.gridBar = Math.min(bars - 1, this.gridBar + 1); $("#grid-follow").checked = false; this.renderGrid();
      });

      // som
      $("#snd-name").addEventListener("input", e => { this.p.sounds[this.sel].name = e.target.value.toUpperCase(); this.renderPads(); this.renderGridLabels(); this.dirty(); });
      $("#trim-start").addEventListener("input", e => this.trim("start", e.target.value / 1000));
      $("#trim-end").addEventListener("input", e => this.trim("end", e.target.value / 1000));
      $("#snd-play").addEventListener("click", () => { this.engine.ensure(); this.engine.trigger(this.sel); });
      $("#snd-file").addEventListener("click", () => this.pickSoundFile(this.sel));
      $("#snd-rev").addEventListener("click", () => this.action("reverse"));
      $("#snd-del").addEventListener("click", () => this.deleteSound());
      $("#mic-btn").addEventListener("click", () => this.micButton());
      $("#mic-thr").addEventListener("input", e => { this.sampler.threshold = e.target.value / 100; $("#mic-thr-mark").style.left = e.target.value + "%"; });
      this.sampler.onLevel = (lv, st) => this.micLevel(lv, st);
      this.sampler.onDone = (raw, rate) => this.micDone(raw, rate);

      $("#file-sound").addEventListener("change", e => {
        const f = e.target.files[0];
        if (f) this.loadSoundFile(this.fileTarget, f);
        e.target.value = "";
      });
      $("#file-project").addEventListener("change", e => {
        const f = e.target.files[0];
        if (f) this.openProjectFile(f);
        e.target.value = "";
      });

      // song
      $("#song-toggle").addEventListener("click", () => this.action("song"));
      $("#song-add").addEventListener("click", () => {
        const last = this.p.song.steps[this.p.song.steps.length - 1];
        this.p.song.steps.push({ seg: last ? last.seg : this.p.curSeg, reps: 1 });
        this.renderSong(); this.dirty();
      });
      $("#song-list").addEventListener("change", e => {
        const i = +e.target.dataset.i;
        const st = this.p.song.steps[i];
        if (!st) return;
        if (e.target.dataset.f === "seg") st.seg = clamp((parseInt(e.target.value, 10) || 1) - 1, 0, 98);
        if (e.target.dataset.f === "reps") st.reps = clamp(parseInt(e.target.value, 10) || 1, 1, 99);
        this.renderSong(); this.dirty();
      });
      $("#song-list").addEventListener("click", e => {
        const b = e.target.closest("[data-del]");
        if (!b) return;
        this.p.song.steps.splice(+b.dataset.del, 1);
        this.renderSong(); this.dirty();
      });

      // setup
      $("#set-bits").addEventListener("change", e => { this.p.settings.bits = +e.target.value; this.reprocess(); });
      $("#set-rate").addEventListener("change", e => { this.p.settings.rate = +e.target.value; this.reprocess(); });
      $("#set-mem").addEventListener("change", e => { this.p.settings.memLimit = e.target.value === "1"; this.renderMemory(); this.dirty(); });
      $("#set-tune").addEventListener("change", e => { this.p.settings.tuneRange = +e.target.value; this.renderSliders(); this.dirty(); });
      $("#set-s950").addEventListener("change", e => { this.p.settings.s950 = e.target.checked; this.engine.applyMaster(); this.dirty(); });
      $("#set-s950cut").addEventListener("input", e => {
        this.p.settings.s950Cut = +e.target.value; this.engine.applyMaster();
        const hz = Math.round(200 * Math.pow(90, this.p.settings.s950Cut / 99));
        this.flash("FILTRO S950", this.p.settings.s950 ? hz + " HZ" : "DESLIGADO"); this.dirty();
      });
      $("#set-out").addEventListener("input", e => { this.p.settings.outDb = +e.target.value; this.engine.applyMaster(); this.flash("VOLUME SAIDA", e.target.value + " DB"); this.dirty(); });
      $("#set-dynamic").addEventListener("change", e => { this.p.settings.dynamic = e.target.checked; this.dirty(); });
      $("#midi-btn").addEventListener("click", () => this.enableMidi());
      $("#proj-name").addEventListener("input", e => { this.p.name = e.target.value.toUpperCase(); this.dirty(); });
      $("#proj-save").addEventListener("click", () => this.action("save"));
      $("#proj-open").addEventListener("click", () => this.action("load"));
      $("#exp-seg").addEventListener("click", () => this.exportWav("segment"));
      $("#exp-song").addEventListener("click", () => this.exportWav("song"));
      $("#proj-new").addEventListener("click", () => this.newProject());

      // sequenciador
      this.seq.on("transport", () => this.renderTransport());
      this.seq.on("position", pos => this.onPosition(pos));
      this.seq.on("change", () => { this.renderGrid(); this.dirty(); });
      this.seq.on("hit", (s, time) => this.onHit(s, time));
      this.seq.on("songstep", () => { this.renderSong(); this.renderLED(); });
      this.seq.on("message", (a, b) => this.flash(a, b));

      // MIDI
      this.midi.onNote = (n, vel, on) => {
        if (on) this.hitSound(n, { vel: this.p.settings.dynamic ? vel : 1 });
      };
      this.midi.onSlider = (i, v) => { $(`#sl-${i}`).value = Math.round(v * 1000); this.sliderInput(i, v); };

      document.addEventListener("visibilitychange", () => { if (document.hidden) this.saveNow(); });
      window.addEventListener("resize", () => this.drawWave());
    }

    bindKeyboard() {
      const padKeys = ["KeyA", "KeyS", "KeyD", "KeyF", "KeyG", "KeyH", "KeyJ", "KeyK"];
      const bankKeys = ["KeyZ", "KeyX", "KeyC", "KeyV"];
      const typing = () => { const t = document.activeElement; return t && (t.tagName === "INPUT" && t.type !== "range" && t.type !== "checkbox" || t.tagName === "TEXTAREA" || t.tagName === "SELECT"); };
      window.addEventListener("keydown", e => {
        if (typing() || e.metaKey || e.ctrlKey || e.altKey) return;
        if ($("#power").classList.contains("off") === false) { if (e.code === "Space" || e.code === "Enter") { e.preventDefault(); this.powerOn(); } return; }
        const pi = padKeys.indexOf(e.code);
        if (pi >= 0) { e.preventDefault(); if (!e.repeat) { this.padDown(pi, 1); this.padEl(pi).classList.add("down"); } return; }
        const bi = bankKeys.indexOf(e.code);
        if (bi >= 0) { e.preventDefault(); this.setBank(bi); return; }
        if (e.repeat) return;
        if (e.code === "Space") { e.preventDefault(); this.action("run"); }
        else if (e.code === "KeyR") this.action("record");
        else if (e.code === "KeyT") this.hold("repeat", true);
        else if (e.code === "Backspace") { e.preventDefault(); this.hold("erase", true); }
        else if (e.code === "Enter" || e.code === "NumpadEnter") { e.preventDefault(); this.key("enter"); }
        else if (e.code === "Escape") this.key("cancel");
        else if (e.key === "-" ) this.key("dec");
        else if (e.key === "+" || e.key === "=") this.key("inc");
        else if (e.key === "." || e.key === ",") this.key(".");
        else if (/^[0-9]$/.test(e.key)) this.key(e.key);
      });
      window.addEventListener("keyup", e => {
        const pi = padKeys.indexOf(e.code);
        if (pi >= 0) { this.padUp(pi); this.padEl(pi).classList.remove("down"); }
        if (e.code === "KeyT") this.hold("repeat", false);
        if (e.code === "Backspace") this.hold("erase", false);
      });
    }

    /* =========================================================== pads */

    padEl(i) { return $(`.pad[data-pad="${i}"]`); }

    padSound(i) {
      const o = {};
      let s;
      if (this.sliderMode === "mpitch") { s = this.multiSrc; o.tune = this.p.multiPitch[i]; }
      else if (this.sliderMode === "mlevel") { s = this.multiSrc; o.lvl = this.p.multiLevel[i]; }
      else s = this.bank * 8 + i;
      return { s, o };
    }

    padDown(i, vel) {
      this.engine.ensure();
      const { s, o } = this.padSound(i);
      if (this.p.settings.dynamic && vel !== 1) o.vel = vel;
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

    /** Toca um som vindo de pad, teclado ou MIDI, respeitando ERASE e REPEAT. */
    hitSound(s, o = {}, fromPad) {
      this.engine.ensure();
      const snd = this.p.sounds[s];
      if (this.eraseHeld) {
        this.usedWhileHeld = true;
        if (this.seq.playing) {
          this.seq.erasing.add(s);
          this.flash("APAGANDO " + soundLabel(s), snd.name || "");
        } else {
          const n = this.seq.eraseSound(this.p.curSeg, s);
          this.flash("APAGADO " + soundLabel(s), n + " NOTAS DO SEG " + pad2(this.p.curSeg + 1));
        }
        return;
      }
      if (this.repeatHeld) {
        this.usedWhileHeld = true;
        if (this.seq.playing) {
          if (fromPad) this.seq.repeatPads.set(s, o);
          this.select(s);
          return;
        }
      }
      if (!snd.pcm) {
        this.select(s);
        this.flash(soundLabel(s) + " VAZIO", "LOAD SOUND OU SAMPLE");
        return;
      }
      this.seq.liveHit(s, o);
      this.select(s);
    }

    onHit(s, time) {
      const inBank = Math.floor(s / 8) === this.bank;
      const multi = this.sliderMode === "mpitch" || this.sliderMode === "mlevel";
      if (!inBank && !multi) return;
      const delay = Math.max(0, (time - this.engine.ctx.currentTime) * 1000);
      setTimeout(() => {
        const idx = multi ? null : s % 8;
        const els = idx == null ? [] : [this.padEl(idx)];
        els.forEach(el => { if (!el) return; el.classList.add("hit"); setTimeout(() => el.classList.remove("hit"), 90); });
      }, delay);
    }

    select(s) {
      if (this.sel === s) return;
      this.sel = s;
      $("#sel-label").textContent = soundLabel(s) + " " + (this.p.sounds[s].name || "");
      this.renderSound();
      this.renderLEDs();
    }

    setBank(b) {
      this.bank = ((b % 4) + 4) % 4;
      $("#bank-label").textContent = RJ.BANKS[this.bank];
      if (this.sliderMode !== "mpitch" && this.sliderMode !== "mlevel") this.select(this.bank * 8 + (this.sel % 8));
      this.renderPads();
      this.renderSliders();
      this.renderGrid();
      this.flash("BANCO " + RJ.BANKS[this.bank], RJ.bankUsage(this.p, this.bank).toFixed(2) + "S DE 2.50S");
    }

    /* =========================================================== sliders */

    sliderInput(i, v) {
      const p = this.p;
      const range = p.settings.tuneRange;
      switch (this.sliderMode) {
        case "mix": p.levels[i] = v; this.engine.applyMix(); break;
        case "tune": { const s = p.sounds[this.bank * 8 + i]; s.tune = Math.round((v * 2 - 1) * range * 10) / 10; break; }
        case "decay": { const s = p.sounds[this.bank * 8 + i]; s.decay = Math.round(v * 31) / 31; break; }
        case "mpitch": p.multiPitch[i] = Math.round((v * 2 - 1) * range); break;
        case "mlevel": p.multiLevel[i] = Math.round(v * 31) / 31; break;
      }
      this.renderSliderValue(i);
      const name = { mix: "MIX", tune: "TUNE", decay: "DECAY", mpitch: "MULTI PITCH", mlevel: "MULTI LEVEL" }[this.sliderMode];
      this.flash(name + " " + (i + 1), $(`#sv-${i}`).textContent, 900);
      this.dirty();
    }

    sliderValue(i) {
      const p = this.p, range = p.settings.tuneRange;
      switch (this.sliderMode) {
        case "mix": return p.levels[i];
        case "tune": return (p.sounds[this.bank * 8 + i].tune / range + 1) / 2;
        case "decay": return p.sounds[this.bank * 8 + i].decay;
        case "mpitch": return (p.multiPitch[i] / range + 1) / 2;
        case "mlevel": return p.multiLevel[i];
      }
      return 0;
    }

    sliderText(i) {
      const p = this.p;
      const sg = v => (v > 0 ? "+" : "") + v;
      switch (this.sliderMode) {
        case "mix": return String(Math.round(p.levels[i] * 99));
        case "tune": return sg(p.sounds[this.bank * 8 + i].tune.toFixed(1));
        case "decay": return String(Math.round(p.sounds[this.bank * 8 + i].decay * 31));
        case "mpitch": return sg(p.multiPitch[i]);
        case "mlevel": return String(Math.round(p.multiLevel[i] * 31));
      }
      return "";
    }

    renderSliderValue(i) { $(`#sv-${i}`).textContent = this.sliderText(i); }

    renderSliders() {
      for (let i = 0; i < 8; i++) {
        $(`#sl-${i}`).value = Math.round(clamp(this.sliderValue(i), 0, 1) * 1000);
        this.renderSliderValue(i);
      }
      const names = { mix: "MIX", tune: "TUNE", decay: "DECAY", mpitch: "MULTI PITCH " + soundLabel(this.multiSrc), mlevel: "MULTI LEVEL " + soundLabel(this.multiSrc) };
      $("#slider-mode-label").textContent = "SLIDERS: " + names[this.sliderMode];
    }

    setSliderMode(m) {
      if ((m === "mpitch" || m === "mlevel") && this.sliderMode === m) m = this.prevMode;
      if (m === "mpitch" || m === "mlevel") {
        if (this.sliderMode !== "mpitch" && this.sliderMode !== "mlevel") this.prevMode = this.sliderMode;
        this.multiSrc = this.sel;
        this.flash(m === "mpitch" ? "MULTI PITCH" : "MULTI LEVEL", soundLabel(this.sel) + " " + (this.p.sounds[this.sel].name || ""));
      } else {
        this.flash("SLIDERS", { mix: "MIX", tune: "TUNE", decay: "DECAY" }[m]);
      }
      this.sliderMode = m;
      this.renderSliders();
      this.renderPads();
      this.renderLEDs();
    }

    /* =========================================================== parametros e teclado numerico */

    params() {
      const p = this.p;
      return {
        segment: { label: "SEGMENTO", get: () => p.curSeg + 1, set: v => this.selectSegment(v - 1), min: 1, max: 99, step: 1, fmt: v => pad2(v) },
        tempo: { label: "TEMPO", get: () => p.tempo, set: v => { p.tempo = Math.round(clamp(v, 30, 250) * 10) / 10; }, min: 30, max: 250, step: 1, fmt: v => v.toFixed(1) + " BPM", decimal: true },
        swing: { label: "SWING", list: RJ.SWING.map(v => v + "%"), get: () => RJ.SWING.indexOf(p.swing), set: v => { p.swing = RJ.SWING[clamp(v, 0, RJ.SWING.length - 1)]; } },
        ac: { label: "AUTO CORRECT", list: RJ.AUTO_CORRECT.map(a => a.label), get: () => p.ac, set: v => { p.ac = clamp(v, 0, RJ.AUTO_CORRECT.length - 1); } },
        length: { label: "TAMANHO SEG " + pad2(p.curSeg + 1), get: () => RJ.segment(p, p.curSeg).bars, set: v => { RJ.segment(p, p.curSeg).bars = clamp(Math.round(v), 1, 99); this.gridBar = 0; this.renderGrid(); }, min: 1, max: 99, step: 1, fmt: v => v + (v === 1 ? " COMPASSO" : " COMPASSOS") },
        metronome: { label: "METRONOMO", list: ["DESLIGADO", "SO GRAVANDO", "SEMPRE"], get: () => ["off", "rec", "on"].indexOf(p.metronome), set: v => { p.metronome = ["off", "rec", "on"][clamp(v, 0, 2)]; } },
        copy: { label: "COPIAR SEG " + pad2(p.curSeg + 1) + " P/", get: () => this.copyTarget || clamp(p.curSeg + 2, 1, 99), set: v => { this.copyTarget = clamp(Math.round(v), 1, 99); }, min: 1, max: 99, step: 1, fmt: v => "SEG " + pad2(v), commit: true },
      };
    }

    setParam(name) {
      this.param = name;
      this.entry = "";
      if (name === "copy") this.copyTarget = clamp(this.p.curSeg + 2, 1, 99);
      this.flashUntil = 0;
      this.renderLCD();
      this.renderLEDs();
    }

    key(k) {
      const def = this.params()[this.param];
      if (!def) return;
      if (/^[0-9]$/.test(k) || k === ".") {
        if (def.list) { const n = parseInt(k, 10); if (!isNaN(n) && n >= 1 && n <= def.list.length) { def.set(n - 1); this.afterParam(); } return; }
        if (k === "." && (!def.decimal || this.entry.includes("."))) return;
        this.entry = (this.entry + k).slice(-5);
        this.flashUntil = 0;
        this.renderLCD();
        return;
      }
      if (k === "cancel") {
        if (this.entry) this.entry = "";
        else this.param = "segment";
        this.confirm = null;
        this.flashUntil = 0;
        this.renderLCD(); this.renderLEDs();
        return;
      }
      if (k === "inc" || k === "dec") {
        const d = k === "inc" ? 1 : -1;
        this.entry = "";
        if (def.list) def.set(clamp(def.get() + d, 0, def.list.length - 1));
        else def.set(clamp(def.get() + d * def.step, def.min, def.max));
        this.afterParam();
        return;
      }
      if (k === "enter") {
        if (this.entry) {
          const v = parseFloat(this.entry);
          this.entry = "";
          if (!isNaN(v)) def.set(clamp(v, def.min, def.max));
        }
        if (def.commit && this.param === "copy") {
          const to = this.copyTarget - 1;
          if (to === this.p.curSeg) { this.flash("MESMO SEGMENTO", "ESCOLHA OUTRO"); return; }
          this.seq.copySegment(this.p.curSeg, to);
          this.flash("COPIADO", "SEG " + pad2(this.p.curSeg + 1) + " > SEG " + pad2(to + 1));
          this.param = "segment";
          this.renderLEDs();
          return;
        }
        this.afterParam();
      }
    }

    afterParam() {
      this.flashUntil = 0;
      this.renderLCD();
      this.renderLED();
      this.dirty();
    }

    selectSegment(i) {
      this.p.curSeg = clamp(Math.round(i), 0, 98);
      RJ.segment(this.p, this.p.curSeg);
      this.gridBar = 0;
      this.renderGrid();
      this.renderLED();
    }

    /* =========================================================== acoes */

    action(a) {
      this.engine.ensure();
      switch (a) {
        case "mode-mix": this.setSliderMode("mix"); break;
        case "mode-tune": this.setSliderMode(this.sliderMode === "tune" ? "decay" : "tune"); break;
        case "mode-mpitch": this.setSliderMode("mpitch"); break;
        case "mode-mlevel": this.setSliderMode("mlevel"); break;
        case "bank": this.setBank(this.bank + 1); break;
        case "p-segment": this.setParam("segment"); break;
        case "p-tempo": this.setParam("tempo"); break;
        case "p-swing": this.setParam("swing"); break;
        case "p-ac": this.setParam("ac"); break;
        case "p-length": this.setParam("length"); break;
        case "p-metronome": this.setParam("metronome"); break;
        case "p-copy": this.setParam("copy"); break;
        case "song":
          if (this.seq.playing) this.seq.stop();
          this.p.mode = this.p.mode === "song" ? "segment" : "song";
          this.renderSong(); this.renderLED(); this.renderLEDs();
          this.flash(this.p.mode === "song" ? "SONG MODE" : "SEGMENT MODE", this.p.mode === "song" ? this.p.song.steps.length + " PASSOS" : "SEG " + pad2(this.p.curSeg + 1));
          this.dirty();
          break;
        case "erase-seg":
          if (this.confirm === "erase-seg") {
            this.confirm = null;
            this.seq.clearSegment(this.p.curSeg);
            this.flash("SEG " + pad2(this.p.curSeg + 1) + " APAGADO", "");
          } else {
            this.confirm = "erase-seg";
            this.flash("APAGAR SEG " + pad2(this.p.curSeg + 1) + "?", "APERTE DE NOVO", 3000);
            setTimeout(() => { if (this.confirm === "erase-seg") this.confirm = null; }, 3000);
          }
          break;
        case "run":
          this.seq.toggle();
          break;
        case "record":
          this.seq.recArmed = !this.seq.recArmed;
          if (this.p.mode === "song" && this.seq.recArmed) this.flash("RECORD", "SO NO SEGMENT MODE");
          this.renderTransport();
          break;
        case "sample": this.tab("sound"); this.micButton(); break;
        case "load-sound": this.pickSoundFile(this.sel); break;
        case "truncate": this.tab("sound"); this.flash("TRUNCATE " + soundLabel(this.sel), "AJUSTE INICIO/FIM"); break;
        case "reverse": {
          const s = this.p.sounds[this.sel];
          if (!s.pcm) return;
          s.reverse = !s.reverse; s.ver++;
          this.flash("REVERSE " + soundLabel(this.sel), s.reverse ? "LIGADO" : "DESLIGADO");
          this.renderSound(); this.renderLEDs(); this.dirty();
          break;
        }
        case "save": this.saveProjectFile(); break;
        case "load": $("#file-project").click(); break;
        case "export": this.exportWav(this.p.mode === "song" ? "song" : "segment"); break;
      }
    }

    hold(kind, down) {
      if (kind === "repeat") {
        if (down === this.repeatHeld) return;
        this.repeatHeld = down;
        $("#btn-repeat").classList.toggle("on", down);
        if (down) { this.usedWhileHeld = false; }
        else {
          this.seq.repeatPads.clear();
          if (!this.usedWhileHeld) this.tap();
        }
      } else if (kind === "erase") {
        if (down === this.eraseHeld) return;
        this.eraseHeld = down;
        $("#btn-erase").classList.toggle("on", down);
        if (down) { this.usedWhileHeld = false; this.flash("ERASE", "SEGURE E TOQUE UM PAD", 1500); }
        else this.seq.erasing.clear();
      }
    }

    tap() {
      const now = performance.now();
      this.taps = this.taps.filter(t => now - t < 2500);
      this.taps.push(now);
      if (this.taps.length >= 2) {
        const iv = [];
        for (let i = 1; i < this.taps.length; i++) iv.push(this.taps[i] - this.taps[i - 1]);
        const avg = iv.slice(-4).reduce((a, b) => a + b, 0) / Math.min(4, iv.length);
        this.p.tempo = Math.round(clamp(60000 / avg, 30, 250) * 10) / 10;
        this.param = "tempo";
        this.renderLEDs();
        this.flash("TAP TEMPO", this.p.tempo.toFixed(1) + " BPM");
        this.dirty();
      } else this.flash("TAP TEMPO", "CONTINUE BATENDO");
    }

    /* =========================================================== sons */

    pickSoundFile(index) {
      this.fileTarget = index;
      $("#file-sound").click();
    }

    async loadSoundFile(index, file) {
      this.engine.ensure();
      try {
        this.flash("CARREGANDO", file.name.slice(0, 20));
        const ab = await file.arrayBuffer();
        const { raw, rate } = await RJ.decodeAudio(this.engine.ctx, ab);
        const name = file.name.replace(/\.[^.]+$/, "");
        const r = RJ.assignSound(this.p, index, raw, rate, name);
        this.sel = -1; this.select(index);
        this.refreshSoundViews();
        this.flash(soundLabel(index) + " " + r.seconds.toFixed(2) + "S", r.cut ? "CORTADO: BANCO CHEIO" : "CARREGADO");
        this.dirty();
      } catch (e) {
        console.warn(e);
        this.flash("ERRO AO LER", "FORMATO NAO SUPORTADO");
      }
    }

    deleteSound() {
      if (this.confirm !== "del-sound") {
        this.confirm = "del-sound";
        this.flash("APAGAR " + soundLabel(this.sel) + "?", "APERTE DE NOVO", 3000);
        setTimeout(() => { if (this.confirm === "del-sound") this.confirm = null; }, 3000);
        return;
      }
      this.confirm = null;
      RJ.clearSound(this.p, this.sel);
      this.refreshSoundViews();
      this.flash(soundLabel(this.sel) + " APAGADO", "");
      this.dirty();
    }

    trim(which, v) {
      const s = this.p.sounds[this.sel];
      if (!s.pcm) return;
      if (which === "start") s.startF = clamp(v, 0, s.endF - 0.002);
      else {
        let end = clamp(v, s.startF + 0.002, 1);
        if (this.p.settings.memLimit) {
          const bank = Math.floor(this.sel / 8);
          const others = RJ.bankUsage(this.p, bank) - RJ.soundSeconds(s);
          const maxLen = (RJ.BANK_SECONDS - others) * s.rate / s.pcm.length;
          end = Math.min(end, s.startF + Math.max(0.002, maxLen));
        }
        s.endF = end;
      }
      s.ver++;
      $("#trim-start").value = Math.round(s.startF * 1000);
      $("#trim-end").value = Math.round(s.endF * 1000);
      $("#snd-secs").textContent = RJ.soundSeconds(s).toFixed(2) + " s";
      this.drawWave();
      this.renderMemory();
      this.flash("TRUNCATE " + soundLabel(this.sel), RJ.soundSeconds(s).toFixed(3) + " S");
      this.dirty();
    }

    reprocess() {
      RJ.reprocessAll(this.p);
      this.engine.invalidate();
      this.refreshSoundViews();
      this.flash("SISTEMA", this.p.settings.bits + " BITS " + (this.p.settings.rate / 1000).toFixed(2) + "K");
      this.dirty();
    }

    /* ----- microfone */

    async micButton() {
      const st = this.sampler.state;
      try {
        if (st === "off") {
          await this.sampler.open();
          this.flash("SAMPLE " + soundLabel(this.sel), "AJUSTE O NIVEL");
        } else if (st === "monitor") {
          const s = this.p.sounds[this.sel];
          const bank = Math.floor(this.sel / 8);
          const free = this.p.settings.memLimit ? RJ.BANK_SECONDS - (RJ.bankUsage(this.p, bank) - RJ.soundSeconds(s)) : 20;
          if (free < 0.05) { this.flash("BANCO " + RJ.BANKS[bank] + " CHEIO", "APAGUE OU TRUNQUE"); return; }
          this.sampler.arm(free);
          this.flash("SAMPLE " + soundLabel(this.sel), "AGUARDANDO SINAL", 60000);
        } else {
          this.sampler.stop();
        }
      } catch (e) {
        console.warn(e);
        this.flash("MICROFONE", "SEM PERMISSAO");
        $("#mic-status").textContent = "Nao foi possivel abrir o microfone: " + e.message;
      }
      this.renderMic();
    }

    micLevel(lv, st) {
      const m = $("#mic-meter");
      if (m) m.style.width = Math.min(100, lv * 100) + "%";
      if (st !== this.lastMicState) { this.lastMicState = st; this.renderMic(); if (st === "recording") this.flash("SAMPLE " + soundLabel(this.sel), "GRAVANDO...", 60000); }
    }

    micDone(raw, rate) {
      // remove silencio inicial abaixo do limiar
      const r = RJ.assignSound(this.p, this.sel, raw, rate, "SAMPLE " + soundLabel(this.sel));
      this.refreshSoundViews();
      this.flash("SAMPLE " + soundLabel(this.sel), r.seconds.toFixed(2) + " S GRAVADOS");
      this.renderMic();
      this.dirty();
    }

    renderMic() {
      const st = this.sampler.state;
      const b = $("#mic-btn");
      b.textContent = { off: "LIGAR MICROFONE", monitor: "ARMAR GRAVACAO", armed: "CANCELAR", recording: "PARAR" }[st];
      b.classList.toggle("live", st === "armed" || st === "recording");
      $("#mic-status").textContent = {
        off: "Grava no slot selecionado, ate o limite de memoria do banco.",
        monitor: "Microfone ligado. Ajuste o volume da fonte e arme a gravacao. Ela comeca quando o sinal passa do limiar.",
        armed: "Armado: toque o som que quer samplear.",
        recording: "Gravando. Para sozinho no limite de memoria ou quando voce apertar PARAR.",
      }[st];
      this.renderLEDs();
    }

    /* =========================================================== projeto */

    dirty() {
      clearTimeout(this.saveTimer);
      this.saveTimer = setTimeout(() => this.saveNow(), 1500);
    }

    saveNow() {
      clearTimeout(this.saveTimer);
      if (!this.engine.ready) return;
      try { RJ.store.put("autosave", RJ.serialize(this.p)); } catch (e) { console.warn(e); }
    }

    saveProjectFile() {
      const json = RJ.serialize(this.p);
      const name = (this.p.name || "projeto").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "projeto";
      RJ.dsp.downloadBlob(new Blob([json], { type: "application/json" }), name + ".rj2000.json");
      this.flash("SALVO", name + ".rj2000.json");
    }

    async openProjectFile(file) {
      try {
        const text = await file.text();
        this.useProject(RJ.deserialize(text));
        this.refreshAll();
        this.flash("PROJETO ABERTO", this.p.name);
        this.saveNow();
      } catch (e) {
        console.warn(e);
        this.flash("ERRO AO ABRIR", "ARQUIVO INVALIDO");
      }
    }

    async newProject() {
      if (this.confirm !== "new") {
        this.confirm = "new";
        this.flash("NOVO PROJETO?", "APERTE DE NOVO", 3000);
        setTimeout(() => { if (this.confirm === "new") this.confirm = null; }, 3000);
        return;
      }
      this.confirm = null;
      const np = RJ.createProject();
      this.useProject(np);
      await RJ.loadDefaultKit(this.p, this.engine.ctx);
      this.refreshAll();
      this.flash("NOVO PROJETO", "KIT PADRAO CARREGADO");
      this.saveNow();
    }

    async exportWav(kind) {
      this.engine.ensure();
      try {
        this.flash("EXPORTANDO", kind === "song" ? "SONG" : "SEG " + pad2(this.p.curSeg + 1), 60000);
        const wav = await this.seq.renderWav(kind);
        const base = (this.p.name || "rj2000").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "rj2000";
        const fname = base + (kind === "song" ? "-song" : "-seg" + pad2(this.p.curSeg + 1)) + ".wav";
        RJ.dsp.downloadBlob(new Blob([wav], { type: "audio/wav" }), fname);
        this.flash("WAV EXPORTADO", fname.slice(0, 20));
      } catch (e) {
        console.warn(e);
        this.flash("NADA PARA EXPORTAR", e.message.toUpperCase().slice(0, 20));
      }
    }

    async enableMidi() {
      try {
        const ins = await this.midi.enable();
        const show = list => { $("#midi-status").textContent = list.length ? "Conectado: " + list.join(", ") : "MIDI ativo, nenhum controlador conectado."; };
        show(ins);
        this.midi.onChange = show;
        $("#midi-btn").textContent = "MIDI ATIVO";
        this.flash("MIDI", ins.length ? ins.length + " ENTRADA(S)" : "SEM CONTROLADOR");
      } catch (e) {
        $("#midi-status").textContent = "Nao foi possivel ativar o MIDI: " + e.message + ". Use Chrome ou Edge.";
        this.flash("MIDI", "INDISPONIVEL");
      }
    }

    /* =========================================================== renderizacao */

    refreshAll() {
      $("#bank-label").textContent = RJ.BANKS[this.bank];
      $("#proj-name").value = this.p.name;
      const s = this.p.settings;
      $("#set-bits").value = s.bits; $("#set-rate").value = s.rate; $("#set-mem").value = s.memLimit ? "1" : "0";
      $("#set-tune").value = s.tuneRange; $("#set-s950").checked = s.s950; $("#set-s950cut").value = s.s950Cut;
      $("#set-out").value = s.outDb; $("#set-dynamic").checked = s.dynamic;
      const sel = this.sel; this.sel = -1; this.select(sel);
      this.renderPads(); this.renderSliders(); this.renderGrid(); this.renderSong();
      this.renderTransport(); this.renderLED(); this.renderLEDs(); this.renderMemory(); this.renderLCD();
    }

    refreshSoundViews() {
      this.renderPads(); this.renderGridLabels(); this.renderSound(); this.renderMemory(); this.renderSliders();
    }

    renderPads() {
      const multi = this.sliderMode === "mpitch" || this.sliderMode === "mlevel";
      for (let i = 0; i < 8; i++) {
        const el = $(`#pn-${i}`);
        if (multi) {
          el.textContent = this.sliderMode === "mpitch" ? ((this.p.multiPitch[i] > 0 ? "+" : "") + this.p.multiPitch[i]) : "LV " + Math.round(this.p.multiLevel[i] * 31);
        } else {
          const s = this.p.sounds[this.bank * 8 + i];
          el.textContent = s.pcm ? (s.name || soundLabel(this.bank * 8 + i)) : "--";
        }
        this.padEl(i).classList.toggle("empty", !multi && !this.p.sounds[this.bank * 8 + i].pcm);
      }
    }

    renderGridLabels() {
      $$(".g-lbl").forEach(l => {
        const s = this.bank * 8 + (+l.dataset.row);
        l.innerHTML = `<b>${soundLabel(s)}</b> <span>${(this.p.sounds[s].name || "").replace(/[<>&]/g, "")}</span>`;
      });
    }

    renderGrid() {
      const seg = RJ.segment(this.p, this.p.curSeg);
      if (this.gridBar >= seg.bars) this.gridBar = seg.bars - 1;
      $("#grid-title").textContent = `SEG ${pad2(this.p.curSeg + 1)} · COMPASSO ${this.gridBar + 1}/${seg.bars}`;
      this.renderGridLabels();
      const base = this.gridBar * 4 * RJ.PPQ;
      const on = new Set();
      seg.events.forEach(e => {
        if (Math.floor(e.s / 8) !== this.bank) return;
        const rel = e.t - base;
        if (rel < 0 || rel >= 4 * RJ.PPQ) return;
        on.add((e.s % 8) + ":" + Math.floor(rel / 24));
      });
      $$(".g-cell").forEach(c => c.classList.toggle("on", on.has(c.dataset.row + ":" + c.dataset.col)));
    }

    onPosition(pos) {
      if (pos && !this.seq.playing) return; // evento atrasado depois do STOP
      this.pos = pos;
      $$(".g-cell.now").forEach(c => c.classList.remove("now"));
      if (!pos) { this.renderLCD(); return; }
      const bar = Math.floor(pos.step / 16);
      if (pos.seg === this.p.curSeg) {
        if ($("#grid-follow").checked && bar !== this.gridBar) { this.gridBar = bar; this.renderGrid(); }
        if (bar === this.gridBar) $$(`.g-cell[data-col="${pos.step % 16}"]`).forEach(c => c.classList.add("now"));
      }
      if (pos.step % 4 === 0) { this.renderLCD(); if (this.p.mode === "song") this.renderLED(); }
    }

    renderSong() {
      const p = this.p;
      $("#song-state").textContent = p.mode === "song" ? "LIGADO" : "DESLIGADO";
      $("#song-toggle").textContent = p.mode === "song" ? "DESLIGAR SONG" : "LIGAR SONG";
      const cur = this.seq.playing && p.mode === "song" ? this.seq.songStep : -1;
      $("#song-list").innerHTML = p.song.steps.map((st, i) => `
        <div class="song-step${i === cur ? " now" : ""}">
          <span class="ss-n">${pad2(i + 1)}</span>
          <label>SEG <input type="number" min="1" max="99" value="${st.seg + 1}" data-i="${i}" data-f="seg"></label>
          <label>VEZES <input type="number" min="1" max="99" value="${st.reps}" data-i="${i}" data-f="reps"></label>
          <span class="ss-info">${RJ.segment(p, st.seg).bars} comp.</span>
          <button class="mini warn" data-del="${i}" aria-label="Remover passo">X</button>
        </div>`).join("") || `<p class="note">Nenhum passo. Use + PASSO.</p>`;
    }

    renderSound() {
      const i = this.sel;
      if (i < 0) return;
      const s = this.p.sounds[i];
      $("#snd-slot").textContent = soundLabel(i);
      const nm = $("#snd-name");
      if (document.activeElement !== nm) nm.value = s.name || "";
      $("#snd-secs").textContent = RJ.soundSeconds(s).toFixed(2) + " s";
      $("#trim-start").value = Math.round(s.startF * 1000);
      $("#trim-end").value = Math.round(s.endF * 1000);
      $("#snd-rev").classList.toggle("on", !!s.reverse);
      $("#sel-label").textContent = soundLabel(i) + " " + (s.name || "");
      this.drawWave();
    }

    drawWave() {
      const cv = $("#wave");
      if (!cv) return;
      const w = cv.clientWidth || 600;
      const dpr = window.devicePixelRatio || 1;
      cv.width = Math.round(w * dpr);
      cv.height = Math.round(120 * dpr);
      const g = cv.getContext("2d");
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      const h = 120;
      const css = getComputedStyle(document.documentElement);
      g.fillStyle = css.getPropertyValue("--lcd-bg").trim() || "#9cad4a";
      g.fillRect(0, 0, w, h);
      const s = this.p.sounds[this.sel];
      g.fillStyle = css.getPropertyValue("--lcd-ink").trim() || "#1d2610";
      if (!s || !s.pcm) {
        g.font = "14px 'Share Tech Mono', monospace";
        g.fillText("SLOT VAZIO", 12, h / 2 + 5);
        return;
      }
      const d = s.pcm;
      const step = d.length / w;
      for (let x = 0; x < w; x++) {
        let mn = 1, mx = -1;
        const a = Math.floor(x * step), b = Math.min(d.length, Math.floor((x + 1) * step) + 1);
        for (let j = a; j < b; j++) { if (d[j] < mn) mn = d[j]; if (d[j] > mx) mx = d[j]; }
        g.fillRect(x, (1 - mx) * h / 2, 1, Math.max(1, (mx - mn) * h / 2));
      }
      // areas cortadas
      g.fillStyle = "rgba(20, 28, 10, 0.55)";
      g.fillRect(0, 0, s.startF * w, h);
      g.fillRect(s.endF * w, 0, w - s.endF * w, h);
      g.fillStyle = "#c0281c";
      g.fillRect(s.startF * w - 1, 0, 2, h);
      g.fillRect(s.endF * w - 1, 0, 2, h);
    }

    renderMemory() {
      const lim = this.p.settings.memLimit;
      $("#memory").innerHTML = RJ.BANKS.map((b, i) => {
        const u = RJ.bankUsage(this.p, i);
        const pct = lim ? Math.min(100, u / RJ.BANK_SECONDS * 100) : Math.min(100, u / 10 * 100);
        return `<div class="mem"><span>BANCO ${b}</span><div class="mem-bar"><i style="width:${pct}%"></i></div><span>${u.toFixed(2)}${lim ? " / 2.50" : ""} s</span></div>`;
      }).join("");
    }

    renderTransport() {
      $("#btn-run").classList.toggle("on", this.seq.playing);
      $("#btn-rec").classList.toggle("on", this.seq.recArmed);
      $("#btn-rec").classList.toggle("live", this.seq.recording);
      this.renderLCD();
      this.renderSong();
      this.renderLED();
    }

    renderLED() {
      const p = this.p;
      let txt, cap;
      if (p.mode === "song") {
        const st = this.seq.playing ? this.seq.songStep : 0;
        txt = pad2(Math.min(99, st + 1));
        cap = "SONG";
      } else {
        txt = pad2(p.curSeg + 1);
        cap = "SEG";
      }
      $("#led").textContent = txt;
      $("#led-cap").textContent = cap;
    }

    renderLEDs() {
      const on = {
        mix: this.sliderMode === "mix", tune: this.sliderMode === "tune" || this.sliderMode === "decay",
        mpitch: this.sliderMode === "mpitch", mlevel: this.sliderMode === "mlevel",
        segment: this.param === "segment", tempo: this.param === "tempo", swing: this.param === "swing",
        ac: this.param === "ac", length: this.param === "length", metronome: this.param === "metronome",
        copy: this.param === "copy", song: this.p.mode === "song",
        sample: this.sampler.state !== "off", reverse: this.sel >= 0 && !!this.p.sounds[this.sel].reverse,
      };
      $$("[data-led]").forEach(b => b.classList.toggle("on", !!on[b.dataset.led]));
    }

    /* ----- LCD */

    lcd(a, b) {
      $("#lcd1").textContent = (a || "").slice(0, 20);
      $("#lcd2").textContent = (b || "").slice(0, 20);
    }

    flash(a, b, ms = 1400) {
      this.flashUntil = performance.now() + ms;
      this.lcd(a, b);
      clearTimeout(this.flashTimer);
      this.flashTimer = setTimeout(() => { this.flashUntil = 0; this.renderLCD(); }, ms);
    }

    renderLCD() {
      if (performance.now() < this.flashUntil) return;
      const p = this.p;
      const def = this.params()[this.param];
      const seg = RJ.segment(p, p.curSeg);
      if (this.param !== "segment" && def) {
        let val;
        if (this.entry) val = this.entry + "_";
        else if (def.list) val = def.list[def.get()] || "";
        else val = def.fmt(def.get());
        this.lcd(def.label, val + (def.commit ? "  ENTER" : ""));
        return;
      }
      if (this.entry) { this.lcd("SEGMENTO", this.entry + "_  ENTER"); return; }
      let l1;
      if (this.seq.playing && this.pos) {
        const bar = Math.floor(this.pos.step / 16) + 1;
        const beat = Math.floor((this.pos.step % 16) / 4) + 1;
        const segN = this.pos.seg + 1;
        l1 = (p.mode === "song" ? "SONG S" + pad2(segN) : "SEG " + pad2(segN)) + "  " + bar + "." + beat + (this.seq.recording ? " REC" : "");
      } else if (p.mode === "song") {
        l1 = "SONG  " + p.song.steps.length + " PASSOS";
      } else {
        l1 = "SEG " + pad2(p.curSeg + 1) + "  " + seg.bars + (seg.bars === 1 ? " COMP" : " COMPS") + (this.seq.recArmed ? " REC" : "");
      }
      const l2 = p.tempo.toFixed(1) + " " + RJ.AUTO_CORRECT[p.ac].label + " SW" + p.swing;
      this.lcd(l1, l2);
    }

    tab(name) {
      $$(".tabs [data-tab]").forEach(b => b.classList.toggle("active", b.dataset.tab === name));
      $$(".drawer .panel").forEach(pn => pn.classList.toggle("active", pn.id === "tab-" + name));
      if (name === "sound") { this.renderSound(); this.renderMemory(); }
    }
  }

  RJ.App = App;
  window.addEventListener("DOMContentLoaded", () => {
    const app = new App();
    RJ.app = app;
    app.build();
  });
})();
