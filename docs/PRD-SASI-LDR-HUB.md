# PRD — SASI LDR Hub

**Documento de requisitos de produto (retrato do sistema + roadmap de melhorias)**

| | |
|---|---|
| Produto | SASI LDR Hub |
| Versão do documento | 1.0 (rascunho completo para revisão) |
| Data | 16/10/2026 |
| Base de informação | Código-fonte, banco de dados em produção e decisões tomadas com o David ao longo do desenvolvimento (jun–out/2026) |
| Público | Diretoria e gestores · time técnico · equipe de operação (LDRs, pré-vendedores, administradores) |
| Como ler | Partes 1 a 5 explicam o negócio e o vocabulário (leitura para todos). Partes 6 a 12 detalham o que o sistema faz, módulo a módulo. Partes 13 a 17 são técnicas. A parte 18 lista melhorias propostas e a 19 as perguntas em aberto. |

---

## Sumário

1. Resumo executivo
2. Contexto e problema
3. Visão, objetivos e o que NÃO é objetivo
4. Quem usa: cargos e permissões
5. Glossário: o vocabulário do sistema (o que é uma base de dados, planilha, linha, campanha…)
6. Como a informação é organizada (Órgão → Região → Planilha → Linha)
7. Regras de negócio centrais (completude, crédito, território, região, campanhas)
8. Módulo: Acesso e usuários
9. Módulo: Bases de Dados e a Planilha
10. Módulo: Correção de Contatos (fila de telefones)
11. Módulo: Validação de contatos
12. Módulo: Metas, Dashboard, Relatórios e Ranking
13. Módulos de apoio: Agenda, Sugestões, Assistente, Configurações
14. Integrações (HubSpot e Aluno a Bordo) e rotinas automáticas
15. Arquitetura técnica e modelo de dados
16. Requisitos não funcionais (desempenho, segurança, privacidade, disponibilidade, backup)
17. Padrões de interface (UX)
18. Estado atual em números, riscos e roadmap de melhorias
19. Decisões já tomadas e perguntas em aberto
20. Anexos (mapa de telas e APIs)

---

# 1. Resumo executivo

O **SASI LDR Hub** é o sistema interno em que a equipe comercial da SASI **organiza, limpa e confirma os contatos de órgãos públicos** (prefeituras, secretarias, consórcios, defensorias, PROCONs e outros) **antes** de eles seguirem para o CRM (HubSpot).

Em uma frase: **é a "mesa de trabalho" onde as bases de contatos são saneadas e qualificadas, e onde se mede a produção de quem faz esse trabalho.**

O sistema entrega, hoje, cinco coisas:

1. **Bases de dados em formato de planilha**, editáveis por várias pessoas ao mesmo tempo, em tempo real, com importação e exportação.
2. **Fila de correção de telefones** incorretos, com apoio de busca por IA e devolução do resultado ao HubSpot.
3. **Validação por ligação**: a equipe liga para contatos e registra Sim, Não ou "ainda não validado", planilha a planilha.
4. **Metas, relatórios e ranking** por pessoa, com crédito justo e auditável sobre quem completou, corrigiu ou validou cada contato.
5. **Camada de segurança operacional**: níveis de acesso, lixeira, histórico de alterações, revisão de créditos e backup.

Hoje o sistema atende cerca de 14 pessoas (11 LDRs e 3 administradores), 59 planilhas, 14,5 mil contatos ativos e uma fila de ~11 mil telefones a corrigir (números de 16/10/2026, detalhados na parte 18).

---

# 2. Contexto e problema

## 2.1 De onde vêm os contatos
A SASI vende soluções para o setor público. Os contatos de interesse (telefone da prefeitura, e-mail institucional, nome do prefeito, WhatsApp, site etc.) chegam de várias fontes: planilhas compradas ou montadas pela equipe, listas exportadas do HubSpot, pesquisas manuais e campanhas ("Cidade na Mão 2026", "Aluno a Bordo").

## 2.2 O problema
- Os dados chegam **incompletos, duplicados e desatualizados** (telefones que não atendem, e-mails errados, prefeitos que mudaram).
- Entrar no CRM com dado ruim **contamina** o funil: o vendedor liga para número errado, as campanhas perdem eficiência e os relatórios do CRM mentem.
- Antes do sistema, o trabalho de limpeza era feito em planilhas soltas, **sem saber quem fez o quê**, sem metas, sem fila de prioridade e sem histórico.

## 2.3 A solução
Uma camada operacional **antes do CRM**: a equipe trabalha as bases dentro do LDR Hub, o sistema mostra o que falta (completude), organiza os telefones ruins numa fila, registra quem confirmou cada contato por ligação e mede produção e metas com regras claras. O que está limpo volta ao HubSpot (telefone corrigido, etapa do ciclo de vida atualizada).

## 2.4 O que é "LDR"
**LDR** é a sigla usada na SASI para o profissional que faz a prospecção e qualificação de contatos (Lead Development Representative). No sistema, "LDR" é também o nome de um **cargo** (perfil de acesso). O **Pré-vendedor** tem o mesmo conjunto de permissões, com um escopo de dados menor (ver parte 4).

---

# 3. Visão, objetivos e o que NÃO é objetivo

## 3.1 Visão
Ser o lugar único e confiável onde a SASI **sabe o estado real de cada contato** (completo? correto? confirmado?) e **quem trabalhou nele**, para que somente dado limpo chegue ao CRM.

## 3.2 Objetivo central (definido com o David)
**Sanear e qualificar as bases antes do HubSpot.**

## 3.3 Objetivos específicos
| # | Objetivo | Como o sistema atende |
|---|---|---|
| O1 | Deixar cada contato **completo** (campos obrigatórios preenchidos) | Régua de completude, contadores, % por planilha, metas de preenchimento |
| O2 | Corrigir **telefones incorretos** com rapidez | Fila de correção, busca por IA, devolução ao HubSpot |
| O3 | **Confirmar por ligação** os contatos de planilhas escolhidas | Módulo de validação (Sim / Não / –) |
| O4 | Medir **produção por pessoa** de forma justa e auditável | Crédito por quem completa a linha, histórico de células, Revisar créditos |
| O5 | Dar **metas claras** e mostrar o progresso | Metas por território, por campanha e por planilha validada |
| O6 | Trabalhar **em equipe, ao mesmo tempo**, sem perder dado | Planilha em tempo real, lixeira, desfazer, histórico, backup |
| O7 | Garantir **segurança e controle de acesso** | Cargos, estrutura só do admin, trilha de auditoria |

## 3.4 Fora de escopo (o que o sistema NÃO é)
- **Não é um CRM.** Não gerencia negócios, funil de vendas nem propostas; isso é o HubSpot.
- **Não envia e-mails de marketing nem faz ligações.** A equipe liga por fora e registra o resultado.
- **Não é um data warehouse/BI.** Os relatórios são operacionais, sobre a produção da equipe.
- **Não tem aplicativo móvel nativo.** Funciona no navegador; o uso principal é em computador (a planilha é uma tela de trabalho pesada).

## 3.5 Indicadores de sucesso
Definidos com o David (em 16/10/2026). Os três primeiros são os indicadores adotados; **as metas numéricas ainda precisam ser definidas** (ver Q1 na parte 19).

| # | Indicador | O que mede | Fonte no sistema hoje |
|---|---|---|---|
| I1 | **Tempo para uma base ficar 100% pronta** | Dias entre a planilha ter o primeiro dado e chegar a 100% completa (e validada, nas planilhas com validação) | % de preenchimento e validação por planilha (cartões de Bases, Relatórios → Validação). *Falta registrar a data em que cada planilha atinge 100%.* |
| I2 | **Economia de retrabalho do vendedor** | Menos ligações para número errado e menos contatos ruins no CRM, na percepção de quem vende | Telefones corrigidos, fila de correção, taxa de acerto da validação. *O "retrabalho" em si ainda é medido por pesquisa com os vendedores.* |
| I3 | **Engajamento da equipe** | Quantas pessoas usam o sistema e quanto produzem, sem comparar com meta | Produção por pessoa (Relatórios → Desempenho), horários, ranking. *Falta registrar usuários ativos por dia/semana.* |

Observação: o David também indicou que ainda não tem certeza de que esses três bastam; a lista pode mudar. O sistema já **calcula** a produção, a completude, a validação e a fila; o que falta é registrar a data de "100% pronta" (I1) e o uso diário (I3).

---

# 4. Quem usa: cargos e permissões

O sistema tem **três cargos**. O cargo é lido do banco a cada acesso (cache de 8 segundos), então uma mudança de cargo vale sem precisar sair e entrar de novo.

## 4.1 Os cargos

**Administrador (também chamado informalmente de "superadmin")**
Quem gerencia o sistema e a equipe. Vê **tudo**: todas as bases, a produção de todas as pessoas, relatórios completos. É o único que pode mudar a estrutura (colunas, páginas), importar e exportar planilhas, ligar a validação, definir metas, gerenciar usuários, ver e ajustar créditos e acessar configurações e backup. Hoje são 3 pessoas.

**LDR**
Quem faz o trabalho operacional: preenche as planilhas, corrige telefones, valida contatos. Edita o **conteúdo** das células, mas **não** a estrutura da planilha; **não** importa, **não** exporta, **não** exclui bases. No relatório, vê **só o que é dele**, e no Ranking vê a equipe (com limites de privacidade). Hoje são 11 pessoas.

