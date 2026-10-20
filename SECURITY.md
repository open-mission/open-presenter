# Política de Segurança

## Versões suportadas

Apenas a versão estável mais recente recebe correções de segurança. Atualize
pelo próprio app ou baixe a última release em
[github.com/open-mission/open-presenter/releases](https://github.com/open-mission/open-presenter/releases).

## Como reportar uma vulnerabilidade

**Não abra uma issue pública** para vulnerabilidades.

Use o canal privado do GitHub:

1. Acesse a aba **Security** do repositório.
2. Clique em **Report a vulnerability**.
3. Descreva o impacto, os passos de reprodução e, se possível, uma sugestão de
   correção.

Se o canal privado não estiver disponível, entre em contato com os mantenedores
pelo perfil da [Open Mission](https://github.com/open-mission).

Você receberá uma confirmação de recebimento assim que possível. Pedimos que
não divulgue detalhes publicamente antes de uma correção ser publicada.

## Escopo

Fazem parte do escopo:

- O aplicativo desktop e o processo de atualização assinada.
- O servidor HTTP/WebSocket embutido (porta `5050`) e o controle remoto.
- O tratamento de arquivos importados (temas, mídia, Bíblias e letras).
- O workflow de release e a cadeia de assinatura dos pacotes.

## Boas práticas para operadores

- Baixe o app apenas das releases oficiais.
- Mantenha o controle remoto protegido por token e não compartilhe o endereço
  publicamente sem necessidade.
- Não execute o app com privilégios de administrador.
- Mantenha o sistema operacional e a WebView atualizados.

## Chaves de assinatura

As chaves privadas de assinatura do updater **nunca** são armazenadas no
repositório. Elas ficam apenas no cofre local do mantenedor e nos secrets do
GitHub Actions. Se uma chave for comprometida, uma nova chave pública deve ser
publicada em uma release e os usuários precisarão instalar essa release
manualmente.
