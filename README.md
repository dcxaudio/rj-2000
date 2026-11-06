# RJ-2000

Sampler e sequenciador de 12 bits que roda no navegador, inspirado no **E-mu SP-1200**. É o primeiro instrumento da linha RJ da [DCX Audio](https://github.com/dcxaudio), um projeto open source e sem fins lucrativos de samplers e experimentos de produção musical, feito em Duque de Caxias (RJ).

**Abrir o RJ-2000:** https://dcxaudio.github.io/rj-2000 *(quando o GitHub Pages estiver ligado)*

## O que ele faz

- **32 sons em 4 bancos (A a D)**, 8 pads por banco, como na máquina original.
- **Som de 12 bits a 26,04 kHz**, com afinação por "drop-sample" (sem interpolação), que gera o aliasing característico do SP-1200.
- **8 canais com filtros diferentes**: canais 1 e 2 com filtro que acompanha a afinação, 3 a 6 com filtro fixo, 7 e 8 sem filtro. Cada canal toca um som por vez.
- **Memória limitada**: 2,5 segundos por banco, 10 segundos no total (pode ser desligado no SETUP).
- **Sliders com modos**: MIX, TUNE/DECAY, MULTI PITCH e MULTI LEVEL.
- **Sequenciador de segmentos**: 99 segmentos de 1 a 99 compassos, gravação em tempo real com AUTO CORRECT (1/8 a 1/32, tercinas e HI-RES), SWING de 50% a 71%, TAP/REPEAT e ERASE ao vivo.
- **Song mode**: encadeia segmentos com repetições.
- **Sampling pelo microfone**, com limiar de disparo.
- **Carregar arquivos de áudio** (WAV, AIFF, MP3, OGG, FLAC) ou arrastar o arquivo para um pad.
- **Salvar e abrir projetos** (`.rj2000.json`), com salvamento automático no navegador.
- **Exportar WAV** do segmento ou da song.
- **Teclado do computador e MIDI** (Chrome e Edge).
- **Extras**: filtro passa-baixa estilo Akai S950, resolução de 8/12/16 bits e taxas de 13 a 44,1 kHz.

## Como usar

Abra o link acima, aperte **LIGAR** e depois **RUN/STOP** para ouvir o padrão de exemplo. O guia rápido está na aba **AJUDA** e o manual completo em [docs/manual.md](docs/manual.md).

Para rodar no seu computador, baixe o repositório e abra o `index.html` no navegador. Não precisa instalar nada.

## Estrutura

```
index.html          interface
css/rj2000.css      visual
js/dsp.js           reamostragem, redução de bits, WAV
js/engine.js        motor de áudio (canais, filtros, afinação drop-sample)
js/sequencer.js     sequenciador, auto correct, swing, song mode, exportação
js/project.js       sons, memória, segmentos, salvar/abrir
js/io.js            microfone e MIDI
js/app.js           interface e controles
js/kit.js           kit padrão embutido (gerado)
samples/dcx-kit-01  kit padrão em WAV (CC0)
tools/gerar_kit.py  script que sintetiza o kit padrão
docs/               manual e referências
```

Sem frameworks e sem etapa de build: HTML, CSS e JavaScript puros.

## Kit padrão

O **DCX Kit 01** (bancos A, B e C) foi sintetizado do zero pelo script `tools/gerar_kit.py` e está em domínio público (CC0). O banco D vem vazio para os seus samples. Veja [samples/dcx-kit-01/LICENSE.txt](samples/dcx-kit-01/LICENSE.txt).

## Referências sobre o SP-1200

Não incluímos o manual original no repositório porque ele é material protegido da E-mu Systems. Para consulta:

- [Manual do E-mu SP-1200 (ManualsLib)](https://www.manualslib.com/manual/827730/E-Mu-Sp1200.html)
- [Documentação do SP-1200 da Rossum Electro-Music (reedição de 2021)](https://www.rossum-electro.com/support/documentation)

## Contribuindo

Ideias, bugs e melhorias são bem-vindos nas [issues](https://github.com/dcxaudio/rj-2000/issues). Se for mexer no código, abra um pull request explicando o que mudou.

## Licença

Código sob a [GNU GPL v3.0](LICENSE). O kit padrão está em CC0.

SP-1200 é uma marca de seus respectivos donos. O RJ-2000 é um projeto independente, sem relação com a E-mu Systems, a Creative ou a Rossum Electro-Music.