**Pré-vendedor**
Mesmas permissões do LDR, com duas diferenças: **não vê "Bases de Dados"** no menu e, na correção de contatos, vê apenas os contatos cujo **"Proprietário" no HubSpot** esteja vinculado a ele. (Sem vínculo, a tela mostra um aviso.)

## 4.2 Matriz de permissões

| Ação | Admin | LDR | Pré-vendedor |
|---|:---:|:---:|:---:|
| Ver Bases de Dados (órgãos, regiões, planilhas) | ✔ | ✔ | ✘ |
| Editar conteúdo das células | ✔ | ✔ | ✘ (sem acesso às bases) |
| Criar/renomear/excluir coluna, tipo da coluna (lista suspensa), páginas | ✔ | ✘ | ✘ |
| Ligar/desligar "Validar planilha" | ✔ | ✘ | ✘ |
| Registrar Sim/Não na coluna Validado | ✔ | ✔ | ✘ |
| Importar planilha (CSV/Excel) e desfazer importação | ✔ | ✘ | ✘ |
| Exportar planilha / relatórios (CSV) — o CSV do **Ranking** qualquer cargo baixa, com a mesma privacidade da tela | ✔ | ✘ (só Ranking) | ✘ (só Ranking) |
| Apagar base (vai para a Lixeira), restaurar da Lixeira | ✔ | ✘ | ✘ |
| Corrigir telefones (fila) | ✔ | ✔ | ✔ (só o seu proprietário) |
| Ver Dashboard próprio | ✔ (visão da equipe) | ✔ | ✔ |
| Definir metas | ✔ | ✘ | ✘ |
| Relatórios: ver a equipe inteira, "ver de quem" | ✔ | ✘ | ✘ |
| Relatórios: ver o próprio desempenho, horários, validação, correções | ✔ | ✔ | ✔ |
| Ranking da equipe | ✔ (completo) | ✔ (sem Sim/Não/taxa dos colegas) | ✔ (idem) |
| Revisar créditos (remover/reatribuir) | ✔ | ✘ | ✘ |
| Gerenciar usuários, convites, vínculo de proprietário | ✔ | ✘ | ✘ |
| Sugestões: enviar | ✔ | ✔ | ✔ |
| Sugestões: ler e triar | ✔ | ✘ | ✘ |
| Configurações da conta | ✔ | ✔ | ✔ |
| Configurações de integração e backup | ✔ | ✘ | ✘ |
| Agenda (reuniões do HubSpot) | ✔ | ✔ | ✔ |
| Assistente do sistema (chat) | ✔ (contexto da equipe) | ✔ (contexto próprio) | ✔ (contexto próprio) |

> **Regra de ouro de segurança:** quando uma tela mostra "dados da pessoa logada", a identidade vem **sempre da sessão** (login), nunca de um parâmetro de URL. O servidor — e não só a tela — recusa dados de outra pessoa a quem não é admin.

---

# 5. Glossário: o vocabulário do sistema

Esta parte explica, em linguagem simples, cada conceito que aparece no sistema. Se você ler só uma parte do documento, leia esta.

## 5.1 Base de dados (ou "base")
Uma **base de dados** é um **conjunto organizado de informações guardadas num mesmo lugar**, em linhas e colunas, do mesmo jeito que uma planilha do Excel. No SASI LDR Hub, uma base é uma **lista de contatos de órgãos públicos** que a equipe vai trabalhar. Exemplo: "todas as secretarias de saúde municipais do Nordeste".

Cada base tem um nome, uma origem (criada à mão ou importada de arquivo) e uma estrutura de colunas.

## 5.2 Planilha
No sistema, **base e planilha são a mesma coisa vista de dois lados**: a "base" é o cadastro (nome, dono dos dados, colunas) e a "planilha" é a **tela** em que você enxerga e edita as linhas da base. Na conversa do dia a dia, a equipe diz "planilha". Tecnicamente, no banco, o nome é *Base*.

## 5.3 Linha, contato e município
Cada **linha** da planilha é um **contato** de um órgão público, normalmente identificado por **um município** (uma prefeitura ou a secretaria dele). Quando se diz "este contato está completo", fala-se da linha inteira.

## 5.4 Coluna e célula
A **coluna** é um tipo de informação (telefone, e-mail, prefeito…). A **célula** é o cruzamento de uma linha com uma coluna: o dado em si.

- **Colunas padrão** (19 campos): cidade, estado, região, população, telefone geral da prefeitura, e-mail institucional, secretaria de administração, nome do prefeito, site oficial, WhatsApp, código IBGE, origem do contato, fase do ciclo de vida, campanha, setor, departamentos, solução de interesse, prospectante e proprietário.
- **Colunas personalizadas**: criadas pelo administrador para necessidades específicas da planilha (texto livre ou **lista suspensa** com opções coloridas, como "Sim / Não / Pendente").
- A **coluna "Validado"** é uma coluna especial do sistema (parte 11).

## 5.5 Órgão (tipo de órgão)
O **órgão** é o **tipo de instituição pública** à qual os contatos pertencem: Prefeitura, Secretaria de Educação, Secretaria de Saúde Municipal, Consórcios, SESCOOP, PROCON estadual, Defensoria Pública Estadual, Associações Estaduais de Municípios, Localidades em Estado de emergência e calamidade, entre outros. Hoje há 12 órgãos.

## 5.6 Região
O Brasil é dividido em **5 regiões**: Norte, Nordeste, Centro-Oeste, Sudeste e Sul. Cada órgão tem **uma planilha por região** (por isso um órgão completo tem até 5 planilhas).

## 5.7 Convenção de nome
Toda planilha segue o padrão **"{Órgão} - {Região}"**, por exemplo *"Secretaria de Saúde Municipal - Nordeste"*. O sistema usa esse nome para saber a que órgão e região a planilha pertence (e agrupar os cartões na tela de Bases).

## 5.8 Página (aba) da planilha
Dentro de uma planilha, as linhas podem ser separadas em **páginas** (abas na parte de baixo, como no Excel): uma por **estado (UF)** ou uma **página livre** com nome qualquer, criada pelo administrador. Servem para organizar o trabalho e **não mudam a planilha**: são só um agrupamento das linhas.

## 5.9 Campanha
Uma **campanha** é uma iniciativa comercial/marketing no HubSpot à qual o contato pertence. As campanhas **ativas** hoje são **"Cidade na Mão 2026"** e **"Aluno a Bordo"**. Outras grafias que apareçam (por exemplo "Cidade na Mão 2061") são ruído de dados e ficam fora dos filtros.

## 5.10 HubSpot (CRM)
**CRM** é o sistema de relacionamento com clientes onde vivem contatos, empresas, negócios e reuniões. O da SASI é o **HubSpot**. O LDR Hub conversa com ele: lê contatos/campanhas, lê reuniões (Agenda) e devolve correções.

## 5.11 Fase do ciclo de vida
Campo do HubSpot que diz em que etapa o contato está. O sistema usa duas etapas especiais: **"Telefone incorreto"** (entra na fila) e **"Telefone atualizado"** (saiu da fila). Para "número não encontrado" há uma etapa própria.

## 5.12 Completude ("linha completa")
Uma linha está **completa** quando os **7 campos obrigatórios** (a "régua") estão preenchidos **e** todas as colunas personalizadas **visíveis** também. Detalhes na parte 7.

## 5.13 Fila de correção
A lista de contatos com **telefone incorreto**, aguardando que alguém ache o número certo. Cada item é uma **correção pendente**.

## 5.14 Validação (Sim / Não / –)
Registro do resultado de **ligar para o contato para confirmar** que ele está correto. **Sim** = confirmado; **Não** = ligou e está errado/inexistente; **–** = ainda não validado.

## 5.15 Meta
Uma **quantidade a atingir num prazo** (diária, semanal ou mensal), definida pelo admin para uma pessoa e para um escopo (um território, uma campanha ou uma planilha validada).

## 5.16 Território
O **escopo de uma meta de preenchimento**: uma planilha + região + estado (ou "toda a planilha"). Só o que foi feito **dentro do território** conta na meta.

## 5.17 Crédito
O **registro de quem completou uma linha**. É a base de toda a medição de produção de preenchimento: se você completou a linha, o crédito é seu.

## 5.18 Produção
Tudo o que a pessoa fez em um período: **linhas completadas** + **correções feitas** + **contatos validados**. A produção aparece nos totais, no ranking e nos relatórios, **independentemente** de existir meta.

## 5.19 Ranking
Classificação da equipe por produção num período. Há quatro quadros: Atividades, Preenchimento, Validação e % da meta.

## 5.20 Lixeira e exclusão reversível
Nada importante é apagado de vez na hora. **Linhas** excluídas ficam marcadas como excluídas e podem voltar (desfazer). **Planilhas inteiras** apagadas vão para a **Lixeira** por 30 dias e podem ser restauradas com os mesmos dados e créditos.

## 5.21 Tempo real
Várias pessoas editam a mesma planilha **ao mesmo tempo**; cada alteração aparece para os outros em instantes, e o sistema mostra quem está com a planilha aberta.

