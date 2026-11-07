/* RJ-2000 - projeto: sons, segmentos, songs, mixes e armazenamento
 *
 * Segue a organizacao do SP-1200:
 * - 32 sons (A1 a D8), guardados em 12 bits / 26,04 kHz.
 * - Memoria de 10 s, dividida em 4 bancos de 2,5 s.
 * - 100 segmentos (00 a 99), cada um com compasso, tamanho e tempo proprios.
 * - 100 songs (00 a 99), cada uma com tempo e mix proprios.
 * - Mix por som e 8 mixes guardados.
 */
window.RJ = window.RJ || {};

RJ.PPQ = 96;            // pulsos por seminima (o swing de 54..71% precisa de 48 ou mais em 1/16)
RJ.SEGMENTS = 100;
RJ.SONGS = 100;
RJ.RATE = 26040;        // taxa de amostragem do SP-1200
RJ.BITS = 12;
RJ.BANK_SECONDS = 2.5;       // SP-1200 original (10 s no total); o padrao e Sample Time = 20 s, 5 s por banco
RJ.BANKS = ["A", "B", "C", "D"];
RJ.TUNE_RANGE = 7;      // +/- 7 semitons (uma quinta)
RJ.DENOMS = [4, 8, 16, 32];

RJ.AUTO_CORRECT = [
  { label: "1/4", ticks: 96 },
  { label: "1/4T", ticks: 64 },
  { label: "1/8", ticks: 48, swing: true },
  { label: "1/8T", ticks: 32 },
  { label: "1/16", ticks: 24, swing: true },
  { label: "1/16T", ticks: 16 },
  { label: "1/32", ticks: 12 },
  { label: "1/32T", ticks: 8 },
  { label: "Hi-Res", ticks: 4 },   // tercina de 1/64
];
RJ.METRONOME = [{ label: "Off", ticks: 0 }].concat(RJ.AUTO_CORRECT.slice(0, 8));
RJ.SWING = [50, 54, 58, 63, 67, 71];

RJ.soundLabel = i => RJ.BANKS[Math.floor(i / 8)] + ((i % 8) + 1);

/* ---------------------------------------------------------------- fabrica */

RJ.newSound = function (index) {
  return {
    id: index, name: "", pcm: null,
    start: 0, end: 0, loop: null,   // em amostras (truncate/loop do SET-UP 19)
    tune: 0, decay: 31,             // tune em semitons; decay 0-31 (31 = sem decay)
    mode: "tune",                   // o slider controla "tune" ou "decay" (SET-UP 18)
    channel: index % 8,             // canal de saida 0-7 (SET-UP 17)
    ver: 0,
  };
};

RJ.newSegment = function (tempo) {
  return { num: 4, den: 4, bars: 2, beats: 0, tempo: tempo || 120, events: [], ver: 0 };
};

RJ.newSong = function (tempo, mix) {
  return { tempo: tempo || 120, mix: (mix || new Array(32).fill(0.8)).slice(), first: 1, steps: [] };
};

RJ.createProject = function () {
  return {
    format: "rj2000", version: 2,
    mode: "segment",          // segment | song
    curSeg: 0, curSong: 0,
    segments: new Array(RJ.SEGMENTS).fill(null),
    songs: new Array(RJ.SONGS).fill(null),
    mix: new Array(32).fill(0.8),
    mixes: new Array(8).fill(null),
    multi: null,              // { type: "pitch" | "level", src }
    multiPitch: [7, 5, 4, 2, 0, -1, -3, -5],          // esquerda = mais agudo (escala diatonica)
    multiLevel: [0.13, 0.25, 0.38, 0.5, 0.63, 0.75, 0.88, 1],
    swing: 50, ac: 0, metronome: 1,
    dynamic: false, dynAlloc: false,
    midi: { channel: 1, mode: "omni" },
    masterVol: 0.75, metVol: 0.5,
    sample: { gain: 0, fine: 0.5, threshold: 0.1, length: 5, slot: 0 },
    memory: 20,               // tempo total de sample: 20 s (reedicao) ou 10 s (SP-1200 original, SET-UP 23 > Sample Time)
    defaultTempo: 120,
    sounds: Array.from({ length: 32 }, (_, i) => RJ.newSound(i)),
  };
};

RJ.segment = function (p, i) {
  if (!p.segments[i]) p.segments[i] = RJ.newSegment(p.defaultTempo);
  return p.segments[i];
};

