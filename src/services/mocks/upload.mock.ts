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
    processoId: 99,
    usuarioUploadId: 1,
    nomeOriginal: file.name,
    extensao: formatoDetectado,
    tipoMime: file.type || (formatoDetectado === 'zip' ? 'application/zip' : 'application/geo+json'),
    tamanhoBytes: file.size || 15420000,
    urlArmazenamento: '/storage/mock/' + file.name,
    hashSha256: 'a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2',
    imutavel: true,
    dataUpload: new Date().toISOString(),
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
    { id: '4674', label: 'EPSG:4674 (SIRGAS 2000)' },
  ],
  orgaos: [
    { id: '1', label: 'IBGE' },
    { id: '2', label: 'INCRA' },
    { id: '3', label: 'ANA' },
  ],
  conjuntos: [
    { id: '1', label: 'Imóveis rurais' },
    { id: '2', label: 'Malha municipal' },
    { id: '3', label: 'Reserva legal' },
    { id: '4', label: 'Uso e cobertura do solo' },
    { id: '5', label: 'APP Hidrográfica' },
  ],
}
