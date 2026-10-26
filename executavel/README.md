# Executável do Frontend GeodataHub

Este diretório contém o executável autossuficiente (standalone) do Frontend do GeodataHub para Linux.

## Características
- **100% Autossuficiente**: Todos os arquivos do frontend (HTML, JS, CSS, imagens) estão embutidos no binário. Não necessita de Node.js, npm, nginx ou arquivos externos para rodar.
- **Suporte a .env em Tempo de Execução**: Lê automaticamente as variáveis de ambiente do arquivo `.env` sem precisar recompilar a aplicação.
- **Roteamento SPA Completo**: Suporta o HTML5 History Mode do Vue Router (todas as rotas carregam normalmente sem erro 404).

---

## Como Usar

### 1. Configurar o arquivo .env
Edite ou crie o arquivo `.env` na mesma pasta do executável:

```env
PORT=3000
HOST=0.0.0.0
VITE_API_BASE_URL=http://localhost:8080
```

### 2. Iniciar o Executável
Basta executar o binário no terminal:

```bash
./frontend
```

Acesse no navegador: **http://localhost:3000**

---

## Opções de Linha de Comando

| Opção | Descrição | Exemplo |
|---|---|---|
| `-p, --port <porta>` | Define a porta HTTP (sobrescreve o .env) | `./frontend -p 8080` |
| `-h, --host <ip>` | Define a interface de rede | `./frontend -h 127.0.0.1` |
| `-e, --env <caminho>` | Especifica um arquivo .env personalizado | `./frontend --env /etc/app.env` |
| `-d, --dist <pasta>` | Permite sobrescrever os arquivos estáticos por uma pasta em disco | `./frontend -d ./minha-dist` |
| `-v, --version` | Exibe a versão | `./frontend -v` |
| `--help` | Exibe a ajuda detalhada | `./frontend --help` |

---

## Ordem de Prioridade do .env
1. Caminho passado explicitamente via flag `--env <arquivo>`
2. Arquivo `.env` no diretório onde o comando foi chamado (`./.env`)
3. Arquivo `.env` na mesma pasta do executável (`<pasta_do_binario>/.env`)
4. Variáveis de ambiente do sistema operacional (`export VITE_API_BASE_URL=...`)
