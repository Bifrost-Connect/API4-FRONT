# US10 — Comparação temporal de safras

Verificação realizada em 13/11/2026. O README do projeto aponta para o
[GitHub Projects 2](https://github.com/orgs/Bifrost-Connect/projects/2/views/1).
O quadro não pôde ser consultado nesta sessão; os requisitos e checkboxes foram
verificados nas issues públicas da US10. Todas as tarefas de frontend estavam
desmarcadas. Nenhuma issue ou status do GitHub foi alterado.

| Issue                                                              | Tarefas  | Resultado no frontend                                                                                                                                                                                           |
| ------------------------------------------------------------------ | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [#46](https://github.com/Bifrost-Connect/API-4-SEMESTRE/issues/46) | 1 e 2    | Tela `/comparacao-temporal`, menu do Analista/Gestor legado, atalho no catálogo com Base A pré-selecionada, seleção de conjunto, versões e recorte por coordenadas ou área visível.                             |
| [#47](https://github.com/Bifrost-Connect/API-4-SEMESTRE/issues/47) | 3, 4 e 5 | Dois mapas Leaflet com câmera sincronizada, cortina acessível por ponteiro/teclado e toggle de delta vermelho/verde/amarelo.                                                                                    |
| [#48](https://github.com/Bifrost-Connect/API-4-SEMESTRE/issues/48) | 6        | Painel retrátil com áreas oficiais, saldo, percentual, aumento, redução e permanência. **Parcial:** contagem de imóveis depende de dados ausentes na API.                                                       |
| [#48](https://github.com/Bifrost-Connect/API-4-SEMESTRE/issues/48) | 7        | Clique/seleção destaca o mesmo identificador nos dois mapas e exibe presença/ausência por versão. **Parcial:** histórico numérico por imóvel depende de implementação real no backend.                          |
| [#49](https://github.com/Bifrost-Connect/API-4-SEMESTRE/issues/49) | 8 e 9    | Validação de conjunto, versões distintas e bbox; aviso de cobertura incompatível; loading por mapa; timeout/erros com nova tentativa. Troca de filtros cancela as requisições e invalida resultados anteriores. |
| [#49](https://github.com/Bifrost-Connect/API-4-SEMESTRE/issues/49) | 10 e 11  | Testes de sincronização sem loops, percentual com área inicial zero e exclusão de versões abertas/não aprovadas.                                                                                                |

## Integração com a API existente

O frontend reutiliza o cliente HTTP e `VITE_API_BASE_URL` existentes, incluindo a
configuração em tempo de execução do executável. A URL recebe o prefixo `/api`
automaticamente; não é necessário alterar o backend nem o banco.

| Endpoint                                                               | Uso                                                                                                                                |
| ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `GET /api/catalogo/bases?apenas_disponiveis=true&page=…&size=100`      | Percorre o catálogo publicado; filtra flags e estados incompatíveis e mantém os IDs de carga/processo.                             |
| `GET /api/analise/comparacao/camadas?id_carga_a=…&id_carga_b=…&bbox=…` | Obtém os GeoJSONs das duas versões no mesmo recorte.                                                                               |
| `POST /api/analise/comparacao/evolucao`                                | Envia `{ safraAId, safraBId, bbox }` e recebe métricas regionais e `geoJsonClassificado`, inclusive quando este é uma string JSON. |

O recorte é `oeste,sul,leste,norte` em longitude/latitude, como espera a API.
A listagem de safras por município não é necessária neste fluxo por bbox;
`GET /analise/comparacao/safras` exige uma região de referência cadastrada.

## Pendências que exigem backend

- A resposta `EvolucaoResponseDTO` não contém contagens de imóveis com agravamento
  ou redução. Não se pode deduzir essas contagens pela quantidade de manchas do
  delta, pois uma mancha pode abranger vários imóveis.
- `GET /api/analise/comparacao/imovel/{identificador}` existe, mas no
  [AnaliseEspacialController](https://github.com/Bifrost-Connect/API4-BACK/blob/main/src/main/java/com/bifrostconnect/api_geo/controller/AnaliseEspacialController.java)
  consultado retorna valores fixos de exemplo (45 ha, 50 ha e +5 ha). O frontend
  não consome esse retorno como se fosse um histórico oficial. Os GeoJSONs
  pareados também não trazem métricas de irregularidade por imóvel.

O checkout local de `API4-BACK` está anterior a esses endpoints. Para usar dados
reais, execute uma versão do backend existente no GitHub que contenha a US10,
com suas migrations já existentes e ao menos duas cargas publicadas do mesmo
conjunto. Configure seu endereço em `VITE_API_BASE_URL`. A validação desta entrega
usa respostas controladas da API; não inclui execução contra PostGIS real.

## Verificação

- `pnpm exec vitest run`: suíte unitária completa aprovada (83 testes).
- `pnpm exec playwright test e2e/temporal-comparison.spec.ts --project=chromium --reporter=line`:
  três testes aprovados: navegação, filtro de publicadas, parâmetros, GeoJSON no Leaflet real, métricas,
  delta, inspeção simultânea, cortina, responsividade e bloqueio do Operador;
  requisições de API são interceptadas pelo teste.
- `pnpm build-only`: bundle de produção gerado.
- ESLint nos arquivos de comparação e testes: aprovado.
- `pnpm build` / `pnpm type-check`: bloqueados por erros anteriores em
  `process.ts`, tipos de quarentena, `DashboardView.vue`, `MapView.vue` e testes
  antigos. Não foram encontrados erros de TypeScript nos arquivos da US10.

Os arquivos de comparação temporal e a alteração em `vitest.config.ts` já
estavam presentes sem commit no início desta tarefa. A implementação foi
completada sobre esses arquivos, preservando a configuração de testes existente.
