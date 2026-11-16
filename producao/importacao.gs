/**
 * IMPORTAÇÃO — SEMESTRES 4 A 8 / 2026.2
 *
 * Cole em um NOVO arquivo: Importacao.gs
 * Não substitua Código.gs nem Index.html.
 *
 * Requer o serviço avançado Drive API v3.
 *
 * Professores existentes e registros não são apagados.
 * As cópias convertidas dos arquivos Excel ficam no seu Drive
 * com o prefixo "IMPORTACAO_APP_".
 *
 * Aulas sem início/fim reais entram apenas na contagem
 * de aulas previstas, não como aulas realizadas.
 */

function importarSemestres4a8() {
  const BANCO_ID =
    '1JBQUc4QaQFv3tqM2ZkpqLTpt-pI0mZ_NFeOTmmU7kgo';

  const fontes = [
    {
      semestre: '4º',
      id: '1CsW6fos4FM6Fas8vQRgvrX3kWbXgp7Bl'
    },
    {
      semestre: '5º',
      id: '13fDV1bZuoEyk1N7h4Z4Eof001TToFmci'
    },
    {
      semestre: '6º',
      id: '1XJew9Oq9trZ7yhwwqd2dkZZvtwIApGjK'
    },
    {
      semestre: '7º',
      id: '1oYG9xWGd7br4I48HnyWG5ctWOFSC7hmA'
    },
    {
      semestre: '8º',
      id: '1spo_uyNB7OnuJHepL-sp-054IRp4txW5'
    }
  ];

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    const banco = SpreadsheetApp.openById(BANCO_ID);
    const tz = banco.getSpreadsheetTimeZone();

    // Confere o coordenador antes de preparar a importação.
    const abaCoord = banco.getSheetByName('Coordenadores');

    if (!abaCoord) {
      throw new Error('Aba Coordenadores não encontrada.');
    }

    const email = Session.getActiveUser().getEmail()
      .trim().toLowerCase();

    const autorizado = email && abaCoord
      .getDataRange()
      .getDisplayValues()
      .slice(1)
      .some(r => String(r[0]).trim().toLowerCase() === email);

    if (!autorizado) {
      throw new Error(
        'Execute com uma conta cadastrada na aba Coordenadores.'
      );
    }

    const professores = impLerTabela_(banco, 'Professores', [
      'Nome', 'ProfessorId', 'Tipo', 'AulasPrevistas',
      'Semestre', 'Turno', 'InicioPadrao', 'FimPadrao'
    ]);

    const registros = impLerTabela_(banco, 'Registros', [
      'Data', 'ProfessorId', 'InicioPrevisto', 'FimPrevisto',
      'InicioReal', 'FimReal', 'Faltou',
      'ProfessorTitularId', 'ProfessorSubstitutoId', 'Motivo'
    ]);

    const motivos = impLerTabela_(banco, 'MotivosAusencia', [
      'Motivo', 'Ativo'
    ]);

    const indiceProf = new Map();
    const ids = new Set();

    professores.rows.forEach(p => {
      if (!p.Nome) return;

      if (!p.ProfessorId) {
        throw new Error(
          'Professor sem ProfessorId no Banco: ' + p.Nome
        );
      }

      const id = String(p.ProfessorId).trim();

      if (ids.has(id)) {
        throw new Error('ProfessorId repetido no Banco: ' + id);
      }

      ids.add(id);

      const chave = impChaveProfessor_(
        p.Nome, p.Tipo, p.Semestre, p.Turno
      );

      if (indiceProf.has(chave)) {
        throw new Error(
          'Há dois cadastros equivalentes no Banco: ' + p.Nome +
          '. Confira semestre, turno e tipo antes de importar.'
        );
      }

      indiceProf.set(chave, p);
    });

    const novosProfessores = [];
    const novosRegistros = [];
    const novosMotivos = [];
    const planejamento = new Map();
    const aulas = [];
    const resumo = [];

    function obterProfessor(nome, tipo, semestre, turno) {
      nome = impNome_(nome);

      const chave = impChaveProfessor_(
        nome, tipo, semestre, turno
      );

      if (indiceProf.has(chave)) {
        return indiceProf.get(chave);
      }

      const horario = turno === 'Manhã'
        ? ['08:00', '11:00']
        : turno === 'Tarde'
          ? ['14:00', '17:00']
          : ['19:00', '22:00'];

      const professor = {
        Nome: nome,
        ProfessorId: 'prof_' + Utilities.getUuid(),
        Tipo: tipo,
        AulasPrevistas: 0,
        Semestre: semestre,
        Turno: turno,
        InicioPadrao: horario[0],
        FimPadrao: horario[1],
        Email: '',
        'Email (opcional)': '',
        Ativo: 'Sim',
        MotivoDesligamento: ''
      };

      indiceProf.set(chave, professor);
      novosProfessores.push(professor);
      return professor;
    }

    // Prepara e valida todas as fontes antes de gravar no Banco.
    fontes.forEach(fonte => {
      const origem = impAbrirExcel_(fonte);
      const aba = origem.getSheets().find(
        s => impNorm_(s.getName()) === 'registros'
      );

      if (!aba) {
        throw new Error(
          'Aba REGISTROS não encontrada no ' + fonte.semestre
        );
      }

      const valores = aba.getDataRange().getValues();
      const cabecalho = valores[0].map(impNorm_);
      const fuso = origem.getSpreadsheetTimeZone();

      function coluna(nome) {
        const pos = cabecalho.indexOf(impNorm_(nome));

        if (pos < 0) {
          throw new Error(
            fonte.semestre + ': coluna ausente: ' + nome
          );
        }

        return pos;
      }

      const c = {
        data: coluna('Data'),
        semestre: coluna('Semestre'),
        turno: coluna('Turno'),
        nome: coluna('Professor(es)'),
        faltou: coluna('Faltou?'),
        substituto: coluna('Professor Substituto'),
        motivo: coluna('Motivo:'),
        ps: coluna('Inicio Previsto'),
        pe: coluna('Fim Previsto'),
        rs: coluna('Início Real'),
        re: coluna('Fim Real')
      };

      let realizadas = 0;
      let substituicoes = 0;

      valores.slice(1).forEach((r, numero) => {
        const local = fonte.semestre + ', linha ' + (numero + 2);
        const nome = impNome_(r[c.nome]);

        if (!nome) return;

        // Exclui somente o nome de teste informado.
        if (impNorm_(nome) === 'jeronimo') return;

        const semestre = impSemestre_(r[c.semestre]);

        if (semestre !== fonte.semestre) {
          throw new Error(local + ': semestre inconsistente.');
        }

        const turno = impTurno_(r[c.turno]);
        const data = impData_(r[c.data], fuso);
        const titular = obterProfessor(
          nome, 'Titular', semestre, turno
        );

        if (!planejamento.has(titular.ProfessorId)) {
          planejamento.set(titular.ProfessorId, new Set());
        }

        // Conta as datas previstas, inclusive as ainda não realizadas.
        planejamento.get(titular.ProfessorId).add(data);

        const rs = impHora_(r[c.rs], fuso);
        const re = impHora_(r[c.re], fuso);
        const nomeSub = impNome_(r[c.substituto]);
        const marca = impNorm_(r[c.faltou]);

        if (marca && !['sim', 's', 'nao', 'n'].includes(marca)) {
          throw new Error(local + ': valor inválido em Faltou?.');
        }

        if (nomeSub && ['nao', 'n'].includes(marca)) {
          throw new Error(
            local + ': há substituto, mas Faltou? está marcado Não.'
          );
        }

        const faltou = !!nomeSub || ['sim', 's'].includes(marca);

        if (!rs && !re) {
          if (faltou) {
            throw new Error(
              local + ': ausência/substituição sem horários reais.'
            );
          }
          return;
        }

        if (!rs || !re) {
          throw new Error(local + ': horário real incompleto.');
        }

        if (faltou && !nomeSub) {
          throw new Error(
            local + ': falta registrada sem professor substituto.'
          );
        }

        const ps = impHora_(r[c.ps], fuso);
        const pe = impHora_(r[c.pe], fuso);

        if (!ps || !pe ||
            impMin_(pe) <= impMin_(ps) ||
            impMin_(re) <= impMin_(rs)) {
          throw new Error(local + ': intervalo de horário inválido.');
        }

        const substituto = faltou
          ? obterProfessor(nomeSub, 'Substituto', semestre, turno)
          : null;

        const motivo = faltou
          ? String(r[c.motivo] || '').trim() || 'Não informado'
          : '';

        aulas.push({
          Data: data,
          ProfessorId: substituto
            ? substituto.ProfessorId
            : titular.ProfessorId,
          InicioPrevisto: ps,
          FimPrevisto: pe,
          InicioReal: rs,
          FimReal: re,
          Faltou: faltou ? 'Sim' : 'Não',
          ProfessorTitularId: titular.ProfessorId,
          ProfessorSubstitutoId: substituto
            ? substituto.ProfessorId
            : '',
          Motivo: motivo
        });

        realizadas++;
        if (substituto) substituicoes++;
      });

      resumo.push(
        fonte.semestre + ': ' + realizadas +
        ' aulas realizadas; ' + substituicoes + ' substituições.'
      );
    });

    // Aulas previstas são preenchidas somente nos novos cadastros.
    novosProfessores.forEach(p => {
      if (p.Tipo === 'Titular') {
        p.AulasPrevistas = planejamento.has(p.ProfessorId)
          ? planejamento.get(p.ProfessorId).size
          : 0;
      }
    });

    // Não sobrescreve registros existentes.
    // Mesma aula com dados divergentes interrompe a importação.
    const existentes = new Map();

    registros.rows.forEach(r => {
      if (!r.Data) return;

      const normalizado = {
        Data: impData_(r.Data, tz),
        ProfessorId: String(r.ProfessorId || '').trim(),
        InicioPrevisto: impHora_(r.InicioPrevisto, tz),
        FimPrevisto: impHora_(r.FimPrevisto, tz),
        InicioReal: impHora_(r.InicioReal, tz),
        FimReal: impHora_(r.FimReal, tz),
        Faltou: ['sim', 's', 'true'].includes(impNorm_(r.Faltou))
          ? 'Sim' : 'Não',
        ProfessorTitularId: String(
          r.ProfessorTitularId || r.ProfessorId || ''
        ).trim(),
        ProfessorSubstitutoId: String(
          r.ProfessorSubstitutoId || ''
        ).trim(),
        Motivo: String(r.Motivo || '').trim()
      };

      const chave = impChaveAula_(normalizado);

      if (existentes.has(chave)) {
        throw new Error(
          'O Banco já contém lançamentos repetidos para ' +
          normalizado.Data + ', titular ' +
          normalizado.ProfessorTitularId +
          '. Confira antes de importar.'
        );
      }

      existentes.set(chave, normalizado);
    });

    let ignorados = 0;

    aulas.forEach(aula => {
      const chave = impChaveAula_(aula);

      if (existentes.has(chave)) {
        const anterior = existentes.get(chave);

        if (JSON.stringify(anterior) !== JSON.stringify(aula)) {
          throw new Error(
            'Conflito em ' + aula.Data + ', titular ' +
            aula.ProfessorTitularId +
            ': a aula já existe com dados diferentes. Nada foi gravado.'
          );
        }

        ignorados++;
        return;
      }

      existentes.set(chave, aula);
      novosRegistros.push(aula);
    });

    const motivosConhecidos = new Set(
      motivos.rows.map(r => impNorm_(r.Motivo))
    );

    novosRegistros.forEach(r => {
      if (r.Motivo && !motivosConhecidos.has(impNorm_(r.Motivo))) {
        novosMotivos.push({
          Motivo: r.Motivo,
          Ativo: 'Sim'
        });
        motivosConhecidos.add(impNorm_(r.Motivo));
      }
    });

    // Grava apenas depois que toda a preparação foi validada.
    impAcrescentar_(professores, novosProfessores);
    impAcrescentar_(motivos, novosMotivos);
    impAcrescentar_(registros, novosRegistros);

    SpreadsheetApp.flush();

    const mensagem = [
      'IMPORTAÇÃO CONCLUÍDA',
      '',
      ...resumo,
      '',
      'Novos cadastros: ' + novosProfessores.length,
      'Novos lançamentos: ' + novosRegistros.length,
      'Lançamentos iguais já existentes: ' + ignorados,
      'Novos motivos: ' + novosMotivos.length,
      '',
      'Atualize a página da aplicação para carregar os dados.'
    ].join('\n');

    console.log(mensagem);
    banco.toast('Importação concluída. Consulte o registro de execução.');
    return mensagem;

  } finally {
    lock.releaseLock();
  }
}

