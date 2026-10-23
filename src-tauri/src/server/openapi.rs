use axum::response::{Html, IntoResponse, Response};
use axum::http::{header, StatusCode};

pub async fn openapi_json_handler() -> impl IntoResponse {
    let spec = OPENAPI_SPEC.replace("{{VERSION}}", env!("CARGO_PKG_VERSION"));
    (
        StatusCode::OK,
        [(header::CONTENT_TYPE, "application/json; charset=utf-8")],
        spec,
    )
}

pub async fn swagger_ui_handler() -> Response {
    let html = r#"<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Open Presenter · Swagger UI</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5.11.0/swagger-ui.css" />
  <style>
    body {
      margin: 0;
      background: #090d16;
      color: #f8fafc;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    }
    .topbar { display: none !important; }
    .swagger-ui {
      max-width: 1200px;
      margin: 0 auto;
      padding: 24px;
    }
    .swagger-ui .info { margin: 24px 0; }
    .swagger-ui .info .title { color: #38bdf8 !important; }
    .swagger-ui .info p, .swagger-ui .info li { color: #94a3b8 !important; }
    .swagger-ui .scheme-container {
      background: #1e293b !important;
      box-shadow: none !important;
      border: 1px solid #334155 !important;
      border-radius: 12px;
      padding: 16px;
    }
    .swagger-ui .opblock {
      border-radius: 10px !important;
      box-shadow: 0 1px 3px rgba(0,0,0,0.3) !important;
      margin-bottom: 12px !important;
    }
    .swagger-ui .btn.authorize {
      background-color: #0284c7 !important;
      border-color: #0284c7 !important;
      color: #fff !important;
      border-radius: 8px;
    }
    .swagger-ui .btn.authorize svg { fill: #fff !important; }
  </style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5.11.0/swagger-ui-bundle.js" crossorigin></script>
  <script src="https://unpkg.com/swagger-ui-dist@5.11.0/swagger-ui-standalone-preset.js" crossorigin></script>
  <script>
    window.onload = () => {
      window.ui = SwaggerUIBundle({
        url: '/api/v1/openapi.json',
        dom_id: '#swagger-ui',
        deepLinking: true,
        presets: [
          SwaggerUIBundle.presets.apis,
          SwaggerUIStandalonePreset
        ],
        layout: "BaseLayout"
      });
    };
  </script>
</body>
</html>"#;

    Html(html).into_response()
}

const OPENAPI_SPEC: &str = r#"{
  "openapi": "3.0.3",
  "info": {
    "title": "Open Presenter API",
    "version": "{{VERSION}}",
    "description": "API REST e WebSocket para controle de apresentação ao vivo, automações de estúdio (Bitfocus Companion, Stream Deck, Elgato), integração com OBS e envio de alertas.",
    "contact": {
      "name": "Open Presenter Project",
      "url": "https://github.com/open-mission/open-presenter"
    },
    "license": {
      "name": "MIT",
      "url": "https://opensource.org/licenses/MIT"
    }
  },
  "servers": [
    {
      "url": "http://localhost:5050",
      "description": "Servidor local de saídas e automação"
    }
  ],
  "tags": [
    { "name": "Status & Info", "description": "Informações e verificação de saúde do sistema" },
    { "name": "Ao Vivo & Slides", "description": "Controle de projeção de slides, blackout e fundo" },
    { "name": "Setlist", "description": "Ordem do culto e navegação entre itens" },
    { "name": "Cronômetro & Timer", "description": "Contagem regressiva e decorrida para o púlpito" },
    { "name": "Comunicação & Avisos", "description": "Envio de alertas, mensagens e letreiros rolantes" },
    { "name": "Músicas", "description": "Biblioteca e busca de letras" },
    { "name": "Bíblia", "description": "Busca e projeção de escrituras sagradas" },
    { "name": "Mídias & Wallpaper", "description": "Papel de parede e imagens" },
    { "name": "WebSocket", "description": "Streaming em tempo real de eventos" }
  ],
  "paths": {
    "/api/v1/info": {
      "get": {
        "tags": ["Status & Info"],
        "summary": "Informações da versão e status do servidor",
        "security": [{ "bearerAuth": [] }, { "apiKeyAuth": [] }],
        "responses": {
          "200": { "description": "Status OK com dados do aplicativo" },
          "401": { "description": "Token de autorização inválido ou ausente" }
        }
      }
    },
    "/api/v1/live": {
      "get": {
        "tags": ["Ao Vivo & Slides"],
        "summary": "Consulta o slide que está sendo exibido ao vivo no telão",
        "security": [{ "bearerAuth": [] }, { "apiKeyAuth": [] }],
        "responses": {
          "200": { "description": "Dados do slide no ar" },
          "401": { "description": "Não autorizado" }
        }
      }
    },
    "/api/v1/present": {
      "post": {
        "tags": ["Ao Vivo & Slides"],
        "summary": "Projeta um slide específico do setlist ativo",
        "security": [{ "bearerAuth": [] }, { "apiKeyAuth": [] }],
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "required": ["itemId", "index"],
                "properties": {
                  "itemId": { "type": "string", "example": "item-musica-1" },
                  "index": { "type": "integer", "example": 0, "description": "Índice do slide dentro do item" }
                }
              }
            }
          }
        },
        "responses": {
          "200": { "description": "Slide projetado com sucesso" },
          "404": { "description": "Item ou slide não encontrado" }
        }
      }
    },
    "/api/v1/next": {
      "post": {
        "tags": ["Ao Vivo & Slides"],
        "summary": "Avança para o próximo slide da programação ativa",
        "security": [{ "bearerAuth": [] }, { "apiKeyAuth": [] }],
        "responses": {
          "200": { "description": "Slide avançado com sucesso" }
        }
      }
    },
    "/api/v1/prev": {
      "post": {
        "tags": ["Ao Vivo & Slides"],
        "summary": "Retrocede para o slide anterior da programação ativa",
        "security": [{ "bearerAuth": [] }, { "apiKeyAuth": [] }],
        "responses": {
          "200": { "description": "Slide retrocedido com sucesso" }
        }
      }
    },
    "/api/v1/clear": {
      "post": {
        "tags": ["Ao Vivo & Slides"],
        "summary": "Oculta o texto do slide mantendo o plano de fundo visível",
        "security": [{ "bearerAuth": [] }, { "apiKeyAuth": [] }],
        "responses": {
          "200": { "description": "Texto ocultado com sucesso" }
        }
      }
    },
    "/api/v1/blackout": {
      "post": {
        "tags": ["Ao Vivo & Slides"],
        "summary": "Ativa ou desativa a tela preta (blackout)",
        "security": [{ "bearerAuth": [] }, { "apiKeyAuth": [] }],
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "required": ["blackout"],
                "properties": {
                  "blackout": { "type": "boolean", "example": true }
                }
              }
            }
          }
        },
        "responses": {
          "200": { "description": "Estado de blackout atualizado" }
        }
      }
    },
    "/api/v1/setlist": {
      "get": {
        "tags": ["Setlist"],
        "summary": "Lista todos os itens, músicas e slides do culto ativo",
        "security": [{ "bearerAuth": [] }, { "apiKeyAuth": [] }],
        "responses": {
          "200": { "description": "Snapshot do setlist completo" }
        }
      }
    },
    "/api/v1/setlist/active": {
      "get": {
        "tags": ["Setlist"],
        "summary": "Obtém o ID e os dados do evento/culto ativo no momento",
        "security": [{ "bearerAuth": [] }, { "apiKeyAuth": [] }],
        "responses": {
          "200": { "description": "Dados do evento ativo e snapshot do setlist" }
        }
      },
      "post": {
        "tags": ["Setlist"],
        "summary": "Define ou alterna o evento ativo no sistema (persistido no SQLite)",
        "security": [{ "bearerAuth": [] }, { "apiKeyAuth": [] }],
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "properties": {
                  "eventId": { "type": "string", "nullable": true, "example": "culto-domingo-noite" }
                }
              }
            }
          }
        },
        "responses": {
          "200": { "description": "Evento ativo atualizado e setlist recarregado" }
        }
      }
    },
    "/api/v1/timer": {
      "get": {
        "tags": ["Cronômetro & Timer"],
        "summary": "Consulta o estado atual do cronômetro",
        "responses": {
          "200": { "description": "Estado do timer (running, elapsedSecs, etc.)" }
        }
      }
    },
    "/api/v1/timer/start": {
      "post": {
        "tags": ["Cronômetro & Timer"],
        "summary": "Inicia a contagem do cronômetro",
        "security": [{ "bearerAuth": [] }, { "apiKeyAuth": [] }],
        "responses": { "200": { "description": "Timer iniciado" } }
      }
    },
    "/api/v1/timer/pause": {
      "post": {
        "tags": ["Cronômetro & Timer"],
        "summary": "Pausa a contagem do cronômetro",
        "security": [{ "bearerAuth": [] }, { "apiKeyAuth": [] }],
        "responses": { "200": { "description": "Timer pausado" } }
      }
    },
    "/api/v1/timer/reset": {
      "post": {
        "tags": ["Cronômetro & Timer"],
        "summary": "Zera o cronômetro para 00:00",
        "security": [{ "bearerAuth": [] }, { "apiKeyAuth": [] }],
        "responses": { "200": { "description": "Timer resetado" } }
      }
    },
    "/api/v1/timer/countdown": {
      "post": {
        "tags": ["Cronômetro & Timer"],
        "summary": "Configura e inicia uma contagem regressiva em segundos",
        "security": [{ "bearerAuth": [] }, { "apiKeyAuth": [] }],
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "required": ["seconds"],
                "properties": {
                  "seconds": { "type": "integer", "example": 1800, "description": "Duração em segundos (ex: 1800 = 30min)" }
                }
              }
            }
          }
        },
        "responses": { "200": { "description": "Contagem regressiva iniciada" } }
      }
    },
    "/api/v1/stage-message": {
      "get": {
        "tags": ["Comunicação & Avisos"],
        "summary": "Consulta o aviso/mensagem que está atualmente no ar",
        "responses": {
          "200": { "description": "Alerta ativo ou null se não houver aviso" }
        }
      },
      "post": {
        "tags": ["Comunicação & Avisos"],
        "summary": "Envia um aviso, alerta ou letreiro rolante para as saídas de vídeo",
        "security": [{ "bearerAuth": [] }, { "apiKeyAuth": [] }],
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "required": ["id", "text"],
                "properties": {
                  "id": { "type": "string", "example": "alert-auto-1" },
                  "text": { "type": "string", "example": "Atenção: veículo no estacionamento com luzes acesas" },
                  "displayMode": {
                    "type": "string",
                    "enum": ["banner_top", "banner_bottom", "overlay", "variable_only"],
                    "default": "banner_top"
                  },
                  "scroll": { "type": "boolean", "default": true, "description": "Se true, faz rolagem contínua da direita para esquerda" },
                  "level": { "type": "string", "enum": ["info", "warning", "urgent"], "default": "info" },
                  "targets": {
                    "type": "array",
                    "items": { "type": "string", "enum": ["stage", "public", "stream"] },
                    "default": ["stage", "public"]
                  },
                  "autoDismissSeconds": { "type": "integer", "example": 30, "description": "Tempo em segundos antes de sumir automaticamente (0 = manual)" },
                  "createdAt": { "type": "string", "format": "date-time", "example": "2026-10-22T05:00:00Z" }
                }
              }
            }
          }
        },
        "responses": {
          "200": { "description": "Aviso enviado e exibido com sucesso" }
        }
      },
      "delete": {
        "tags": ["Comunicação & Avisos"],
        "summary": "Remove imediatamente o aviso ativo de todas as telas",
        "security": [{ "bearerAuth": [] }, { "apiKeyAuth": [] }],
        "responses": {
          "200": { "description": "Aviso limpo com sucesso" }
        }
      }
    },
    "/api/v1/songs": {
      "get": {
        "tags": ["Músicas"],
        "summary": "Lista todas as músicas cadastradas na biblioteca local",
        "security": [{ "bearerAuth": [] }, { "apiKeyAuth": [] }],
        "responses": { "200": { "description": "Lista de músicas com id, título e artista" } }
      }
    },
    "/api/v1/songs/{id}/slides": {
      "get": {
        "tags": ["Músicas"],
        "summary": "Lista todos os slides e estrofes de uma música específica",
        "security": [{ "bearerAuth": [] }, { "apiKeyAuth": [] }],
        "parameters": [
          { "name": "id", "in": "path", "required": true, "schema": { "type": "string" } }
        ],
        "responses": { "200": { "description": "Estrofes e slides da música" } }
      }
    },
    "/api/v1/present-song": {
      "post": {
        "tags": ["Músicas"],
        "summary": "Projeta diretamente uma música da biblioteca no ar",
        "security": [{ "bearerAuth": [] }, { "apiKeyAuth": [] }],
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "required": ["songId", "verseIndex"],
                "properties": {
                  "songId": { "type": "string", "example": "song-123" },
                  "verseIndex": { "type": "integer", "example": 0 }
                }
              }
            }
          }
        },
        "responses": { "200": { "description": "Música projetada" } }
      }
    },
    "/api/v1/bible/books": {
      "get": {
        "tags": ["Bíblia"],
        "summary": "Lista os livros canônicos da Bíblia Sagrada",
        "security": [{ "bearerAuth": [] }, { "apiKeyAuth": [] }],
        "responses": { "200": { "description": "Lista de livros com id e número de capítulos" } }
      }
    },
    "/api/v1/bible/chapter": {
      "get": {
        "tags": ["Bíblia"],
        "summary": "Retorna todos os versículos de um capítulo",
        "security": [{ "bearerAuth": [] }, { "apiKeyAuth": [] }],
        "parameters": [
          { "name": "version", "in": "query", "required": true, "schema": { "type": "string", "example": "ARA" } },
          { "name": "book", "in": "query", "required": true, "schema": { "type": "integer", "example": 19 } },
          { "name": "chapter", "in": "query", "required": true, "schema": { "type": "integer", "example": 23 } }
        ],
        "responses": { "200": { "description": "Versículos do capítulo" } }
      }
    },
    "/api/v1/present-bible": {
      "post": {
        "tags": ["Bíblia"],
        "summary": "Projeta diretamente um versículo bíblico no ar",
        "security": [{ "bearerAuth": [] }, { "apiKeyAuth": [] }],
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "required": ["version", "book", "chapter", "verse"],
                "properties": {
                  "version": { "type": "string", "example": "ARA" },
                  "book": { "type": "integer", "example": 19 },
                  "chapter": { "type": "integer", "example": 23 },
                  "verse": { "type": "integer", "example": 1 }
                }
              }
            }
          }
        },
        "responses": { "200": { "description": "Versículo bíblico projetado" } }
      }
    },
    "/api/v1/wallpaper": {
      "get": {
        "tags": ["Mídias & Wallpaper"],
        "summary": "Consulta o papel de parede ativo",
        "security": [{ "bearerAuth": [] }, { "apiKeyAuth": [] }],
        "responses": { "200": { "description": "Configuração do papel de parede" } }
      },
      "post": {
        "tags": ["Mídias & Wallpaper"],
        "summary": "Ativa ou desativa a exibição do papel de parede no telão",
        "security": [{ "bearerAuth": [] }, { "apiKeyAuth": [] }],
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "required": ["enabled"],
                "properties": { "enabled": { "type": "boolean", "example": true } }
              }
            }
          }
        },
        "responses": { "200": { "description": "Papel de parede atualizado" } }
      }
    },
    "/ws": {
      "get": {
        "tags": ["WebSocket"],
        "summary": "Conexão WebSocket para streaming bidirecional de eventos",
        "description": "Permite que clientes remotos (como Stage Web, OBS Browser Source e automações) recebam eventos instantâneos `presentation://slide`, `stage://message`, `stage://timer`, `presentation://wallpaper`.",
        "responses": {
          "101": { "description": "Switching Protocols para WebSocket" }
        }
      }
    }
  },
  "components": {
    "securitySchemes": {
      "bearerAuth": {
        "type": "http",
        "scheme": "bearer",
        "bearerFormat": "Token / PIN",
        "description": "Insira o Token de Controle Remoto / API (configurado em Preferências ➔ Controle Remoto)"
      },
      "apiKeyAuth": {
        "type": "apiKey",
        "in": "header",
        "name": "X-API-Key",
        "description": "Chave de API enviada via cabeçalho HTTP X-API-Key"
      }
    }
  }
}"#;
