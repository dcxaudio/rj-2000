# Manual do RJ-2000 (b0.1)

O RJ-2000 segue o painel e o fluxo de trabalho do E-mu SP-1200. Quase tudo passa pelo LCD de 2 linhas e 16 caracteres: você aperta um botão, digita um número e confirma. As mensagens do LCD ficam em inglês, como na máquina original.

Embaixo dele fica o **RJ-950**, um sampler de rack inspirado no Akai S950, como muita gente usava no estúdio: o SP faz a bateria e o sequenciamento, e o 950 toca os samples longos com início, fim, loop e filtro. Ele está na seção 16.

## 1. Ligando

O navegador só libera o áudio depois de um toque, por isso a máquina abre com o botão **LIGAR**. Ela mostra `Insert Diskette`, `Loading Software`, `Loading Sequences` e `Loading Sounds`, como a original. Na primeira vez carrega o kit padrão, com bateria no banco A e trechos de choro no banco B (como colocar o disquete de sons), e começa com todos os segmentos e songs vazios. Depois disso restaura o último estado salvo no navegador. Para limpar as sequências, use SET-UP 23 > Clear Seq Mem.

## 2. O teclado e o LCD

- **Teclado numérico:** de 0 a 9. O **7 também é NO** e o **9 também é YES**, como no SP-1200.
- **◀ ▶:** sobem ou descem o valor. Segurando, correm rápido.
- **Enter:** confirma ou sai da página.
- **Campos de dois dígitos pedem o zero na frente:** segmento 7 é `0` `7`.
- **Cursor piscando:** marca o dígito que você está digitando.

### Tela principal

- **Segment mode:** `Seg 00  ♩=092.0` na linha 1. Na linha 2, um gráfico de barras com os 8 sliders, o modo dos sliders e o banco.
- **Song mode:** `Song 00 ♩=120.0`. Tocando, a linha 2 mostra o passo e o segmento.
- **Trocar de segmento ou song:** digite dois números. Tocando, o segmento novo começa quando o atual termina.

## 3. Master Control

| Controle | Função |
|---|---|
| Tempo | Tempo de 40 a 240 BPM. Digite 4 números (`0` `9` `2` `5` = 92,5), use as setas ou o slider 1. Cada segmento guarda o seu tempo e cada song também. |
| ◀ ▶ | Setas. |
| Enter | Confirma ou sai. |
| Mix Volume | Volume geral. |
| Metronome Volume | Volume do metrônomo. |

## 4. Performance

- **Botão Tune/Decay / Mix / Multi Mode:** alterna o que os sliders fazem.
  - **Mix:** volume de cada **som** (os 8 do banco atual). No song mode, mexe no mix da song.
  - **Tune/Decay:** cada som usa o slider para afinação (±7 semitons) **ou** para decay, conforme o SET-UP 18. No kit padrão, A1 a A6 começam em tune com −5,2 semitons (foram gravados acelerados, o macete dos 45 RPM) e os hats A7 e A8 em decay.
  - **Multi Mode:** aparece depois do SET-UP 11 ou 12. Os sliders ajustam a afinação ou o volume de cada pad.
- **Botão A/B/C/D:** troca o banco.
- **Pads:** tocam os 8 sons do banco. Com o SET-UP 14 ligado e uma tela que mede pressão, ou um controlador MIDI, respondem à força.

## 5. Programming (segment mode)

A função de **baixo** de cada botão vale no segment mode.

