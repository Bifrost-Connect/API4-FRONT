export const mockUploadSuccessResponse = (nome: string) => ({
  id: Math.floor(Math.random() * 1000) + 100,
  nome: nome,
  tipoGeometria: 'Polygon',
  caminhoArquivoBruto: `/storage/uploads/${nome.replace(/\s+/g, '_').toLowerCase()}.zip`,
  dataUpload: new Date().toISOString(),
  status: 'PROCESSADO_COM_SUCESSO',
})

export const mockUploadErrorResponse = {
  erro: 'Arquivo inválido',
  mensagem: 'O arquivo .zip não contém um arquivo .shp válido dentro.',
}

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
