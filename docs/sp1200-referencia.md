# SP-1200: referência de funcionamento para o RJ-2000

Pesquisa feita em 05/11/2026 para deixar o RJ-2000 o mais fiel possível ao E-mu SP-1200 original (sistema operacional de fábrica, não a reedição da Rossum nem o SPf1200). As fontes estão no fim. Itens marcados com **[confirmar]** não foram encontrados em texto e precisam ser checados em foto do painel ou no PDF do manual.

Objetivo deste documento: servir de especificação para a próxima versão. A seção 10 lista o que ainda falta em relação ao beta atual (b0.0).

---

## 1. Números da máquina

| Item | Valor |
|---|---|
| Resolução | 12 bits linear |
| Taxa de amostragem | 26,04 kHz |
| Memória de sample | 10 s no total, em 4 zonas de 2,5 s (uma por banco). Um som não pode atravessar zonas, então nenhum som passa de 2,5 s |
| Sons | 32 (A1 a D8), 4 bancos de 8 |
| Vozes | 8, uma por canal de saída |
| Segmentos | 100 (00 a 99) |
| Songs | 100 (00 a 99) |
| Memória de sequência | cerca de 5.000 notas (mostrada em %) |
| Mixes guardados | 8 |
| Resolução do sequenciador | 24 pulsos por semínima (o HI-RES é tercina de 1/64; a saída de metrônomo é um clique de 24 PPQN) |
| Tempo | 40 a 240 BPM, com 0,1 BPM de precisão |
| Display | LCD de 2 linhas x 16 caracteres, com luz de fundo |
| Pads | 8, sensíveis a força (piezo), que pode ser desligado |
| Conversão | sem filtro de reconstrução na saída: há imagem espectral acima de Nyquist, o que deixa o som mais brilhante |
| Afinação | drop-sample (pula ou repete amostras, sem interpolação), com aliasing audível |

## 2. Saídas e filtros

- **Canais 1 e 2:** filtro passa-baixa dinâmico (chip SSM2044). O corte cai conforme o som decai, como um envelope.
- **Canais 3 e 4:** filtro passa-baixa fixo com corte mais baixo.
- **Canais 5 e 6:** filtro passa-baixa fixo com corte mais alto.
- **Canais 7 e 8:** sem filtro (saída direta do conversor, a mais "crua").
- **Mix out:** soma mono dos 8 canais filtrados. Não há saída estéreo.
- **Um som por canal:** um novo disparo no mesmo canal corta o som que está tocando.
- **Canal de cada som:** definido em SET-UP 17 (cada um dos 32 sons pode ir para qualquer canal de 1 a 8). Não é fixo pela posição do pad. **[confirmar o padrão de fábrica: provavelmente a posição do pad]**
- **Alocação dinâmica** (função especial 22): alterna entre os pares de canais (1-2, 3-4, 5-6, 7-8) para um som não cortar a si mesmo.

## 3. Painel

O painel é dividido em módulos. Cada módulo de função tem um botão com LED. Um módulo ativo trava as funções que não têm relação com ele.

### Módulos acessados por número (botão do módulo + número no teclado)

- **SET-UP**
- **DISK**
- **SYNC**
- **SAMPLE** (tem também o botão GAIN e a entrada SAMPLE IN)

### Módulos sempre disponíveis

- **PERFORMANCE**
  - 8 pads grandes na parte de baixo, cada um com um slider em cima.
  - Botão **SELECT** (à esquerda dos pads): troca entre os bancos A, B, C e D.
  - Botão **TUNE-MIX-MULTI** (canto superior esquerdo do módulo): alterna a função dos sliders entre MIX e TUNE/DECAY. LEDs: MIX, TUNE/DECAY e MULTIMODE (este acende quando um multi mode está ativo).
- **PROGRAMMING**
  - Botão **SONG/SEGMENT**, o mais à esquerda.
  - Oito botões à direita dele com **dois rótulos**: o de cima vale no song mode, o de baixo no segment mode. Ordem confirmada por foto do painel (cima / baixo):
    1. Trigger / Metronome
    2. Repeat / Swing
    3. Subsong / Copy
    4. End / Time Signature
    5. Insert / Segment Length
    6. Delete / Erase
    7. Tempo Change / Auto Correct
    8. Mix Change / Step Program