| Botão | Função |
|---|---|
| Metronome | Desligado, 1/4, 1/4T, 1/8, 1/8T, 1/16, 1/16T, 1/32 ou 1/32T. Acento no tempo 1. Só com a máquina parada. |
| Swing | 50%, 54%, 58%, 63%, 67% ou 71%. É aplicado na gravação, nos contratempos de 1/8 ou 1/16. Só com a máquina parada. |
| Copy | `Copy Seg __ to Seg __` e Enter. Com origem igual ao destino, emenda o segmento nele mesmo (`Append`, de 1 a 99 vezes). É assim que se aumenta um segmento com notas. |
| Time Signature | Numerador de 01 a 99 e denominador 4, 8, 16 ou 32 (setas). |
| Segment Length | Compassos e tempos extras. Diminuir pergunta `Truncate Length?`. Aumentar um segmento com notas mostra `Use Copy to Lengthen Segment`. Num segmento vazio, aperte **Run/Stop** nesta página para dimensionar em tempo real e de novo para parar. |
| Erase | Solte o botão e escolha: toque um pad para apagar aquele som do segmento, ou digite o número de um segmento para apagá-lo inteiro. Gravando, **segure Erase e o pad**: as notas somem conforme passam. |
| Auto Correct | Quantização: 1/4, 1/4T, 1/8, 1/8T, 1/16, 1/16T, 1/32, 1/32T ou Hi-Res (tercina de 1/64). Funciona também tocando. |
| Step Program | Anda pelo segmento no passo do Auto Correct (setas, ou segure Run/Stop). Toque um pad para inserir a nota. Segure Erase e toque o pad para tirar. Mostra até 4 sons por passo. |

## 6. Transporte

| Botão | Função |
|---|---|
| Run/Stop | Toca e para. Num segmento vazio a máquina dá um bipe. |
| Record/Edit | Segment mode, parado: volta para a tela principal, conta 1 compasso com o metrônomo (`Count-In 4 3 2 1`, LED piscando) e começa a gravar sozinho. Apertar de novo durante a contagem cancela. Tocando: liga e desliga a gravação (punch in/out). Song mode: entra e sai da edição da song. |
| Tap/Repeat | Segurando junto com um pad, repete a nota no ritmo do Auto Correct (e grava, se estiver gravando). Batido sozinho, no tempo da música, define o tempo. |

Tocando no segment mode, a linha 2 do LCD mostra `Play` ou `Rec` com o compasso e o tempo (`Rec   Bar 01.3`). Ao mexer num slider, o gráfico de barras aparece por um instante.

Com a máquina tocando, a maioria das funções fica travada (bipe). Funcionam Tempo, Auto Correct, Erase ao vivo e SET-UP 11, 12 e 13.

## 7. Song mode

Aperte **Song/Segment** para trocar de modo. Digite dois números para escolher a song (00 a 99). Cada song tem o seu tempo e o seu mix.

Para editar, aperte **Record/Edit**. A linha 1 mostra `Song 00 Step 01` e a linha 2, o que há no passo.

- **Número de 2 dígitos:** coloca o segmento no passo e avança.
- **◀ ▶ ou Enter:** andam pelos passos.
- Funções de **cima** dos botões de Programming:

| Botão | Função |
|---|---|
| Trigger | Insere um passo de trigger (sem efeito no navegador). |
| Repeat | Primeiro toque: início da repetição (`\|-`). Segundo: fim, com o número de vezes (padrão 02). |
| Subsong | Toca outra song como um passo (`Subsong __`). |
| End | End de novo = parar. End e Repeat = voltar ao início. End e um número = encadear com outra song. Se houver passos depois, pergunta `End Here?`. |
| Insert | Insere um passo novo. |
| Delete | Apaga o passo. |
| Tempo Change | 1 = acelerando, 2 = ritardando. Depois `+BB/TT`: quantos BPM e em quantos tempos. |
| Mix Change | Troca para um dos 8 mixes guardados (1 a 8). |

## 8. Set-up (botão Set-up e dois números)

