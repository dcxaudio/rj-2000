# SP-1200: referência de funcionamento para o RJ-2000

Pesquisa feita em 05/11/2026 para deixar o RJ-2000 o mais fiel possível ao E-mu SP-1200 original (sistema operacional de fábrica, não a reedição da Rossum nem o SPf1200). As fontes estão no fim. Itens marcados com **[confirmar]** não foram encontrados em texto e precisam ser checados em foto do painel ou no PDF do manual.

Objetivo deste documento: servir de especificação para a próxima versão. A seção 10 lista o que precisa mudar na v0.0.

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
  - Oito botões à direita dele com **dois rótulos**: o de cima vale no song mode, o de baixo no segment mode.
    - Funções de song: TRIGGER, REPEAT, END, INSERT, DELETE, TEMPO CHANGE, MIX CHANGE, REC/EDIT.
    - Funções de segment: TIME SIGNATURE, SEGMENT LENGTH, ERASE, COPY, SWING, STEP PROGRAM, AUTO CORRECT, METRONOME.
    - **[confirmar a ordem e quais rótulos ficam no mesmo botão, por foto do painel]**
  - Também: RUN/STOP, RECORD, TEMPO, TAP/REPEAT.
- **ENTRADA DE DADOS:** teclado de 0 a 9, ENTER, YES, NO, seta para a esquerda e seta para a direita.
- **MASTER CONTROL:** knob MIX VOLUME, knob METRONOME VOLUME, chave liga/desliga.

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
| 3 | Gain: +00 dB (linha), +20 dB (instrumento), +40 dB (microfone), além do knob GAIN fino |
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

## 10. O que muda na v0.0 do RJ-2000

### Visual e painel

- [ ] **Esconder tudo que não existe na SP-1200 clássica:** as abas GRADE, SOM, SONG, SETUP e AJUDA, os botões SAVE, LOAD e EXPORT WAV soltos, e os extras de S950, bits e taxa. Tudo vai para um modo "EXTRAS", desligado por padrão (ex.: um botãozinho discreto no rodapé). O painel padrão deve ter só o que a máquina tem.
- [ ] **Reorganizar em módulos:** SET-UP, DISK, SYNC e SAMPLE (cada um com LED), PERFORMANCE, PROGRAMMING, entrada de dados e MASTER (knobs MIX VOLUME e METRONOME VOLUME).
- [ ] **Programming:** botão SONG/SEGMENT mais oito botões com rótulo duplo (song em cima, segment embaixo), mais RUN/STOP, RECORD, TEMPO e TAP/REPEAT.
- [ ] **Performance:** um único botão TUNE-MIX-MULTI com LEDs MIX, TUNE/DECAY e MULTIMODE; botão SELECT à esquerda dos pads para os bancos.
- [ ] **Entrada de dados:** acrescentar YES e NO (hoje só há NO).
- [ ] **LCD:** 2 linhas x 16 caracteres; segment mode como `Seg 07 ♪=092.0` com a linha 2 vazia; mensagens em inglês como as originais (`Sample Armed`, `Truncate Length`, `Exit Multi Mode?`...).
- [ ] **Ao ligar:** sequência de boot (`Loading Software` etc.).
- [ ] **Remover o LED de 2 dígitos**, se a máquina original não tiver. **[confirmar por foto]**

### Comportamento

