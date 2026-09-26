import axios from 'axios'

export const mockactive = true; // Quando ativada (true), cancela todos os mocks e exibe o erro real da API

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080',
  headers: {
    'Content-Type': 'application/json',
  },
})

export default api