## 5.22 Soft delete, snapshot, auditoria (termos técnicos)
- **Soft delete:** "apagar" marcando como apagado, sem remover do banco.
- **Snapshot:** foto congelada de um resultado (por exemplo, o resultado de uma meta quando o período fecha).
- **Auditoria:** registro permanente de quem fez o quê e quando.

---

# 6. Como a informação é organizada

A navegação em **Bases de Dados** tem **três níveis**, do mais geral ao mais específico:

```
Nível 1 — Bases de Dados            → cartões de ÓRGÃO (Prefeitura, Saúde, Defensoria…)
   └ Nível 2 — Regiões do órgão     → 5 cartões: Norte · Nordeste · Centro-Oeste · Sudeste · Sul
        └ Nível 3 — A planilha      → as linhas (contatos) editáveis, com páginas por UF
```

## 6.1 Nível 1: Bases de Dados (órgãos)
- Um **cartão por órgão**, com ícone, número de planilhas, **% de preenchimento** (barra colorida), situação (Não iniciado, Em andamento, Quase lá, Concluído), contatos e o resumo de **validação** (quando houver planilhas validadas).
- **Busca** pelo nome do órgão e botão **Filtros** (Situação, Contatos com/sem, Ordenar por).
- Botões na mesma linha: **Lixeira** (só admin, mostra quantas planilhas estão lá) e **Novo órgão** (cria o órgão já com as 5 regiões).
- Menu ⋯ em cada cartão: editar nome e apagar.

## 6.2 Nível 2: Regiões de um órgão
- **Sempre 5 cartões** (as 5 regiões), mesmo sem planilha ainda. Quando não há planilha, o cartão oferece **Criar planilha**.
- Cada cartão mostra o status da planilha ("Planilha importada" ou "Sem planilha"), % de preenchimento, contatos e validação.

## 6.3 Nível 3: A planilha
É a tela de trabalho principal (parte 9). Para abrir, clique no cartão da região.

## 6.4 Como o sistema descobre o órgão e a região de uma planilha
Pelo **nome** ("{Órgão} - {Região}"). Duas exceções históricas: "Aluno a Bordo" entra em *Secretaria de Educação* e "Cidade na mão" entra em *Prefeitura*.

---

# 7. Regras de negócio centrais

Estas regras são o "coração" do sistema. Todas as telas (cartões, relatórios, metas, ranking) usam **as mesmas** regras, sempre calculadas pelo mesmo código, para que os números nunca divirjam.

## 7.1 Régua de completude (linha completa)
Os **7 campos obrigatórios** da régua:
1. Cidade · 2. Estado · 3. Telefone geral da prefeitura · 4. E-mail institucional · 5. Nome do prefeito · 6. WhatsApp institucional · 7. Site oficial.

Uma linha é **completa** quando:
- todos os campos da régua **que estão visíveis** estão preenchidos; **e**
- todas as colunas personalizadas **visíveis** (exceto a coluna "Validado") estão preenchidas.

Pontos importantes:
- **Coluna oculta ou excluída não conta**: nem exige, nem deixa faltando. Isso permite que uma planilha use só parte da régua.
- **Coluna "Validado" não entra** na completude: preencher e validar são duas etapas distintas.
- **Linha em branco não entra nos contadores**: linhas que só têm estado/região (o "andaime" da página) ou o valor "–" são consideradas vazias e não inflam "a preencher".

## 7.2 Contadores
- **Concluídos**: linhas completas. **A preencher**: linhas com algum dado, ainda incompletas.
- Nos cartões: **% = completas ÷ linhas com dado**; faixas: 0% Não iniciado · 1–49% Em andamento · 50–99% Quase lá · 100% Concluído.

## 7.3 Região efetiva
A região de um contato é a que está no campo "Região"; se estiver vazio, o sistema usa **a região do nome da planilha**. Isso evita que planilhas sem a coluna "Região" apareçam como "Sem região".

## 7.4 Crédito de preenchimento (quem recebe o crédito)
Regra definida em out/2026, depois de um caso em que 391 linhas já prontas foram creditadas a uma pessoa só por trocar maiúscula/minúscula:

1. **Só ganha crédito quem completa a linha**: a edição levou a linha de **incompleta para completa** (quem preencheu a **última célula que faltava**).
2. **Editar uma linha que já estava completa nunca dá crédito**, nem a primeira vez. Isso vale para linhas importadas já prontas e para dados antigos: ficam "sem pessoa".
3. **O primeiro a completar continua dono**: se alguém apaga uma célula de uma linha creditada e outra pessoa digita de novo, o crédito **volta ao primeiro**. Quem redigita não "rouba" a linha.
4. **O admin pode ajustar**: em *Revisar créditos* ele remove o crédito (a linha fica solta e o próximo que completar ganha) ou passa o crédito a outra pessoa, sempre com **motivo registrado**.
5. **Mudanças de estrutura não dão crédito**: quando o admin cria, oculta ou apaga colunas, linhas que passam a estar completas **não** são creditadas a ninguém; os créditos antigos são preservados e voltam ao dono original se a linha voltar a completar.
6. **Importar planilha não dá crédito.**

## 7.5 Território e "o que conta na meta"
- A **meta conta apenas o território definido nela** e apenas o que a **própria pessoa** fez dentro dele.
- O que a pessoa faz **fora do território continua valendo** nos totais, no ranking e nos relatórios dela, só não entra naquela meta.
- Quando mais de uma pessoa tem meta no mesmo território, cada uma conta somente o que ela mesma completou.

## 7.6 Campanhas ativas
Somente **"Cidade na Mão 2026"** e **"Aluno a Bordo"** aparecem em filtros e seletores. Contatos com outras grafias ficam fora das listas; pendências **sem campanha** formam um grupo separado na fila de correção.

## 7.7 Exclusão sempre reversível
- Linha excluída → marcada como excluída (some da tela; dá para desfazer).
- Planilha apagada → Lixeira por 30 dias (restaura com os mesmos dados, valores, correções, créditos e validações).
- Apagar de forma definitiva só pela Lixeira (admin).

---

# 8. Módulo: Acesso e usuários

## 8.1 Login
- Entrada por **e-mail e senha** (senhas guardadas com hash bcrypt, nunca em texto). Sessão por token (JWT) com o cargo e o id do usuário.
- Contas com **convite pendente** não conseguem entrar.
- Páginas públicas: login, definir senha (convite) e recuperar senha. Todo o resto exige login.

## 8.2 Convite por link (criação de usuário)
O admin cria o usuário informando **nome, e-mail e cargo**; **ele nunca define a senha de ninguém**. O sistema gera um **link de convite válido por 7 dias**, enviado por e-mail (serviço de e-mail transacional) ou copiado pelo admin. A pessoa abre o link e **define a própria senha** (mínimo de 8 caracteres). O admin pode **reenviar o convite**.

## 8.3 Recuperação de senha
- Tela pública "Esqueci minha senha": pede o e-mail e envia um link **válido por 1 hora**, de uso único.
- A resposta é sempre a mesma exista ou não a conta (evita descobrir quais e-mails são cadastrados).
- Proteção contra repetição (1 minuto) e cada novo pedido invalida os anteriores.
- É uma tabela separada do convite, de propósito, para que ninguém consiga trancar a conta de um colega.

## 8.4 Gestão de usuários (só admin)
- Lista de usuários, cargo, situação (ativo/convite pendente).
- Editar nome e cargo (o admin **não** altera o próprio cargo).
- **Excluir** usuário: não permite excluir a si mesmo nem o **último admin**.
- Para **Pré-vendedor**, vincular o **Proprietário do HubSpot**. A lista vem dos proprietários existentes nos contatos. O vínculo some se o cargo mudar.

## 8.5 Embed em outro sistema
O LDR Hub pode ser aberto **dentro de uma moldura (iframe)** de outro sistema de monitoramento. Para isso funcionar entre domínios diferentes, os cookies de sessão são configurados como "particionados" (CHIPS). Cada ambiente mantém login próprio (um login por dispositivo). Uma evolução possível é login único (SSO) por e-mail (ver parte 18).

---

# 9. Módulo: Bases de Dados e a Planilha

## 9.1 Para que serve
É onde a equipe **trabalha os contatos**: ver o que falta, completar, corrigir, organizar e confirmar. É o módulo mais usado e o mais complexo do sistema.

## 9.2 Criar, importar e organizar bases
- **Novo órgão** (cria os 5 cartões de região) e **Criar planilha** (em uma região sem planilha): **só quem tem permissão de estrutura (admin)**.
- **Uma planilha nova nasce sem nenhuma coluna e com 50 linhas em branco.** As colunas passam a existir por **importação** (as reconhecidas reaparecem) ou por **criação manual**. Essa foi uma decisão do David: nada de colunas fixas que a equipe não usa.
- **Importar** (só admin): aceita **CSV e Excel (.xlsx/.xls)** de qualquer formato.
  - O sistema **reconhece colunas conhecidas** pelo cabeçalho (ex.: "município" vira Cidade, "fone" vira Telefone) usando uma lista de pistas por campo.
  - Cabeçalhos **não reconhecidos** viram **colunas personalizadas** automaticamente (e, se o rótulo já existir, reaproveita a coluna, sem duplicar).
  - Se a planilha já tem dados, um pop-up pergunta **Mesclar** (acrescenta e completa linhas existentes) ou **Substituir** (troca o conteúdo; opcionalmente troca também o conjunto de colunas).
  - Telefones inválidos detectados na importação **entram na fila de correção**.
  - **Desfazer importação**: cada importação gera um registro permanente com foto para desfazer.
  - Importar **não** gera crédito de produção a ninguém.