- **MASTER CONTROL** (coluna da direita, confirmado por foto): LCD; botões Tempo, ◀, ▶ e Enter; knobs Mix Volume e Metronome Volume; teclado numérico; e embaixo Tap/Repeat, Run/Stop (com LED) e Record/Edit (vermelho, com LED).
- **Teclado numérico:** 1 a 9 em três fileiras e o 0 sozinho embaixo. Não existem botões YES e NO separados: o **7 é também NO** e o **9 é também YES** (rótulos embaixo das teclas).
- **Não há** botão ERASE solto, nem RECORD separado do Record/Edit, nem display de LED: só o LCD.

### Como os dados são digitados

- **Campos de dois dígitos exigem o zero na frente:** segmento 7 é `0` `7`.
- **Tempo:** quatro dígitos com zero na frente, 0,1 BPM de precisão (ex.: `0` `9` `2` `5` = 92,5).
- **Setas:** sobem ou descem um valor por toque; segurando, correm rápido.
- **ENTER:** confirma. Com um cursor piscando, o ENTER desfaz a edição.
- **Sliders também entram dados:** o slider 1 ajusta tempo, limiar, tamanho de sample etc., conforme a função.

### Display

- **Ao ligar:** `SP-1200` / `Insert Diskette`. Depois aparecem `Loading Software`, `Loading Sequences` e `Loading Sounds`.
- **Segment mode:** linha 1 parecida com `Seg 07 ♪=180.0` (segmento e tempo); linha 2 vazia.
- **Song mode:** mostra a song atual e o tempo dela.
- **Linha 2:** mostra o passo da song, gráfico de barras (mix, tune ou decay dos 8 sliders) ou medidor VU.
- **Cursor piscando:** marca o dígito que está sendo editado.

## 4. Segment mode

- O segment mode funciona como rascunho. Tempo e mix ajustados ali valem só no segment mode. Afinação e dinâmica valem para tudo.
- **Escolher segmento:** digite dois dígitos (00 a 99).
- **RUN/STOP:** toca o segmento em loop, com o clique do metrônomo. Se o segmento estiver vazio, a máquina dá um bipe.
- **Trocar de segmento tocando:** o novo começa quando o atual termina.
- **Travas:** com o loop tocando, a maioria dos botões de página não funciona. Gravando, só AUTO CORRECT e SET-UP (para multi pitch e multi level) funcionam.

### Dimensões do segmento

- **TIME SIGNATURE:** numerador de 1 a 99; denominador 4, 8, 16 ou 32. Padrão 4/4.
- **SEGMENT LENGTH:** até 99 compassos mais até 99 tempos extras. Padrão: 2 compassos, 0 tempos. Um `+` no display indica tamanho que não fecha em tempo inteiro.
- **Dimensionar em tempo real:** SEGMENT LENGTH e depois RUN/STOP. O display conta os tempos enquanto toca.
- **Diminuir:** SEGMENT LENGTH num segmento existente pergunta `Truncate Length` (YES/NO).
- **Aumentar:** a máquina responde `Use Copy to Lengthen Segment`.
- **Segmento apagado:** volta a ter 2 compassos de 4/4.

### Gravação em tempo real

- **Começar:** segure RECORD e aperte RUN/STOP. Os dois LEDs acendem.
- **Overdub:** as notas gravadas tocam a cada volta e as novas se somam.
- **Punch out:** aperte RECORD para parar de gravar sem parar a música.
- **Volume:** mudanças de volume nos sliders durante a gravação não são gravadas. Para dinâmica, use os pads sensíveis ou o multi level.

### AUTO CORRECT (quantização)

- **Opções:** 1/4 (padrão), 1/4T, 1/8, 1/8T, 1/16, 1/16T, 1/32, 1/32T e HI-RES (sem quantizar, resolução de tercina de 1/64).
- **Mudança tocando:** vale a partir do fim do segmento.
- **No step program:** define o tamanho do passo.

### SWING