RJ.song = function (p, i) {
  if (!p.songs[i]) p.songs[i] = RJ.newSong(p.defaultTempo, p.mix);
  return p.songs[i];
};

RJ.isEmptySeg = function (p, i) { const s = p.segments[i]; return !s || !s.events.length; };

/** Pulsos de um tempo (denominador) e de um compasso. */
RJ.beatTicks = seg => RJ.PPQ * 4 / seg.den;
RJ.barTicks = seg => seg.num * RJ.beatTicks(seg);
RJ.segTicks = seg => Math.max(1, (seg.bars * seg.num + seg.beats) * RJ.beatTicks(seg));

/** Mix em uso: no song mode, o da song; no segment mode, o mix de trabalho. */
RJ.workMix = function (p) { return p.mode === "song" ? RJ.song(p, p.curSong).mix : p.mix; };

/* ---------------------------------------------------------------- sons e memoria */

RJ.soundSeconds = s => (s.pcm ? s.pcm.length / RJ.RATE : 0);
RJ.bankUsage = function (p, bank) {
  let t = 0;
  for (let i = bank * 8; i < bank * 8 + 8; i++) t += RJ.soundSeconds(p.sounds[i]);
  return t;
};
/** Memoria de um banco: 2,5 s (SP-1200, 10 s no total) ou 5 s (20 s, como na reedicao da Rossum). */
RJ.bankSeconds = p => (p.memory === 20 ? 5 : 2.5);
RJ.bankFree = (p, bank, except) => Math.max(0, RJ.bankSeconds(p) - RJ.bankUsage(p, bank) + (except != null ? RJ.soundSeconds(p.sounds[except]) : 0));

/**
 * Coloca audio num slot: converte para 26,04 kHz / 12 bits e respeita a memoria
 * livre do banco (corta o final se nao couber). Retorna { seconds, cut }.
 */
RJ.SPEED_45 = 45 / (100 / 3);                    // 1,35: disco de 33 tocado em 45 RPM
RJ.TUNE_45 = -12 * Math.log2(RJ.SPEED_45);        // -5,2 semitons devolvem a altura original

/** Tira o silencio do inicio (deixa 2 ms antes do primeiro som). */
RJ.trimLeading = function (raw, rate) {
  let pk = 0;
  for (let i = 0; i < raw.length; i++) { const a = Math.abs(raw[i]); if (a > pk) pk = a; }
  const thr = Math.max(0.004, pk * 0.02);
  let st = 0;
  while (st < raw.length && Math.abs(raw[st]) < thr) st++;
  st = Math.max(0, st - Math.floor(rate * 0.002));
  return st > 0 && st < raw.length - 1 ? raw.subarray(st) : raw;
};

/**
 * opts.speed: 1,35 = macete dos 45 RPM. O som entra acelerado (ocupa menos
 * memoria) e com tune -5,2 para voltar a altura original.
 */
RJ.assignSound = function (p, index, raw, rawRate, name, opts = {}) {
  const bank = Math.floor(index / 8);
  const free = RJ.bankFree(p, bank, index);
  const speed = opts.speed || 1;
  if (opts.trim !== false) raw = RJ.trimLeading(raw, rawRate);
  // acelerar = tratar o audio como se tivesse sido gravado numa taxa maior
  let pcm = RJ.dsp.process(raw, rawRate * speed, RJ.RATE, RJ.BITS);
  const max = Math.floor(free * RJ.RATE);
  const cut = pcm.length > max;
  if (cut) pcm = pcm.slice(0, max);
  // corte no meio da onda estala: fade curto no fim cortado
  RJ.fadeEdges(pcm, opts.fadeIn || 0, cut || opts.fadeOut ? (opts.fadeOut || 0.004) : 0);
  const old = p.sounds[index];
  const snd = RJ.newSound(index);
  snd.ver = old.ver + 1;
  snd.channel = old.channel;
  snd.mode = old.mode;
  snd.name = (name || "").slice(0, 16);
  snd.pcm = pcm.length >= 2 ? pcm : null;
  snd.end = snd.pcm ? snd.pcm.length : 0;
  if (speed !== 1) { snd.tune = -12 * Math.log2(speed); snd.mode = "tune"; }
  p.sounds[index] = snd;
  return { seconds: RJ.soundSeconds(snd), cut };
};

