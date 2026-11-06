# Manual do RJ-2000 (v0.0)

O RJ-2000 imita o fluxo de trabalho do E-mu SP-1200: poucos botões, um display pequeno e muita coisa feita "na mão". Este manual explica cada parte do painel.

## 1. Ligando

O navegador só libera o áudio depois de um toque. Por isso a máquina abre com o botão **LIGAR**. Na primeira vez ela carrega o kit padrão e um padrão de exemplo no segmento 01. Depois disso, ela restaura automaticamente o último projeto salvo no navegador.

## 2. O painel

### Display

- **LED vermelho (2 dígitos):** número do segmento atual. No song mode, mostra o passo da song.
- **LCD:** mostra o estado da máquina e o parâmetro que você está editando. Parado, mostra o segmento, o tamanho em compassos, o tempo, o auto correct e o swing. Tocando, mostra compasso e tempo (ex.: `1.3`).

### Teclado numérico

Serve para editar parâmetros. Aperte um botão de parâmetro (TEMPO, SWING etc.), depois:

- **Setas ◀ ▶:** diminuem ou aumentam o valor.
- **Números + ENTER:** digitam o valor direto. No TEMPO dá para usar ponto decimal (ex.: `92.5`).
- **NO:** cancela a digitação. Apertando de novo, volta para a seleção de segmento.

Sem nenhum parâmetro selecionado, os números escolhem o segmento (ex.: `1`, `2`, ENTER vai para o segmento 12).

### Performance

| Botão | Função |
|---|---|
| MIX | Sliders controlam o volume de cada canal (1 a 8). |
| TUNE/DECAY | Sliders controlam a afinação dos 8 sons do banco atual. Aperte de novo para controlar o decay (tempo de decaimento, 0 a 31; 31 = sem decay). |
| MULTI PITCH | Espalha o último som tocado pelos 8 pads, cada um com uma afinação. Os sliders ajustam a afinação de cada pad. Aperte de novo para sair. |
| MULTI LEVEL | Igual ao Multi Pitch, mas cada pad toca o som com um volume diferente. Útil para hi-hats e ghost notes. |
| BANK | Troca o banco de sons (A, B, C, D). |

### Programming

| Botão | Função |
|---|---|
| SEGMENT | Seleciona o segmento (01 a 99). Durante a reprodução, a troca acontece no fim do segmento que está tocando. |
| SONG | Liga e desliga o song mode. |
| TEMPO | Andamento de 30 a 250 BPM. |
| SWING | 50%, 54%, 58%, 63%, 67% ou 71%. Aplicado no momento da gravação, nos contratempos de 1/8 ou 1/16, como no SP-1200. |
| AUTO CORRECT | Quantização da gravação: 1/8, 1/8T, 1/16, 1/16T, 1/32, 1/32T ou HI-RES (sem quantizar). |
| SEGMENT LENGTH | Tamanho do segmento atual, de 1 a 99 compassos (4/4). |
| METRONOME | Desligado, só durante a gravação, ou sempre. |
| COPY | Copia o segmento atual para outro. Escolha o destino e aperte ENTER. |
| ERASE SEG | Apaga todas as notas do segmento atual. Pede confirmação (aperte duas vezes). |

### Transporte

| Botão | Função |
|---|---|
| RUN/STOP | Toca e para. |
| RECORD | Arma a gravação. Com o RECORD aceso, aperte RUN/STOP e toque os pads: as notas entram no segmento em loop (overdub). |
| TAP/REPEAT | Segurando junto com um pad durante a reprodução: repete a nota no ritmo do auto correct (e grava, se estiver gravando). Tocando sozinho, no tempo da música: define o andamento (tap tempo). |
| ERASE | Segurando junto com um pad durante a reprodução: apaga aquele som conforme o padrão passa. Com a máquina parada: apaga todas as notas daquele som no segmento. |

### Sample

