#!/usr/bin/env python3
"""Monta o js/kit.js (kit padrao embutido no app) a partir de uma pasta de WAVs.

Cada arquivo precisa comecar pelo slot: "A1-kick-1.wav", "B3-rim.wav"...
O nome do som vem do resto do nome do arquivo. Um kit.json opcional na pasta
define tune e modo (tune/decay) de cada slot.

Uso:
  python3 tools/montar_kit.py                      # usa samples/boom-bap-01 e samples/choro-01
  python3 tools/montar_kit.py samples/outra-pasta

O kit fica embutido em base64 para o app abrir direto do arquivo, sem servidor.
"""
import base64
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def main():
    folders = sys.argv[1:] or [os.path.join(ROOT, "samples", k) for k in ("boom-bap-01", "choro-01")]
    entries = []
    for folder in folders:
        entries += read_folder(os.path.abspath(folder))
    if not entries:
        sys.exit("Nenhum WAV com slot no nome")
    kits = ", ".join("samples/" + os.path.basename(os.path.abspath(f)) for f in folders)
    out = os.path.join(ROOT, "js", "kit.js")
    with open(out, "w") as fh:
        fh.write(f"/* Kit padrao do RJ-2000: {kits} (gerado por tools/montar_kit.py). Licencas no LICENSE.txt de cada pasta */\n")
        fh.write("window.RJ = window.RJ || {};\n")
        fh.write("RJ.DEFAULT_KIT = " + json.dumps(entries, separators=(",", ":")) + ";\n")
    print(f"{len(entries)} sons de {kits} em js/kit.js")


def read_folder(folder):
    manifest = {}
    mpath = os.path.join(folder, "kit.json")
    if os.path.exists(mpath):  # tune e modo (tune/decay) de cada slot
        with open(mpath) as fh:
            manifest = json.load(fh).get("slots", {})
    entries = []
    for f in sorted(os.listdir(folder)):
        m = re.match(r"^([A-D][1-8])-(.+)\.wav$", f, re.I)
        if not m:
            continue
        name = m.group(2).replace("-", " ").title()
        with open(os.path.join(folder, f), "rb") as fh:
            data = fh.read()
        e = {"slot": m.group(1).upper(), "name": name, "file": f}
        e.update(manifest.get(e["slot"], {}))
        e["wav"] = base64.b64encode(data).decode("ascii")
        entries.append(e)
    return entries

if __name__ == "__main__":
    main()