function impAbrirExcel_(fonte) {
  if (typeof Drive === 'undefined') {
    throw new Error(
      'Adicione Drive API v3 em Serviços, no editor Apps Script.'
    );
  }

  const propriedades = PropertiesService.getScriptProperties();
  const chave = 'IMPORTACAO_2026_2_' + fonte.id;
  const convertido = propriedades.getProperty(chave);

  // Reutiliza a mesma cópia em novas tentativas.
  if (convertido) {
    return SpreadsheetApp.openById(convertido);
  }

  const original = DriveApp.getFileById(fonte.id);
  const copia = Drive.Files.create(
    {
      name: 'IMPORTACAO_APP_' + fonte.semestre + '_2026_2',
      mimeType: 'application/vnd.google-apps.spreadsheet'
    },
    original.getBlob(),
    { fields: 'id' }
  );

  propriedades.setProperty(chave, copia.id);
  return SpreadsheetApp.openById(copia.id);
}

function impLerTabela_(banco, nome, obrigatorias) {
  const sheet = banco.getSheetByName(nome);

  if (!sheet) {
    throw new Error('Aba não encontrada no Banco: ' + nome);
  }

  const valores = sheet.getDataRange().getValues();
  const headers = valores[0].map(v => String(v).trim());

  const faltantes = obrigatorias.filter(h => !headers.includes(h));

  if (faltantes.length) {
    throw new Error(
      'Estrutura incompatível na aba ' + nome +
      '. Colunas esperadas não encontradas: ' + faltantes.join(', ') +
      '. Cabeçalhos atuais: ' + headers.join(' | ') +
      '. Nenhum dado foi importado.'
    );
  }

  if (new Set(headers).size !== headers.length ||
      headers.some(h => !h)) {
    throw new Error(
      nome + ': há cabeçalhos vazios ou repetidos. Confira a aba.'
    );
  }

  const permitidas = obrigatorias.concat(
    nome === 'Professores'
      ? ['Email', 'Email (opcional)', 'Ativo', 'MotivoDesligamento']
      : []
  );

  const desconhecidas = headers.filter(h => !permitidas.includes(h));

  if (desconhecidas.length) {
    throw new Error(
      nome + ': existem colunas adicionais que precisam ser mapeadas: ' +
      desconhecidas.join(', ') + '. Nenhum dado foi importado.'
    );
  }

  const rows = valores.slice(1)
    .filter(r => r.some(v => v !== ''))
    .map(r => {
      const objeto = {};
      headers.forEach((h, i) => objeto[h] = r[i]);
      return objeto;
    });

  return { sheet: sheet, headers: headers, rows: rows };
}