/** Fade linear de entrada/saida (segundos) e volta para 12 bits. */
RJ.fadeEdges = function (pcm, fin, fout) {
  const steps = Math.pow(2, RJ.BITS - 1);
  const a = Math.min(pcm.length, Math.floor(fin * RJ.RATE)), b = Math.min(pcm.length, Math.floor(fout * RJ.RATE));
  for (let i = 0; i < a; i++) pcm[i] = Math.floor(pcm[i] * (i / a) * steps) / steps;
  for (let i = 0; i < b; i++) { const k = pcm.length - b + i; pcm[k] = Math.floor(pcm[k] * (1 - (i + 1) / b) * steps) / steps; }
};

/**
 * Cruzamento de zero mais perto do ponto i: procura para os dois lados ao mesmo
 * tempo, a partir de i, ate `win` amostras (dir = -1: so para tras; dir = 1:
 * so para frente). Entre as duas amostras do cruzamento, fica a mais perto de zero.
 * Devolve { pos, found } (found = false se nao houver cruzamento na janela).
 */
RJ.nearZero = function (raw, i, win, dir = 0) {
  i = Math.max(1, Math.min(raw.length - 1, i));
  const cross = k => k >= 1 && k < raw.length && (raw[k - 1] <= 0) !== (raw[k] <= 0);
  const pick = k => (Math.abs(raw[k - 1]) < Math.abs(raw[k]) ? k - 1 : k);
  for (let d = 0; d <= win; d++) {
    if ((dir <= 0 || !d) && cross(i - d)) return { pos: pick(i - d), found: true };
    if (dir >= 0 && d && cross(i + d)) return { pos: pick(i + d), found: true };
  }
  return { pos: i, found: false };
};

RJ.clearSound = function (p, index) {
  const old = p.sounds[index];
  const snd = RJ.newSound(index);
  snd.ver = old.ver + 1;
  snd.channel = old.channel;
  p.sounds[index] = snd;
};

/** Torna o truncate permanente: descarta o que esta fora de inicio/fim e libera memoria. */
RJ.makeTruncPermanent = function (snd) {
  if (!snd.pcm) return;
  const a = snd.start, b = snd.end;
  snd.pcm = snd.pcm.slice(a, b);
  if (snd.loop != null) snd.loop = Math.max(0, snd.loop - a);
  snd.start = 0; snd.end = snd.pcm.length;
  snd.ver++;
};

RJ.decodeAudio = function (ctx, arrayBuffer) {
  return new Promise((resolve, reject) => {
    ctx.decodeAudioData(arrayBuffer.slice(0), b => resolve({ raw: RJ.dsp.toMono(b), rate: b.sampleRate }), reject);
  });
};

RJ.loadDefaultKit = async function (p, ctx) {
  if (!RJ.DEFAULT_KIT) return;
  for (const e of RJ.DEFAULT_KIT) {
    const idx = RJ.BANKS.indexOf(e.slot[0]) * 8 + (parseInt(e.slot.slice(1), 10) - 1);
    try {
      const { raw, rate } = await RJ.decodeAudio(ctx, RJ.dsp.base64ToArrayBuffer(e.wav));
      RJ.assignSound(p, idx, raw, rate, e.name, { trim: false });
      const snd = p.sounds[idx];
      // como na maquina: pratos e hats no slider de decay, o resto em tune
      snd.mode = e.mode || (/hat|ride|crash|prato|shaker|pandeir/i.test(e.name) ? "decay" : "tune");
      if (e.tune != null) snd.tune = e.tune;   // sons gravados acelerados (macete dos 45 RPM)
    } catch (err) {
      console.warn("Falha ao carregar som padrao", e.slot, err);
    }
  }
};

/* ---------------------------------------------------------------- arquivos (DISK)
 * A maquina original salva sequencias e sons separados. Fazemos o mesmo:
 *  - .rjseq (JSON): segmentos, songs, mixes, canais e ajustes
 *  - .rjsnd (JSON): os 32 sons (PCM 12 bits a 26,04 kHz)
 * O salvamento automatico no navegador guarda os dois juntos.
 */

