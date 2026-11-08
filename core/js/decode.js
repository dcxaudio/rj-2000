/* DCX Audio - decodificacao de audio
 *
 * WAV, MP3, AIFF ou o que o navegador abrir -> { raw: Float32Array mono, rate }.
 * Usa RJ.dsp.toMono (dsp.js).
 */
window.RJ = window.RJ || {};

RJ.decodeAudio = function (ctx, arrayBuffer) {
  return new Promise((resolve, reject) => {
    ctx.decodeAudioData(arrayBuffer.slice(0), b => resolve({ raw: RJ.dsp.toMono(b), rate: b.sampleRate }), reject);
  });
};
