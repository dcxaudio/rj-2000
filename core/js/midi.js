/* DCX Audio - entrada MIDI
 *
 * MIDI pelo navegador (Chrome, Edge e Opera; Safari e Firefox tem suporte
 * limitado). O host cria um RJ.Midi por pagina e cada mensagem segue:
 *   1. onMessage: o MIDI Learn da pagina (o host liga em learn.handle);
 *   2. os mapas padrao dos aparelhos (addDefaults), na ordem em que entraram.
 *      Um mapa devolve o texto de para onde a mensagem foi, ou nada para passar
 *      adiante. O do SP toca os 32 sons pelas notas 36-67 (js/io.js);
 *   3. se ninguem usou: "Not Mapped".
 * on("log", fn) recebe (mensagem, destino) e on("change", fn) recebe a lista de
 * entradas sempre que ela muda (ao ligar e ao plugar ou tirar um aparelho).
 */
window.RJ = window.RJ || {};

/**
 * Entradas MIDI ignoradas: o nome contem um destes textos (sem diferenca de
 * maiusculas). Sao as portas de controle de DAW, que repetem os controles em
 * outro protocolo. No Arturia Minilab3, a "MCU/HUI" manda os faders como Pitch
 * Bend nos canais 1 a 4 e os botoes como notas, e cada mensagem chegava em dobro.
 * Para ouvir tudo: RJ.MIDI_IGNORE = [] antes de ligar o MIDI.
 */
RJ.MIDI_IGNORE = ["MCU", "HUI", "DAW"];

RJ.midiIgnored = function (name, list = RJ.MIDI_IGNORE) {
  const n = String(name || "").toUpperCase();
  return list.some(t => n.includes(String(t).toUpperCase()));
};

RJ.Midi = class {
  /** opts.ignore: lista no lugar de RJ.MIDI_IGNORE (para uma pagina que precise de outra). */
  constructor(opts = {}) {
    this.access = null;
    this.ignore = opts.ignore || null;
    this.onMessage = null;
    this.defaults = [];
    this.listeners = { change: [], log: [] };
    this.inputs = [];     // nomes das entradas ouvidas
    this.ignored = [];    // nomes das entradas ignoradas
    this.failed = false;  // o navegador nao deu acesso ao MIDI
  }

  get supported() { return !!navigator.requestMIDIAccess; }

  on(type, fn) {
    (this.listeners[type] = this.listeners[type] || []).push(fn);
    return () => { this.listeners[type] = this.listeners[type].filter(f => f !== fn); };
  }

  emit(type, ...args) { (this.listeners[type] || []).forEach(fn => fn(...args)); }

  /** Mapa padrao de um aparelho: fn(d) devolve o destino (texto) ou nada. Devolve a funcao que tira. */
  addDefaults(fn) {
    this.defaults.push(fn);
    return () => { this.defaults = this.defaults.filter(f => f !== fn); };
  }

  async enable() {
    try {
      if (!this.supported) throw new Error("MIDI nao suportado neste navegador");
      if (!this.access) {
        this.access = await navigator.requestMIDIAccess({ sysex: false });
        this.access.onstatechange = () => { this.bind(); this.emit("change", this.inputs); };
      }
      this.failed = false;
      this.bind();
      this.emit("change", this.inputs);
      return this.inputs;
    } catch (e) {
      this.failed = true;
      this.emit("change", this.inputs);
      throw e;
    }
  }

  bind() {
    this.inputs = [];
    this.ignored = [];
    const list = this.ignore || RJ.MIDI_IGNORE;
    this.access.inputs.forEach(inp => {
      if (RJ.midiIgnored(inp.name, list)) {
        inp.onmidimessage = null;
        this.ignored.push(inp.name);
        return;
      }
      inp.onmidimessage = (m) => this.handle(m.data);
      this.inputs.push(inp.name);
    });
  }

  /** Cada mensagem vai primeiro para o Learn; o que ele nao usar cai nos mapas padrao. */
  handle(d) {
    if (!d || !d.length || (d[0] & 0xf0) === 0xf0) return; // clock, sysex, active sensing
    const what = this.route(d);
    this.emit("log", d, what);
  }

  route(d) {
    const used = this.onMessage && this.onMessage(d);
    if (used) return used;
    for (const fn of this.defaults) {
      const r = fn(d);
      if (r) return r;
    }
    return "Not Mapped";
  }
};