- **Valores:** 50% (padrão), 54, 58, 63, 67 e 71%.
- **Mudar:** só com a máquina parada.
- **Atenção:** o manual avisa que gravar ou apagar com swing ligado não é confiável. **[confirmar se o swing é aplicado na gravação ou na reprodução]**
- **Resolução:** as porcentagens de swing batem exatamente com passos de 1/48 de semínima em 1/8 (13/24 = 54,2%, 14/24 = 58,3%, 15/24 = 62,5%, 16/24 = 66,7%, 17/24 = 70,8%) e de 1/96 em 1/16. Por isso o RJ-2000 usa 96 pulsos por semínima, e não 24.

### TEMPO

- **Faixa:** 40 a 240 BPM.
- **Como mudar:** setas (±1), teclado (4 dígitos), slider 1, ou batendo no TAP/REPEAT (ou num pedal ligado na entrada de footswitch).
- **Onde fica guardado:** cada segmento guarda o seu tempo. Cada song tem o seu.

### METRONOME

- **Opções:** desligado, 1/4 (padrão), 1/4T, 1/8, 1/8T, 1/16, 1/16T, 1/32, 1/32T, ou Click (24 PPQN na saída MET OUT).
- **Acento:** no tempo 1.
- **Mudar:** com a máquina parada, METRONOME e depois ENTER.
- **Volume:** knob próprio.

### TAP/REPEAT

- **Segurado junto com um pad:** repete a nota no ritmo do AUTO CORRECT (e grava, se estiver gravando).
- **Batido sozinho:** define o tempo (tap tempo).

### ERASE

- **Apagar um som do segmento:** ERASE, toque o pad e confirme.
- **Apagar ao vivo:** gravando, segure ERASE e o pad. As notas daquele som somem conforme passam. Use HI-RES para apagar notas exatas.
- **Apagar o segmento inteiro:** ERASE, digite o número do segmento e confirme com YES/NO.
- **No step program:** segure ERASE e o pad no passo.

### COPY

- **Copiar:** COPY, número de origem, número de destino, ENTER.
- **Append:** com origem igual ao destino, entra em modo append (emenda o segmento nele mesmo), com contagem de 1 a 99.
- **Aumentar segmento:** é assim que se faz.

### STEP PROGRAM

- **Entrar:** STEP PROGRAM.
- **Andar:** segure RUN/STOP para avançar sozinho, ou use as setas.
- **Display:** compasso, tempo, tamanho do passo e até 4 sons do passo (com `+` se houver mais).
- **Inserir:** toque o pad no passo.
- **Sair:** ENTER ou STEP PROGRAM.

## 5. Song mode

- **Songs:** 00 a 99. Cada song guarda o próprio tempo (40 a 240) e o mix.
- **Entrar:** SONG/SEGMENT carrega o tempo e o mix da song. Ao voltar ao segment mode, os valores do segment voltam.
- **Editar:** REC/EDIT. Digite o número do segmento e use ENTER ou a seta para a direita para ir ao próximo passo. A linha 2 mostra `Step N:`.
- **INSERT:** no passo desejado, insere um passo novo. Os seguintes são renumerados.
- **DELETE:** apaga o passo. Os seguintes são renumerados.
- **REPEAT:** o primeiro toque marca o início de uma repetição (`|-`). O segundo marca o fim, com contagem (padrão 02).
- **TEMPO CHANGE:** 1 = acelerando, 2 = ritardando. Define quantos BPM muda (até 99) e em quantos tempos (até 32). Formato `+00/00` ou `-00/00`.
- **MIX CHANGE:** troca para um dos 8 mixes guardados.
- **END:** END duas vezes = parar. END e REPEAT = repetir a song do início. END e um número = encadear com outra song (`Link`).
- **Apagar a song:** END no passo 1 e confirmar `End Here?`.
- **TRIGGER:** usado com saídas de trigger e sync. **[confirmar funcionamento]**
- **Primeiro passo:** SET-UP 21 define em que passo a song começa.

## 6. Performance (sliders e pads)

- **MIX:** cada slider controla o volume de um **som** (vale para os 4 bancos, então cada banco mostra os seus 8 volumes). O mix pode ser guardado em uma de 8 memórias (SET-UP 15) e chamado depois (SET-UP 16).
- **TUNE/DECAY:** cada som usa o slider para afinação **ou** para decay, não os dois.
  - **Escolha:** SET-UP 18 (tecla 1 = tune, 2 = decay).
  - **Padrão:** bumbos, caixas e palmas vêm em tune; pratos vêm em decay.
  - **Faixa da afinação:** mais ou menos uma quinta (cerca de ±7 semitons).
  - **Decay:** a altura da barra no LCD mostra a duração relativa.
  - Sons em tune tocam com o decay padrão. Sons em decay tocam com a afinação do meio.
