# Kanban pessoal

Kanban de uso diário para organizar demandas de trabalho. Site estático, sem backend: o app roda no navegador e grava os dados onde você escolher — no próprio navegador, num arquivo do seu computador, ou num `board.json` dentro de um repositório privado seu, pela API do GitHub.

**Board:** https://leonardo-lemmertz.github.io/kanban/

## Como funciona

| Peça | Onde | Papel |
| --- | --- | --- |
| App | `leonardo-lemmertz/kanban` (público) | Vite + React + TypeScript + Tailwind, publicado no GitHub Pages |
| Dados | `leonardo-lemmertz/kanban-data` (privado) | um único `board.json`; cada alteração vira um commit |
| Token | `localStorage` do seu navegador | autentica as chamadas `GET`/`PUT` na API do GitHub |

O token **nunca** entra no repositório, em nenhum arquivo, nem em variável de build. Ele é colado na tela **Config** do próprio app e fica só no navegador.

Sem token configurado o app funciona por completo — só não sincroniza: os dados ficam no `localStorage` daquele navegador e o indicador no canto mostra `só neste aparelho`.

## Onde os dados ficam: três modos

Escolhidos em **Config → Onde salvar o board**. Um modo por vez, trocável a qualquer momento.

| Modo | Onde grava | Precisa | Serve para |
| --- | --- | --- | --- |
| **Só neste navegador** (padrão) | `localStorage` | nada | uso num computador só |
| **Arquivo no computador** | um `.json` que você escolhe | Chrome ou Edge | ter os dados num arquivo de verdade — numa pasta de rede, sobrevivem à troca de máquina |
| **GitHub** | `board.json` no repo privado | um token | sincronizar entre aparelhos, inclusive celular e fora da rede da empresa |

### Modo arquivo

Em **Config**, escolha **Arquivo no computador** e depois:

- **Escolher onde salvar…** — cria (ou substitui) o arquivo, gravando nele o board que está na tela agora. É o caminho normal na primeira vez.
- **Abrir um arquivo existente…** — o contrário: lê o board de um arquivo já gravado e passa a usá-lo, substituindo o que estava na tela. É como você retoma o board em outra máquina.

A partir daí, cada alteração grava no arquivo — mesmo agrupamento de 2 s dos outros modos, para não escrever a cada tecla.

Detalhes que vêm da API do navegador, não da nossa implementação:

- Funciona no Chrome e no Edge. Firefox e Safari não expõem `showSaveFilePicker`; nesses o modo aparece desabilitado.
- O navegador não revela ao site a pasta completa do arquivo — só o nome. É por isso que a tela mostra apenas `board.json`.
- Ao reabrir o site, o navegador pode pedir a autorização de escrita de novo. Aparece uma faixa âmbar no topo com o botão **Autorizar**; até você clicar, as alterações ficam salvas no navegador e sobem para o arquivo depois.
- Se o arquivo for movido, renomeado ou apagado, o app avisa e pede que você escolha outro em Config — não quebra em tela branca.

Apontar o arquivo para uma pasta de rede (por exemplo `J:\Projetos\kanban-data\board.json`, que é um share do servidor) tira os dados do disco da sua máquina: o backup passa a ser o do próprio servidor, e outra máquina com o mesmo drive mapeado abre o mesmo board.

## Opcional: sincronizar entre aparelhos

