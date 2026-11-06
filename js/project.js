/* RJ-2000 - projeto (sons, segmentos, song), memoria e armazenamento */
window.RJ = window.RJ || {};

RJ.PPQ = 96;                 // resolucao do sequenciador (pulsos por seminima)
RJ.SEGMENTS = 99;
RJ.BANK_SECONDS = 2.5;       // SP-1200: 10 s no total, 2,5 s por banco
RJ.BANKS = ["A", "B", "C", "D"];

RJ.AUTO_CORRECT = [
  { label: "1/8", ticks: 48, swing: true },
  { label: "1/8T", ticks: 32 },
  { label: "1/16", ticks: 24, swing: true },
  { label: "1/16T", ticks: 16 },
  { label: "1/32", ticks: 12 },
  { label: "1/32T", ticks: 8 },
  { label: "HI-RES", ticks: 1 },
];
RJ.SWING = [50, 54, 58, 63, 67, 71];

RJ.newSound = function (index) {
  return {
    id: index, name: "", raw: null, rawRate: 0,
    pcm: null, rate: 26040,
    startF: 0, endF: 1, reverse: false,
    tune: 0, decay: 1, ver: 0,
  };
};

RJ.newSegment = function () {
  return { bars: 2, events: [], ver: 0 };
};

RJ.createProject = function () {
  return {
    format: "rj2000", version: 1,
    name: "SEM TITULO",
    tempo: 92.0,
    swing: 50,
    ac: 2,                     // indice em RJ.AUTO_CORRECT (1/16)
    metronome: "rec",          // off | rec | on
    curSeg: 0,
    mode: "segment",           // segment | song
    segments: new Array(RJ.SEGMENTS).fill(null),
    song: { steps: [{ seg: 0, reps: 2 }] },
    levels: new Array(8).fill(0.8),
    multiPitch: [-7, -5, -3, -2, 0, 2, 3, 5],
    multiLevel: [0.13, 0.25, 0.38, 0.5, 0.63, 0.75, 0.88, 1],
    sounds: Array.from({ length: 32 }, (_, i) => RJ.newSound(i)),
    settings: {
      bits: 12, rate: 26040,
      s950: false, s950Cut: 99, outDb: 0,
      memLimit: true, tuneRange: 12, dynamic: false,
    },
  };
};

RJ.segment = function (p, i) {
  if (!p.segments[i]) p.segments[i] = RJ.newSegment();
  return p.segments[i];
};

RJ.segTicks = function (seg) { return seg.bars * 4 * RJ.PPQ; };

/* ---------------------------------------------------------------- sons */

RJ.soundSeconds = function (snd) {
  if (!snd.pcm) return 0;
  return (snd.endF - snd.startF) * snd.pcm.length / snd.rate;
};

RJ.bankUsage = function (p, bank) {
  let s = 0;
  for (let i = bank * 8; i < bank * 8 + 8; i++) s += RJ.soundSeconds(p.sounds[i]);
  return s;
};

/** Reprocessa um som a partir do audio bruto (taxa e bits do sistema). */
RJ.processSound = function (p, snd) {
  if (!snd.raw) { snd.pcm = null; return; }
  snd.rate = p.settings.rate;
  snd.pcm = RJ.dsp.process(snd.raw, snd.rawRate, snd.rate, p.settings.bits);
  snd.ver++;
};

/**
 * Coloca audio bruto num slot. Respeita o limite de memoria do banco,
 * cortando o final se precisar. Retorna { seconds, cut }.
 */
RJ.assignSound = function (p, index, raw, rawRate, name) {
  const snd = p.sounds[index];
  snd.raw = raw; snd.rawRate = rawRate; snd.name = (name || "").toUpperCase().slice(0, 12);
  snd.startF = 0; snd.endF = 1; snd.reverse = false; snd.tune = 0; snd.decay = 1;
  RJ.processSound(p, snd);
  let cut = false;
  if (p.settings.memLimit) {
    const bank = Math.floor(index / 8);
    const others = RJ.bankUsage(p, bank) - RJ.soundSeconds(snd);
    const free = Math.max(0, RJ.BANK_SECONDS - others);
    const secs = RJ.soundSeconds(snd);
    if (secs > free) {
      snd.endF = Math.max(0.001, free / secs);
      cut = true;
    }
  }
  return { seconds: RJ.soundSeconds(snd), cut };
};

RJ.clearSound = function (p, index) {
  const old = p.sounds[index];
  const snd = RJ.newSound(index);
  snd.ver = old.ver + 1;
  p.sounds[index] = snd;
};

RJ.reprocessAll = function (p) {
  p.sounds.forEach(s => RJ.processSound(p, s));
};

/** Decodifica um arquivo de audio (ArrayBuffer) para mono bruto. */
RJ.decodeAudio = function (ctx, arrayBuffer) {
  return new Promise((resolve, reject) => {
    ctx.decodeAudioData(arrayBuffer.slice(0), b => resolve({ raw: RJ.dsp.toMono(b), rate: b.sampleRate }), reject);
  });
};

