# Guia de Release

Este documento descreve o processo de publicação de uma nova versão do Open
Presenter, incluindo a atualização automática pelo app.

## Pré-requisitos

- Acesso de escrita ao repositório `open-mission/open-presenter`.
- Chave privada de assinatura do updater em `~/.tauri/open-presenter/updater.key`.
- Secrets configurados no GitHub:
  - `TAURI_SIGNING_PRIVATE_KEY` — conteúdo do arquivo `updater.key`
  - `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` — senha da chave, quando houver

> Guarde a chave privada e a senha em local seguro. Sem elas não é possível
> publicar atualizações para quem já tem o app instalado.

## Passo a passo

1. Atualize `develop` e confirme que o CI de desenvolvimento está verde.
2. Defina a nova versão nos três manifests:
   - `package.json`
   - `src-tauri/Cargo.toml`
   - `src-tauri/tauri.conf.json`
3. Rode `cargo check -p open-presenter` para atualizar o `Cargo.lock`.
4. Atualize o `CHANGELOG.md` com as mudanças técnicas.
5. Crie `docs/releases/<versao>.md` com as notas amigáveis para o público final.
   Esse arquivo vira o corpo da release e as notas exibidas no updater.
6. Rode as verificações locais:

   ```bash
   npm run typecheck
   cargo check -p open-presenter
   npm run build
   ```

   Para gerar artefatos de updater localmente, use a configuração de release e
   as variáveis de assinatura:

   ```bash
   export TAURI_SIGNING_PRIVATE_KEY="$HOME/.tauri/open-presenter/updater.key"
   export TAURI_SIGNING_PRIVATE_KEY_PASSWORD="$(cat "$HOME/.tauri/open-presenter/updater.key.password")"
   npm run tauri:build -- --config src-tauri/tauri.release.conf.json
   ```

7. Faça commit em `develop` e abra o merge para `main`.
8. Na `main`, crie e envie a tag:

   ```bash
   git tag v0.3.0
   git push origin main --tags
   ```

9. O workflow **Release** compila macOS (arm64 e x64), Linux e Windows, assina
   os artefatos e cria um **rascunho** de release com o `latest.json`.
10. Revise os assets do rascunho e publique a release.
11. Confirme que o `latest.json` está acessível:

    ```text
    https://github.com/open-mission/open-presenter/releases/latest/download/latest.json
    ```

12. Abra uma versão anterior do app e use **Preferências → Atualizações** para
    validar o fluxo completo.

## Versionamento

- `PATCH` para correções compatíveis.
- `MINOR` para funcionalidades novas compatíveis.
- `MAJOR` para mudanças incompatíveis.

## Se algo der errado

- Se o build falhar, corrija e crie uma nova tag de patch (por exemplo,
  `v0.3.1`).
- Nunca reutilize uma tag já publicada; o updater compara versões e pode ignorar
  a atualização.
- Se a chave privada for perdida, os usuários precisarão baixar manualmente uma
  release futura com uma nova chave pública.