| Nº | Função |
|---|---|
| 11 | Multi Pitch: toque o pad do som. Os 8 pads tocam o som em afinações diferentes, o da esquerda mais agudo. Se o som estiver em decay, muda o decay. |
| 12 | Multi Level: igual, com volumes do mais fraco (esquerda) ao mais forte. |
| 13 | Sair do multi mode (`Exit Multi Mode?`). |
| 14 | Dynamic Buttons: pads sensíveis à força (Yes/No). |
| 15 | Define Mix: guarda o mix atual como mix 1 a 8. |
| 16 | Select Mix: chama um mix guardado. |
| 17 | Channel Assign: toque um pad e digite o canal de 1 a 8. |
| 18 | Decay/Tune Select: toque um pad, 1 = Tune, 2 = Decay. |
| 19 | Loop/Truncate: toque o pad. Sliders 1 e 2 = início (grosso e fino), 3 e 4 = fim, 5 e 6 = loop. Os valores aparecem em amostras. Enter pergunta `Make Truncation Permanent?`; Yes descarta o resto e libera memória. |
| 20 | Delete Sound. |
| 21 | 1st Song Step: em que passo a song começa. |
| 22 | MIDI Parameters: canal (01 a 16) e modo (1 = Omni, 2 = Poly). Também liga o MIDI do navegador. |
| 23 | Special: setas ou slider 1 percorrem a lista, Enter executa. Clear All Memory, Memory Remaining, Clear Sound Mem, Clear Seq Mem, Copy Sound, Swap Sounds, Default Decay, Name Sound (dá para digitar no teclado do computador), Sample Time (2 = 20 s, o padrão, como na reedição da Rossum; 1 = 10 s como no SP-1200 original, e para isso nenhum banco pode ter mais de 2,5 s), Dynamic Alloc. |

## 9. Colocando samples nos pads

Como no SP-1200: **um som por pad, gravado pela entrada de áudio**. No navegador, um arquivo pode fazer o papel do disco tocando na entrada:

1. **Sample > pad > 8 (Load File)**, também no celular. Aperte Sample, toque o pad de destino, aperte 8 e escolha um arquivo (WAV, MP3, AIFF, OGG, FLAC ou M4A).
2. **Arrastar o arquivo para o pad** (no computador): é o mesmo que o Sample 8 naquele pad. Só um arquivo por vez.
3. **Gravar pelo microfone**, com o Sample 7 (Arm) ou 9 (Force), veja abaixo.

Ao carregar um arquivo, o LCD pergunta `Load at 45 RPM?`:

- **Yes (9):** o som entra acelerado 1,35× e com tune de −5,2 semitons. Ele volta à altura original, ocupa uns 35% menos memória e ganha o grão do drop-sample para baixo. É o macete clássico de tocar o disco em 45 RPM e baixar a afinação no SP-1200.
- **No (7):** o som entra normal.

Depois é como gravar: o sample começa quando o som passa do limiar (o silêncio do começo fica de fora, como no Arm) e para no **Sample Length** (Sample 5) ou quando a memória do banco acaba. Se o arquivo for mais longo, o resto fica de fora e o LCD avisa `Length Reached`. Os pads de um banco dividem a mesma memória: 5 s por banco (2,5 s com Sample Time de 10 s).

Para loops e frases longas, use o **RJ-950** (seção 16): ele guarda até 48 s, e cada pad do SP pode tocar um trecho diferente do mesmo sample.

### Sample (botão Sample e um número)

Ao entrar, o LCD mostra o slot de destino (`*` = ocupado) e `8=File 7/9=Mic`. **Toque um pad para escolher o destino**; se ele já tiver som, você ouve. O microfone só é pedido quando você usa uma função de gravação.

| Nº | Função |
|---|---|
| 1 | VU Mode: ganho e medidor de entrada (com pico e marca do limiar). |
| 2 | Assign Voice: mostra o slot e o canal; toque um pad ou use as setas. |
| 4 | Threshold Set: limiar (setas ou slider 1). |
| 5 | Sample Length: de 0,1 a 5 s (2,5 s com Sample Time de 10 s), limitado pela memória livre do banco. Vale também para o Load File. |
| 7 | Arm Sampling: `Sample Armed`; a gravação começa quando o sinal passa do limiar. |
| 8 | Load File: escolhe um arquivo de áudio para o pad selecionado (seção 9). |
| 9 | Force Sampling: grava na hora. |