RJ.loadDefaultKit = async function (p, ctx) {
  if (!RJ.DEFAULT_KIT) return;
  for (const e of RJ.DEFAULT_KIT) {
    const bank = RJ.BANKS.indexOf(e.slot[0]);
    const idx = bank * 8 + (parseInt(e.slot.slice(1), 10) - 1);
    try {
      const { raw, rate } = await RJ.decodeAudio(ctx, RJ.dsp.base64ToArrayBuffer(e.wav));
      RJ.assignSound(p, idx, raw, rate, e.name);
    } catch (err) {
      console.warn("Falha ao carregar som padrao", e.slot, err);
    }
  }
};

/** Padrao de demonstracao (boom bap simples a 92 BPM) no segmento 1. */
RJ.loadDemoPattern = function (p) {
  const seg = RJ.segment(p, 0);
  seg.bars = 2;
  const s16 = 24;
  const add = (snd, steps) => steps.forEach(st => seg.events.push({ t: st * s16, s: snd }));
  // kick, snare e hats em 2 compassos (32 semicolcheias)
  add(0, [0, 7, 10, 16, 23, 26, 27]);
  add(2, [4, 12, 20, 28]);
  add(3, [12, 31]);
  add(6, [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28]);
  add(7, [30]);
  add(16, [0, 16]);
  add(17, [10, 26]);
  add(18, [0]);
  add(19, [16]);
  p.swing = 58;
  // swing nos contratempos de semicolcheia
  seg.events.forEach(e => {
    const idx = e.t / s16;
    if (idx % 2 === 1) e.t += Math.round(s16 * (2 * p.swing / 100 - 1));
  });
  seg.events.sort((a, b) => a.t - b.t);
  seg.ver++;
};

/* ---------------------------------------------------------------- serializacao */

RJ.serialize = function (p) {
  return JSON.stringify({
    format: "rj2000", version: 1, name: p.name,
    tempo: p.tempo, swing: p.swing, ac: p.ac, metronome: p.metronome,
    curSeg: p.curSeg, mode: p.mode,
    segments: p.segments.map(s => s ? {
      bars: s.bars,
      events: s.events.map(e => { const c = Object.assign({}, e); delete c.born; return c; }),
    } : null),
    song: p.song, levels: p.levels, multiPitch: p.multiPitch, multiLevel: p.multiLevel,
    settings: p.settings,
    sounds: p.sounds.map(s => s.raw ? {
      name: s.name, rawRate: s.rawRate, raw: RJ.dsp.floatToB64(s.raw),
      startF: s.startF, endF: s.endF, reverse: s.reverse, tune: s.tune, decay: s.decay,
    } : null),
  });
};

RJ.deserialize = function (json) {
  const d = typeof json === "string" ? JSON.parse(json) : json;
  if (!d || d.format !== "rj2000") throw new Error("Arquivo nao e um projeto RJ-2000");
  const p = RJ.createProject();
  ["name", "tempo", "swing", "ac", "metronome", "curSeg", "mode"].forEach(k => { if (d[k] != null) p[k] = d[k]; });
  if (d.levels) p.levels = d.levels.slice(0, 8);
  if (d.multiPitch) p.multiPitch = d.multiPitch.slice(0, 8);
  if (d.multiLevel) p.multiLevel = d.multiLevel.slice(0, 8);
  if (d.song && Array.isArray(d.song.steps)) p.song = { steps: d.song.steps.map(s => ({ seg: s.seg | 0, reps: Math.max(1, s.reps | 0) })) };
  Object.assign(p.settings, d.settings || {});
  (d.segments || []).forEach((s, i) => {
    if (s && i < RJ.SEGMENTS) p.segments[i] = { bars: s.bars || 2, events: (s.events || []).map(e => Object.assign({}, e)), ver: 0 };
  });
  (d.sounds || []).forEach((s, i) => {
    if (!s || i >= 32) return;
    const snd = p.sounds[i];
    snd.name = s.name || ""; snd.rawRate = s.rawRate; snd.raw = RJ.dsp.b64ToFloat(s.raw);
    snd.startF = s.startF ?? 0; snd.endF = s.endF ?? 1; snd.reverse = !!s.reverse;
    snd.tune = s.tune ?? 0; snd.decay = s.decay ?? 1;
    RJ.processSound(p, snd);
  });
  return p;
};

/* ---------------------------------------------------------------- armazenamento local (IndexedDB) */

RJ.store = (function () {
  const DB = "rj2000", STORE = "projects";
  function open() {
    return new Promise((resolve, reject) => {
      if (!window.indexedDB) return reject(new Error("IndexedDB indisponivel"));
      const req = indexedDB.open(DB, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  async function put(key, value) {
    try {
      const db = await open();
      await new Promise((res, rej) => {
        const tx = db.transaction(STORE, "readwrite");
        tx.objectStore(STORE).put(value, key);
        tx.oncomplete = res; tx.onerror = () => rej(tx.error);
      });
      return true;
    } catch (e) { console.warn("Nao foi possivel salvar no navegador", e); return false; }
  }
  async function get(key) {
    try {
      const db = await open();
      return await new Promise((res, rej) => {
        const tx = db.transaction(STORE, "readonly");
        const r = tx.objectStore(STORE).get(key);
        r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
      });
    } catch (e) { return null; }
  }
  async function del(key) {
    try {
      const db = await open();
      await new Promise((res) => { const tx = db.transaction(STORE, "readwrite"); tx.objectStore(STORE).delete(key); tx.oncomplete = res; tx.onerror = res; });
    } catch (e) {}
  }
  return { put, get, del };
})();
