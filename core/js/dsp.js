/* RJ-2000 - utilitarios de DSP e arquivos
 * Conversao para mono, reamostragem, reducao de bits (o "som" de 12 bits),
 * codificacao WAV e base64.
 */
window.RJ = window.RJ || {};

RJ.dsp = (function () {
  /** Junta os canais de um AudioBuffer em mono (Float32Array). */
  function toMono(buffer) {
    const n = buffer.length;
    if (buffer.numberOfChannels === 1) return new Float32Array(buffer.getChannelData(0));
    const out = new Float32Array(n);
    const chs = buffer.numberOfChannels;
    for (let c = 0; c < chs; c++) {
      const d = buffer.getChannelData(c);
      for (let i = 0; i < n; i++) out[i] += d[i] / chs;
    }
    return out;
  }

  /** Reamostra com interpolacao linear e um passa-baixa simples antes de
   * reduzir a taxa (o SP-1200 tinha filtro de entrada antes do conversor). */
  function resample(data, fromRate, toRate) {
    if (fromRate === toRate) return new Float32Array(data);
    let src = data;
    if (toRate < fromRate) {
      // passa-baixa de 2 polos em ~45% da nova taxa
      const fc = toRate * 0.45;
      const w = Math.tan(Math.PI * fc / fromRate);
      const k = 1 / (1 + Math.SQRT2 * w + w * w);
      const a0 = w * w * k, a1 = 2 * a0, a2 = a0;
      const b1 = 2 * (w * w - 1) * k, b2 = (1 - Math.SQRT2 * w + w * w) * k;
      src = new Float32Array(data.length);
      let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
      for (let i = 0; i < data.length; i++) {
        const x0 = data[i];
        const y0 = a0 * x0 + a1 * x1 + a2 * x2 - b1 * y1 - b2 * y2;
        src[i] = y0; x2 = x1; x1 = x0; y2 = y1; y1 = y0;
      }
    }
    const ratio = fromRate / toRate;
    const outLen = Math.max(1, Math.floor(src.length / ratio));
    const out = new Float32Array(outLen);
    for (let i = 0; i < outLen; i++) {
      const p = i * ratio;
      const i0 = Math.floor(p);
      const i1 = Math.min(src.length - 1, i0 + 1);
      const f = p - i0;
      out[i] = src[i0] * (1 - f) + src[i1] * f;
    }
    return out;
  }

  /** Reduz a resolucao para N bits (truncamento, como um conversor antigo). */
  function quantize(data, bits) {
    if (bits >= 16) {
      const out = new Float32Array(data.length);
      for (let i = 0; i < data.length; i++) out[i] = Math.max(-1, Math.min(1, data[i]));
      return out;
    }
    const steps = Math.pow(2, bits - 1);
    const out = new Float32Array(data.length);
    for (let i = 0; i < data.length; i++) {
      const v = Math.max(-1, Math.min(1, data[i]));
      out[i] = Math.floor(v * steps) / steps;
    }
    return out;
  }

  /** Processa o audio bruto para o formato do sistema (taxa + bits). */
  function process(raw, rawRate, sysRate, bits) {
    return quantize(resample(raw, rawRate, sysRate), bits);
  }

  function peak(data) {
    let m = 0;
    for (let i = 0; i < data.length; i++) { const a = Math.abs(data[i]); if (a > m) m = a; }
    return m;
  }

  /** Codifica canais Float32 em WAV PCM 16 bits. */
  function encodeWav(channels, sampleRate) {
    const numCh = channels.length;
    const len = channels[0].length;
    const buf = new ArrayBuffer(44 + len * numCh * 2);
    const v = new DataView(buf);
    const str = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
    str(0, "RIFF"); v.setUint32(4, 36 + len * numCh * 2, true); str(8, "WAVE");
    str(12, "fmt "); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, numCh, true);
    v.setUint32(24, sampleRate, true); v.setUint32(28, sampleRate * numCh * 2, true);
    v.setUint16(32, numCh * 2, true); v.setUint16(34, 16, true);
    str(36, "data"); v.setUint32(40, len * numCh * 2, true);
    let o = 44;
    for (let i = 0; i < len; i++) {
      for (let c = 0; c < numCh; c++) {
        const s = Math.max(-1, Math.min(1, channels[c][i]));
        v.setInt16(o, s < 0 ? s * 0x8000 : s * 0x7fff, true);
        o += 2;
      }
    }
    return buf;
  }

  function base64ToArrayBuffer(b64) {
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out.buffer;
  }

  function arrayBufferToBase64(ab) {
    const bytes = new Uint8Array(ab);
    let s = "";
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      s += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
    }
    return btoa(s);
  }

  /** Float32 -> base64 de Int16 (para salvar projetos). */
  function floatToB64(data) {
    const i16 = new Int16Array(data.length);
    for (let i = 0; i < data.length; i++) {
      const s = Math.max(-1, Math.min(1, data[i]));
      i16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    return arrayBufferToBase64(i16.buffer);
  }

  function b64ToFloat(b64) {
    const i16 = new Int16Array(base64ToArrayBuffer(b64));
    const out = new Float32Array(i16.length);
    for (let i = 0; i < i16.length; i++) out[i] = i16[i] / 0x8000;
    return out;
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  return { toMono, resample, quantize, process, peak, encodeWav,
           base64ToArrayBuffer, arrayBufferToBase64, floatToB64, b64ToFloat, downloadBlob };
})();
