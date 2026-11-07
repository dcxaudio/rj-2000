# Changelog

## Próxima

- MIDI Learn desliga o mapa padrão: com qualquer controle aprendido, as notas 36 a 67 e os CC 20 a 27 param de valer, para teclas, Shift e knobs do controlador não mexerem em nada sem querer. Clear MIDI Learn volta ao mapa padrão.
- SET-UP 23 > Save MIDI Learn e Load MIDI Learn: guardar e carregar o mapa do controlador num arquivo.
- SET-UP 23 > MIDI Monitor: mostra a última mensagem MIDI e para onde ela foi; Enter salva o registro das últimas 500 mensagens. O registro também vai para o console do navegador (`[MIDI]`, nível Verbose).

## b0.3 (beta)

- MIDI Learn: os seletores (bancos, Tune/Decay-Mix-Multi, Song/Segment) também são escolhidos tocando nas luzes e nos nomes ao lado do botão. O Set-up também aprende.
- MIDI Learn: knob sem fim (encoder) salvo como knob comum fazia o slider pular para o meio e travar. Agora ele é reconhecido nos primeiros toques, sozinho, inclusive nos mapeamentos já salvos, e anda também nos valores em degraus (decay, multi level).
- MIDI Learn: encoder ligado a um botão vale um toque por passo; botão que só manda 127 aperta de novo a cada toque.
- RJ-950: grupo de corte por sample (Edit Sample, página 5): samples no mesmo grupo cortam um ao outro, para fatiar loops. A cópia herda o grupo.
- Disk 9 agora é New: começa do zero com o kit padrão, mantendo o canal MIDI e o tempo de sample.
- Saíram opções pouco usadas: Disk 7 e 8 (Catalog), SET-UP 21 (1st Song Step) e SET-UP 23 > Dynamic Alloc. A song sempre começa no passo 1 e cada som sai sempre no canal do SET-UP 17.

## b0.2 (beta)

Versão para o navegador. A cópia fiel ao SP-1200, com tudo da b0.1, fica no branch `classic`, base do futuro RJ-2000 Classic.

- MIDI Learn no SET-UP 22: toque num controle do SP ou do RJ-950, mexa no controlador, a última mensagem aparece no LCD e o Enter salva. Vale para pads, sliders, knobs, botões, transporte e o Control do 950. Aceita notas, CC, pitch bend e program change, e percebe sozinho knob sem fim (encoder). O mapa fica salvo no navegador, fora do projeto.
- O MIDI liga sozinho a cada boot depois da primeira vez.
- O canal do mapa padrão (notas 36 a 67, CC 20 a 27) foi para o SET-UP 23 > MIDI Channel (Omni ou 01 a 16). Novo SET-UP 23 > Clear MIDI Learn.
- Saiu o módulo Sync (Internal, MIDI, SMPTE e Click): sincronizar por clock não faz sentido no navegador.
- Saiu o Disk 9 (Format/Copy Software).
- RJ-950: girar o Control para mudar início ou fim enquanto o sample toca não engasga mais. Antes cada passo criava uma cópia nova do áudio e a memória ia acumulando; agora o sample fica guardado uma vez só e toca direto o trecho escolhido.

## b0.1 (beta)

Painel e funcionamento refeitos para ficar o mais perto possível do SP-1200 original.

