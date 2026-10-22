# Derivar Formatos

Plugin para os designers criarem, com o Claude, o script de derivação de formatos de cada cliente.

## Como usar
1. Abra o Claude e anexe o PSD aprovado do cliente (ou aponte a pasta do computador).
2. Peça: "cria o script de derivação do cliente X" — diga os formatos, se forem diferentes do padrão.
   Se tiver versões já feitas à mão em outros formatos, anexe também (melhora muito o resultado).
3. O Claude mostra uma prévia de todos os formatos. Peça ajustes até ficar bom.
4. Receba o `Derivar_<Cliente>.jsx`, copie para a pasta `Presets\Scripts` do Photoshop e reinicie.
   Ele aparece em Arquivo > Scripts. Rode com o PSD aprovado aberto (ou escolha uma pasta inteira).
5. Para atualizar depois (formato novo, layout novo): mande o `.jsx` atual + o PSD novo e peça
   "atualiza o script do cliente X".

## O que o script faz
- Gera um PSD editável por formato na pasta `derivados`, ao lado do original.
- Mantém a composição quando a proporção permite; quando não, reorganiza mantendo a hierarquia
  (imagem principal, título, botão e marca nunca somem).
- Funciona com qualquer nome de camada (não precisa de tags), carrossel com várias pranchetas,
  camadas travadas, camadas de ajuste e de preenchimento.
- Janela com presets salvos por cliente e campo para tamanhos personalizados.

## Conteúdo
- `skills/script-de-cliente/` — o processo que o Claude segue
  - `engine/` — motor de layout comum a todos os clientes (não editar por cliente)
  - `tools/` — análise do PSD, Photoshop simulado para teste, prévia, montagem do script
  - `references/` — referência do perfil do cliente e problemas do Photoshop já resolvidos
  - `examples/perfil-rgc.js` — perfil de exemplo

## Manutenção
Correções no motor (valem para todos os clientes) devem ser feitas em `engine/`, testadas com o
exemplo da RGC e distribuídas como nova versão do plugin. Scripts já entregues continuam
funcionando; para levar a correção a um cliente, peça para atualizar o script dele.
