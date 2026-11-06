# Changelog

## v0.0 (em teste)

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
