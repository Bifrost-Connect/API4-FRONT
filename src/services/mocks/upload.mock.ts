/**
 * ==========================================
 * CONTRATO DE API ESPERADO (BACK-END)
 * ==========================================
 * Rota: POST /api/upload
 * 
 * Como o back-end deve receber a requisição:
 * - Método: POST
 * - Content-Type: multipart/form-data
 * - Corpo da requisição: 
 *   - arquivo: O arquivo .zip (shapefile) enviado pelo usuário.
 *   - nomeCamada: string
 *   - orgaoEmissor: string
 *   - ano: string
 *   - epsg: string
 *   - conjunto: string
 *   - descricao: string (opcional)
 * 
 * Como o back-end deve responder em caso de SUCESSO:
 * - Status 200 OK ou 201 Created
 * - Corpo da resposta (JSON): O formato abaixo simulado em `mockUploadSuccessResponse`
 */
export const mockUploadSuccessResponse = (nome: string) => ({
  id: Math.floor(Math.random() * 1000) + 100,
  nome: nome,
  tipoGeometria: 'Polygon',
  caminhoArquivoBruto: `/storage/uploads/${nome.replace(/\s+/g, '_').toLowerCase()}.zip`,
  dataUpload: new Date().toISOString(),
  status: 'PROCESSADO_COM_SUCESSO',
})

/**
 * Como o back-end deve responder em caso de ERRO (ex: arquivo inválido):
 * - Status 400 Bad Request (ou 422 Unprocessable Entity)
 * - Corpo da resposta (JSON): O formato abaixo simulado em `mockUploadErrorResponse`
 */
export const mockUploadErrorResponse = {
  erro: 'Arquivo inválido',
  mensagem: 'O arquivo .zip não contém um arquivo .shp válido dentro.',
}

/**
 * ==========================================
 * CONTRATO DE API ESPERADO (BACK-END)
 * ==========================================
 * Rota: GET /api/upload/options
 * 
 * Como o back-end deve responder:
 * - Status 200 OK
 * - Corpo da resposta (JSON): O formato abaixo simulado em `mockUploadOptions`, 
 *   trazendo as listas de anos, EPSGs e conjuntos disponíveis no banco.
 */
export const mockUploadOptions = {
  anos: ['2024', '2023', '2022', '2021', '2020'],
  epsgs: [
    { id: '4326', label: 'EPSG:4326 (WGS 84)' },
    { id: '3857', label: 'EPSG:3857 (Pseudo-Mercator)' },
    { id: '4674', label: 'EPSG:4674 (SIRGAS 2000)' },
  ],
  conjuntos: [
    { id: '1', label: 'Limites Territoriais' },
    { id: '2', label: 'Dados Ambientais' },
    { id: '3', label: 'Uso do Solo' },
  ],
}