- **Exportar** (só admin): abre um pop-up com a **lista de colunas** (checklist) e baixa um **CSV** só com as escolhidas. A mesma regra vale para exportações de relatórios.
- **Apagar planilha** (só admin) → vai para a **Lixeira** (30 dias).

## 9.3 A tela da planilha
Edição **estilo Excel/Google Sheets**, com tudo o que a equipe espera de uma planilha:

**Edição e seleção**
- Clicar para selecionar, arrastar para selecionar intervalo, selecionar coluna ou linha inteira, atalhos de teclado, setas, Enter, Tab.
- **Copiar, recortar e colar** entre células e **de/para o Excel**. Células com mais de uma linha (por exemplo dois telefones) são tratadas corretamente (formato TSV com aspas), sem "escorregar" para a linha de baixo. **Colar especial** (valores / transposto). Copiar uma célula e colar sobre um intervalo **preenche todo o intervalo**.
- **Desfazer (Ctrl+Z) e Refazer**, até 100 ações, inclusive exclusão de linhas, ordenação, mesclas e exclusão de colunas.
- **Soma/contagem** da seleção na barra (Σ N células).

**Aparência**
- **Formatação por célula**: negrito, itálico, sublinhado/tachado, cor do texto, cor do fundo e alinhamento.
- **Mesclar células** (compartilhado com a equipe).
- **Densidade** das linhas (compacta/normal/ampla), **zoom** (padrão 70%), **alinhamento** global, cabeçalho fixo ao rolar e opção de congelar a primeira coluna.

**Organização**
- **Ordenar A→Z / Z→A** por coluna: a ordem é **compartilhada** com a equipe e dá para desfazer.
- **Filtro por coluna** (ícone de funil) e **busca** na planilha (ícone de lupa abre o campo).
- **Colunas**: arrastar a letra para mudar a **ordem** (compartilhada), **ocultar/mostrar**, renomear com duplo clique (admin), excluir de forma permanente (admin, limpa os dados e não volta por "mostrar ocultas").
- **Linhas**: adicionar linhas (de 1 a **5.000 de uma vez**), excluir (reversível), mover para outra página.

**Colunas personalizadas e lista suspensa (admin)**
- Até **30 colunas personalizadas** por planilha.
- Tipo **texto** (livre) ou **lista suspensa**: escolher **uma opção colorida** (até 20 opções, 40 caracteres cada, paleta de 8 cores). Modelos prontos: *Sim/Não*, *Sim/Não/Pendente*, *Validação*, *Andamento*, *Prioridade*. Pode definir um **valor padrão** para linhas novas.
- Só o **admin** define o tipo e as opções; quem preenche apenas **escolhe** (clicando em qualquer parte da célula) ou limpa. O servidor **recusa** valor fora da lista (a regra não pode ser burlada pela API).

**Páginas (abas)**
- Abas na parte de baixo: **Todas**, uma por **UF** e **páginas livres** com nome qualquer (admin cria; botão direito renomeia/exclui).
- **Mover linhas** entre páginas. Cada página tem o seu contador.
- Uma página livre guarda a "página" da linha numa chave reservada; **não conta como dado** da linha.

## 9.4 Colaboração em tempo real
- Várias pessoas na mesma planilha ao mesmo tempo; as alterações (células, ordenação, linhas, estrutura) aparecem para todos **em instantes**.
- Avatares mostram **quem está com a planilha aberta**.
- Indicador de salvamento (salvando / salvo às HH:MM / erro).
- *Limite atual:* o tempo real roda em **um único processo** do servidor. Subir mais de uma instância da aplicação exigiria trocar o mecanismo (ver parte 18).

## 9.5 Segurança do conteúdo
- **Histórico de ações grandes** (importação, substituição) e das **últimas 7 edições de célula** por planilha, com desfazer.
- **Trilha de auditoria de células**: cada alteração guarda **quem mudou, valor antes e depois, e quando**, por **90 dias** (visível na tela *Revisar créditos*).
- Exclusões sempre reversíveis (parte 7.7).
- Estrutura (colunas, páginas, tipo, validação) **só o admin**; o servidor valida, não só a tela.

## 9.6 Cartões, busca e filtros da tela de Bases
Descritos na parte 6. Em todo o sistema, **filtros ficam num botão "Filtros" que abre um cartão** (parte 17).

---

# 10. Módulo: Correção de Contatos (fila de telefones)

## 10.1 Para que serve
Contatos cujo **telefone está incorreto** entram numa **fila**. A equipe encontra o número certo, registra e o sistema **devolve a correção ao HubSpot**, tirando o contato da fila de lá também.

## 10.2 De onde vêm os itens da fila
1. **Do HubSpot**: contatos marcados na fase **"Telefone incorreto"** (campanha "Cidade na Mão 2026", regiões Nordeste e Sul).
2. **Da importação de planilhas**: telefones inválidos detectados.
3. **Do "Aluno a Bordo"**: contatos com telefone ausente ou inválido.
4. **Manualmente**: ao marcar um contato como incorreto.

## 10.3 Estados de um item
| Item (correção) | Significado |
|---|---|
| **Pendente** | Está na fila, aguardando alguém |
| **Resolvida** | Alguém informou o telefone novo; sai da fila e **conta** na produção/meta |
| **Não encontrado** | Pesquisaram e não acharam número; sai da fila, **não conta** na meta e vira uma etapa própria no HubSpot |

E o **status do contato**: `ok`, `telefone_incorreto`, `telefone_atualizado`, `telefone_nao_encontrado`.

## 10.4 A tela de correção
- Lista agrupada por **campanha** e **região**, com contagem de pendentes. **Só campanhas ativas** aparecem; as pendências **sem campanha** ficam num grupo à parte (carregado sob demanda para a tela não pesar).
- **Pré-vendedor** vê apenas os contatos do seu Proprietário vinculado.
- Filtros por campanha, região, estado e busca.
- Botão **Sincronizar CRM** (não aparece para pré-vendedor).

## 10.5 Corrigir um contato
Ao corrigir, o LDR informa o **novo telefone** (campo com formatação automática) e, opcionalmente:
- **Tem WhatsApp?**
- **Segundo número** (vai para o campo de celular no HubSpot)
- **Contato institucional?** Sim/Não. Se **Não**, informa **nome e cargo** da pessoa que atendeu.
- **Número não encontrado**: botão próprio, que tira o item da fila sem contar na meta.

Depois de salvar, o sistema **atualiza o HubSpot** em "melhor esforço": telefone, fase do ciclo de vida ("Telefone atualizado"), WhatsApp, pessoa e cargo. Se o HubSpot falhar, a correção **fica salva localmente** e a falha não bloqueia o trabalho.

## 10.6 Busca por IA (Scan)
Para ajudar a achar o número, o botão **Scan** consulta uma IA que pesquisa contatos alternativos do órgão em **4 frentes em paralelo**. O sistema **descarta o número errado atual**, remove duplicados e só mostra telefones com **10 ou 11 dígitos** (com ou sem o prefixo 55). O resultado fica registrado.

## 10.7 Histórico de correções
Lista das **últimas 100 correções resolvidas** (quem, quando, valor antigo → novo). O pré-vendedor vê só as do seu proprietário.

---

# 11. Módulo: Validação de contatos

## 11.1 Para que serve
A equipe **liga para os contatos** para confirmar se estão corretos e registra o resultado. **Nem toda planilha é validada** (é uma escolha da SASI): o admin liga a validação só nas planilhas desejadas.

## 11.2 O botão "Validar planilha"
Na barra da planilha, o **admin** liga/desliga o botão **Validar**. Ao ligar:
- cria a coluna **"Validado"** (lista com **Sim / Não / –**), ou **adota** uma coluna "Validado" que já existia (mantendo os valores antigos);
- **Desligar** só **oculta** a coluna e **guarda tudo** (valores e créditos); ao religar, volta como estava;
- enquanto ligada, a coluna **não pode ser apagada, renomeada nem ter as opções editadas** (só ocultada), para as contagens nunca quebrarem;
- planilhas sem o botão ligado **não ganham coluna nenhuma**.

## 11.3 Os valores
| Valor | Significado |
|---|---|
| **Sim** | Ligou e o contato está correto |
| **Não** | Ligou e está errado ou não existe |
| **–** | Ainda não validado (é o mesmo que a célula vazia) |

## 11.4 Regras
- **Linha totalmente vazia não pode ser validada.** Basta ter algum dado.
- A coluna **Validado não conta** na régua de completude.
- **Crédito: 1 por contato, de quem registrou por último.** Se alguém corrige de "Não" para "Sim", o crédito passa a quem corrigiu (a tela avisa: *"Validação passou para o seu nome. Antes estava com [nome]"*). Voltar para "–" remove o crédito.
- Valores que já existiam **sem pessoa registrada** entram nas contagens da planilha, mas **não** em meta nem ranking.

## 11.5 Onde se vê a validação
- **Barra da planilha**: "Validados · N Sim · N Não · N a validar" (da página aberta, em tempo real).
- **Cartões de Bases**: segunda barra "Validados" com % e a contagem.
- **Metas de validação** (parte 12): meta própria por planilha.
- **Relatórios → Validação**: por planilha e por pessoa.
- **Ranking**: quadro de Validação e taxa de acerto.

