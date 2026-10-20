# Contribuindo com o Open Presenter

Obrigado pelo interesse em contribuir. O projeto é mantido pela comunidade e
segue um fluxo simples para manter as releases previsíveis.

## Antes de começar

- Leia o [`README.md`](README.md) e o [`AGENTS.md`](AGENTS.md).
- Para bugs, abra uma issue com passos de reprodução, versão do app e sistema
  operacional.
- Para funcionalidades grandes, abra uma issue ou discussion antes de
  implementar, para alinhar escopo e abordagem.

## Ambiente

```bash
npm install
npm run tauri:dev
```

Requisitos completos estão no README. O projeto usa versões pinadas de
dependências; evite atualizações sem motivo técnico.

## Branches

- `main`: releases estáveis.
- `develop`: integração contínua.
- Crie `feature/*` ou `fix/*` a partir de `develop`.
- Pull requests devem apontar para `develop`.

## Commits

Use [Conventional Commits](https://www.conventionalcommits.org/pt-br/), em
português ou inglês, curtos e no imperativo:

```text
feat: adiciona busca por palavra na Bíblia
fix: corrige exclusão de tema ao fechar diálogo
docs: atualiza guia de release
```

## Checklist do pull request

- [ ] O código compila: `npm run typecheck`
- [ ] O backend compila: `cargo check -p open-presenter`
- [ ] O comportamento foi testado no app desktop e, quando aplicável, no
      navegador (`/#/public`, `/#/stage`, `/#/remote`)
- [ ] A mudança segue a arquitetura de features e o shared kernel em `src/core`
- [ ] Não há segredos, chaves de assinatura, bancos locais ou artefatos de build
      no diff
- [ ] A documentação foi atualizada quando necessário

## Estilo

- Siga os padrões existentes de componentes, stores Zustand e serviços Rust.
- Evite comentários no código quando a intenção já estiver clara.
- Novos comandos IPC devem ser registrados no `invoke_handler` e expostos em
  `src/core/ipc/commands.ts`.
- Tipos compartilhados entre Rust e TypeScript devem permanecer sincronizados.

## Segurança

Não publique vulnerabilidades em issues. Siga o [`SECURITY.md`](SECURITY.md).

## Licença

Ao contribuir, você concorda que sua contribuição será distribuída sob a
licença MIT do projeto.
