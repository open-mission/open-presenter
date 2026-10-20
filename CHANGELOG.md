# Changelog

Todas as mudanças relevantes do Open Presenter são documentadas neste arquivo.

O formato segue [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/) e o
versionamento segue [Semantic Versioning](https://semver.org/lang/pt-BR/).

## [0.3.0] - 2026-10-19

Release com o módulo Bíblia, temas organizados por momento do culto,
atualizações dentro do app e melhorias na projeção.

### Adicionado

#### Bíblia

- Módulo Bíblia com persistência em SQLite, comandos IPC e endpoints no servidor
  embutido.
- Importação de versões/traduções da Bíblia para uso offline.
- Página Bíblia com paleta de comandos, busca por livro, capítulo, versículo e
  texto.
- Comparação de versículos entre diferentes traduções.
- Exibição de versículos no público e no palco.
- Aba Bíblia no controle remoto, com atalho no dock.
- Campos `prevUp` e `nextUp` no `LiveSlide` para navegação entre versículos.

#### Temas por contexto

- Suporte a páginas de tema para público e palco.
- Temas específicos para contextos do culto (louvor, pregação, avisos e retorno
  do palco).
- Resolução automática do tema por contexto, com fallback para o tema padrão.
- Vinculação de tema ao evento e ativação do tema efetivo por página.
- Seleção e exclusão de tema diretamente no evento.
- Remoção da criação automática de evento padrão.

#### Editor e galeria de temas

- Páginas por contexto no editor de temas.
- Renomeação de camadas.
- Exportação e importação de temas em JSON (`.openpresenter-theme.json`).
- Atualização de temas antigos para o formato com páginas.
- Exibição da versão do tema e ação de atualização para a versão atual.
- Pré-visualizações e seletores atualizados para temas com páginas.
- Tema padrão de Bíblia/Versículos e vínculo do asset `scripture` nas
  preferências.

#### Projeção e palco

- Widgets de prévia do próximo slide (`{next_preview}`, `{next_line}`).
- Versículo anterior disponível na tela do palco.
- Auto-shrink com margem de segurança e melhor quebra de texto no renderer.

#### Atualizações

- Atualização in-app com o plugin oficial do Tauri, artefatos assinados e
  verificação de integridade.
- Aba **Atualizações** nas preferências, com versão instalada, verificação
  manual, verificação automática e instalação.
- Modal de novidades com resumo amigável das mudanças da versão.
- Endpoint de atualização apontando para o `latest.json` das GitHub Releases.
- Assinatura de updates integrada ao workflow de release.

### Alterado

- Temas padrão unificados por contexto.
- Galeria e seletores passam a considerar páginas e contexto do evento.
- Publicação do tema ao vivo passa a usar a página efetiva do contexto.
- Página efetiva do tema é publicada para público e palco.
- Versão exibida nas preferências e na tela Geral passa a vir do build.

### Corrigido

- Exclusão de tema não deixa mais o diálogo em estado inconsistente ao fechar.
- Ajustes internos de estabilidade no editor e na publicação de temas.

### Documentação e manutenção

- Documentação do desenho de temas por contexto.
- Skill de criação de temas para agentes de IA, com schema, guia de variáveis,
  exemplos e script de validação.
- `dist-releases/` adicionado ao `.gitignore`.
- Workflow de release multi-plataforma com macOS (arm64/x64), Linux e Windows.

## [0.2.0] - 2026-10-18

Primeira release pública com a base de operação ao vivo.

### Adicionado

- Aplicativo desktop Tauri v2 + React 19 com servidor HTTP/WebSocket embutido.
- Setlists e agenda de eventos.
- Módulo de músicas com importação do Holyrics, busca online de letras e grupos.
- Editor e galeria de temas de slides.
- Saídas unificadas para público e palco (janela nativa, web ou ambas).
- Controle remoto pelo navegador/celular.
- Studio de criação de apresentações.
- Biblioteca de imagens e mídia.
- Tela de descanso no retorno do palco.
- Atalhos de operador, blackout, limpeza de texto e plano de fundo.
- Persistência local em SQLite.

[0.3.0]: https://github.com/open-mission/open-presenter/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/open-mission/open-presenter/releases/tag/v0.2.0
