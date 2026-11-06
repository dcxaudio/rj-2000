# RJ-2000

Sampler e sequenciador de 12 bits que roda no navegador, inspirado no **E-mu SP-1200**. É o primeiro instrumento da linha RJ da [DCX Audio](https://github.com/dcxaudio), um projeto open source e sem fins lucrativos de samplers e experimentos de produção musical, feito em Duque de Caxias (RJ).

**Abrir o RJ-2000:** https://dcxaudio.github.io/rj-2000 *(quando o GitHub Pages estiver ligado)*

## O que ele faz

O RJ-2000 segue o painel e o fluxo de trabalho do SP-1200: quase tudo passa por um LCD de 2 linhas e pelo teclado numérico.

- **32 sons em 4 bancos (A a D)**, em **12 bits a 26,04 kHz**, com afinação por "drop-sample" (sem interpolação) e o aliasing característico.
- **Memória limitada:** 5 segundos por banco, 20 segundos no total, como na reedição de 2021 (ou os 10 s do original).
- **8 canais**, cada um tocando um som por vez. Filtros por par de canais: dinâmico no 1-2, fixo baixo no 3-4, fixo alto no 5-6, sem filtro no 7-8. O canal de cada som é configurável.
- **Sliders** de mix por som, tune ou decay por som, multi pitch e multi level, com 8 mixes guardados.
- **100 segmentos e 100 songs**, com compasso, tamanho e tempo próprios, AUTO CORRECT de 1/4 a Hi-Res, SWING de 50% a 71%, Step Program, Copy/Append, Erase ao vivo e Tap/Repeat.
- **Song mode** editado passo a passo: repetições, mudança de tempo e de mix, subsongs e encadeamento.
- **Sampling** pelo microfone ou pela entrada de áudio, com ganho, limiar e tamanho.
- **Disk:** salva e carrega sequências e sons em arquivos separados, e carrega samples WAV, AIFF, MP3, OGG e FLAC em qualquer pad. O estado também fica salvo no navegador.
- **Teclado do computador e MIDI** (Chrome e Edge).
- **RJ-950 embaixo do SP:** um sampler de rack inspirado no **Akai S950**, como no estúdio dos anos 80 e 90. Os pads do SP tocam os samples longos do 950 (até 48 s), com início, fim, loop, tune, reverse e filtro passa-baixa. LCD de 2 x 40, knob Control e disquete para soltar arquivos.

## Como usar

Abra o link acima e aperte **LIGAR**. A máquina começa limpa: o banco A vem com um kit de bateria boom bap e os segmentos e songs vêm vazios. Para gravar, aperte **Record/Edit**, depois **Run/Stop**, e toque os pads. O manual completo está em [docs/manual.md](docs/manual.md).

Para rodar no seu computador, baixe o repositório e abra o `index.html` no navegador. Não precisa instalar nada.

## Estrutura

```
index.html          interface
css/rj2000.css      visual
js/dsp.js           reamostragem, redução para 12 bits, base64
js/engine.js        motor de áudio (canais, filtros, afinação drop-sample)
js/sequencer.js     sequenciador, auto correct, swing, song mode
js/project.js       sons, memória, segmentos, songs, mixes, arquivos
js/io.js            microfone e MIDI
js/s950.js          RJ-950: sampler de rack, memória, vozes, filtro e páginas
js/app.js           painel, LCD e páginas (Set-up, Disk, Sync, Sample)
js/kit.js           kit padrão embutido (gerado)
samples/boom-bap-01 kit padrão (banco A), WAV, CC BY 4.0 / CC0
samples/choro-01    melodias (banco B), WAV, domínio público
samples/dcx-kit-01  kit sintetizado (reserva), CC0
tools/cortar_samples.py  prepara os samples para caber em 2,5 s
tools/montar_kit.py      gera o js/kit.js a partir de uma pasta de samples
tools/gerar_kit.py       sintetiza o DCX Kit 01
docs/               manual e referências
```

Sem frameworks e sem etapa de build: HTML, CSS e JavaScript puros.

## Kit padrão

O banco A vem com o **Boom Bap 01**: 8 sons do Boom bap kit do [fingerdrum.io](https://fingerdrum.io/sample-kits) (Re: TUNES), que reúne amostras do MuldjordKit e do DRSKit (DrumGizmo, CC BY 4.0), do Virtuosity Drums e do VCSL (CC0). Os créditos completos estão em [samples/boom-bap-01/LICENSE.txt](samples/boom-bap-01/LICENSE.txt).

O banco B vem com o **Choro 01**: 8 trechos curtos de gravações de choro de 1907 a 1913 (Chiquinha Gonzaga, Irineu de Almeida e Joaquim Callado), em domínio público no Brasil e nos EUA, tirados do Wikimedia Commons. Créditos em [samples/choro-01/LICENSE.txt](samples/choro-01/LICENSE.txt). Os bancos C e D vêm vazios para os seus samples: arraste arquivos de áudio para os pads ou use Sample > pad > 8.

Os sons do banco A (menos os hats) e todos os do banco B foram gravados acelerados 1,35× e entram com tune de −5,2 semitons. É o macete clássico do SP-1200 de tocar o disco em 45 RPM e baixar a afinação na máquina: o som ocupa menos memória e ganha grão.

O **DCX Kit 01**, sintetizado do zero (CC0), continua em `samples/dcx-kit-01` como reserva (`python3 tools/montar_kit.py samples/dcx-kit-01`). A pesquisa de samples livres está em [docs/samples-livres.md](docs/samples-livres.md).

## Referências sobre o SP-1200

Não incluímos o manual original no repositório porque ele é material protegido da E-mu Systems. Para consulta:

- [Manual do E-mu SP-1200 (ManualsLib)](https://www.manualslib.com/manual/827730/E-Mu-Sp1200.html)
- [Documentação do SP-1200 da Rossum Electro-Music (reedição de 2021)](https://www.rossum-electro.com/support/documentation)

Sobre o Akai S950, que inspirou o RJ-950, veja [docs/s950-referencia.md](docs/s950-referencia.md).

## Contribuindo

Ideias, bugs e melhorias são bem-vindos nas [issues](https://github.com/dcxaudio/rj-2000/issues). Se for mexer no código, abra um pull request explicando o que mudou.

## Licença

Código sob a [GNU GPL v3.0](LICENSE). O kit padrão está sob CC BY 4.0 e CC0 (créditos em `samples/boom-bap-01/LICENSE.txt`); o DCX Kit 01 está em CC0.

SP-1200 e S950 são marcas de seus respectivos donos. O RJ-2000 e o RJ-950 são projetos independentes, sem relação com a E-mu Systems, a Creative, a Rossum Electro-Music ou a Akai.