| Botão | Função |
|---|---|
| SAMPLE | Abre a aba SOM e liga o microfone. Aperte de novo para armar: a gravação começa quando o sinal passa do limiar e para no limite de memória do banco ou quando você aperta PARAR. |
| LOAD SOUND | Carrega um arquivo de áudio no som selecionado. Também dá para arrastar o arquivo para cima de um pad. |
| TRUNCATE | Abre a aba SOM para ajustar início e fim do som. Cortar o som libera memória do banco. |
| REVERSE | Toca o som selecionado de trás para frente. |

O **som selecionado** é sempre o último pad tocado. Ele aparece no canto superior direito da área dos pads.

### Disk

| Botão | Função |
|---|---|
| SAVE | Baixa o projeto como arquivo `.rj2000.json` (sons, segmentos, song e ajustes). |
| LOAD | Abre um projeto salvo. |
| EXPORT WAV | Exporta o segmento atual em WAV (ou a song inteira, se o song mode estiver ligado). |

## 3. Memória

O SP-1200 tinha 10 segundos de memória, divididos em 4 bancos de 2,5 segundos. Era por isso que os produtores tocavam os discos em 45 RPM e afinavam o sample para baixo depois: cabia mais som. O RJ-2000 segue a mesma regra. Se um som não couber, ele é cortado e o LCD avisa. As barras de memória ficam na aba SOM. O limite pode ser desligado no SETUP.

## 4. O som

- Todo som carregado é convertido para **12 bits / 26,04 kHz**.
- Ao mudar a afinação, a máquina pula ou repete amostras, sem suavizar. Afinando para baixo, o som fica mais sujo e escuro. Afinando para cima, aparece aliasing metálico.
- **Canais 1 e 2:** filtro passa-baixa que acompanha a afinação. Ótimo para kicks e baixos.
- **Canais 3 a 6:** filtro passa-baixa fixo.
- **Canais 7 e 8:** sem filtro, o som mais "cru". Bom para hats e pratos.
- Cada canal toca um som por vez: um novo disparo no mesmo canal corta o anterior. Os sons na mesma posição de pad em bancos diferentes (A1, B1, C1, D1) dividem o mesmo canal.

Essas características imitam o comportamento conhecido da máquina original, mas são aproximações.

## 5. Abas

- **GRADE:** edição por passos do segmento atual, em semicolcheias, para os 8 sons do banco atual. Toque no nome do som para ouvir.
- **SOM:** nome, forma de onda, início e fim, reverso, apagar, carregar arquivo, microfone e memória dos bancos.
- **SONG:** lista de passos da song (segmento e número de repetições).
- **SETUP:** resolução, taxa de amostragem, limite de memória, faixa do TUNE, filtro S950, volume de saída, MIDI e projeto.
- **AJUDA:** guia rápido.

## 6. Teclado do computador

| Tecla | Função |
|---|---|
| A S D F G H J K | Pads 1 a 8 |
| Z X C V | Bancos A, B, C, D |
| Espaço | RUN/STOP |
| R | RECORD |
| T (segurar) | TAP/REPEAT |
| Backspace (segurar) | ERASE |
| 0 a 9, ponto, Enter, Esc | Teclado numérico (Esc = NO) |
| - e + | Setas ◀ ▶ |

## 7. MIDI

Ative em SETUP > ATIVAR MIDI (Chrome, Edge ou Opera).

- **Notas 36 a 67** tocam os 32 sons direto: 36 = A1, 43 = A8, 44 = B1, e assim por diante. Num controlador com dois bancos de 8 pads (36-43 e 44-51), o banco A toca o banco A e o banco B toca o banco B.
- **CC 20 a 27** movem os sliders 1 a 8 no modo atual.
- Com "Pads sensíveis a força" ligado, a velocity do MIDI controla o volume. No SP-1200 original os pads não eram sensíveis.

## 8. Extras (não existem no SP-1200)

- Filtro passa-baixa de 6ª ordem estilo Akai S950 no master.
- Resolução de 8, 12 ou 16 bits e taxas de 13,02, 26,04 ou 44,1 kHz.
- Grade de edição por passos, exportação em WAV, salvamento automático.
