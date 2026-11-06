# Pesquisa: sample packs de boom bap livres

Pesquisa feita em 05/11/2026 para escolher o kit padrão do RJ-2000 e montar a futura biblioteca da DCX Audio.

## A diferença que importa

Quase todo pack "grátis" é **royalty-free**. Isso quer dizer que você pode usar os sons nas suas músicas, inclusive comerciais, mas **não pode redistribuir os arquivos**.

Para colocar sons dentro do repositório (o kit padrão do RJ-2000 ou uma biblioteca aberta), a licença precisa permitir redistribuição:

- **CC0:** domínio público, sem condições.
- **CC BY:** uso livre, desde que o autor receba crédito.

## 1. Podem entrar no repositório

| Pack | O que tem | Licença | Observação |
|---|---|---|---|
| [Boom bap kit, fingerdrum.io](https://fingerdrum.io/sample-kits) | 16 sons, 34 samples, bateria com cara de vinil | CC0 e CC BY 4.0 (misto) | Melhor candidato a kit padrão. Exige crédito aos autores e manter o README.txt de créditos junto dos arquivos. O site também tem kits Dusty lo-fi, Jazz, Funk e 808 nas mesmas licenças. |
| [Freesound](https://freesound.org), filtrando por licença CC0 | Milhares de one-shots enviados pela comunidade | CC0, arquivo por arquivo | Bom para completar o kit som a som. Conferir a licença de cada arquivo e anotar autor e link. |
| DCX Kit 01 (`samples/dcx-kit-01`) | 24 sons sintetizados por código para o RJ-2000 | CC0 (nosso) | Garante que o app sempre tenha um kit livre, mesmo sem baixar nada. |

## 2. Bons para produzir, mas não para o repositório

Estes são royalty-free: pode usar nas músicas, mas não pode redistribuir os arquivos.

| Pack | O que tem |
|---|---|
| [Old School Drum Kit, BVKER (wavbvkery)](https://wavbvkery.com/boom-bap-drum-kit/) | 106 hits tirados de discos: 30 kicks, 31 snares, 25 hats e 20 percussões |
| [537 Free '90s Hip-Hop Samples, MusicRadar](https://www.musicradar.com) | 537 WAVs: hits, loops, baixos, acordes e chiado de vinil |
| [Boom Bap Pack, SoundPacks (DJ Sonny)](https://soundpacks.com/free-sound-packs/boom-bap-pack/) | Mais de 40 one-shots gravados numa MPC 1000 e mais de 100 sons extras |
| [Boom Bap Drum Kit Vol. 1, SoundPacks (GINTRO)](https://soundpacks.com/free-sound-packs/boom-bap-drum-kit-vol-1/) | 210 one-shots no estilo East Coast dos anos 90. A página não informa a licença; conferir no arquivo baixado. |
| [GRIT Boom Bap Drum Kit, ProducerGrind](https://producergrind.com/products/grit-boom-bap-drum-kit) | Kicks, snares, pratos e breaks para um boom bap mais sujo |
| [Kit da Glitch Magic](https://glitchmagic.com/blogs/news/tips-for-building-a-boom-bap-drum-kit-free-download) | Kit grátis acompanhado de um guia de escolha de sons |

## 3. Cuidado

Desconfie de kits "do produtor famoso" (como os de 9th Wonder ou de Hi-Tek e Nottz) distribuídos por sites de terceiros. Geralmente não são oficiais e costumam ser hits tirados de discos sem liberação.

- **Estudo:** podem ser usados.
- **Lançamento comercial:** evite.
- **Repositório:** nunca coloque.

## O que foi feito (06/11/2026)

- **Banco A:** 8 sons do Boom bap kit do fingerdrum.io viraram o kit padrão (`samples/boom-bap-01`).
- **Créditos:** o fingerdrum.io monta o README de créditos na hora do download (não é um arquivo do site). As fontes vêm dos dados da página: MuldjordKit e DRSKit (DrumGizmo, CC BY 4.0), Virtuosity Drums e VCSL (CC0). Estão em `samples/boom-bap-01/LICENSE.txt`.
- **Memória:** os 8 sons foram cortados para caber em 2,5 s. Kicks, snares, rim e clap foram acelerados 1,35× (macete dos 45 RPM) e tocam com tune −5,2.
- **Reserva:** o DCX Kit 01 sintetizado continua no repositório.

## Próximos candidatos

Kits do fingerdrum.io para outros bancos, se quisermos:

| Kit | Licença | Fontes |
|---|---|---|
| Dusty lo-fi | CC0 | Karoryfer (Gogodze Phu, Big Rusty Drums), Virtuosity Drums, VCSL |
| Jazz | CC0 | Virtuosity Drums, VCSL |
| 808 drum machine | CC0 | TR-808 de Michael Fischer, Sonic Pi |
| Funk | CC BY 4.0 / CC0 | DRSKit, Virtuosity Drums, VCSL |

## Melodias: gravações antigas em domínio público

Pesquisa feita em 06/11/2026 para um banco de melodias de exemplo, no espírito de samplear disco antigo.

### Regra para entrar no repositório

Uma gravação só pode entrar se estiver livre nas duas camadas e nos dois países que importam para o projeto:

- **Gravação (fonograma):**
  - **Brasil:** 70 anos contados de 1º de janeiro do ano seguinte à fixação (Lei 9.610/98, art. 96). Gravações de antes de 1956 estão livres.
  - **Estados Unidos:** pela Music Modernization Act, as gravações publicadas até 1925 entraram em domínio público em 1º/01/2026.
- **Composição:**
  - **Brasil:** vida do autor + 70 anos (art. 41). O compositor precisa ter morrido antes de 1956.
  - **Estados Unidos:** obras publicadas até 1930 estão livres em 2026.

Na prática: **gravação de até 1925, de compositor morto antes de 1956.**

### Melhor fonte: choro carioca de 1907 a 1913 (Wikimedia Commons)

Gravações acústicas em 78 rpm, com flauta, clarinete, cavaquinho, violão e piano. É o Rio de Janeiro do começo do século, com o chiado e o grão que combinam com o SP-1200. Os arquivos estão marcados como `PD-Brazil-media` e, por serem anteriores a 1923, também estão livres nos EUA.

| Arquivo | Composição | Intérpretes | Ano | Tamanho |
|---|---|---|---|---|
| [Corta jaca](https://commons.wikimedia.org/wiki/File:Corta_jaca_1912.ogg) | Chiquinha Gonzaga (†1935) | Grupo Chiquinha Gonzaga: flauta, violão, cavaquinho | 1910-12 | 780 KB |
| [Plangente](https://commons.wikimedia.org/wiki/File:PLANGENTE_(Chiquinha_Gonzaga)_Grupo_Chiquinha_Gonzaga_1912.ogg) | Chiquinha Gonzaga | Grupo Chiquinha Gonzaga | 1912 | 2,1 MB |
| [Mariana em sarrilho](https://commons.wikimedia.org/wiki/File:MARIANA_EM_SARRILHO_(Irineu_de_Almeida)_-_Grupo_do_Novo_Cord%C3%A3o_1907.ogg) | Irineu de Almeida (†1916) | Grupo do Novo Cordão: clarinete, cavaquinho, violão | 1907 | 1,2 MB |
| [Cruzes, minha prima!](https://commons.wikimedia.org/wiki/File:Cruzes,_minha_prima!_Agenor_bens_Joaquim_Callado.ogg) | Joaquim Callado (†1880) | Agenor Bens (flauta), Arthur Camilo (piano) | 1913 | 941 KB |

Outras da mesma categoria que também servem: Falena (1913), Pudesse esta paixão (1912), Cubanita, Te amo e Sultana (1908), todas de Chiquinha Gonzaga.

**Ficam de fora:**

- *Sofres porque queres* (Pixinguinha, 1919): a gravação é livre, mas a composição só entra em domínio público no Brasil em 2044 (Pixinguinha morreu em 1973).
- *Cigana de Catumbi* (1925): não confirmamos a data de morte do compositor.

### Outras fontes

- **Jazz e blues dos EUA de 1917 a 1925 (Wikimedia Commons, `PD-US-record-expired`):** por exemplo, Original Dixieland Jass Band (1917) e New Orleans Rhythm Kings (1922). Muitas foram transferidas do acervo de 78 rpm do Internet Archive.
- **Musopen:** gravações modernas e limpas de música clássica, marcadas como domínio público. O Musopen pede crédito, mas como cortesia, sem obrigação legal.
- **Acervo do IMS (Instituto Moreira Salles):** cerca de 6.000 gravações raras de selos como Casa Edison, Phoenix e Faulhaber. É ótimo para ouvir e pesquisar, mas os termos de uso não deixam claro se podemos redistribuir. Por isso, para o repositório, preferimos o Commons.

## Fontes

- [fingerdrum.io, Free Drum Sample Kits](https://fingerdrum.io/sample-kits)
- [wavbvkery, Free Boom Bap Drum Kit](https://wavbvkery.com/boom-bap-drum-kit/)
- [SoundPacks, Boom Bap Drum Kit Vol. 1](https://soundpacks.com/free-sound-packs/boom-bap-drum-kit-vol-1/)
- [Magnetic Magazine, melhores packs grátis de boom bap (jul/2026)](https://magneticmag.com/2026/07/best-free-boom-bap-sample-packs-to-make-laid-back-grooves-on-a-budget/)
- [KVR, BVKER lança pack grátis de hip hop old school](https://www.kvraudio.com/news/bvker-releases-free-old-school-hip-hop-sample-pack-via-wavbvkery-49810)
- [Wikimedia Commons, categoria Acoustical/mechanical recording](https://commons.wikimedia.org/wiki/Category:Acoustical/mechanical_recording)
- [Wikimedia Commons, regras de direito autoral do Brasil](https://commons.wikimedia.org/wiki/Commons:Copyright_rules_by_territory/Brazil)
- [Wikimedia Commons, Template:PD-US-record-expired](https://commons.wikimedia.org/wiki/Template:PD-US-record-expired)
- [UCSB, Public Domain Day 2026 (gravações de 1925)](https://adp.library.ucsb.edu/index.php/resources/detail/516)
- [Billboard Brasil, IMS libera 6 mil gravações raras](https://billboard.com.br/ims-disponibiliza-de-graca-6-mil-gravacoes-raras-da-musica-brasileira/)