---

# 12. Módulo: Metas, Dashboard, Relatórios e Ranking

## 12.1 Metas
**Três tipos**, criados pelo admin num pop-up com uma aba por tipo (cada pessoa pode ter várias):

| Tipo | Escopo | O que conta |
|---|---|---|
| **Preenchimento** | Planilha + região + estado (ou "toda a planilha") | Linhas que **a própria pessoa completou** dentro do território |
| **Correção** | Uma campanha | Correções **resolvidas pela pessoa** naquela campanha |
| **Validação** | Uma ou mais planilhas **com validação ligada** | Contatos que a pessoa validou (**Sim + Não**) naquelas planilhas; há o filtro **"Só Sim"** para ver só os confirmados |

**Prazos:** diária, semanal (segunda a domingo) ou mensal. **Alvo:** a quantidade.

**Situação (semáforo):** **No ritmo** (meta batida ou feito ≥ o esperado até agora), **Em risco** (feito ≥ 60% do esperado) e **Atrasado** (abaixo disso). O "esperado" cresce ao longo do período.

**Experiência do LDR (Minhas Metas):** metas ativas com barra e marca do ritmo esperado, **histórico** por período (semanas, meses ou dias), **sequência** (períodos batidos seguidos) e um **pontinho colorido no menu** que indica a pior situação das metas; um aviso de **"meta nova"** quando o admin cria uma.

**Experiência do admin (Metas da Equipe):** cartão por LDR com todas as metas, busca e filtros (situação, tipo, prazo), botão **Ver histórico** (carrega o histórico daquele LDR sob demanda, sem marcar como visto para ele) e **Editar metas**.

**Histórico congelado:** todo dia o sistema grava o resultado final das metas dos períodos encerrados (*snapshot*), para o histórico não mudar depois.

## 12.2 Dashboard ("Visão geral")
- **LDR / Pré-vendedor**: cartões "Corrigidos hoje / esta semana / este mês / total", **metas de preenchimento**, **metas de correção** (com a fila), **metas de validação**, e a **produção dos últimos 14 dias**.
- **Admin**: totais (bases, contatos, telefones incorretos, atualizados), **alerta de "Créditos para revisar"** (quando alguém recebe créditos demais em pouco tempo) e **metas de cada LDR**.

## 12.3 Relatórios (um menu para todos, com abas)
O menu **Relatórios** é o mesmo para todos os cargos. **A diferença é o que cada um enxerga**.

| Aba | Admin | LDR / Pré-vendedor |
|---|---|---|
| **Visão geral** | Equipe toda: indicadores, metas, funil de saneamento, ranking por LDR (semana/mês), exportação | **Só o dele**: total produzido, preenchidas, corrigidas, validadas, % das metas, produção por dia |
| **Desempenho** (só admin) | "Produção por pessoa": totais, por estado, por campanha, comparativo por dia, situação das metas, detalhe por pessoa, exportação (resumo e detalhado) | — |
| **Horários** | "Ver de quem": equipe ou uma pessoa; mapa de calor dia × hora | Só os dele |
| **Validação** | Por **planilha** (contatos, Sim, Não, a validar, % validada, quem mais validou) e por **pessoa** (validados, Sim, Não, taxa de acerto); horários da equipe | Só as validações dele |
| **Ranking** | 4 quadros completos | 4 quadros, com privacidade (ver 12.4) |
| **Correções** | Histórico de Correções da equipe | Só as dele |

- **Produção** = linhas completadas + correções + validações (as três com cor própria nos gráficos).
- **Comparação com o período anterior** (↑/↓ %) nos indicadores, na validação e no ranking.
- **Filtros** (botão **Filtros**): período (hoje, 7 dias, 30 dias, mês, mês passado ou personalizado), órgão, região, estado, pessoa, campanha, tipo de produção e "Sim + Não / Só Sim".
- **Exportação** (só admin) com escolha de colunas.

## 12.4 Ranking
Quatro quadros: **Atividades** (preenchidas + corrigidas + validadas), **Preenchimento**, **Validação** (com Sim, Não e **taxa de acerto**) e **% da meta** (só quem tem meta). Filtros: período, órgão e "Sim + Não / Só Sim". Cada quadro mostra posição, medalhas para os 3 primeiros, a **variação contra o período anterior** e destaca a sua linha ("você está em 3º"). Inclui **horários de validação** da equipe e os seus.

**Privacidade:** o LDR vê **nome, posição e total de todos**, mas **Sim/Não/taxa de acerto só os dele**. Esses dados dos colegas **não saem do servidor** (não basta esconder na tela). O CSV segue a mesma regra. O admin vê tudo.

## 12.5 Revisar créditos (só admin)
Tela de **governança da produção**:
- Lista os créditos por pessoa, período e planilha, mostrando **as últimas alterações de cada linha** (quem mudou o quê, antes → depois).
- Ações, **em lote**: **Remover crédito** (a linha fica solta) ou **Passar para outra pessoa**, com **motivo obrigatório** registrado (quem, quando, motivo).
- **Alerta de crédito suspeito**: avisa o admin no Dashboard quando alguém recebe créditos demais em pouco tempo (os limites ficam na parte técnica, 20.4).
- Histórico de ajustes recentes.

---

# 13. Módulos de apoio

## 13.1 Agenda
- **Para que serve:** calendário das **reuniões do HubSpot** (somente leitura), para a equipe ver o que está agendado.
- **Quem acessa:** todos os cargos.
- **O que mostra:** reuniões de **60 dias atrás a 120 dias à frente**, nas visões **mês, semana e dia**, com minicalendário, alternância de fins de semana e atalhos de teclado (D/S/M/T e setas).
- **Cores por resultado:** **agendada** (azul), **concluída** (verde), **não concluída** (vermelho: não compareceu, cancelada…).
- **Filtros:** por resultado e por **responsáveis** (pré-vendedor = dono do contato; vendedor = dono do negócio).
- **Detalhe:** janela com título, horário, contato, negócio, responsáveis e **link direto ao HubSpot**.
- **Dados:** vêm do HubSpot em tempo de consulta (com cache curto de 2 minutos); **nada é gravado** no banco do LDR Hub.

## 13.2 Sugestões de melhoria
- **Para que serve:** qualquer usuário manda ideia ou problema **sem sair do sistema**, por **texto ou por voz**.
- **Envio:** botão flutuante em todas as telas. A **nota de voz** pode ser transcrita automaticamente por IA (limite de ~4 MB de áudio).
- **Triagem (só admin):** tela *Sugestões de Melhoria* com a lista, marcação **nova / resolvida** e exclusão. O menu mostra um **selo de novidade** com as sugestões ainda não vistas.
- Hoje há **17 sugestões** registradas.

## 13.3 Assistente do sistema
- **Para que serve:** um **chat** que responde perguntas sobre os números do sistema ("quantas correções fiz hoje?").
- **Como funciona:** usa uma IA (Groq) alimentada com um resumo dos dados; **somente leitura** (não altera nada). Se a IA estiver indisponível, responde por **regras locais** simples.
- **Privacidade por cargo:**
  - **Admin**: contexto da equipe (totais, usuários, produção por operador).
  - **LDR / Pré-vendedor**: **só os próprios números**, mais totais gerais; perguntas sobre outros usuários são bloqueadas.
  - Perguntas sobre segredos (senha, token, chave) são **sempre bloqueadas**.

## 13.4 Configurações
- **Sua conta** (todos): nome, e-mail e cargo.
- **Só admin:** teste da conexão com o HubSpot e o painel de backup.
- **Suporte SASI:** link de e-mail no rodapé do menu.
- Versão exibida: **v1.0.0**.

---

# 14. Integrações e rotinas automáticas

## 14.1 HubSpot: do CRM para o LDR Hub (sincronização)
**Objetivo:** trazer para o sistema os contatos das campanhas e saber **quais estão com telefone incorreto/atualizado**.

- **Escopo hoje:** base *Cidade na mão – Região Nordeste* e *Região Sul* (campanha "Cidade na Mão 2026"); em Sul, se o HubSpot marca um contato como incorreto e ele ainda não existe localmente, o sistema o **cria** na hora.
- **O que faz:** lê os contatos (somente os que têm "prefeitura" no nome), grava o **id do HubSpot e o proprietário**; para quem está em **"Telefone atualizado"** grava o telefone novo e **resolve** a correção; para quem está em **"Telefone incorreto"** coloca na fila (preservando decisões locais já tomadas: corrigido ou "não encontrado").
- **Não destrutivo:** nunca apaga dado local.
- **Quando roda:** manualmente (botão **Sincronizar CRM**), de forma automática (a cada 6 horas e 30 segundos depois que o sistema inicia) e pela rotina agendada (4 vezes ao dia).

## 14.2 HubSpot: do LDR Hub para o CRM (devolução)
Ao **corrigir** um telefone, o sistema atualiza no HubSpot: telefone, fase do ciclo de vida ("Telefone atualizado"), WhatsApp, pessoa/cargo e o 2º número. Para **"não encontrado"**, muda só a etapa. Sem `hubspotId` a correção fica só local. Falha no HubSpot **não bloqueia** o trabalho.

