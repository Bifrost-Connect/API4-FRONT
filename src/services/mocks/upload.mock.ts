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
 *   - arquivo: O arquivo enviado pelo usuário (.zip, .csv, .json, .geojson).
 *   - nomeCamada: string
 *   - orgaoEmissor: string
 *   - ano: string
 *   - epsg: string
 *   - conjunto: string
 *   - descricao: string (opcional)
 *   - classificacaoAcesso: string
 *   - competencia: string
 *   - coberturaEspacial: string
 *   - coberturaTemporal: string
 *   - usuarioResponsavel: string
 *
 * Como o back-end deve responder em caso de SUCESSO:
 * - Status 200 OK ou 201 Created
 * - Corpo da resposta (JSON): O formato abaixo simulado em `mockUploadSuccessResponse`
 */
export const mockProcessoCriado = {
  id: 1024,
  status: 'CRIADO'
};

export const mockArquivoOriginalSuccess = (file: File) => {
  const formatoDetectado = file.name.endsWith('.geojson') ? 'geojson' : 'zip';
  return {
    id: 1024,
    nomeOriginal: file.name,
    formato: formatoDetectado,
    tamanho: file.size ? `${(file.size / 1024 / 1024).toFixed(2)} MB` : '15.4 MB',
    recordCount: 1542,
    epsgDetected: '4674',
    epsgDivergence: false,
    dataUpload: new Date().toISOString(),
    status: 'PROCESSADO_COM_SUCESSO',
  };
};

/**
 * Como o back-end deve responder em caso de ERRO (ex: arquivo inválido):
 * - Status 400 Bad Request (ou 422 Unprocessable Entity)
 * - Corpo da resposta (JSON): O formato abaixo simulado em `mockUploadErrorResponse`
 */
export const mockUploadErrorResponse = {
  erro: 'Arquivo inválido',
  mensagem: 'O arquivo selecionado não é suportado ou está corrompido.',
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
  anos: ['2026', '2025', '2024', '2023', '2022', '2021', '2020'],
  epsgs: [
    { id: '4326', label: 'EPSG:4326 (WGS 84)' },
    { id: '3857', label: 'EPSG:3857 (Pseudo-Mercator)' },
    { id: '4674', label: 'EPSG:4674 (SIRGAS 2000)' },
    { id: '31983', label: 'EPSG:31983 (SIRGAS 2000 / UTM zone 23S)' },
  ],
  conjuntos: [
    { id: 'imoveis', label: 'Imóveis rurais' },
    { id: 'malha', label: 'Malha municipal' },
    { id: 'reserva', label: 'Reserva legal' },
    { id: 'uso_solo', label: 'Uso e cobertura do solo' },
    { id: 'app_hidrografica', label: 'APP Hidrográfica' },
  ],
}
