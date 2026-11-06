#!/usr/bin/env python3
"""Corta samples para caber num banco do SP-1200 (2,5 s), a partir de um cortes.json.

Uso:
  python3 tools/cortar_samples.py samples/boom-bap-01 pasta_com_os_wavs_originais

O cortes.json da pasta do kit diz, para cada slot:
  "A1": {"src": "A1-kick.wav", "start": 0, "len": 0.34, "speed": 1.35, "name": "kick-1"}
  - src:   arquivo original (WAV 16 bits; converta FLAC/OGG antes, por exemplo com
           afconvert -f WAVE -d LEI16 entrada.ogg saida.wav)
  - start: onde comeca, em segundos. Com "auto", tira o silencio do inicio.
  - len:   quantos segundos ficam (ja acelerado). A soma do banco deve ser <= 2,5.
  - speed: 1.35 = o macete do disco em 45 RPM: o som e acelerado e o app toca
           com tune -5,2 semitons (definido no kit.json), voltando a altura original.
  - name:  nome do arquivo de saida (o slot vai na frente).
  - normalize: true sobe o volume ate perto do maximo (bom para gravacoes antigas).
Faz tambem: mono, fade de saida de 25 ms e, nos cortes com start em segundos,
fade de entrada de 3 ms.
"""
import array
import json
import os
import struct
import sys
import wave


def read_wav(path):
    b = open(path, "rb").read()
    assert b[:4] == b"RIFF" and b[8:12] == b"WAVE", path
    i, ch, sr, data = 12, 0, 0, None
    while i < len(b) - 8:
        cid, size = b[i:i + 4], struct.unpack("<I", b[i + 4:i + 8])[0]
        body = b[i + 8:i + 8 + size]
        if cid == b"fmt ":
            ch, sr = struct.unpack("<H", body[2:4])[0], struct.unpack("<I", body[4:8])[0]
            assert struct.unpack("<H", body[14:16])[0] == 16, "precisa ser 16 bits"
        elif cid == b"data":
            data = body
        i += 8 + size + (size & 1)
    a = array.array("h")
    a.frombytes(data[:len(data) // 2 * 2])
    return [sum(a[k:k + ch]) / ch for k in range(0, len(a) - ch + 1, ch)], sr


def main():
    kit, src_dir = sys.argv[1], sys.argv[2]
    spec = json.load(open(os.path.join(kit, "cortes.json")))["slots"]
    banks = {}
    for slot, c in sorted(spec.items()):
        mono, sr = read_wav(os.path.join(src_dir, c["src"]))
        auto = c.get("start", "auto") == "auto"
        if auto:
            st = next((i for i, v in enumerate(mono) if abs(v) > 300), 0)
            mono = mono[max(0, st - 8):]
        else:
            mono = mono[int(c["start"] * sr):]
        sp = c.get("speed", 1.0)
        mono = mono[:int((c["len"] * sp + 0.05) * sr)]
        if sp != 1.0:
            n2 = int(len(mono) / sp)
            out = []
            for i in range(n2):
                p = i * sp
                k = int(p)
                f = p - k
                out.append(mono[k] * (1 - f) + mono[min(len(mono) - 1, k + 1)] * f)
            mono = out
        keep = min(len(mono), int(c["len"] * sr))
        mono = mono[:keep]
        # fade de entrada so em cortes no meio da gravacao (nao amacia o ataque da bateria)
        fi, fo = (0 if auto else min(int(0.003 * sr), keep)), min(int(0.025 * sr), keep)
        for i in range(fi):
            mono[i] *= i / fi
        for i in range(fo):
            mono[keep - fo + i] *= 1 - (i + 1) / fo
        pk = max(1, max(abs(v) for v in mono))
        g = 32000 / pk if c.get("normalize") or pk > 32000 else 1.0
        pcm = array.array("h", (int(max(-32768, min(32767, round(v * g)))) for v in mono))
        name = f"{slot}-{c['name']}.wav"
        with wave.open(os.path.join(kit, name), "wb") as w:
            w.setnchannels(1)
            w.setsampwidth(2)
            w.setframerate(sr)
            w.writeframes(pcm.tobytes())
        banks[slot[0]] = banks.get(slot[0], 0) + keep / sr
        print(f"{name}: {keep / sr:.3f} s")
    for b, t in sorted(banks.items()):
        print(f"Banco {b}: {t:.2f} s" + ("  (passou de 2,5 s!)" if t > 2.5 else ""))


if __name__ == "__main__":
    main()