## 14.3 Aluno a Bordo
- Cria e atualiza a base **"Aluno a Bordo"** (Secretarias de Educação), campanha "Aluno a Bordo", a partir de **8 listas do HubSpot** (secretarias e pessoas, em 4 regiões).
- **Idempotente:** pode rodar quantas vezes quiser sem duplicar (um contato por id do HubSpot).
- Telefone válido: pelo menos um número com **10 a 13 dígitos**. Quem tem telefone ausente/inválido **entra na fila de correção**. Quem o LDR marcou como "não encontrado" **não volta** à fila.
- Não há botão na tela; roda pela rotina agendada.

## 14.4 Outros serviços usados
| Serviço | Para quê |
|---|---|
| **HubSpot** | CRM: contatos, campanhas, reuniões |
| **Groq (IA)** | Assistente, Scan de telefones, transcrição de voz das sugestões |
| **Serviço de e-mail transacional** | Convite e recuperação de senha |
| **Validação externa de telefone** (opcional) | Checagem complementar de números |

## 14.5 Rotinas agendadas (horários em UTC; Brasília = UTC − 3)
| Rotina | UTC | Brasília | O que faz |
|---|---|---|---|
| Fechar metas (*snapshot*) | 04:00 | 01:00 | Congela o resultado dos períodos encerrados; apaga o histórico de células com mais de 90 dias |
| Backup do banco | 05:00 | 02:00 | Cópia completa; mantém 14 dias |
| Sincronização HubSpot | 09:00 · 13:00 · 17:00 · 21:00 | 06 · 10 · 14 · 18 h | Traz campanhas/telefones do CRM |
| Aluno a Bordo | 08:00 · 20:00 | 05 · 17 h | Atualiza a base do projeto |
| Sincronização interna | a cada 6 h | — | Reforço automático dentro do próprio sistema |

As rotinas HTTP são protegidas por uma **chave secreta** (só quem a possui chama).

---

# 15. Arquitetura técnica e modelo de dados

## 15.1 Visão geral
```
 Navegador (React)  ⇄  Aplicação Next.js (páginas + APIs)  ⇄  Banco PostgreSQL
                              │
                              ├─ HubSpot (CRM)         ├─ Groq (IA)
                              └─ E-mail transacional   └─ Telefone (validação externa)
```
- **Aplicação:** Next.js 15 (App Router), React 19, TypeScript, Tailwind 4. Servida em **contêiner** atrás de um proxy com HTTPS.
- **Banco:** PostgreSQL, acessado por **Prisma 6**.
- **Autenticação:** NextAuth v5 (sessão por token, e-mail e senha).
- **Planilha:** componente próprio (~4.400 linhas), com edição, seleção, colagem, formatação, páginas e tempo real.
- **Tempo real:** canal **SSE** (Server-Sent Events) mantido **em memória** no servidor: presença, edições de célula, ordenação, linhas e estrutura.
- **Desempenho:** pool de conexões ampliado, cache curto em páginas pesadas, esqueletos de carregamento (*skeletons*), payload enxuto na fila de correção.
- **Qualidade:** ~110 testes automáticos de regra de negócio (cálculos de metas, completude, ranking, importação, colagem, permissões…) rodados na integração contínua junto com lint, tipos e build.

## 15.2 Como os dados evoluem (sem migração clássica)
O banco de produção **não recebe migração automática** no deploy (um erro de migração poderia apagar dados). Por isso:
- Tabelas novas nascem **sob demanda**, com SQL idempotente (`CREATE TABLE IF NOT EXISTS`) na primeira vez que são usadas.
- A **estrutura de cada planilha** (colunas personalizadas, ordem, ocultas, páginas, mesclas, ordenação, validação…) fica dentro de um campo JSON da própria base (`Base.headers`), com **chaves reservadas**.
- Mudança de esquema é **manual e deliberada**.

## 15.3 Modelo de dados (tabelas)

**Núcleo**
| Tabela | O que guarda |
|---|---|
| `User` | Usuários: e-mail, nome, hash da senha, cargo |
| `Base` | A planilha: nome, origem (manual/importada), estrutura em JSON |
| `Contact` | Cada **linha**: os 19 campos padrão, status, id do HubSpot, formatação, exclusão reversível, ordem |
| `ContactCustomValue` | Valores das **colunas personalizadas** por contato (inclusive a coluna Validado) |

**Correção**
| Tabela | O que guarda |
|---|---|
| `Correction` | Item da fila: campo, valor antigo/novo, motivo, status (pendente/resolvida/não encontrado), quem criou/resolveu, datas |
| `Scan` | Resultado de cada busca por IA de telefone |

**Produção e crédito**
| Tabela | O que guarda |
|---|---|
| `ContactFill` | **Quem completou** cada linha e quando (existe só enquanto a linha está completa) |
| `CreditoOriginal` | O **dono original** do crédito de uma linha que deixou de estar completa (para recuperar ao completar de novo) |
| `ContactValidacao` | Quem registrou Sim/Não de cada contato e quando |
| `CreditoLog` | Cada crédito dado, removido ou reatribuído (com motivo e responsável) |
| `CelulaLog` | Cada alteração de célula: quem, antes, depois, quando (**90 dias**) |

**Metas**
| Tabela | O que guarda |
|---|---|
| `Meta` | Metas por pessoa: tipo, território/campanha/planilha, prazo, alvo |
| `MetaSnapshot` | Resultado congelado de metas de períodos encerrados |
| `MetaVisto` | Última vez que cada LDR viu suas metas (para o aviso "meta nova") |

**Segurança operacional**
| Tabela | O que guarda |
|---|---|
| `BaseEvento` | Histórico imutável de ações grandes (importação, substituição, edições recentes) com foto para desfazer |
| `BaseLixeira` | Cópia completa de planilhas apagadas (30 dias) |
| `PasswordReset` | Pedidos de recuperação de senha (hash, validade, uso) |
| `UserProprietario` | Vínculo pré-vendedor ↔ proprietário do HubSpot |
| `Suggestion` | Sugestões enviadas |

## 15.4 Chaves reservadas dentro da estrutura da planilha (`Base.headers`)
Rótulo de coluna renomeada · `__cols__` (colunas personalizadas) · `__order__` (ordem das colunas) · `__hidden__` / `__deleted__` (ocultas / excluídas) · `__merges__` · `__sortBy__` · `__abas__` / `__paginas__` (páginas) · `__semPadrao__` (nasce sem colunas) · `__titulo__` · `__validar__` (validação ligada) · `__semeada__` (linhas iniciais criadas).

---

# 16. Requisitos não funcionais

## 16.1 Desempenho
- Navegação entre telas **fluida** (cache de curta duração e esqueletos de carregamento).
- Planilhas com **milhares de linhas** (da ordem de milhares de linhas nas maiores); a renderização completa de todas as linhas é um **limite conhecido** (virtualização está no roadmap).
- Fila de correção carrega **sem a lista de contatos sem campanha** até alguém pedir (reduziu o peso de ~5 MB para ~340 KB).

## 16.2 Segurança
- Senhas com **bcrypt**; **convite** e **recuperação** por link com validade e uso único; respostas que **não revelam** se um e-mail existe.
- **Cargos validados no servidor** em cada rota (admin, permissão específica ou usuário logado); a tela não é a única barreira.
- **Dados de outra pessoa nunca saem do servidor** para quem não é admin (ranking, relatórios, assistente).
- Rotinas HTTP protegidas por chave; **segredos fora do código** (variáveis de ambiente).
- Dependências **atualizadas** (leitor de Excel trocado pela versão corrigida do fabricante; framework travado numa versão estável); restam itens que dependem de uma atualização maior do framework.
- **Sem limite de tentativas de login** por decisão do negócio; mitigações recomendadas na parte 18.
- Sem autenticação em dois fatores (2FA) por ora.

## 16.3 Privacidade e LGPD
**Natureza dos dados:** na maioria, **contatos institucionais de órgãos públicos** (telefone da prefeitura, e-mail institucional, site). Porém incluem **nomes de pessoas** (prefeito, secretário, quem atendeu a ligação), cargos e e-mails/telefones que podem ser pessoais. Esses são **dados pessoais** e a LGPD se aplica.

**Controles que já existem:** acesso por cargo; trilha de auditoria de alterações (90 dias) e de créditos; exclusão reversível e lixeira; dados de outras pessoas protegidos no servidor; segredos fora do código.

**Requisitos de LGPD (decididos em 16/10/2026, ainda a cumprir):**
| # | Requisito | Situação |
|---|---|---|
| L1 | **Responsável** (encarregado) designado pela SASI | A definir |
| L2 | **Base legal e finalidade** documentadas (prospecção B2B para o setor público; interesse legítimo, a confirmar pelo jurídico) | A definir |
| L3 | **Política de retenção**: por quanto tempo guardar contatos, excluídos e logs (hoje: lixeira 30 dias, trilha de células 90 dias, backup 14 dias; contatos excluídos sem prazo) | Rascunho no anexo 20.5 |
| L4 | **Canal para pedidos de titulares** (acesso, correção, eliminação) e procedimento para atender no sistema | A definir |
| L5 | **Registro das operações de tratamento** (quem acessa o quê) | Parcial (auditoria de células e créditos) |
| L6 | **Eliminação definitiva** de contatos solicitados/vencidos, inclusive dos backups no prazo | A definir |

