#!/usr/bin/env python3
"""
Gera o kit padrao do RJ-2000 (DCX Kit 01) por sintese.

Todos os sons sao criados do zero por este script e liberados em CC0
(dominio publico). Saida:
  samples/dcx-kit-01/*.wav   (16-bit, mono, 26.040 Hz)
  (o js/kit.js agora e montado por tools/montar_kit.py)

Uso: python3 tools/gerar_kit.py
"""
import base64
import io
import json
import os
import wave

import numpy as np
from scipy.signal import butter, lfilter

SR = 26040
RNG = np.random.default_rng(1200)
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_DIR = os.path.join(ROOT, "samples", "dcx-kit-01")


def t_axis(dur):
    return np.arange(int(SR * dur)) / SR


def lp(x, hz, order=2):
    b, a = butter(order, min(hz, SR * 0.45) / (SR / 2), "low")
    return lfilter(b, a, x)


def hp(x, hz, order=2):
    b, a = butter(order, hz / (SR / 2), "high")
    return lfilter(b, a, x)


def bp(x, lo, hi, order=2):
    b, a = butter(order, [lo / (SR / 2), min(hi, SR * 0.45) / (SR / 2)], "band")
    return lfilter(b, a, x)


def noise(n):
    return RNG.uniform(-1, 1, n)


def sat(x, drive=1.5):
    return np.tanh(x * drive) / np.tanh(drive)


def fade(x, ms=4):
    n = min(len(x), int(SR * ms / 1000))
    if n > 0:
        x[-n:] *= np.linspace(1, 0, n)
    return x


def norm(x, peak=0.89):
    m = np.max(np.abs(x)) or 1.0
    return x / m * peak


def vinyl(x, amount=0.012):
    """Chiado leve de disco, para dar cara de sample tirado de vinil."""
    n = len(x)
    hiss = lp(hp(noise(n), 1500), 7000) * amount
    clicks = np.zeros(n)
    for _ in range(max(1, n // 9000)):
        i = RNG.integers(0, n)
        clicks[i] = RNG.uniform(-1, 1) * amount * 6
    return x + hiss + lp(clicks, 4000)


# ---------------------------------------------------------------- bateria
def kick(dur, f0, f1, drop, decay, click=0.4, drive=2.2):
    t = t_axis(dur)
    f = f1 + (f0 - f1) * np.exp(-t * drop)
    phase = 2 * np.pi * np.cumsum(f) / SR
    body = np.sin(phase) * np.exp(-t * decay)
    clk = lp(noise(len(t)), 3500) * np.exp(-t * 180) * click
    return fade(vinyl(sat(body + clk, drive)))


def snare(dur, tone, snap, decay, body_amt=0.5, color=5200):
    t = t_axis(dur)
    body = np.sin(2 * np.pi * (tone + 60 * np.exp(-t * 50)) * t) * np.exp(-t * 28)
    nz = bp(noise(len(t)), 1200, color) * np.exp(-t * decay)
    crack = hp(noise(len(t)), 2500) * np.exp(-t * 90) * snap
    return fade(vinyl(sat(body * body_amt + nz + crack, 1.8)))


def rim(dur=0.09):
    t = t_axis(dur)
    x = np.sin(2 * np.pi * 1700 * t) * 0.6 + np.sin(2 * np.pi * 820 * t) * 0.5
    x = x * np.exp(-t * 75) + bp(noise(len(t)), 2000, 6000) * np.exp(-t * 160) * 0.5
    return fade(vinyl(x))


def clap(dur=0.32):
    t = t_axis(dur)
    nz = bp(noise(len(t)), 900, 4200)
    env = np.zeros(len(t))
    for k, off in enumerate([0.0, 0.011, 0.022, 0.033]):
        tt = np.clip(t - off, 0, None)
        env += (t >= off) * np.exp(-tt * (140 if k < 3 else 22))
    return fade(vinyl(sat(nz * env, 1.6)))


def hat(dur, decay, color=7000):
    t = t_axis(dur)
    metal = sum(np.sign(np.sin(2 * np.pi * f * t)) for f in (317, 457, 593, 731, 887, 1063))
    x = hp(metal * 0.12 + noise(len(t)) * 0.7, color, 4) * np.exp(-t * decay)
    return fade(vinyl(x, 0.006))


def ride(dur=0.7):
    t = t_axis(dur)
    metal = sum(np.sin(2 * np.pi * f * t) for f in (533, 811, 1207, 1597, 2213, 3089))
    x = hp(metal * 0.2 + noise(len(t)) * 0.35, 3000, 2) * np.exp(-t * 5.5)
    x += np.sin(2 * np.pi * 2650 * t) * np.exp(-t * 30) * 0.25
    return fade(vinyl(x, 0.006))


def tom(dur, f0, decay):
    t = t_axis(dur)
    f = f0 * (1 + 0.5 * np.exp(-t * 25))
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * decay)
    x += lp(noise(len(t)), 2500) * np.exp(-t * 80) * 0.25
    return fade(vinyl(sat(x, 1.4)))


def conga(dur=0.26, f0=330):
    t = t_axis(dur)
    f = f0 * (1 + 0.25 * np.exp(-t * 60))
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 18)
    x += bp(noise(len(t)), 800, 3000) * np.exp(-t * 200) * 0.4
    return fade(vinyl(x))