RJ.serializeSeq = function (p) {
  return {
    format: "rj2000-seq", version: 2,
    curSeg: p.curSeg, curSong: p.curSong, mode: p.mode,
    segments: p.segments.map(s => s ? {
      num: s.num, den: s.den, bars: s.bars, beats: s.beats, tempo: s.tempo,
      events: s.events.map(e => { const c = Object.assign({}, e); delete c.born; return c; }),
    } : null),
    songs: p.songs, mix: p.mix, mixes: p.mixes,
    multi: p.multi, multiPitch: p.multiPitch, multiLevel: p.multiLevel,
    swing: p.swing, ac: p.ac, metronome: p.metronome,
    dynamic: p.dynamic, dynAlloc: p.dynAlloc, midi: p.midi,
    masterVol: p.masterVol, metVol: p.metVol, sample: p.sample, memory: p.memory,
    assign: p.sounds.map(s => ({ channel: s.channel, mode: s.mode })),
  };
};

RJ.serializeSnd = function (p) {
  return {
    format: "rj2000-snd", version: 2, rate: RJ.RATE,
    sounds: p.sounds.map(s => s.pcm ? {
      name: s.name, pcm: RJ.dsp.floatToB64(s.pcm), start: s.start, end: s.end, loop: s.loop,
      tune: s.tune, decay: s.decay, mode: s.mode, channel: s.channel,
    } : null),
  };
};

RJ.applySeq = function (p, d) {
  if (!d || d.format !== "rj2000-seq") throw new Error("Nao e um arquivo de sequencias");
  ["curSeg", "curSong", "mode", "swing", "ac", "metronome", "dynamic", "dynAlloc", "masterVol", "metVol", "multi", "memory"].forEach(k => { if (d[k] !== undefined) p[k] = d[k]; });
  if (d.midi) p.midi = Object.assign({}, p.midi, d.midi);
  if (d.sample) p.sample = Object.assign({}, p.sample, d.sample);
  if (d.mix) p.mix = d.mix.slice(0, 32);
  if (d.mixes) p.mixes = d.mixes.slice(0, 8);
  if (d.multiPitch) p.multiPitch = d.multiPitch.slice(0, 8);
  if (d.multiLevel) p.multiLevel = d.multiLevel.slice(0, 8);
  p.segments = new Array(RJ.SEGMENTS).fill(null);
  (d.segments || []).forEach((s, i) => { if (s && i < RJ.SEGMENTS) p.segments[i] = RJ.loadSegment(s); });
  p.songs = new Array(RJ.SONGS).fill(null);
  (d.songs || []).forEach((s, i) => { if (s && i < RJ.SONGS) p.songs[i] = Object.assign(RJ.newSong(), s, { steps: (s.steps || []).slice() }); });
  (d.assign || []).forEach((a, i) => { if (a && p.sounds[i]) { p.sounds[i].channel = a.channel | 0; p.sounds[i].mode = a.mode === "decay" ? "decay" : "tune"; } });
};

RJ.loadSegment = function (s) {
  return Object.assign(RJ.newSegment(), {
    num: s.num || 4, den: s.den || 4, bars: s.bars != null ? s.bars : 2, beats: s.beats || 0, tempo: s.tempo || 120,
    events: (s.events || []).map(e => Object.assign({}, e)), ver: 0,
  });
};

RJ.applySnd = function (p, d, only) {
  if (!d || d.format !== "rj2000-snd") throw new Error("Nao e um arquivo de sons");
  (d.sounds || []).forEach((s, i) => {
    if (i >= 32 || (only != null && only !== i)) return;
    if (!s) { RJ.clearSound(p, i); return; }
    const snd = RJ.newSound(i);
    snd.ver = p.sounds[i].ver + 1;
    Object.assign(snd, { name: s.name || "", start: s.start || 0, loop: s.loop != null ? s.loop : null,
      tune: s.tune || 0, decay: s.decay != null ? s.decay : 31, mode: s.mode === "decay" ? "decay" : "tune",
      channel: s.channel != null ? s.channel : i % 8 });
    snd.pcm = RJ.dsp.b64ToFloat(s.pcm);
    snd.end = s.end || snd.pcm.length;
    p.sounds[i] = snd;
  });
};

RJ.serialize = p => JSON.stringify({ format: "rj2000", version: 2, seq: RJ.serializeSeq(p), snd: RJ.serializeSnd(p) });

RJ.deserialize = function (json) {
  const d = typeof json === "string" ? JSON.parse(json) : json;
  if (!d || d.format !== "rj2000" || d.version !== 2) throw new Error("Projeto de outra versao");
  const p = RJ.createProject();
  RJ.applySnd(p, d.snd);
  RJ.applySeq(p, d.seq);
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
  return { put, get };
})();