- **MULTI PITCH (SET-UP 11):** espalha um som pelos 8 pads em afinações diferentes, numa escala diatônica. O pad da **esquerda é o mais agudo**. Num prato em modo decay, o da esquerda é o decay mais longo.
- **MULTI LEVEL (SET-UP 12):** espalha um som pelos 8 pads com volumes diferentes. O pad da esquerda é o mais fraco e o da direita o mais forte.
- **Sair do multi (SET-UP 13):** confirmar `Exit Multi Mode?` com YES. O LED MULTIMODE indica o multi ativo.
- **Dinâmica:** SET-UP 14 liga ou desliga os pads sensíveis. Desligado, todo toque sai no volume máximo.
- **Ao desligar:** a performance volta ao padrão. Só os 8 mixes guardados permanecem.

## 7. SET-UP (botão SET-UP + número)

| Nº | Função |
|---|---|
| 11 | Multi pitch |
| 12 | Multi level |
| 13 | Sair do multi mode |
| 14 | Dynamic buttons (pads sensíveis: YES/NO) |
| 15 | Define mix (guardar o mix atual como mix 1 a 8) |
| 16 | Select mix (chamar um mix guardado) |
| 17 | Channel assign (canal de saída de cada som, 1 a 8) |
| 18 | Tune/decay (escolha por som) |
| 19 | Truncate/loop |
| 20 | Delete sound |
| 21 | First song step (passo inicial da song) |
| 22 | MIDI: canal (01 a 16) e modo (1 = Omni, 2 = Poly) |
| 23 | Special functions (o slider 1 percorre a lista) |

### Truncate/loop (SET-UP 19)

- **Início:** slider 1 (grosso) e slider 2 (fino). Mostra `S=`.
- **Fim:** slider 3 (grosso) e slider 4 (fino). Mostra `E=`.
- **Loop:** slider 5 (grosso) e slider 6 (fino). Mostra `L=`. Padrão: sem loop.
- **Unidade:** os valores são em amostras (cerca de 26 por milissegundo).
- **Ao sair:** pergunta `Make Truncation Permanent? Y/N`. Truncar de forma permanente libera memória.
- **Sons copiados:** não podem ser truncados (`Copied`).

### Funções especiais (SET-UP 23)

| Nº | Função |
|---|---|
| 12 | Clear all memory |
| 13 | Memória restante |
| 14 | Write SMPTE (gravar SMPTE em fita) |
| 15 | Clear sound memory |
| 16 | Clear sequence memory |
| 17 | Copy sound |
| 18 | Swap sounds |
| 19 | Decay padrão para todos os sons (slider 1) |
| 21 | Name sound |
| 22 | Dynamic allocation |
| 23 e 24 | Envio de sons por MIDI (sample dump) |

**[confirmar a lista completa no apêndice G do manual]**

## 8. SAMPLE (botão SAMPLE + número)

| Nº | Função |
|---|---|
| 1 | VU mode (padrão ao entrar): local do som, ganho e medidor VU com pico |
| 2 | Assign: escolhe o slot (A1 a D8) e o canal de saída. `*` = slot ocupado. A máquina sugere o próximo slot vazio |
| 3 | Level (rótulo do painel): ganho de +00 dB (linha), +20 dB (instrumento) ou +40 dB (microfone), além do knob GAIN fino |
| 4 | Threshold (limiar), pelo slider 1 |
| 5 | Sample length: até 2,5 s, em passos de 0,1 s, pelo slider 1 |
| 6 | Re-sample (refazer) |
| 7 | Arm: espera o sinal passar do limiar. LCD: `Sample Armed` |
| 9 | Force: grava na hora. LCD: `Sampling` |

- **Depois de gravar:** `Sample is good` ou `Sample Overload`.
- **Sem retorno:** não dá para ouvir a entrada enquanto grava. Você só escuta depois, no pad.
- **Entrada:** mono.
- **Ordem do manual:** ganho (3), nível no VU (1), limiar (4), tamanho (5), destino (2), e então armar (7) ou forçar (9).