def shaker(dur=0.16):
    t = t_axis(dur)
    env = np.minimum(t / 0.03, 1) * np.exp(-np.clip(t - 0.03, 0, None) * 35)
    return fade(vinyl(hp(noise(len(t)), 5000, 4) * env, 0.004))


def tamb(dur=0.24):
    t = t_axis(dur)
    jingle = sum(np.sin(2 * np.pi * f * t) for f in (5300, 6100, 7400, 8900))
    x = hp(jingle * 0.15 + noise(len(t)), 4500, 4) * np.exp(-t * 16)
    return fade(vinyl(x, 0.004))


def cowbell(dur=0.24):
    t = t_axis(dur)
    x = np.sign(np.sin(2 * np.pi * 560 * t)) * 0.5 + np.sign(np.sin(2 * np.pi * 845 * t)) * 0.5
    x = bp(x, 400, 3000) * np.exp(-t * 14)
    return fade(vinyl(x))


def snap(dur=0.1):
    t = t_axis(dur)
    x = bp(noise(len(t)), 1500, 5000) * np.exp(-t * 70)
    x += np.sin(2 * np.pi * 1900 * t) * np.exp(-t * 120) * 0.3
    return fade(vinyl(x))


# ---------------------------------------------------------------- tonal
def bass(dur, hz, cutoff, decay=3.0, sub=False):
    t = t_axis(dur)
    if sub:
        x = np.sin(2 * np.pi * hz * t) + 0.15 * np.sin(2 * np.pi * hz * 2 * t)
    else:
        saw = 2 * ((hz * t) % 1) - 1
        x = lp(saw, cutoff, 4) * 1.4
    env = np.minimum(t / 0.004, 1) * np.exp(-t * decay)
    return fade(vinyl(sat(x * env, 1.6)), 15)


def epiano(dur, notes):
    t = t_axis(dur)
    x = np.zeros(len(t))
    for hz in notes:
        mod = np.sin(2 * np.pi * hz * 14 * t) * np.exp(-t * 9) * 1.2
        x += np.sin(2 * np.pi * hz * t + mod) * np.exp(-t * 2.2)
    x = lp(x, 4500)
    return fade(vinyl(sat(x / len(notes), 1.2), 0.008), 20)


def stab(dur, notes, bright=3000, decay=9):
    t = t_axis(dur)
    x = sum(2 * ((hz * t) % 1) - 1 for hz in notes) / len(notes)
    x = lp(x, bright, 2) * np.minimum(t / 0.006, 1) * np.exp(-t * decay)
    return fade(vinyl(sat(x, 1.5), 0.008), 15)


def horn(dur, notes):
    t = t_axis(dur)
    att = np.minimum(t / 0.025, 1)
    x = sum(np.sign(np.sin(2 * np.pi * hz * t)) * 0.6 + 2 * ((hz * t) % 1) - 1 for hz in notes)
    x = bp(x / len(notes), 250, 2600) * att * np.exp(-t * 6)
    return fade(vinyl(sat(x, 1.7), 0.008), 20)


