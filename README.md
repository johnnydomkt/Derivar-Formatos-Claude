# Ferramentas de Design — plugins do Claude

Marketplace de plugins do Claude da agência. Hoje tem um plugin:

- **Derivar Formatos** — cria o script do Photoshop (`Derivar_<Cliente>.jsx`) que desdobra o
  criativo aprovado em Story, quadrado, Google Ads e tamanhos livres, gerando PSDs editáveis.

## Instalar (cada designer faz uma vez)

1. No Claude, abra **Personalizar → Plugins**.
2. Clique em **Adicionar → Adicionar marketplace**.
3. Escolha adicionar a partir de um repositório e informe o endereço deste repositório.
4. Instale **Derivar Formatos**.
5. Abra uma conversa nova, anexe o PSD aprovado e peça:
   "cria o script de derivação do cliente X".

Se o repositório for privado, a pessoa precisa ter acesso a ele no GitHub.

## Publicar uma versão nova

1. Altere os arquivos em `plugins/derivar-formatos/`.
2. Aumente o número de `version` em `plugins/derivar-formatos/.claude-plugin/plugin.json`
   **e** em `.claude-plugin/marketplace.json` (os dois iguais).
3. Faça commit e envie para o GitHub. Os designers recebem a atualização pelo Claude.

## Estrutura

```
.claude-plugin/marketplace.json          ← catálogo do marketplace
plugins/derivar-formatos/
├─ .claude-plugin/plugin.json            ← nome e versão do plugin
├─ README.md
└─ skills/script-de-cliente/             ← instruções, motor, ferramentas e exemplo
```