function impAcrescentar_(tabela, objetos) {
  if (!objetos.length) return;

  const sheet = tabela.sheet;
  const primeira = sheet.getLastRow() + 1;
  const ultima = primeira + objetos.length - 1;

  if (ultima > sheet.getMaxRows()) {
    sheet.insertRowsAfter(
      sheet.getMaxRows(),
      ultima - sheet.getMaxRows()
    );
  }

  const valores = objetos.map(objeto =>
    tabela.headers.map(h => {
      const valor = objeto[h] === undefined ? '' : objeto[h];

      // Trata texto que começa com "=" como texto, não fórmula.
      return typeof valor === 'string' && valor.startsWith('=')
        ? "'" + valor
        : valor;
    })
  );

  const intervalo = sheet.getRange(
    primeira, 1, valores.length, tabela.headers.length
  );

  // Mantém datas e horários em texto no formato usado pela aplicação.
  intervalo.setNumberFormat('@');
  intervalo.setValues(valores);
}

function impNorm_(valor) {
  return String(valor === null || valor === undefined ? '' : valor)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function impNome_(valor) {
  let nome = String(valor || '').trim().replace(/\s+/g, ' ');
  if (!nome) return '';

  const chave = impNorm_(
    nome.replace(/^dra?\.?\s*/i, '')
  );

  // Correspondências confirmadas pelo usuário.
  const equivalencias = {
    'mercia lessa': 'Dra. Mércia Lessa Rocha',
    'thiago de paula': 'Dr. Thiago de Paula Pessôa Franco Silva'
  };

  return equivalencias[chave] || nome;
}

function impChaveProfessor_(nome, tipo, semestre, turno) {
  const pessoa = impNorm_(
    impNome_(nome).replace(/^dra?\.?\s*/i, '')
  );

  return [
    pessoa,
    impNorm_(tipo),
    impSemestre_(semestre),
    impTurno_(turno)
  ].join('|');
}

function impSemestre_(valor) {
  const resultado = String(valor || '').match(/\d+/);

  if (!resultado) {
    throw new Error('Semestre inválido: ' + valor);
  }

  return Number(resultado[0]) + 'º';
}

function impTurno_(valor) {
  const texto = impNorm_(valor);

  if (texto === 'm' || texto.startsWith('man')) return 'Manhã';
  if (texto === 't' || texto.startsWith('tar')) return 'Tarde';
  if (texto === 'n' || texto.startsWith('noi')) return 'Noite';

  throw new Error('Turno inválido: ' + valor);
}

function impHora_(valor, fuso) {
  if (valor === '' || valor === null || valor === undefined) {
    return '';
  }

  if (valor instanceof Date) {
    return Utilities.formatDate(valor, fuso, 'HH:mm');
  }

  if (typeof valor === 'number') {
    if (valor < 0 || valor >= 1) {
      throw new Error('Valor numérico de horário inválido: ' + valor);
    }

    const minutos = Math.round(valor * 1440);

    if (minutos >= 1440) {
      throw new Error('Horário fora do intervalo de um dia.');
    }

    return String(Math.floor(minutos / 60)).padStart(2, '0') +
      ':' + String(minutos % 60).padStart(2, '0');
  }

  const texto = String(valor).trim();
  const partes = texto.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);

  if (!partes ||
      Number(partes[1]) > 23 ||
      Number(partes[2]) > 59 ||
      (partes[3] && Number(partes[3]) !== 0)) {
    throw new Error('Horário inválido ou com segundos não zerados: ' + texto);
  }

  return partes[1].padStart(2, '0') + ':' + partes[2];
}