## 16.4 Disponibilidade e continuidade
- Um único ambiente de produção (aplicação + banco). Reinício para publicar uma versão causa **~10 segundos** de indisponibilidade e reconexão do tempo real.
- **Backup diário** completo do banco com retenção de **14 dias**. **Ainda não existe cópia fora do ambiente de produção**; foi decidido enviar uma cópia diária para **armazenamento em nuvem (Drive ou S3)**, com criptografia e retenção (item da v1.1; conta de destino a definir).
- Camadas de recuperação de **erro humano**: desfazer (100 ações), exclusão reversível, histórico de importação, lixeira (30 dias), trilha de células (90 dias).

## 16.5 Compatibilidade e acessibilidade
- Navegadores modernos de computador; o uso principal é em **desktop**. A planilha não foi otimizada para celular e o uso em telas pequenas não foi validado formalmente.
- Idioma: **português do Brasil**; datas e horas no **fuso de Brasília**.
- Acessibilidade: rótulos em botões e campos, foco por teclado nos componentes principais; uma **auditoria WCAG** formal ainda não foi feita.

## 16.6 Observabilidade
- Registros (logs) da aplicação disponíveis para a equipe técnica.
- **Não há monitoramento ativo com alerta** (queda, erro de banco, disco, backup que falhou): hoje descobre-se pelo relato da equipe (roadmap).

---

# 17. Padrões de interface (UX)

Decisões de design que valem para **toda tela nova**:

1. **Filtros sempre num botão "Filtros"** que abre um **cartão** com os filtros em lista suspensa/segmentos; o botão mostra **quantos filtros estão ativos** e vem acompanhado de **"Limpar tudo"**. Nunca filtros soltos na linha. (Componente único `FiltrosCard`.)
2. **Busca pequena e discreta**, no **mesmo nível e tamanho** dos botões de ação (36 px), nunca uma barra larga.
3. **Janelas de confirmação e entrada com a identidade do sistema** (nunca os pop-ups do navegador).
4. **Avisos (toasts)** para sucesso/erro; **indicador de salvamento** na planilha.
5. **Telas de carregamento** com esqueleto para navegação rápida.
6. **Cores com significado**: verde = ok/concluído, âmbar = em andamento/validação, vermelho = atrasado/erro, índigo = ação principal.
7. **Ações destrutivas** sempre com confirmação e, sempre que possível, **reversíveis**.
8. Menu lateral recolhível com **marcadores de pendência** (metas, sugestões).
9. Texto **direto, em português**, sem jargão técnico para o usuário final.

---

# 18. Estado atual, riscos e roadmap de melhorias

## 18.1 O sistema em números (16/10/2026, banco de produção)
| Indicador | Valor |
|---|---|
| Usuários | 14 (11 LDR, 3 admin) |
| Planilhas (bases) | 59, em 12 órgãos |
| Contatos ativos | 14.542 |
| Contatos excluídos (reversíveis) | 15.386 |
| Planilhas na Lixeira | 11 |
| Valores em colunas personalizadas | 18.987 |
| Correções pendentes / resolvidas / "não encontrado" | 11.037 / 145 / 12 |
| Créditos de preenchimento registrados | 4.310 |
| Validações com pessoa registrada | 233 |
| Metas definidas | 9 |
| Sugestões recebidas | 17 |

Planilhas por órgão: Consórcios 11 · SESCOOP 10 · Habitação (secretaria estadual) 5 · PROCON estadual 5 · Localidades em emergência 5 · Saúde Municipal 5 · Associações de Municípios 5 · Defensoria Pública 5 · Prefeitura 4 · Cidade na Mão 2 · Secretaria de Educação 1 · Aluno a Bordo 1.

## 18.2 Riscos e dívidas técnicas conhecidos
| # | Risco / dívida | Impacto | Sugestão |
|---|---|---|---|
| R1 | **Sem cópia de backup fora do ambiente de produção** | Alto: se o ambiente se perder, perdem-se dados e backups | Definir destino externo (nuvem) e testar restauração |
| R2 | **Sem monitoramento com alerta** (queda, erro, disco, backup falho) | Alto: descobre-se pelo relato da equipe | Monitor externo + alerta no WhatsApp/e-mail |
| R3 | **Sem testes de tela** e **sem ambiente de homologação** | Médio/Alto: erros chegam à equipe (aconteceu mais de uma vez) | Testes dos fluxos críticos e cópia para testar antes de publicar |
| R4 | **Deploy manual** com ~10 s de indisponibilidade | Médio | Deploy automático só se testes passarem; reinício sem queda |
| R5 | **Tempo real em um único processo** | Médio (limita escala) | Trocar o mecanismo se for preciso mais de uma instância |
| R6 | **Planilha renderiza todas as linhas** | Médio: lentidão acima de ~5 mil linhas | Virtualização das linhas |
| R7 | **Componente da planilha com ~4.400 linhas** | Médio: qualquer mudança é arriscada | Dividir em módulos junto com testes de tela |
| R8 | **Migrações de banco manuais / tabelas sob demanda** | Médio | Adotar migrações reais com procedimento seguro |
| R9 | **IDs do HubSpot fixos no código** (listas, etapas, portal) | Médio: mudar o CRM exige alterar código | Mover para configuração |
| R10 | **Sem 2FA e sem limite de tentativas de login** | Médio (contas admin são o maior alvo) | 2FA opcional para admin; reavaliar limite |
| R11 | **Rotas de contatos/bases exigem só login** (a restrição de edição está na tela) | Médio | Revisar permissão por rota no servidor |
| R12 | **Dados com ruído**: 75 grafias de campanha com 1 contato; ~1,5 mil contatos com "CNM 2026" (grafia diferente); 118 com "-" | Baixo/Médio | Limpeza e unificação |
| R13 | **Textos desatualizados** (Configurações diz para pedir a senha ao admin; README descreve uma versão antiga) | Baixo | Atualizar |
| R14 | **LGPD sem documentação formal** | Médio | Requisitos L1–L6 (parte 16.3) e rascunho de política (anexo 20.5) |
| R15 | **Algumas atualizações de segurança** dependem de uma versão maior do framework | Baixo/Médio | Planejar atualização |
| R16 | **Endereço definitivo / domínio próprio** ainda por definir | Baixo | Registro DNS com o TI |

## 18.3 Roadmap de melhorias (proposto, a discutir)

**Já entregue neste ciclo (para registro)**: lixeira de planilhas; troca da biblioteca de Excel; senhas rotacionadas e dependências atualizadas; tempo real; validação de contatos; crédito por quem completa a linha com auditoria e revisão; relatórios unificados com ranking; metas contando só o território; filtros padronizados.

**v1.1 — Proteger o que já funciona** *(prioridade alta)*
1. Backup **externo em nuvem (Drive ou S3)**, criptografado, + teste de restauração (R1) — *decidido; falta definir a conta de destino*
2. **Monitoramento e alerta** de queda/erro/backup (R2)
3. Domínio próprio e **recuperação de senha** com e-mail institucional configurado
4. **Limpeza de dados**: campanhas inexistentes, "CNM 2026", registros "-" (R12)
5. **Importação com mapeador de colunas e pré-visualização** (escolher qual coluna do arquivo vira qual, ver erros antes de confirmar)
6. **Primeiros testes de tela** nos fluxos críticos: criar planilha, importar, editar, validar, login (R3)

**v1.2 — Escala e qualidade** *(prioridade média)*
7. **Virtualizar a planilha** (R6)
8. **Histórico por célula com restaurar** na própria tela (os dados já existem; falta a interface)
9. **Mais tipos de coluna**: data, número, caixa de marcar, link, e-mail/telefone validados; lista com várias opções; **formatação condicional**
10. **Ambiente de homologação** e **deploy automático** (R3, R4)
11. **Migrações de banco** de verdade (R8)
12. **2FA** opcional para administradores (R10)
13. Revisão de **permissões por rota** no servidor (R11)

**v1.3 e além** *(a avaliar)*
14. **Comentários em células** e menção a colegas
15. **Visões salvas** por pessoa (filtros e colunas) e **busca global** entre bases
16. **Notificações dentro do sistema** (meta nova, tarefa atribuída)
17. **Relatórios agendados** por e-mail e em **PDF**
18. **Painel de saúde das integrações** (última sincronização, falhas) e **botão manual** do Aluno a Bordo
19. **Mapa de contatos** (plano já escrito)
20. **Login único (SSO)** com o sistema de monitoramento
21. **Importação/validação em lote por arquivo** e **observação por validação** (motivo do "Não")
22. **Pesos configuráveis** no ranking de Atividades
23. **LGPD**: designar responsável, documentar base legal, aprovar a política de retenção (rascunho no anexo 20.5), canal de titulares e rotina de eliminação (L1–L6)
24. **Registrar a data em que cada planilha chega a 100%** e o **uso diário** (usuários ativos), para medir os indicadores I1 e I3

> Cada item acima pode virar uma conversa de produto (objetivo, regra, riscos, "pronto quando…"), como foi feito com validação e relatórios.

---

# 19. Decisões já tomadas e perguntas em aberto

