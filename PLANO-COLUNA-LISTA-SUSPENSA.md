# Plano — Coluna do tipo "lista suspensa" (dropdown colorido)

Status: **planejamento, nada implementado.**

## Pedido
Um tipo de coluna em que cada célula é uma **lista suspensa** (ex.: Sim / Não), com **cor por opção**. **Só o administrador** cria/edita a coluna, as opções e as cores; quem preenche só escolhe.

## Como o sistema guarda colunas hoje (aproveitar, sem migration)
- Colunas personalizadas ficam em `Base.headers.__cols__` como `{ key, label }`; valores em `ContactCustomValue` (texto). Só admin altera a estrutura (`PUT /api/bases/[id]/colunas`); qualquer usuário preenche (`POST /api/contacts/[id]/custom`).
- Mudança de estrutura já propaga ao vivo (evento `layout` com `customCols`) e valores também (evento `edit`).

## Proposta

### Modelo
`{ key, label, tipo?: "texto" | "lista", opcoes?: [{ valor: "Sim", cor: "verde" }, …] }`
- Sem `tipo` = texto (**colunas existentes não mudam nada**).
- Valor continua sendo **texto simples** (o nome da opção) → importação, exportação CSV, filtros por valor, busca, completude e histórico funcionam como hoje.
- Cores: paleta fixa de 8 (verde, vermelho, âmbar, azul, roxo, rosa, cinza, laranja) com contraste garantido; atalho "Sim/Não" já com verde/vermelho.

### Admin (única pessoa que configura)
- Menu da coluna ganha **"Tipo da coluna"** → Texto / Lista suspensa.
- Editor de opções: adicionar, renomear, reordenar, remover, escolher cor (bolinhas), com atalho **Sim / Não**.
- Validação no servidor (`/colunas`): só admin; máx. 20 opções, nomes únicos até 40 caracteres, cor da paleta.
- Mudar o tipo de uma coluna **com dados** pede confirmação (valores que não casam ficam como estão, marcados "fora da lista").

### Quem preenche (LDR/qualquer usuário)
- Célula mostra um **selo colorido** com o valor; clicar (ou Enter) abre a lista das opções; escolher grava na hora (mesmo caminho de salvar célula, então tempo real e desfazer funcionam).
- Pode **limpar** a célula. **Não** cria nem altera opções.
- Colar/digitar valor que **não está na lista** é recusado (ou ignorado ao colar em bloco), com aviso — evita sujeira.
- Valor antigo que não existe mais na lista aparece em cinza "(fora da lista)" até alguém trocar.

### Detalhes
- Filtro por valores da coluna já existe e passa a listar as opções com a cor.
- Exportação CSV: sai o texto da opção (sem cor).
- Importação: continua criando colunas de texto; o admin converte para lista depois.
- Preenchimento (completude): célula com opção escolhida conta como preenchida.
- Relatórios/metas: sem mudança.

## Implementação (fases, publicando por etapa)
1. **Modelo + servidor** (`base-columns.ts`, `/colunas`): novos campos, validação, testes unitários (opções, cores, tipos antigos intactos).
2. **Admin**: menu "Tipo da coluna" + editor de opções/cores (usa o `Dialog` do sistema).
3. **Célula**: selo colorido + lista suspensa, teclado, colar/limpar, "fora da lista".
4. **Filtro/exportação** e verificação (build, testes, conferir no servidor, tempo real entre duas telas).
Estimativa: ~1 dia.

## Decisões para você
1. **Escolha única** (uma opção por célula) está bom, ou quer **múltipla** (ex.: várias tags)? Sugestão: única.
2. **Valor fora da lista** ao colar: recusar (sugestão) ou aceitar e marcar?
3. Quem pode **limpar** a célula: qualquer usuário (sugestão) ou só admin?
4. Pode haver **valor padrão** (ex.: toda linha nova nasce "Não")? Sugestão: opcional, definido pelo admin.