function impData_(valor, fuso) {
  if (valor instanceof Date) {
    return Utilities.formatDate(valor, fuso, 'yyyy-MM-dd');
  }

  const texto = String(valor || '').trim();
  let partes = texto.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T].*)?$/);
  let ano, mes, dia;

  if (partes) {
    ano = Number(partes[1]);
    mes = Number(partes[2]);
    dia = Number(partes[3]);
  } else {
    partes = texto.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);

    if (!partes) {
      throw new Error('Data inválida: ' + texto);
    }

    ano = Number(partes[3]);
    mes = Number(partes[2]);
    dia = Number(partes[1]);
  }

  const teste = new Date(Date.UTC(ano, mes - 1, dia));

  if (teste.getUTCFullYear() !== ano ||
      teste.getUTCMonth() !== mes - 1 ||
      teste.getUTCDate() !== dia) {
    throw new Error('Data inexistente: ' + texto);
  }

  return String(ano) + '-' +
    String(mes).padStart(2, '0') + '-' +
    String(dia).padStart(2, '0');
}

function impMin_(hora) {
  const partes = hora.split(':').map(Number);
  return partes[0] * 60 + partes[1];
}

function impChaveAula_(registro) {
  return [
    registro.Data,
    registro.ProfessorTitularId,
    registro.InicioPrevisto,
    registro.FimPrevisto
  ].join('|');
}