**Nada nesta seção é obrigatório.** Ela só interessa se você quiser abrir o mesmo board em mais de um aparelho, incluindo celular e computador fora da rede da empresa. Se o que você quer é só não perder os dados ao trocar de máquina, o [modo arquivo](#modo-arquivo) resolve sem token. Para usar num computador só, pule direto para [Uso diário](#uso-diário).

Para ligar a sincronização, gere um token. O escopo abaixo é o mínimo necessário: um token com mais permissão do que isso não traz nenhuma vantagem para o app e aumenta o estrago caso vaze.

1. Acesse **https://github.com/settings/personal-access-tokens/new** (Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token).
2. **Token name:** `kanban` (ou o que preferir).
3. **Expiration:** defina uma data — 90 dias é um bom padrão. Evite `No expiration`.
4. **Resource owner:** sua conta.
5. **Repository access:** marque **Only select repositories** e escolha **apenas** `kanban-data`.
6. **Permissions → Repository permissions → Contents:** mude para **Read and write**.
   Não marque mais nada. O `Metadata: Read-only` aparece sozinho como dependência — é esperado.
7. **Generate token** e copie o valor (começa com `github_pat_`). Ele só é exibido uma vez.

### Onde colar

1. Abra o board: https://leonardo-lemmertz.github.io/kanban/
2. Clique em **Config** na barra superior.
3. Preencha:
   - **Usuário ou organização:** `leonardo-lemmertz`
   - **Repositório de dados:** `kanban-data`
   - **Arquivo:** `board.json`
   - **Branch:** `main`
   - **Token:** cole o `github_pat_…`
4. **Testar conexão** → deve responder quantos cards existem no board remoto.
5. **Salvar e recarregar**.

Repita em cada aparelho que for usar (celular, notebook de casa). O mesmo token serve, ou gere um por aparelho — assim você revoga um sem afetar os outros.

Quando o token expirar, o app mostra um aviso vermelho com botão para a tela de Config. Gere um novo e cole no mesmo lugar; nada se perde.

## Uso diário

- **Arrastar** cards entre colunas e dentro da coluna (desktop).
- No **celular**, as colunas rolam na horizontal com encaixe, e o menu **⋯** de cada card tem `Mover para…`, `Subir`, `Descer` e `Arquivar` — o arrastar por toque é frágil, então esse menu é o caminho principal ali.
- **Clique no card** abre o painel lateral de detalhe. As edições salvam automaticamente ao sair do campo.
- **Descrição** aceita markdown básico: `**negrito**`, `*itálico*`, `` `código` ``, `- listas`, `[texto](url)`.
- **Atalhos:** `N` novo card · `/` buscar · `Esc` fecha o painel / limpa a busca.
- **Prazo:** o card ganha selo âmbar quando vence hoje e vermelho quando já venceu.
- **WIP limit:** o contador da coluna fica vermelho quando passa do limite (menu ⋯ da coluna para definir).
- **Arquivar em vez de excluir:** o card sai do board e continua consultável na aba **Arquivo**, de onde pode voltar para qualquer coluna.

### Itens dentro do card

Um card grande costuma ser, na prática, muitas tarefas pequenas — uma frente com vários interlocutores, cada um num estado diferente. Para isso o card tem uma lista de itens, no painel lateral.

Cada item tem **três estados**, não dois: **a fazer**, **aguardando** e **feito**. O terceiro existe porque boa parte do trabalho não é nem pendente nem pronta — está na mão de outra pessoa. Clicar no marcador percorre os três.

- **Contador de espera**: o item em "aguardando" mostra há quantos dias está assim. É o que transforma "esperando retorno" em "esperando há 9 dias, hora de cobrar".
- **Data e hora por item**, independentes do prazo do card. Uma reunião marcada dentro de um item vira selo de verdade.
- **No card, no board**: um `3/22` com o total, o número de itens aguardando em âmbar, e — quando o card não tem prazo próprio — a data mais próxima entre os itens.
- **A busca enxerga os itens**, então procurar por um fornecedor acha o card que o menciona.

#### Converter uma descrição em itens

Card cujo texto já é uma lista (uma linha por assunto) ganha o botão **Converter descrição em N itens**. Cada linha vira um item, com dois chutes informados:

- linhas com "aguardando", "em contato", "chamei", "chamar" ou "retorno" viram **aguardando**;
- `24/08` vira data e `10h` vira hora — com cuidado para não confundir telefone (`0800 006 9500`) nem link (`meet.google.com/...`) com data.

É um chute, não uma promessa: revise depois. Por isso a conversão **não apaga a descrição original**, e o botão some assim que a lista tem itens, para não duplicar tudo num segundo clique.

### Vista "Pista"

Aba ao lado de **Board**: o mesmo board desenhado como uma volta de kart, com traçado inspirado em Interlagos (S do Senna, Curva do Sol, reta oposta, ferradura, junção, subida dos boxes).

O desenho imita uma foto aérea: asfalto escuro com linhas brancas nas bordas, zebra vermelha e branca, grama e áreas de escape em volta, e sombra sob a pista e sob cada kart. A impressão de volume vem de uma **projeção oblíqua** — o eixo vertical é achatado (`SQUASH`), como numa foto tirada de lado em vez de exatamente de cima.

A projeção é aplicada ao próprio `d` do path, não a um `transform` de grupo. Isso importa por dois motivos: `getPointAtLength()` já devolve a posição projetada (nada a converter na hora de posicionar os karts) e os textos dos marcos não saem achatados. O traçado em planta fica legível no código, em `PLAN`.

- Cada **coluna** do board é um **setor** da pista, na ordem em que estão no board — renomear ou reordenar colunas muda a pista sozinho.
- Cada **card** é um kart, distribuído dentro do seu setor pela ordem que tem na coluna.
- A **cor do kart** é a bandeira do prazo: vermelho atrasado, âmbar vence hoje, azul vence em breve, cinza sem prazo.
- **Clique num kart** para abrir o card. Busca e filtros valem aqui também; os cards filtrados saem da pista e a legenda diz quantos ficaram ocultos.
- Setor lotado encolhe os karts para não encavalar; acima de ~24 cards num setor o kart vira uma bolinha simples.
- A volta corre no **sentido anti-horário**, como Interlagos. A geometria do traçado está espelhada justamente para isso: percorrer o `path` na ordem em que foi desenhado (largada → S do Senna → Curva do Sol → reta oposta → … → junção) resulta no sentido anti-horário. Inverter o percurso, em vez de espelhar, embaralharia a ordem das curvas.

É uma vista de leitura, para olhar o todo — não dá para arrastar karts. Para mover um card a partir dela, abra pelo kart e use o seletor de coluna no painel. O traçado é uma aproximação estilizada do autódromo, não um decalque: as proporções foram ajustadas para caber na tela.

O posicionamento sai de `getPointAtLength()` no próprio `<path>` do SVG, então mudar o desenho da pista não exige mexer em nada da distribuição dos cards.

### Indicador de sincronização

| Estado | O que significa |
| --- | --- |
| `salvo` | tudo gravado no destino escolhido (arquivo ou GitHub) |
| `salvando` | alterações agrupadas; gravam em até 2 s de uma vez |
| `autorizar` | modo arquivo: o navegador quer sua confirmação para escrever — faixa âmbar no topo |
| `offline` | sem rede — as alterações estão salvas no aparelho e sobem quando a conexão voltar |
| `erro` | falha na gravação; o aviso no topo explica e aponta o caminho |
| `conflito` | o board foi editado em outro aparelho — veja abaixo |
| `só neste aparelho` | modo padrão: funciona, mas não grava fora do navegador |

Clicar no indicador força a gravação imediata e busca a versão do destino.

### Conflito entre aparelhos

As gravações vão com o `sha` do arquivo lido. Se você editou no celular e depois no PC, o GitHub recusa a segunda gravação em vez de sobrescrever. O app então mostra uma faixa com as duas versões (quantos cards, quando foi atualizada) e dois botões: **usar a do GitHub** ou **manter a deste aparelho e enviar**. Nada é decidido sem você clicar, e a versão descartada continua no histórico de commits.

## Backup e restauração

### Export/import manual

**Exportar** baixa o `board-<data>.json`. **Importar** substitui o board por um arquivo — e baixa automaticamente uma cópia do estado anterior antes de trocar. Funciona nos três modos; é o plano B se algo der errado.

### Restaurar a partir do histórico de commits

Todo salvamento é um commit no `kanban-data`, com mensagem descritiva (`chore: move "Revisar contrato" para Em andamento`). Para voltar no tempo:

**Pelo site do GitHub (sem instalar nada)**

1. Vá em `https://github.com/leonardo-lemmertz/kanban-data/commits/main/board.json` — a lista de todas as versões.
2. Clique no commit anterior ao estrago → botão **View file** → **Raw** → salve o arquivo.
3. No app, clique em **Importar** e escolha esse arquivo. Pronto — o estado volta, e a volta também fica registrada como um commit novo.

**Pela linha de comando (desfaz direto no repositório)**

```bash
git clone https://github.com/leonardo-lemmertz/kanban-data.git
cd kanban-data
git log --oneline -- board.json
git checkout <hash-do-commit-bom> -- board.json
git commit -m "restore: volta board.json para <hash>"
git push
```

Depois, no app, clique no indicador de sincronização para buscar a versão restaurada.

## Segurança: o trade-off que você está aceitando

O token fica no `localStorage` do navegador. Isso é o que permite um app sem backend e sem login — e o preço é direto:

- **Quem tiver acesso ao seu navegador tem acesso ao repositório de dados.** Sessão aberta, perfil do Chrome sincronizado, máquina compartilhada — tudo isso conta.
- É por isso que o **escopo mínimo importa**: um token restrito a `kanban-data` com `Contents: Read and write` só alcança o seu board. Não dá para ler seus outros repositórios, abrir issues, publicar código ou mexer na conta.
- É por isso que a **expiração importa**: um token vazado tem prazo de validade curto. Renovar leva 1 minuto.
- Em computador compartilhado, use **Config → Remover token deste navegador** ao terminar. O board continua salvo localmente; só a sincronização para.
- Suspeita de vazamento: revogue em **https://github.com/settings/personal-access-tokens** — o token morre na hora, sem afetar mais nada da sua conta.
- O repositório do app é público (exigência do GitHub Pages no plano free), mas ele contém **apenas código**. Seus dados estão no repositório privado, e o site público não tem serventia para quem não tem token.

## Desenvolvimento

```bash
npm install
npm run dev
```

O `vite.config.ts` usa `base: '/kanban/'` porque o Pages serve o site nesse caminho. Rodando local o Vite respeita isso automaticamente.

O push na `main` dispara `.github/workflows/deploy.yml`, que faz o build e publica no Pages.

### Estrutura

```
src/
  types.ts              Board, Column, Card, ChecklistItem, SCHEMA_VERSION
  lib/checklist.ts      estatisticas, contagem de espera e conversao de descricao
  storage/              persistência: uma interface, três adaptadores
    localAdapter.ts       localStorage (padrão)
    fileAdapter.ts        File System Access API, arquivo local
    handleStore.ts        guarda o handle do arquivo no IndexedDB
    githubAdapter.ts      API do GitHub, controle de sha, 409, 401/403
    migrate.ts            valida/normaliza qualquer JSON de entrada
  state/
    boardReducer.ts     ações puras; cada ação devolve sua mensagem de commit
    useBoard.ts         reducer + debounce de 2s + estado de sync + conflito
  components/           Board, ColumnView, CardTile, CardPanel, ArchiveView…
    TrackView.tsx       vista "Pista": o board como volta de kart
  lib/markdown.tsx      renderizador próprio, sem innerHTML
```

Dependências de runtime: só `react` e `react-dom`. O markdown é renderizado por código próprio produzindo elementos React (nunca `innerHTML`), com whitelist de protocolo nos links — num app que guarda token no navegador, um XSS na descrição do card seria roubo de token.

Para mudar o formato do `board.json`, incremente `SCHEMA_VERSION` em `src/types.ts` e trate a versão antiga em `src/storage/migrate.ts`. O schema está na **versão 2**, que acrescentou `checklist` ao card; board gravado na versão 1 abre normalmente, com a lista vazia.
