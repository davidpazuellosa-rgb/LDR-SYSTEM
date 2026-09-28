# Plano — Produção por pessoa (metas × realizado) em Relatórios

Status: **planejamento, nada implementado.** Onde: página **Relatórios** (`/relatorios`, só admin).
A página Metas da Equipe continua só para definir/acompanhar metas.

## 1. O que o David quer ver

1. **Total geral**: quanto a equipe produziu (preenchido + corrigido) e quanto das metas foi batido.
2. **Por pessoa**: meta, realizado, %, e o detalhe (preenchidas × corrigidas).
3. **Quantidade geral** e por pessoa, filtrável por período, órgão, região, estado, campanha e pessoa.
4. Gráficos que deixem isso fácil de ler; exportar para Excel.

## 2. O que já existe (aproveitar)

- `src/lib/relatorio.ts` (`buildRelatorio`) — já calcula ranking por LDR (`total`, `preenchidas`, `corrigidas`), série diária de 14 dias, `metasView` (meta × realizado com ritmo esperado).
- `src/components/RelatorioFiltros.tsx` — período (Semana/Mês/Tudo), LDR, campanha, via query string.
- `/api/relatorios/export` — CSV de produção e de metas.
- Gráficos hoje são **SVG feito à mão** (sem biblioteca). Manter esse padrão: leve, sem dependência nova.
- Fonte dos números: `ContactFill` (preenchimento, com `concluidoEm`) e `Correction` (`resolvedById`, `resolvedAt`).

Regra de contagem (mantida): preenchimento é atribuído ao **território** (órgão+região+estado) da meta; correção, a quem resolveu.

## 2.1 Pontos em aberto

- **Contar por território ou por quem preencheu?** Por território é a regra de hoje (1 estado = 1 LDR). Por pessoa permitiria dois LDRs no mesmo estado, mas muda dashboard, minhas-metas e snapshots. Plano assume **território** (sem mudança de regra).
- Metas de dias/semanas/meses diferentes convivem; o "% geral" usa cada meta no seu próprio prazo (ver §5).

## 3. Layout da página (de cima para baixo)

```
┌ Relatórios ─────────────────────────────────────────────────────────┐
│ [Período ▾ Hoje|7d|30d|Mês|Personalizado] [Órgão ▾] [Região ▾]      │
│ [Estado ▾ (busca)] [Pessoa ▾ (busca, multi)] [Campanha ▾] [Limpar]  │
│ chips dos filtros ativos:  Prefeitura ✕  Nordeste ✕  Ana Paula ✕    │
├─────────────────────────────────────────────────────────────────────┤
│ KPIs:  Total produzido | Preenchidas | Corrigidas | Metas batidas   │
│        (cada um com ↑↓% vs período anterior)        | % das metas   │
├───────────────────────────────┬─────────────────────────────────────┤
│ Produção por dia (linhas      │ Produção por pessoa (barras         │
│ empilhadas: preench + corr.)  │ horizontais empilhadas, ordenadas)  │
├───────────────────────────────┼─────────────────────────────────────┤
│ Meta × Realizado por pessoa   │ Mapa do Brasil / ranking de estados │
│ (barra com marca do ritmo)    │ (produção por UF)                   │
├───────────────────────────────┴─────────────────────────────────────┤
│ Tabela "Produção por pessoa" (ordenável, com busca e total)          │
│ Pessoa | Meta | Feito | % | Preench. | Corrig. | Status | ▸ detalhe  │
│ ...                                                                  │
│ TOTAL DA EQUIPE                                                      │
│                                          [Exportar CSV] [Exportar XLS]│
└─────────────────────────────────────────────────────────────────────┘
```

Clicar numa pessoa (barra, linha ou tabela) **abre o detalhe** num painel lateral: produção dela por dia, por estado e por campanha + lista das metas dela com % de cada uma.

## 4. Filtros (dropdown com busca, corretos)

Componente único `Dropdown` reutilizável (mesma cara dos popups do sistema), com:
- campo de **busca** dentro do dropdown (filtra as opções digitando);
- **multi-seleção** com caixinhas onde faz sentido (Pessoa, Estado, Campanha), "Selecionar todos/Limpar";
- contador no botão ("Pessoa · 3");
- fecha com Esc e clique fora; teclado (setas/Enter).

