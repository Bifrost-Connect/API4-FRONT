# Registro temporário de alterações — US06 e US08

> Documento de constatação das alterações realizadas nesta sessão. Pode ser removido quando o registro não for mais necessário.

## US06 — Cálculo automático de sobreposição

### Alterações no frontend

- Criada a tela de Análise territorial para o perfil Analista, com seleção de um documento CAR e de camadas de restrição (alertas, APP e Reserva Legal), respeitando a safra.
- Adicionada ação para solicitar o cálculo e apresentar, por imóvel, área total em hectares, área sobreposta, percentual de sobreposição, situação do processamento e mensagem de falha analítica quando disponível.
- As áreas são exibidas com quatro casas decimais e o percentual com duas casas.
- A tela apresenta estados de carregamento, erro e conclusão, além de identificar quando os dados exibidos são demonstrativos.
- Um arquivo GeoJSON local pode ser carregado para pré-visualização. A validação aceita `FeatureCollection` com geometrias `Polygon` ou `MultiPolygon` e verifica coordenadas compatíveis com EPSG:4326. Arquivos locais não são usados para cálculo oficial: precisam ser cadastrados e processados pelo sistema.
- Criado o serviço `src/services/spatialAnalysis.ts`, com tipos e chamadas preparados para listar documentos, obter geometrias e pedir sobreposições. Enquanto as rotas ainda não existem, a interface usa fixtures de demonstração de `src/services/mocks/spatial-analysis.mock.ts` quando permitido pela configuração do frontend.

### Dependências ainda necessárias no backend

- Disponibilizar documentos espaciais já tratados para cálculo, com identificador, categoria, safra, estado e metadados.
- Implementar a solicitação de cálculo e retornar resultados por imóvel, preservando resultados válidos quando uma feição falhar.
- Persistir ou consultar área do imóvel, hectares sobrepostos, percentual, geometria de interseção e estado/erro analítico. As estruturas de banco existentes parecem oferecer parte da base, mas precisam ser confirmadas contra esse contrato.
- Autorizar o papel `ANALISTA` nas rotas necessárias.

## US08 — Visualização cartográfica interativa

### Alterações no frontend

- A tela de Análise territorial possui mapa Leaflet com fundos de ruas, satélite e topográfico.
- Camadas CAR, restrições e interseções podem ser ligadas e desligadas independentemente, com estilos distintos para facilitar a leitura.
- O mapa apresenta popups com informações do imóvel e da sobreposição, lista de resultados selecionável e foco/zoom para a geometria correspondente.
- A geometria não é limitada a quadrados ou retângulos: o mapa renderiza polígonos irregulares e `MultiPolygon`, inclusive áreas separadas, como um exemplo demonstrativo de território indígena. Também foi incluída Terra Indígena como categoria de camada e de pré-visualização.
- A importação local aceita feições `Polygon` e `MultiPolygon`, incluindo contornos irregulares; os exemplos do mapa também usam limites não retangulares para refletir essa flexibilidade.
- O serviço está preparado para solicitar GeoJSON por documento e, futuramente, por `bbox` (área visível do mapa).
- Foi incluída geometria demonstrativa para ilustrar a visualização enquanto o backend não fornece as camadas oficiais.

### Dependências ainda necessárias no backend

- Disponibilizar GeoJSON das camadas tratadas/publicadas e das interseções, filtrável por tipo, documento/safra e, idealmente, pelo `bbox` atual do mapa.
- Retornar geometrias em EPSG:4326 e propriedades necessárias para os popups: código CAR, área total, área sobreposta, percentual e safra.
- Definir paginação ou limite de feições para consultas cartográficas extensas.
- Incluir `ANALISTA` nas regras de autorização dessas consultas.

## Rotas propostas para integração

O serviço frontend está preparado para estes contratos provisórios, que precisam ser alinhados com o backend:

- `GET /api/analises-espaciais/documentos?zone=TRATADA&status=DISPONIVEL`
- `GET /api/analises-espaciais/documentos/{id}/geojson?bbox=...`
- `POST /api/analises-espaciais/sobreposicoes`

Essas rotas ainda não representam endpoints confirmados do backend. O cálculo e a exibição oficiais dependem da implementação e validação desse contrato.

## Navegação e perfis também ajustados nesta sessão

- O perfil Analista tem rota e menu próprios para `/analise-territorial`.
- O mapa territorial compartilhado (`/mapa`) está disponível nos menus de Operador, Auditor, Analista e Administrador; a visualização cartográfica comum não concede aos demais perfis as ações de cálculo exclusivas da análise territorial.
- O Mapa operacional passou a exibir limites demonstrativos com contornos irregulares e `MultiPolygon`, incluindo um exemplo multipartes de reserva indígena, para mostrar geometrias territoriais a todos os perfis.
- O perfil Auditor tem painel próprio (`/auditor`) e acesso à auditoria de cargas.
- Operador e Administrador permanecem direcionados ao painel operacional; o menu do Operador não inclui auditoria de cargas.
- Rotas e links de navegação foram associados aos perfis. O login de demonstração permite selecionar Operador, Analista, Auditor ou Administrador e persiste o perfil selecionado no navegador.
- Criado `src/views/AuditorDashboardView.vue` com resumo da fila de revisão, cargas em quarentena/falha e cargas concluídas, usando os dados do serviço de dashboard existente.

## Arquivos frontend relacionados

- `src/views/TerritorialAnalysisView.vue`
- `src/services/spatialAnalysis.ts`
- `src/services/mocks/spatial-analysis.mock.ts`
- `src/views/AuditorDashboardView.vue`
- `src/router/index.ts`
- `src/services/user.ts`
- `src/views/LoginView.vue`
- `src/components/AppSidebar.vue`
- `src/components/AppNavbar.vue`

## Validação e limites

- O build de produção do frontend (`pnpm run build-only`) concluiu com sucesso nesta sessão.
- A verificação de tipos apontou problemas preexistentes em outros arquivos do projeto; não foram apontados erros nos arquivos novos da análise territorial.
- Não foram feitas alterações no backend.
- Os dados de cálculo e geometrias demonstrativos servem apenas para visualização. A importação local nesta tela cobre GeoJSON; não implementa leitura de ZIP/Shapefile nem persistência/envio ao backend.
