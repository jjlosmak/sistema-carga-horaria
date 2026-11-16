# Contexto atual — Sistema Carga Horária Docente

Atualizado em 16/11/2026. Responsável: Jerônimo Leite.

Sistema próprio da Unichristus para acompanhamento de carga horária docente. Não pertence ao EduCAPES: somente a linguagem visual é compartilhada. Não importar contas, permissões, regras, dados ou integrações do EduCAPES.

## Fonte atual

- Repositório: jjlosmak/sistema-carga-horaria.
- Branch de produção deste sistema: `producao`. A main é a versão histórica e não acompanha a produção.
- Arquivos atuais em `producao/`: Code.gs, Index.html, Logo.html e importacao.gs.
- Editor: https://script.google.com/u/0/home/projects/1C3M6pU-E7XVOh1anUgaJwwbEVuge_vbygZmKkqLKonYbeSysbjg9jlCw/edit
- Publicado: versão 21 do Apps Script, 16/11/2026 às 15:55 (Fortaleza).
- URL existente: https://script.google.com/a/macros/unichristus.edu.br/s/AKfycbzBciOZhKDR1T8RPV5yTkPKv9iw5cpCCUTdAyWMK1sqyIZL1wBUR65in_C5FKaq5mT4/exec
- Código publicado: commit d2346bf37e6c581b297f477e0ea58a15da6a9293.

## Estado e cuidado nas próximas alterações

A atualização foi exclusivamente visual. Funções e cálculos originais, RPC, backend, importação e impressão foram preservados. Há um aviso fixo na interface informando isso.

Preservar especialmente: avanço alfabético ao próximo titular ao salvar; data mantida; limpeza dos horários reais; foco no início real; mensagem no fim da lista; ordenação ignorando Dr./Dra.; horários previstos; distinção titular/substituto; Presente/Reunião sem apagar horários; entrar/sair de Faltou limpando horários; substituto/motivo obrigatórios; confirmação de sobrescrita; histórico dos desligados; campos de cadastro protegidos quando há histórico.

Impressão deve continuar com o layout existente, inclusive ficha individual sem expor outros docentes, seleção em lote, uma ficha por página e compactação de 18 a 25 professores. Alterações visuais da tela ficam em @media screen.

Backup anterior no Git: `backup/pre-atualizacao-visual-2026-11-16`, commit 95e1b98eaf763f09ba63695e118ca46a7685043f. Versão anterior 20 disponível no Google para reversão pela mesma implantação. A versão antiga experimental e as prévias V01/V02 continuam em branches separadas.

Jerônimo trabalha em dois computadores: comparar remoto, local e editor antes de editar; preservar alterações desconhecidas. Testar somente com dados fictícios. Não executar importação/manutenção para testar aparência e não enviar mensagens a professores sem pedido. Nunca registrar senhas/tokens. Publicar sempre pela edição da implantação existente, mantendo seu endereço.

Verificações e limites: `docs/PUBLICACAO-VISUAL-2026-11-16.md`; dados reais foram apenas consultados na comparação de indicadores. A atualização não foi testada com gravações reais nem com impressão física/PDF.
