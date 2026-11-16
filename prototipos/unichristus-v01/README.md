# Carga Horária Docente — prévia visual Unichristus V01

Data: 16/11/2026. Responsável pelo projeto: Jerônimo Leite.

## Separação de versões

- `experimental/versao-anterior`: cópia preservada do Git anterior, no commit `c0a7b175b1e1595f175a3ccc3f40cf50cd8030fe`.
- `prototipo/unichristus-v01`: prévia visual com dados fictícios, sem integrações ou autenticação real.
- Apps Script em produção: não alterado. A versão do editor é posterior ao código da main. Não usar a main para sobrescrevê-lo.
- O arquivo informado como salvo nos arquivos do projeto ainda não estava disponível nesta sessão. A criação de uma base fiel de produção no Git depende de recebê-lo e comparar seus arquivos com o editor.

## Abrir a prévia

Baixe `prototipos/unichristus-v01/previa.html` e abra no navegador. É um HTML autossuficiente, sem dependências externas.

## Conteúdo

Painel, lançamentos (presença, ausência, substituição e reunião), relatórios, histórico editável, ficha individual com impressão e comparação anônima, titulares, substitutos, motivos e coordenadores. Menu completo/compacto, temas claro/escuro, painéis laterais e adaptação para celular.

Todas as mudanças afetam somente exemplos em memória. Recarregar restaura os exemplos. Backup baixa JSON fictício, sem envio ao Drive. Cadastros de coordenadores não concedem acesso real. A ficha impressa não inclui ausências, motivos, saldo, total de horas ou nomes dos colegas.

## Limites e próxima etapa

Esta entrega avalia apresentação e navegação. Cálculos, validações, permissões, integrações e impressão definitiva precisam ser reconciliados com o código atual antes de uma implementação. Não copiar regras, contas ou dados do EduCAPES. Nenhuma função existente foi removida da produção. Nenhuma implantação foi criada ou modificada.

## Verificações

- Sintaxe JavaScript validada.
- Oito áreas abertas no navegador.
- Lançamento fictício de ausência com substituto confirmado e refletido no detalhe.
- Temas claro/escuro, detalhe lateral, menu móvel em 390 × 844 e prévia de ficha individual conferidos.
- Impressão física/PDF, fluxos completos de CRUD e integração real não foram validados.