- [ ] **Segmentos e songs** de 00 a 99, com entrada de 2 dígitos e zero na frente. Hoje são de 01 a 99 e não há várias songs.
- [ ] **Tempo** de 40 a 240, com entrada de 4 dígitos. Cada segmento guarda o próprio tempo e cada song também.
- [ ] **Resolução de 24 PPQN** (hoje é 96) e AUTO CORRECT com 1/4 e 1/4T, padrão 1/4.
- [ ] **TIME SIGNATURE** e SEGMENT LENGTH com compassos mais tempos extras; dimensionamento em tempo real; `Use Copy to Lengthen Segment`.
- [ ] **COPY** com modo append (origem igual ao destino).
- [ ] **RECORD:** segurar RECORD e apertar RUN/STOP; apertar RECORD tocando faz punch out.
- [ ] **ERASE:** ERASE + pad + confirmação apaga o som; ERASE + número apaga o segmento.
- [ ] **Swing** só muda com a máquina parada.
- [ ] **Metrônomo** com subdivisões e knob de volume.
- [ ] **Segmento vazio:** RUN dá um bipe.
- [ ] **Travas** de botões durante a reprodução.
- [ ] **STEP PROGRAM** pelo LCD, no lugar da grade.
- [ ] **Song mode** editado passo a passo pelo LCD: REC/EDIT, INSERT, DELETE, REPEAT, END (parar, repetir, encadear), TEMPO CHANGE e MIX CHANGE.
- [ ] **MIX por som**, não por canal (hoje é por canal), com 8 mixes guardados (SET-UP 15 e 16).
- [ ] **TUNE ou DECAY por som** (SET-UP 18), com a faixa de afinação em ±7 semitons. Pratos e hats começam em decay.
- [ ] **MULTI PITCH:** pad da esquerda o mais agudo, em escala diatônica. Entrar pelo SET-UP 11, 12 e 13, com o LED MULTIMODE.
- [ ] **Canal de saída configurável por som** (SET-UP 17).
- [ ] **Filtros:** canais 1 e 2 com corte que cai conforme o som decai (envelope); canais 3 e 4 com corte fixo mais baixo; 5 e 6 com corte fixo mais alto; 7 e 8 sem filtro. Hoje os canais 3 a 6 usam o mesmo corte e o filtro dinâmico acompanha a afinação, não o decaimento.
- [ ] **SAMPLE 1 a 9** pelo LCD: VU, assign, gain, threshold, length (até 2,5 s, passos de 0,1 s), arm e force. Mensagens `Sample is good` e `Sample Overload`.
- [ ] **TRUNCATE (SET-UP 19)** pelos sliders 1 a 6 (início, fim e loop, grosso e fino) e `Make Truncation Permanent?`.
- [ ] **DISK 0 a 9:** no navegador, salvar e abrir arquivos separados de sequências e de sons, mais "carregar tudo".
- [ ] **MIDI:** SET-UP 22 (canal, Omni/Poly), notas 36 a 67.

### Para decidir antes de mexer

- [ ] O que mostrar no lugar do LED de 2 dígitos.
- [ ] Como o modo EXTRAS aparece (botão no rodapé? tecla de atalho?).
- [ ] Se o kit padrão continua carregado ao ligar. A máquina original liga vazia e pede disquete; a sugestão é carregar o kit como se fosse o disquete, com a mensagem `Loading Sounds`.

---

## Fontes

- [SP-1200 Owner's Manual, Craig Anderton (PDF)](https://www.autistici.org/2000-maniax/texts/sp1200_manual.pdf). Também em [samplekings.com](https://www.samplekings.com/pdfs/SP1200%20User%20Manual.pdf). Fonte principal das funções, números e mensagens.
- [E-mu SP-1200 Service Manual (ManualsLib)](https://www.manualslib.com/manual/827730/E-Mu-Sp1200.html)
- [Review do SP-1200 na Sound On Sound, out/1987](https://www.muzines.co.uk/articles/e-mu-sp1200/2517)
- [Rossum Electro-Music, Education: SP-1200](https://www.rossum-electro.com/pages/education-sp-1200) (filtros por canal, corte de voz por canal, display 2x16)
- [Wikipedia: E-mu SP-1200](https://en.wikipedia.org/wiki/E-mu_SP-1200) (drop-sample, sem filtro de reconstrução, especificações)
- [SPf1200, sistema não oficial](https://spf1200.com/) (descreve o comportamento do sistema de fábrica: display, travas, notas MIDI, disco)
- [Índice de vídeos sobre o SP-1200 (MATRIXSYNTH)](https://www.matrixsynth.com/2018/06/overview-manual-of-e-mu-sp1200-boom-bap.html)