O knob **Gain** vai de −12 a +36 dB. Enter volta ao menu; durante a gravação, Enter para. No fim aparece `Sample is good` ou `Sample Overload`. Aperte Sample de novo para sair e desligar o microfone.

## 10. Disk (botão Disk e um número)

No navegador, o disquete é um arquivo no seu computador. Como na máquina, sequências e sons são salvos separados.

| Nº | Função |
|---|---|
| 1 | Save Sequences: baixa `rj2000-sequencias.rjseq.json` (segmentos, songs, mixes, canais e ajustes). |
| 2 | Save Sounds: baixa `rj2000-sons.rjsnd.json` (os 32 sons). |
| 3 | Load Sequences. |
| 4 | Load Segment #: carrega um segmento de um arquivo de sequências. |
| 5 | Load Sounds. |
| 6 | Load Sound #: toque um pad e escolha um arquivo de áudio (igual ao Sample 8). |
| 7 | Catalog Sequences: lista segmentos e songs (setas). |
| 8 | Catalog Sounds: lista os sons, a duração e o canal. |
| 9 | Format/Copy Software: não se aplica no navegador. |
| 0 | Load Sequences and Sounds: escolha os dois arquivos de uma vez. |

O estado da máquina também fica salvo sozinho no navegador.

## 11. Sync

Só **1 Internal** funciona por enquanto. MIDI, SMPTE e Click mostram `Not Available`.

## 12. O som

- Todo som é convertido para **12 bits / 26,04 kHz**.
- A afinação pula ou repete amostras, sem suavizar (drop-sample). Para baixo fica mais sujo e escuro; para cima aparece aliasing metálico.
- **Memória:** 5 s por banco, 20 s no total, como na reedição da Rossum de 2021. Pelo SET-UP 23 > Sample Time dá para voltar aos 10 s do original (2,5 s por banco). Um som que não cabe é cortado (com um fade curto no fim, para não estalar) e o LCD avisa. Projetos salvos antes continuam com o tempo que tinham.
- **Canais:** cada som sai num canal (SET-UP 17; o padrão é a posição do pad). Cada canal toca um som por vez: um disparo novo corta o anterior.
  - **1 e 2:** filtro passa-baixa dinâmico, que fecha junto com o decay.
  - **3 e 4:** filtro fixo, corte mais baixo.
  - **5 e 6:** filtro fixo, corte mais alto.
  - **7 e 8:** sem filtro, o som mais cru.
- Essas características imitam a máquina original, mas são aproximações.

## 13. Diferenças em relação ao SP-1200

O RJ-2000 segue o original o mais perto possível. Estas são as mudanças que fizemos de propósito:

