# Prévia Unichristus V02 — preservar os comportamentos existentes

Esta revisão substitui a abordagem da primeira prévia, que recriava parte dos fluxos e a impressão. A V02 usa como base o arquivo atual fornecido por Jerônimo, preservando as funções originais.

## O que foi preservado

- Sequência alfabética de titulares, ignorando Dr./Dra. na ordenação; próximo professor selecionado após salvar.
- Data mantida entre lançamentos; horários reais limpos e foco devolvido ao início real; aviso de fim da lista, sem voltar automaticamente ao primeiro.
- Horários previstos por turno; cálculo de horas reais, saldo e média por aula do código original.
- Presente/Reunião mantém os horários; entrar/sair de Faltou limpa os horários para evitar atribuição à pessoa errada; substituto e motivo obrigatórios na ausência; motivo Outro.
- Confirmação de sobrescrita de lançamento existente; edição com titular fixo; exclusão; histórico dos desligados; restrições nos cadastros com histórico.
- Titulares, substitutos, motivos ativos/inativos, coordenadores e ação de backup presentes.
- Relatórios semanais (segunda a domingo), mensais e semestrais; reunião marcada no relatório; professor responsável e horários previsto/real.
- Ficha completa da coordenação e impressão individual/anônima; seleção de fichas; todos do contexto; uma ficha por página.
- Impressão compacta entre 18 e 25 professores, exatamente conforme o código original.

## Impressão

A folha de estilos original inteira, inclusive @page e @media print, foi mantida literalmente. As funções printFicha, fichaBatchHtml, reportPrintHtml e seus auxiliares permanecem iguais ao original. Toda a nova folha de estilos está dentro de @media screen. Não foram redesenhados os documentos impressos.

## Verificação

96 verificações passaram. Foram comparadas 55 funções originais sem mudança, saídas de cálculos/relatórios/fichas, lotes com 17, 18, 25 e 26 professores, anonimização, contexto, ordenação e operações simuladas. O arquivo original contém 60 funções de primeiro nível. Na prévia, rpc é substituída por um simulador; shell/render recebem decoração visual e setTheme/initialTheme usam uma preferência exclusiva da prévia.

No navegador foram conferidos: sequência Ana → Bruno → Carlos; manutenção da data; limpeza dos horários e foco; fim da lista mantendo Fábio; Presente/Reunião sem limpeza; entrada em Faltou com limpeza e campos obrigatórios; oito áreas; prévia de ficha e ausência de erros JavaScript.

A impressão foi conferida por identidade do código/CSS e igualdade das saídas HTML, sem impressão física/PDF. Os testes do simulador não certificam as validações, permissões ou integrações do servidor real.

## Isolamento e limites

Dados fictícios, apenas em memória. Não há chamada real ao Apps Script. Backup é simulado em memória; coordenadores não recebem permissão real. Recarregar restaura os exemplos.

Logo.html não foi fornecido e a prévia usa marca textual somente na tela. Código.gs, importacao.gs e Logo.html atuais ainda precisam ser comparados antes da integração. A produção, a branch producao, o editor e a implantação não foram alterados.

## Arquivos

- previa.html: abrir diretamente no navegador.
- original-current.html: cópia imutável da interface fornecida, usada na geração.
- build-preserved.cjs: gera a prévia a partir da base original.
- preserved-screen.css: aparência somente em tela.
- preserved-demo.js: simulador e decoração da prévia.
- test-preservation.cjs, test-results.json e preservation-proof.json: comparações e evidências.

Para reproduzir, executar `node build-preserved.cjs` e `node test-preservation.cjs`. O gerador também escreve em `../../outputs`, relativo ao diretório de execução do projeto de origem.
