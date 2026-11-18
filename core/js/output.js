/* DCX Audio - saida comum
 *
 * Um AudioContext so para a pagina e um limitador no fim, antes da saida da
 * placa. Cada aparelho entra nele pelo host (host.output(id)), com ganho 1.
 */
window.RJ = window.RJ || {};

(function () {
  "use strict";
  const RJ = window.RJ;

  RJ.makeLimiter = function (ctx) {
    // saturacao suave so perto de 0 dBFS, para os aparelhos juntos nao estourarem
    const lim = ctx.createWaveShaper();
    const curve = new Float32Array(2048);
    for (let i = 0; i < curve.length; i++) {
      const x = (i / (curve.length - 1)) * 2 - 1, a = Math.abs(x);
      curve[i] = a < 0.7 ? x : Math.sign(x) * (0.7 + 0.28 * Math.tanh((a - 0.7) / 0.28));
    }
    lim.curve = curve;
    return lim;
  };

  /**
   * Tipo da sessao de audio do iPhone (Safari 16.4+): "playback" toca mesmo com a
   * chave de silencioso; "play-and-record" enquanto o microfone esta aberto.
   * Onde nao existe, nao faz nada.
   */
  RJ.setAudioSession = function (type) {
    try { if (navigator.audioSession) navigator.audioSession.type = type; } catch (e) { /* sem suporte */ }
  };

  RJ.Output = class {
    constructor() {
      this.ctx = null; this.limiter = null;
      // quem cria a saida diz se a maquina esta ligada (o host troca por () => host.on)
      this.active = () => true;
    }
    ensure() {
      if (!this.ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        this.ctx = new AC({ latencyHint: "interactive" });
        this.limiter = RJ.makeLimiter(this.ctx);
        this.limiter.connect(this.ctx.destination);
        RJ.setAudioSession("playback");
        this.watch(this.ctx);
      }
      this.wake();
      return this.ctx;
    }
    /** Religa o contexto se nao estiver tocando ("suspended" ou o "interrupted" do iPhone). */
    wake() {
      const c = this.ctx;
      if (!c || c.state === "running" || c.state === "closed") return;
      try { const p = c.resume(); if (p && p.catch) p.catch(() => {}); } catch (e) { /* tenta no proximo */ }
    }
    /** Uma vez por contexto: volta o som ao voltar para a pagina, ao mudar o estado e no proximo toque ou tecla. */
    watch(ctx) {
      if (ctx.rjWatched) return;
      ctx.rjWatched = true;
      const retry = () => { if (this.ctx === ctx && this.active()) this.wake(); };
      document.addEventListener("visibilitychange", () => { if (!document.hidden) retry(); });
      window.addEventListener("pageshow", retry);
      // com atraso: ao trocar a saida (setSinkId) o contexto para por um instante, e um resume() no meio da troca
      // deixava o contexto "running" com o relogio parado (sem som); esperar a troca acabar evita isso
      if (ctx.addEventListener) ctx.addEventListener("statechange", () => { if (!document.hidden) setTimeout(retry, 400); });
      const opt = { capture: true, passive: true };
      ["pointerdown", "touchend", "keydown"].forEach(t => document.addEventListener(t, retry, opt));
    }
    get ready() { return !!this.ctx; }
  };
})();