def pluck(dur, hz):
    # Karplus-Strong simples
    n = int(SR * dur)
    period = int(SR / hz)
    buf = noise(period)
    out = np.zeros(n)
    for i in range(n):
        v = buf[i % period]
        out[i] = v
        buf[i % period] = 0.5 * (v + buf[(i + 1) % period]) * 0.996
    return fade(vinyl(lp(out, 5000)), 15)


def hz(note):
    names = {"C": 0, "C#": 1, "D": 2, "D#": 3, "E": 4, "F": 5, "F#": 6, "G": 7, "G#": 8, "A": 9, "A#": 10, "B": 11}
    return 440.0 * 2 ** ((names[note[:-1]] + 12 * (int(note[-1]) + 1) - 69) / 12)


KIT = [
    # Banco A - bateria
    ("A1", "Kick Boom", lambda: kick(0.42, 150, 48, 28, 7.5, 0.5, 2.4)),
    ("A2", "Kick Dusty", lambda: lp(kick(0.36, 120, 55, 35, 9.0, 0.3, 3.0), 2500)),
    ("A3", "Snare Crack", lambda: snare(0.28, 190, 0.9, 16)),
    ("A4", "Snare Fat", lambda: lp(snare(0.34, 165, 0.4, 11, 0.8, 4200), 6000)),
    ("A5", "Rimshot", rim),
    ("A6", "Clap", clap),
    ("A7", "Hat Fechado", lambda: hat(0.08, 55)),
    ("A8", "Hat Aberto", lambda: hat(0.38, 7.5)),
    # Banco B - percussao
    ("B1", "Ride", ride),
    ("B2", "Tom Grave", lambda: tom(0.34, 95, 9)),
    ("B3", "Tom Agudo", lambda: tom(0.28, 150, 11)),
    ("B4", "Conga", conga),
    ("B5", "Shaker", shaker),
    ("B6", "Pandeirola", tamb),
    ("B7", "Cowbell", cowbell),
    ("B8", "Snap", snap),
    # Banco C - tonal
    ("C1", "Baixo Mi", lambda: bass(0.34, hz("E1"), 700)),
    ("C2", "Baixo Sub La", lambda: bass(0.34, hz("A1"), 0, 3.2, True)),
    ("C3", "Rhodes Dm9", lambda: epiano(0.48, [hz(n) for n in ("D3", "F3", "A3", "C4", "E4")])),
    ("C4", "Rhodes Gm7", lambda: epiano(0.4, [hz(n) for n in ("G2", "A#3", "D4", "F4")])),
    ("C5", "Stab Synth", lambda: stab(0.24, [hz(n) for n in ("C3", "D#3", "G3", "A#3")])),
    ("C6", "Metais", lambda: horn(0.26, [hz(n) for n in ("F3", "A3", "C4")])),
    ("C7", "Pluck", lambda: pluck(0.22, hz("A3"))),
    ("C8", "Stab Grave", lambda: stab(0.2, [hz(n) for n in ("C2", "G2", "C3")], 1400, 12)),
]


def to_wav_bytes(x):
    pcm = np.clip(np.round(x * 32767), -32768, 32767).astype("<i2")
    bio = io.BytesIO()
    with wave.open(bio, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())
    return bio.getvalue()


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    entries = []
    banks = {}
    for slot, name, fn in KIT:
        x = norm(np.asarray(fn(), dtype=np.float64))
        data = to_wav_bytes(x)
        fname = f"{slot}-{name.lower().replace(' ', '-')}.wav"
        with open(os.path.join(OUT_DIR, fname), "wb") as f:
            f.write(data)
        banks[slot[0]] = banks.get(slot[0], 0) + len(x) / SR
        entries.append({"slot": slot, "name": name, "file": fname,
                        "wav": base64.b64encode(data).decode("ascii")})
    # para usar este kit no app: python3 tools/montar_kit.py samples/dcx-kit-01
    for b, secs in banks.items():
        print(f"Banco {b}: {secs:.2f} s")
    print(f"{len(entries)} sons gerados")


if __name__ == "__main__":
    main()
