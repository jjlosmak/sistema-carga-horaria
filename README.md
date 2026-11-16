# Carga Horária Docente — atualização visual Unichristus

## Fontes e versões

- Branch `producao`: arquivos atuais do Apps Script em `producao/`.
- Branch `backup/pre-atualizacao-visual-2026-11-16`: quatro arquivos anteriores à atualização, preservados integralmente. Commit de backup: 95e1b98eaf763f09ba63695e118ca46a7685043f.
- Branch `experimental/versao-anterior`: versão antiga do Git, preservada.
- Branch `prototipo/unichristus-v02`: prévia aprovada, somente com dados fictícios e simulador.
- `main` e a pasta raiz histórica `apps-script/` não representam a produção atual.

## Atualização publicada

Somente `producao/Index.html` muda a aparência das telas: azul institucional, menu lateral completo/compacto, temas, formulários e painéis. O aviso visível informa: “Atualização visual: as funções, os cálculos e os layouts de impressão continuam os mesmos.”

Código.gs (registrado como Code.gs), importacao.gs e Logo.html foram capturados do editor e permanecem idênticos. A conexão google.script.run é original. Nenhum dado fictício ou simulador foi incluído na fonte de produção. A folha de estilos original, incluindo a impressão e compactação entre 18 e 25 professores, permanece literal; os estilos novos se limitam à tela.

Foram comparadas as 60 funções de primeiro nível: 58 permanecem idênticas, incluindo cálculos, RPC e impressão; shell e render recebem apenas a decoração visual. As 96 verificações da prévia continuam aprovadas, e o avanço automático/data/foco foi conferido em navegador com dados fictícios.

## Publicação

Publicada em 16/11/2026 às 15:55 (Fortaleza), como versão 21 do Apps Script, na mesma implantação e no mesmo endereço da versão 20. A interface foi aberta após a publicação: aviso presente, oito áreas acessíveis, oito indicadores iguais aos anteriores e nenhum erro JavaScript observado. Registro em `docs/PUBLICACAO-VISUAL-2026-11-16.md`.

Para continuidade, ler `docs/CONTEXTO-ATUAL-DO-SISTEMA.md` e comparar o Git com o editor antes de cada alteração.

Backup de código não é exportação do banco. Não foram executadas importações, manutenção, testes com dados reais ou avisos aos professores. Credenciais e Propriedades do script não foram exportadas.
