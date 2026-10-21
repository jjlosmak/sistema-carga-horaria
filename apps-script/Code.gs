/**
 * Sistema de Carga Horária Docente
 * Google Apps Script + Google Sheets como banco de dados.
 *
 * Abas usadas na planilha:
 *   Parametros  -> chave | valor   (semestre, semanas, semanaAtual, horasPorAula)
 *   Professores -> id | nome | disciplina | turma | aulasPorSemana | ativo
 *   Lancamentos -> semana | professorId | aulasDadas | horas | observacao | atualizadoEm
 *
 * Para começar: abra a planilha, vá em Extensões > Apps Script, cole estes arquivos,
 * rode a função `configurarPlanilha` uma vez e publique como app da Web.
 */

const ABAS = {
  parametros: 'Parametros',
  professores: 'Professores',
  lancamentos: 'Lancamentos',
};

const CABECALHOS = {
  Parametros: ['chave', 'valor'],
  Professores: ['id', 'nome', 'disciplina', 'turma', 'aulasPorSemana', 'ativo'],
  Lancamentos: ['semana', 'professorId', 'aulasDadas', 'horas', 'observacao', 'atualizadoEm'],
};

// ---------------------------------------------------------------------------
// Web app
// ---------------------------------------------------------------------------

function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('Carga Horária Docente')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/** Devolve tudo o que a interface precisa numa única chamada. */
function getDados() {
  return {
    parametros: lerParametros_(),
    professores: lerTabela_(ABAS.professores).map(function (p) {
      return {
        id: String(p.id),
        nome: p.nome,
        disciplina: p.disciplina,
        turma: p.turma,
        aulasPorSemana: Number(p.aulasPorSemana) || 0,
        ativo: p.ativo !== false && String(p.ativo).toUpperCase() !== 'FALSE',
      };
    }),
    lancamentos: lerTabela_(ABAS.lancamentos).map(function (l) {
      return {
        semana: Number(l.semana),
        professorId: String(l.professorId),
        aulasDadas: Number(l.aulasDadas) || 0,
        horas: Number(l.horas) || 0,
        observacao: l.observacao || '',
      };
    }),
  };
}

/** Cria ou atualiza o lançamento de um professor numa semana. */
function salvarLancamento(lanc) {
  validarLancamento_(lanc);
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const aba = aba_(ABAS.lancamentos);
    const valores = aba.getDataRange().getValues();
    const linha = [Number(lanc.semana), String(lanc.professorId), Number(lanc.aulasDadas),
                   Number(lanc.horas), lanc.observacao || '', new Date()];

    for (let i = 1; i < valores.length; i++) {
      if (Number(valores[i][0]) === Number(lanc.semana) && String(valores[i][1]) === String(lanc.professorId)) {
        aba.getRange(i + 1, 1, 1, linha.length).setValues([linha]);
        return getDados();
      }
    }
    aba.appendRow(linha);
    return getDados();
  } finally {
    lock.releaseLock();
  }
}

/** Cria ou atualiza um professor. Sem id, gera um novo. */
function salvarProfessor(prof) {
  if (!prof || !String(prof.nome || '').trim()) throw new Error('Informe o nome do professor.');
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const aba = aba_(ABAS.professores);
    const valores = aba.getDataRange().getValues();
    const id = prof.id || 'P' + Utilities.formatString('%03d', valores.length);
    const linha = [id, prof.nome.trim(), prof.disciplina || '', prof.turma || '',
                   Number(prof.aulasPorSemana) || 0, prof.ativo !== false];

    for (let i = 1; i < valores.length; i++) {
      if (String(valores[i][0]) === String(id)) {
        aba.getRange(i + 1, 1, 1, linha.length).setValues([linha]);
        return getDados();
      }
    }
    aba.appendRow(linha);
    return getDados();
  } finally {
    lock.releaseLock();
  }
}

/** Atualiza a semana atual do semestre (usada para calcular o previsto até agora). */
function salvarSemanaAtual(semana) {
  const p = lerParametros_();
  const n = Number(semana);
  if (!(n >= 1 && n <= p.semanas)) throw new Error('Semana fora do semestre (1 a ' + p.semanas + ').');
  gravarParametro_('semanaAtual', n);
  return getDados();
}

// ---------------------------------------------------------------------------
// Configuração inicial (rodar uma vez)
// ---------------------------------------------------------------------------