## 19.1 Registro de decisões (com o David)
| Tema | Decisão |
|---|---|
| Objetivo | Sanear e qualificar bases **antes** do HubSpot |
| Cargos | Admin = superadmin; LDR e Pré-vendedor com as mesmas permissões, escopos diferentes |
| Planilha nova | Nasce **sem colunas** e com 50 linhas; colunas por importação ou criação manual |
| Crédito de preenchimento | **Só quem completa a linha** ganha; editar linha pronta não dá crédito; o **primeiro a completar** continua dono; só o admin ajusta, com motivo |
| Importação | **Só admin** importa (LDR deixou de poder) |
| Metas | Contam **só o território definido** e só o que a **própria pessoa** fez; o que é feito fora vale em totais/ranking/relatórios, mas não na meta |
| Meta de validação | **Sim + Não**, por planilha validada, com filtro "só Sim" |
| Validação | Toggle por planilha (só admin); valores Sim / Não / –; crédito de quem registrou por último; independe da completude; ao desligar, oculta e guarda tudo |
| Relatórios | Um só menu para todos, com abas; ranking como aba; o LDR vê só o dele + ranking com privacidade |
| Ranking | Quatro quadros; LDR não vê Sim/Não/taxa dos colegas; sem "desde o início" |
| Login | **Sem limite de tentativas** de login |
| Interface | Filtros sempre em botão + cartão; busca pequena no nível dos botões |
| Campanhas | Só "Cidade na Mão 2026" e "Aluno a Bordo" aparecem |
| Exclusão | Sempre reversível (desfazer, lixeira 30 dias, auditoria de células 90 dias) |
| Indicadores de sucesso | Tempo para a base ficar 100% pronta · economia de retrabalho do vendedor · engajamento da equipe (metas numéricas a definir) |
| Backup | Cópia diária **fora** do ambiente, em nuvem (Drive ou S3) |
| Pré-vendedor e celular | Pré-vendedor valida e participa de metas de validação como o LDR; a planilha é **somente para computador** |
| LGPD | Tratar como **requisito a cumprir**, com responsável e política de retenção |
| Documento | Este PRD não detalha a hospedagem/infraestrutura |

## 19.2 Perguntas
**Respondidas em 16/10/2026**
| # | Pergunta | Resposta |
|---|---|---|
| Q1 | Indicadores de sucesso | I1 tempo para base 100% pronta, I2 economia de retrabalho do vendedor, I3 engajamento (ver 3.5). *Metas numéricas ainda abertas.* |
| Q2 | Backup fora do ambiente | Nuvem (Drive ou S3). *Falta definir a conta.* |
| Q5 | LGPD | Requisito a cumprir, com responsável e política de retenção (ver 16.3 e anexo 20.5) |
| Q6 | Pré-vendedor e Validação | Valida e participa de metas de validação como o LDR |
| Q8 | Planilha no celular | Somente computador |

**Ainda em aberto**
| # | Pergunta | Opções (sugestão em negrito) |
|---|---|---|
| Q1b | **Metas numéricas** dos indicadores (ex.: "uma base leva no máximo X dias para chegar a 100%") | a definir |
| Q2b | **Qual conta/serviço** de nuvem será o destino do backup, e quem guarda a chave de criptografia? | Drive da SASI · conta S3 da SASI · outro |
| Q3 | **2FA para administradores?** | **sim, opcional para admin** · para todos · não |
| Q4 | **Limite de tentativas de login**: manter a decisão de não ter? | manter · **limite alto (ex.: 10 por 15 min) só com aviso ao admin** |
| Q7 | **Ranking de Atividades**: soma simples ou com pesos por tipo? | **soma simples (hoje)** · pesos definidos pelo admin |
| Q9 | **Novas campanhas**: como cadastrar quando surgirem? | **lista configurável pelo admin** · continuar no código |
| Q10 | **Contatos excluídos (15 mil)**: prazo para eliminar de vez? | **política de retenção (ex.: 12 meses)** · manter para sempre |
| Q11 | **Quais órgãos terão validação ligada** primeiro? | a decidir pela operação |
| Q12 | **Quem é o responsável LGPD** na SASI e quem aprova a política? | a definir |

---

# 20. Anexos

## 20.1 Mapa de telas
**Públicas:** Login · Definir senha (convite) · Recuperar senha (pedido e nova senha).

**Com login:**
- **Visão geral** (Dashboard) · **Agenda** · **Configurações**
- **Bases de Dados** (órgãos) → regiões → **planilha** · **Lixeira de planilhas** (admin)
- **Correção de Contatos** · **Histórico de Correções**
- **Minhas Metas** (LDR) / **Metas da Equipe** (admin)
- **Relatórios**: Visão geral · Desempenho (admin) · Horários · Validação · Ranking · Correções
- **Revisar créditos** (admin) · **Usuários** (admin) · **Sugestões de Melhoria** (admin)
- Atalhos fixos: **Assistente** (chat) e botão de **Sugestão**; link **Suporte SASI** no menu.

## 20.2 Áreas de API (para o time técnico)
| Área | Endereços principais |
|---|---|
| Acesso | `/api/auth/*`, `/api/users`, `/api/users/[id]`, `/api/convite`, `/api/recuperar-senha` |
| Bases e planilha | `/api/bases`, `/api/orgaos`, `/api/bases/[id]` e `abas`, `colunas`, `layout`, `merges`, `ordenar`, `paginas`, `paginas/mover`, `validacao`, `import`, `export`, `desfazer`, `historico`; tempo real em `/api/realtime/[baseId]` |
| Contatos e correção | `/api/contacts`, `/api/contacts/lote`, `/api/contacts/[id]` e `custom`, `flag`, `restore`, `scan`; `/api/corrections/[id]` |
| Metas e produção | `/api/metas/[userId]`, `/api/metas/[userId]/historico`, `/api/creditos`, `/api/ranking/export`, `/api/relatorios/export`, `/api/relatorios/producao/export` |
| Integrações | `/api/crm/sync`, `/api/hubspot/test`, `/api/aluno-a-bordo/sync`, `/api/agenda` |
| Rotinas | `/api/cron/sync`, `/api/cron/aluno`, `/api/cron/metas-snapshot`, `/api/cron/backup` |
| Apoio | `/api/assistant`, `/api/sugestoes` (+ transcrição e triagem), `/api/backup`, `/api/lixeira/[id]` |

## 20.3 Variáveis de configuração (apenas nomes)
Banco de dados · segredo de sessão e endereço do sistema · conta administradora inicial · e-mail transacional (chave e remetente) · HubSpot (token, etapa "não encontrado", sincronização automática e intervalo) · IA (chaves, modelo) · validação de telefone · chave das rotinas · subcaminho de publicação · destino de backup externo (quando existir).

## 20.4 Fórmulas e regras resumidas
- **% de preenchimento** = linhas completas ÷ linhas com dado.
- **Linha completa** = 7 campos da régua + colunas personalizadas **visíveis**, **sem** a coluna Validado.
- **Taxa de acerto** = Sim ÷ (Sim + Não).
- **Meta — situação**: No ritmo (feito ≥ esperado ou meta batida) · Em risco (≥ 60% do esperado) · Atrasado (abaixo disso).
- **Esperado** no período = alvo × fração do período já decorrida.
- **Produção** = linhas completadas + correções resolvidas + validações (Sim + Não).
- **Alerta de crédito suspeito** = > 100 créditos em 1 hora ou > 300 em 24 horas.
- **Retenções**: lixeira de planilhas 30 dias · auditoria de células 90 dias · backup 14 dias · convite 7 dias · recuperação de senha 1 hora.

## 20.5 Rascunho de política de retenção e privacidade (para a SASI revisar)

> **Rascunho técnico, não é parecer jurídico.** Deve ser revisado pelo responsável (L1) e pelo jurídico antes de valer.

**Finalidade:** manter e qualificar uma base de contatos de órgãos públicos para prospecção comercial da SASI, evitando contato indevido e dado desatualizado.

**Dados tratados:** nome de cidade/órgão, telefones, e-mails e site institucionais, nome e cargo de agentes públicos, resultado de validação por ligação, e registros de quem alterou cada dado (usuários do sistema).

**Prazos propostos de retenção:**
| Dado | Prazo sugerido | Hoje |
|---|---|---|
| Contatos ativos | Enquanto houver finalidade; revisão anual | Sem prazo |
| Contatos excluídos (reversíveis) | **12 meses**, depois eliminação definitiva | Sem prazo (15 mil acumulados) |
| Planilhas na Lixeira | 30 dias | 30 dias ✔ |
| Histórico de alterações de células | 90 dias | 90 dias ✔ |
| Registro de créditos/ajustes | 24 meses (para auditoria de produção) | Sem prazo |
| Backups | 14 dias (e cópia externa com a mesma política) | 14 dias (sem cópia externa) |
| Contas de usuários desligados | Desativar no desligamento; eliminar em 12 meses preservando o registro de produção anonimizado | A definir |

**Direitos dos titulares:** canal único (e-mail do responsável) para acesso, correção e eliminação; prazo interno de resposta de 15 dias; procedimento técnico: localizar o contato pelo telefone/e-mail na base, anonimizar/eliminar e registrar no log.

**Segurança:** acesso por cargo, trilha de auditoria, senhas protegidas, segredos fora do código, backup protegido.

---

*Fim do documento. Este PRD é vivo: cada decisão nova (ver parte 19) deve ser registrada aqui.*