| Filtro | Tipo | Observação |
|---|---|---|
| Período | segmentado + dropdown | Hoje, 7 dias, 30 dias, Este mês, Mês passado, Personalizado (2 datas) |
| Órgão | 1 escolha (busca) | Prefeitura, Sec. Educação, Saúde… |
| Região | multi | depende do órgão |
| Estado | multi (busca) | depende da região escolhida |
| Pessoa | multi (busca) | só cargos operadores (LDR / pré-vendedor) |
| Campanha | multi (busca) | lista de campanhas ativas (HubSpot) |
| Tipo | segmentado | Tudo / Preenchimento / Correção |

Estado dos filtros na **URL** (link compartilhável, botão voltar funciona) — como já é hoje; "Limpar tudo" e chips removíveis.

Filtros em cascata: escolher Órgão reduz Regiões; Região reduz Estados (só o que existe de fato).

## 5. Cálculos

- **Total produzido** = preenchidas + corrigidas no período/filtro.
- **Meta da pessoa** = soma dos alvos das metas dela **normalizados para o período filtrado** (diária × dias, semanal × semanas, mensal × meses; período parcial proporcional).
- **% da pessoa** = realizado ÷ meta normalizada (limitado a 100% na barra, número real na tabela).
- **Metas batidas** = metas cujo realizado no *próprio* prazo atingiu o alvo (ex.: meta semanal conta na semana fechada).
- **Total da equipe** = soma das pessoas (sem dupla contagem).
- **Comparativo** = mesmo tamanho de período imediatamente anterior.
- Períodos encerrados usam o **snapshot** congelado (`MetaSnapshot`) quando existir, senão recalculam (igual à página Minhas Metas).

## 6. Gráficos (todos em SVG, com tooltip e acessíveis)

1. **Produção por dia** — área/linhas empilhadas (preenchimento × correção), eixo de datas, tooltip com totais.
2. **Produção por pessoa** — barras horizontais empilhadas, ordenadas, clicáveis; mostra o total ao lado.
3. **Meta × Realizado por pessoa** — barra de progresso com marca do ritmo esperado e cor por status (no ritmo / em risco / atrasado), como já existe por meta.
4. **Por estado** — mapa/tilemap já existente (`BrasilTilemap`) filtrado + top 5 estados.
5. **Distribuição por campanha** (correção) — barras.
6. (Opcional) **Ritmo da semana** — heatmap dia×hora já existente, filtrado por pessoa.

Paleta e cartões seguem o visual atual (indigo/emerald/amber/rose, `CARD`/`TITLE`).

## 7. Exportação

- CSV atual continua; novo `tipo=pessoas`: uma linha por pessoa (meta, feito, %, preench., corrig.) + linha TOTAL; e `tipo=pessoas-detalhe`: pessoa × estado × campanha × dia.
- Respeita os filtros ativos. Nome do arquivo com período.

## 8. Implementação (fases)

**Fase 1 — Dados** (`src/lib/relatorio.ts`): função `produzidoPorPessoa(filtros)` com filtros de órgão/região/estado/pessoa/campanha/tipo/datas; normalização de metas; comparativo; testes unitários (puros, sem banco) para normalização de período e totais.
**Fase 2 — Filtros**: componente `Dropdown` (busca + multi) e nova `RelatorioFiltros` com chips e cascata; estado na URL.
**Fase 3 — Tela**: KPIs, tabela por pessoa (ordenar/buscar/total), gráficos 1–3.
**Fase 4 — Detalhe da pessoa** (painel lateral) + gráficos 4–5.
**Fase 5 — Exportação** dos novos formatos.
**Fase 6 — Verificação**: conferir os números contra o banco (SQL direto), testar filtros combinados, mobile, e deploy.

Cada fase entrega algo usável e vai ao ar separadamente.

## 9. Riscos e cuidados

- Volume: `ContactFill` cresce; consultas com índices por `concluidoEm` e `preenchidoPorId` (já existem). Agregar no banco, não no JS.
- Linhas concluídas **antes** do recurso não têm registro de conclusão e contam 0 (limitação já conhecida).
- Não mexer em `minhas-metas`/`MetasEquipe` enquanto houver alterações da outra sessão sem commit.
- Só admin acessa; LDR continua vendo apenas os próprios números em `/relatorio`.

## 10. Estimativa

Fases 1–3 (o essencial: total geral + por pessoa + filtros + tabela + 3 gráficos): ~1 dia de trabalho.
Fases 4–5: ~meio dia. Fase 6 junto de cada entrega.