## 9. DISK e SYNC

### DISK (botão DISK + número)

| Nº | Função |
|---|---|
| 0 | Load sequences and sounds (carrega tudo) |
| 1 | Save sequences (songs, segmentos, mixes e canais) |
| 2 | Save sounds |
| 3 | Load sequences |
| 4 | Load segment # |
| 5 | Load sounds |
| 6 | Load sound # |
| 7 | Catalog sequences |
| 8 | Catalog sounds |
| 9 | Format disk / copy software |

- **Salvar tudo:** a máquina original não salva sequências e sons juntos; são duas operações.
- **Tempo:** não é salvo com as sequências.

### SYNC (botão SYNC + número)

1. Internal
2. MIDI (envia sempre MIDI clock; pode seguir o clock externo)
3. SMPTE
4. Click (24 a 384 PPQN)

### MIDI

- **Notas:** os pads enviam e recebem as notas 36 a 67 (A1 a D8).
- **Velocity:** é fixa, a menos que os pads sensíveis (SET-UP 14) estejam ligados.

---

## 9b. Tempo de sample na prática (pesquisa de 06/11/2026)

- **O limite:** 10 s no total e 2,5 s por som. Isso obrigava a escolher bem o que samplear.
- **O macete dos 45 RPM:** tocar o disco de 33⅓ em 45 RPM, samplear e baixar a afinação no SP-1200. Virou prática quase padrão no hip hop do começo dos anos 90, até chegarem máquinas com mais memória, como a MPC60. O custo é perder fidelidade e ganhar artefatos, que viraram parte do som.
- **Bateria normal, loop acelerado:** relatos de fórum dizem que kicks e snares curtos costumavam entrar na velocidade normal, e os loops e breaks entravam acelerados. É informação de fórum, não regra documentada.
- **Chop:** a combinação de truncate e sequenciador servia para fatiar breaks e frases e reorganizar as partes.
- **SP-1200 + Akai S950:** muita gente usava as duas juntas. O S950 (12 bits, até 48 kHz, mais memória e filtro melhor) ficava com os loops e as partes mais limpas, e o SP-1200 com a bateria e o caráter. O Ski, por exemplo, contou que tocava a bateria no SP e usava o S950 junto nas produções do *Reasonable Doubt*.
- **Reedição da Rossum (2021):** dobrou a memória para **20 s**. Segundo a Rossum, o motor original já suportava 20 s, e só não veio assim porque a RAM era cara demais em 1987. O resto do som (12 bits, 26,04 kHz) ficou igual.

**Aplicado no RJ-2000:**

- 20 s por padrão (Rossum), com SET-UP 23 > Sample Time para voltar aos 10 s do original.
- Load at 45 RPM.
- Importação no jeito do SP: um arquivo por pad, cortado no Sample Length. O Chop em pads foi testado na b0.1 e saiu: fatiar loops longos ficou com o RJ-950, como era feito com o S950 (veja [s950-referencia.md](s950-referencia.md)).

Fontes:

