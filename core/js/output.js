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

  RJ.Output = class {
    constructor() { this.ctx = null; this.limiter = null; }
    ensure() {
      if (!this.ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        this.ctx = new AC({ latencyHint: "interactive" });
        this.limiter = RJ.makeLimiter(this.ctx);
        this.limiter.connect(this.ctx.destination);
      }
      if (this.ctx.state === "suspended") this.ctx.resume();
      return this.ctx;
    }
    get ready() { return !!this.ctx; }
  };
})();