| O que | No SP-1200 | No RJ-2000 |
|---|---|---|
| Começar a gravar | Segurar Record e apertar Run/Stop; a gravação começa na hora. | Record/Edit sozinho, com a máquina parada: volta para a tela principal, conta 1 compasso e começa. (Segurar Record e apertar Run/Stop também funciona e faz a mesma contagem.) |
| Posição no LCD | A linha 2 não mostra o compasso. | Tocando, a linha 2 mostra `Play` ou `Rec` com compasso e tempo. |
| Colocar samples | Só pela entrada de áudio (Sample 1 a 9) ou disquete. | Também por arquivo: Sample > pad > 8 (Load File) ou arrastar para o pad, um arquivo por pad, que entra como se fosse gravado (limiar e Sample Length). Pergunta `Load at 45 RPM?`. |
| Funções do Sample | 1 VU, 2 Assign, 3 Level, 4 Threshold, 5 Length, 6 Re-Sample, 7 Arm, 9 Force. | Saíram o 3 (o ganho fica só no knob Gain, de −12 a +36 dB) e o 6 (igual ao 7). Entrou o 8 (Load File). O microfone só é pedido quando necessário. |
| Tempo de sample | 10 s (2,5 s por banco). | 20 s por padrão (5 s por banco), como na reedição da Rossum; 10 s no SET-UP 23 > Sample Time. |
| Cortes | Cortes secos, que podem estalar. | Fade curto no fim de som cortado. |
| Sampler junto | O S950 era um aparelho à parte, ligado por cabo MIDI. | O RJ-950 já vem embaixo, ligado aos pads (seção 16). |
| Cores | Painel cinza. | Painel preto (#1c1c1c), com o mesmo LCD verde. |

## 14. Teclado do computador

| Tecla | Função |
|---|---|
| A S D F G H J K | Pads 1 a 8 |
| Z X C V | Bancos A, B, C, D |
| Espaço | Run/Stop |
| R | Record/Edit |
| T (segurar) | Tap/Repeat |
| 0 a 9, Enter | Teclado numérico |
| Y / N | Yes (9) / No (7) |
| ← → | Setas |
| Esc | Sai da página aberta |

Depois de um clique no RJ-950, os números, o ponto, as setas e o Enter vão para ele (o contorno azul mostra isso): ← → movem o cursor, ↑ ↓ são ON/+ e OFF/−, Page Up/Down trocam de página, P é o PB. Um clique no SP devolve o teclado para ele. Pads, bancos, Espaço e R continuam no SP.

## 15. MIDI

Ligue pelo SET-UP 22 (Chrome, Edge ou Opera).

- **Notas 36 a 67** tocam os 32 sons direto: 36 = A1, 43 = A8, 44 = B1, e assim por diante.
- **CC 20 a 27** movem os sliders 1 a 8 no modo atual.
- No modo Poly, só o canal escolhido é ouvido.

## 16. RJ-950 (o rack embaixo do SP)

Versão reduzida, inspirada no Akai S950 de 1988, o sampler que muita gente usava junto com o SP-1200. O SP mandava notas MIDI e o S950 tocava os loops, os baixos e as frases, com mais tempo de sample e o filtro. Aqui os dois já vêm ligados.

**Ligando:** o 950 liga junto com o SP (`LOADING OPERATING SYSTEM`) e volta com a memória salva no navegador. O botão **Power** desliga e liga só ele. O LCD é de 2 linhas e 40 caracteres, com mensagens em maiúsculas, como no original.

### Como os pads do SP tocam o 950

Cada pad do RJ-2000 manda uma nota (A1 = 36 ... D8 = 67), tocado ao vivo ou pelo sequenciador. No 950, cada pad pode apontar para um sample. O pad toca o som do SP **e** o sample do 950; por isso o normal é usar pads vazios no SP, o truque da época. A luz **MIDI** pisca a cada nota recebida.

- Ao carregar ou gravar um sample, o 950 já liga ele ao primeiro pad vazio do SP (sem som no SP e sem sample do 950) e mostra qual foi, por exemplo `ON PAD C1`.
- No **Edit Program** dá para trocar: toque o pad no SP (ou gire o Control com o cursor em PAD) e escolha o sample em SMP (`--` = nenhum).
- Gravar no SP funciona normal: o segmento guarda o pad, e o 950 toca junto.
- Run/Stop parando o SP também para o que o 950 estiver tocando. Um sample com loop toca até o próximo disparo do mesmo pad ou até o SP parar.

### Painel

- **Modos** (8 botões embaixo do LCD, com luz): Play, Rec, Edit Sample, Edit Program, MIDI, Utility, Disk, Master Tune. Apertar o mesmo modo de novo passa para a página seguinte. A tabela impressa embaixo dos botões lista as páginas.
- **Control** (o knob grande): gira o valor que está no cursor. Arraste para cima ou para baixo, ou use a roda do mouse. Girando rápido, os passos ficam maiores.
- **Teclado:** números e ponto digitam um valor, **Ent** confirma (ou executa a página). **◀ ▶** movem o cursor, **Page ▲▼** trocam de página, **On/+** e **Off/−** sobem ou descem um passo (segurando, repetem). **PB** toca ou para o sample atual.
- **Disquete:** clique para escolher um arquivo de áudio ou solte o arquivo em cima dele. A luz verde acende enquanto carrega.
- **Rec Level** (ganho do microfone, de −12 a +36 dB), **Monitor** (ouvir a entrada) e **Output** (volume do 950). O 950 sai junto com o SP, mas não passa pelo Mix Volume dele. **Contrast** ajusta o LCD.

### Modos e páginas

| Modo | Página | O que faz |
|---|---|---|
| Play | | Escolhe o sample (SMP), mostra o pad ligado a ele e a memória livre. Parado, tocar um pad do SP também escolhe o sample. |
| Rec | | Grava pelo microfone. RATE (taxa), LEN (tempo máximo) e THR (limiar; 00 = grava na hora). Ent começa, Ent de novo para. |
| Edit Sample | 1 | ST e END: início e fim, em segundos. A linha 2 mostra o sample inteiro, com o trecho usado aceso e marcas no início e no fim. |
| | 2 | LOOP ON/OFF e AT: o loop vai do ponto AT até o fim. |
| | 3 | TUNE (±24 semitons), FINE (±50 cents), LEVEL (00 a 99) e REVERSE. |
| | 4 | FILTER: passa-baixa de 2 polos sem ressonância, como o do S950. 99 = aberto; abaixando, o corte desce até 60 Hz. |
| Edit Program | | PAD do SP → SMP do 950. |
| MIDI | | Liga ou desliga a recepção dos pads do SP. |
| Utility | 1 | COPY: cria uma cópia do sample que usa a mesma memória. Serve para tocar trechos diferentes do mesmo loop em pads diferentes. |
| | 2 | DELETE: Ent duas vezes. |
| | 3 | CLEAR ALL MEMORY: Ent duas vezes. |
| Disk | 1 | LOAD AUDIO FILE e RATE, a taxa usada para converter o arquivo. |
| | 2 | SAVE MEMORY: baixa `rj-950-memoria.json` com todos os samples. |
| | 3 | LOAD MEMORY: abre esse arquivo (substitui a memória). |
| Master Tune | | Afinação geral, ±50 cents. |

**Início, fim e loop caem no cruzamento de zero:** girando o Control, o ponto anda na direção do giro até o zero seguinte; digitando um valor (por exemplo `1.25` e Ent), vai para o zero mais perto. Assim o corte não estala.

### Fatiando um loop entre os pads

1. Solte o loop no disquete. Ele entra como SMP 01 e fica ligado, por exemplo, ao pad C1.
2. Em Edit Sample, página 1, ajuste ST e END para o primeiro trecho. Toque C1 no SP para ouvir.
3. Utility > COPY (Ent). A cópia vira o SMP 02, já ligada ao C2, sem gastar memória.
4. Ajuste ST e END da cópia para o próximo trecho. Repita para os outros pads.

### O som e a memória

- **12 bits**, como o S950. A taxa (RATE) é escolhida ao carregar ou gravar, de 7,5 a 48 kHz (padrão 32 kHz). Taxa mais baixa dá mais tempo e um som mais sujo.
- **Memória de 2,25 MB**, como um S950 com as duas expansões EXM-006: 48 s a 32 kHz, 38 s a 40 kHz, 32 s a 48 kHz. Arquivo que não cabe é cortado no fim (`MEMORY FULL: END CUT`).
- **8 vozes.** O mesmo sample disparado de novo corta o anterior; com as 8 ocupadas, a mais antiga para.
- Até 99 samples.

### O que ficou de fora do S950

Para simplificar: keygroups e programas múltiplos (aqui é um programa só, um sample por pad), envelopes, LFO, crossfade de loop, time stretch e saídas separadas. O 950 não tem entrada MIDI própria: um teclado MIDI ligado no SP (seção 15) toca os pads, e os pads tocam o 950. O REVERSE não usa o loop.