- Painel no layout da máquina, em preto com LCD verde: Set-up, Disk, Sync, Sample, Master Control, Programming e Performance.
- Saíram os extras que a máquina não tem: grade de passos, abas, filtro S950 (que voltou como parte do RJ-950), bits e taxa, exportar WAV e o display de LED.
- Tudo pelo LCD 2 x 16, com mensagens em inglês como as originais. No teclado, 7 = No e 9 = Yes.
- Segmentos e songs de 00 a 99, tempo por segmento e por song, compasso e tamanho com tempos extras.
- Song mode editado passo a passo (repeat, end, tempo change, mix change, subsong).
- Mix por som e 8 mixes guardados; tune ou decay por som; multi pitch e multi level pelo Set-up.
- Canal por som, alocação dinâmica e filtros por par de canais.
- Loop/truncate pelos sliders; sampling pelas funções 1 a 9 do Sample; Disk com arquivos separados de sequências e sons.
- Primeira diferença proposital em relação ao original: o Record/Edit, com a máquina parada, volta para a tela principal, conta 1 compasso e começa a gravar. Tocando, o LCD mostra `Play`/`Rec` com compasso e tempo. As diferenças ficam listadas no manual (seção 13).
- Samples nos pads do jeito do SP-1200: um arquivo por pad, por Sample > pad > 8 (Load File) ou arrastando para o pad, também no celular. O arquivo entra como se fosse gravado: começa no limiar e para no Sample Length ou no fim da memória do banco (`Length Reached`). Pergunta `Load at 45 RPM?` (acelera 1,35× e põe tune −5,2). Som cortado ganha fade de 4 ms.
- Tempo de sample de 20 s por padrão (5 s por banco), como na reedição da Rossum; SET-UP 23 > Sample Time volta aos 10 s do original. O Sample Length vai até 5 s.
- Novo RJ-950, um sampler de rack embaixo do SP, inspirado no Akai S950: LCD de 2 x 40, 8 modos, teclado, knob Control, disquete para soltar arquivos, 12 bits de 7,5 a 48 kHz, 2,25 MB (48 s a 32 kHz), 8 vozes. Por sample: início e fim no cruzamento de zero, loop, tune, fine, level, reverse e filtro passa-baixa de 2 polos. Os pads do SP mandam notas para o 950, ao vivo e pelo sequenciador, e cada pad aponta para um sample (Edit Program). Copy cria cópias que dividem a memória, para fatiar um loop entre pads. Memória salva no navegador e em arquivo.
- Saiu o Chop (fatiar um sample longo nos pads do SP): esse trabalho agora é feito no RJ-950.
- Sample enxuto: saíram o 3 (Level, agora só o knob Gain de −12 a +36 dB) e o 6 (Re-Sample); entrou o 8 (Load File). O microfone só é pedido quando uma função de gravação é usada.
- Banco B com melodias de exemplo: Choro 01, trechos de choro de 1907 a 1913 em domínio público (Chiquinha Gonzaga, Irineu de Almeida, Joaquim Callado), créditos em samples/choro-01.
- A máquina começa limpa: sem padrão nem song de exemplo.
- Novo kit padrão no banco A: Boom Bap 01, com 8 sons do Boom bap kit do fingerdrum.io (CC BY 4.0 / CC0, créditos em samples/boom-bap-01). Kicks, snares, rim e clap gravados acelerados (macete dos 45 RPM) e tocados com tune −5,2. Bancos C e D vazios.
- O DCX Kit 01 sintetizado fica como reserva. Novos scripts tools/cortar_samples.py e tools/montar_kit.py.
- Projetos salvos na b0.0 não abrem na b0.1 (o formato mudou).

## b0.0 (beta)

Primeira versão do RJ-2000, reescrita a partir do protótipo waveTracing SP950.

- 32 sons em 4 bancos, som de 12 bits / 26,04 kHz com afinação drop-sample.
- 8 canais com filtros no estilo SP-1200 e corte de voz por canal.
- Limite de memória de 2,5 s por banco (desligável).
- Sliders MIX, TUNE/DECAY, MULTI PITCH e MULTI LEVEL.
- Sequenciador com 99 segmentos, auto correct, swing, tap/repeat, erase ao vivo e song mode.
- Sampling pelo microfone, carregamento de arquivos e arrastar para os pads.
- Salvar/abrir projeto, salvamento automático e exportação WAV.
- Teclado do computador e MIDI.
- Extras: filtro S950, 8/12/16 bits e taxas de 13 a 44,1 kHz.
- Kit padrão DCX Kit 01, sintetizado e em domínio público.
- Corrigido: o protótipo não tocava som porque chamava funções que não existiam (`db2gain`, `updateLCDText`, `handleUploadedFile`).