- [Wikipedia, E-mu SP-1200](https://en.wikipedia.org/wiki/E-mu_SP-1200)
- [Rossum, SP-1200](https://www.rossum-electro.com/products/sp-1200/)
- [MusicRadar, anúncio da reedição](https://www.musicradar.com/news/reissue-of-the-classic-sp-1200-sampler-announced-by-dave-rossum)
- [Attack Magazine, samplers que definiram a música de pista](https://attackmagazine.com/features/long-read/nine-samplers-that-defined-dance-music/4)
- [Gearspace, S950 vs SP1200](https://gearspace.com/threads/s950-vs-sp1200.113961/)
- [SP-1200 forum, técnicas de sampling](https://www.tapatalk.com/groups/sp1200/sp-sound-and-sampling-techniques-t827.html)
- [Reverb, o legado dos Akai S](https://reverb.com/news/found-on-reverb-the-legacy-of-akai-s-series-samplers)

## 10. Situação no RJ-2000 (b0.1)

### Feito na b0.1

- [x] Painel no layout do original: Set-up, Disk, Sync e Sample em cima; Master Control à direita; Programming com rótulos duplos; Performance com seletor de modo, sliders, seletor de banco e pads. Cores escuras (#1c1c1c) e LCD verde.
- [x] Removidos os extras (grade, abas, filtro S950, bits e taxa, exportar WAV) e o display de LED.
- [x] LCD 2 x 16 com mensagens em inglês, cursor piscando e gráfico de barras dos sliders. Sequência de boot.
- [x] Teclado com 7 = NO e 9 = YES; campos de dois dígitos com zero na frente; tempo com 4 dígitos.
- [x] Segmentos e songs de 00 a 99; tempo de 40 a 240 por segmento e por song.
- [x] Time Signature, Segment Length com compassos e tempos extras, `Truncate Length?`, `Use Copy to Lengthen Segment` e dimensionamento em tempo real.
- [x] Copy com append; Erase por pad, por segmento e ao vivo; Step Program pelo LCD.
- [x] Auto Correct com 1/4 a Hi-Res; metrônomo com subdivisões e knob de volume; swing só com a máquina parada.
- [x] Record/Edit: arma parado, punch in/out tocando, edição da song no song mode. Bipe em segmento vazio e travas durante a reprodução.
- [x] Song mode completo pelo LCD: Insert, Delete, Repeat, End (parar, repetir, encadear), Tempo Change, Mix Change, Subsong, Trigger e 1st Song Step.
- [x] Mix por som, mix por song e 8 mixes guardados (SET-UP 15 e 16).
- [x] Tune ou decay por som (SET-UP 18), ±7 semitons; multi pitch e multi level (SET-UP 11, 12, 13) com LED Multi Mode.
- [x] Canal por som (SET-UP 17) e alocação dinâmica; filtros: 1-2 dinâmico pelo decay, 3-4 fixo baixo, 5-6 fixo alto, 7-8 sem filtro.
- [x] Loop/Truncate pelos sliders 1 a 6 com `Make Truncation Permanent?`.
- [x] SAMPLE 1 a 9 pelo LCD, com `Sample Armed`, `Sample is good` e `Sample Overload`.
- [x] DISK 0 a 9 com arquivos separados de sequências e de sons.
- [x] SET-UP 22 (canal MIDI e Omni/Poly) e funções especiais do SET-UP 23.

### Mudanças nossas (de propósito)

- Record/Edit parado faz contagem de 1 compasso e começa a gravar sozinho; o LCD mostra `Count-In` e depois `Play`/`Rec` com compasso e tempo. A lista completa fica no manual, seção 13.

### Ainda falta

- [ ] SYNC 2, 3 e 4 (MIDI clock, SMPTE e Click).
- [ ] Saída de MIDI para aparelhos externos (as notas dos pads já vão para o RJ-950).
- [ ] Envio de sons por MIDI (sample dump).
- [ ] Valores exatos dos filtros e da curva de decay, comparando com gravações da máquina.
- [ ] Testar o sampling por microfone num navegador comum (o painel de teste bloqueia o microfone).
- [ ] Confirmar os itens marcados com **[confirmar]** acima.

## Fontes

- [SP-1200 Owner's Manual, Craig Anderton (PDF)](https://www.autistici.org/2000-maniax/texts/sp1200_manual.pdf). Também em [samplekings.com](https://www.samplekings.com/pdfs/SP1200%20User%20Manual.pdf). Fonte principal das funções, números e mensagens.
- [E-mu SP-1200 Service Manual (ManualsLib)](https://www.manualslib.com/manual/827730/E-Mu-Sp1200.html)
- [Review do SP-1200 na Sound On Sound, out/1987](https://www.muzines.co.uk/articles/e-mu-sp1200/2517)
- [Rossum Electro-Music, Education: SP-1200](https://www.rossum-electro.com/pages/education-sp-1200) (filtros por canal, corte de voz por canal, display 2x16)
- [Wikipedia: E-mu SP-1200](https://en.wikipedia.org/wiki/E-mu_SP-1200) (drop-sample, sem filtro de reconstrução, especificações)
- [SPf1200, sistema não oficial](https://spf1200.com/) (descreve o comportamento do sistema de fábrica: display, travas, notas MIDI, disco)
- [Índice de vídeos sobre o SP-1200 (MATRIXSYNTH)](https://www.matrixsynth.com/2018/06/overview-manual-of-e-mu-sp1200-boom-bap.html)