/** Cria as abas com cabeçalhos e preenche com dados FICTÍCIOS de exemplo. */
function configurarPlanilha() {
  const ss = SpreadsheetApp.getActive();
  Object.keys(CABECALHOS).forEach(function (nome) {
    const aba = ss.getSheetByName(nome) || ss.insertSheet(nome);
    aba.clear();
    aba.getRange(1, 1, 1, CABECALHOS[nome].length).setValues([CABECALHOS[nome]])
      .setFontWeight('bold').setBackground('#e8eef7');
    aba.setFrozenRows(1);
  });

  aba_(ABAS.parametros).getRange(2, 1, 4, 2).setValues([
    ['semestre', '2026.2'], ['semanas', 18], ['semanaAtual', 12], ['horasPorAula', 1.67],
  ]);

  const professores = [
    ['P001', 'Ana Lúcia Bezerra', 'Anatomia Humana', 'S1', 4],
    ['P002', 'Bruno Castelo Nogueira', 'Bioquímica', 'S1', 3],
    ['P003', 'Carla Fontenele Dias', 'Saúde Coletiva', 'S2', 2],
    ['P004', 'Diego Aragão Pinheiro', 'Farmacologia', 'S3', 4],
    ['P005', 'Elaine Moura Sampaio', 'Semiologia', 'S4', 3],
    ['P006', 'Fábio Rolim Cavalcante', 'Bioestatística', 'S2', 2],
    ['P007', 'Gabriela Torres Lins', 'Ética Profissional', 'S5', 2],
    ['P008', 'Henrique Sá Barreto', 'Metodologia Científica', 'S1', 2],
  ].map(function (p) { return p.concat([true]); });
  aba_(ABAS.professores).getRange(2, 1, professores.length, 6).setValues(professores);

  const lanc = gerarLancamentosExemplo_(professores, 12);
  aba_(ABAS.lancamentos).getRange(2, 1, lanc.length, 6).setValues(lanc);

  SpreadsheetApp.getUi().alert('Planilha configurada com dados de exemplo. Agora publique como app da Web.');
}

/** Gera lançamentos plausíveis e determinísticos para as semanas já passadas. */
function gerarLancamentosExemplo_(professores, semanas) {
  // perfil de cumprimento de cada professor (chance de dar todas as aulas da semana)
  const perfil = [0.98, 0.88, 1.0, 0.8, 0.95, 0.72, 0.97, 0.9];
  const linhas = [];
  professores.forEach(function (p, i) {
    for (let s = 1; s <= semanas; s++) {
      if (i === professores.length - 1 && s === semanas) continue; // um lançamento ainda não feito
      const r = pseudoAleatorio_(i, s);
      let dadas = p[4];
      if (r > perfil[i]) dadas = Math.max(0, p[4] - (r > (1 + perfil[i]) / 2 + 0.02 ? 2 : 1));
      const horas = Math.round(dadas * (1.5 + ((i + s) % 4) * 0.1) * 10) / 10;
      linhas.push([s, p[0], dadas, horas, dadas < p[4] ? 'Reposição pendente' : '', new Date()]);
    }
  });
  return linhas;
}

/** Número entre 0 e 1 sempre igual para o mesmo (i, s): os exemplos saem iguais em todo lugar. */
function pseudoAleatorio_(i, s) {
  const x = Math.sin((i + 1) * 12.9898 + s * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

// ---------------------------------------------------------------------------
// Utilitários
// ---------------------------------------------------------------------------

function aba_(nome) {
  const aba = SpreadsheetApp.getActive().getSheetByName(nome);
  if (!aba) throw new Error('Aba "' + nome + '" não encontrada. Rode configurarPlanilha().');
  return aba;
}

function lerTabela_(nome) {
  const valores = aba_(nome).getDataRange().getValues();
  const cab = valores.shift();
  return valores
    .filter(function (l) { return l.some(function (c) { return c !== ''; }); })
    .map(function (l) {
      const obj = {};
      cab.forEach(function (c, i) { obj[c] = l[i]; });
      return obj;
    });
}

function lerParametros_() {
  const p = {};
  lerTabela_(ABAS.parametros).forEach(function (l) { p[l.chave] = l.valor; });
  return {
    semestre: String(p.semestre || ''),
    semanas: Number(p.semanas) || 18,
    semanaAtual: Number(p.semanaAtual) || 1,
    horasPorAula: Number(p.horasPorAula) || 1.67,
  };
}

function gravarParametro_(chave, valor) {
  const aba = aba_(ABAS.parametros);
  const valores = aba.getDataRange().getValues();
  for (let i = 1; i < valores.length; i++) {
    if (valores[i][0] === chave) {
      aba.getRange(i + 1, 2).setValue(valor);
      return;
    }
  }
  aba.appendRow([chave, valor]);
}

function validarLancamento_(l) {
  if (!l || !l.professorId) throw new Error('Escolha o professor.');
  const p = lerParametros_();
  const s = Number(l.semana);
  if (!(s >= 1 && s <= p.semanas)) throw new Error('Semana deve estar entre 1 e ' + p.semanas + '.');
  if (!(Number(l.aulasDadas) >= 0)) throw new Error('Aulas dadas não pode ser negativo.');
  if (!(Number(l.horas) >= 0)) throw new Error('Horas não pode ser negativo.');
}
