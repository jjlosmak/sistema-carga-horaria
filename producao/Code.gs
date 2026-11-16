/**
 * CARGA HORÁRIA DOCENTE
 *
 * Professores:
 * Nome | ProfessorId | Tipo | AulasPrevistas | Semestre | Turno |
 * InicioPadrao | FimPadrao | Email (opcional) |
 * Ativo | MotivoDesligamento
 *
 * Registros:
 * Data | ProfessorId | InicioPrevisto | FimPrevisto |
 * InicioReal | FimReal | Faltou | ProfessorTitularId |
 * ProfessorSubstitutoId | Motivo | RegistroId | Reuniao
 *
 * Coordenadores:
 * Email
 *
 * MotivosAusencia:
 * Motivo | Ativo
 */

const APP_SHEETS = {
  professores: 'Professores',
  registros: 'Registros',
  coordenadores: 'Coordenadores',
  motivos: 'MotivosAusencia'
};

const APP_TIMES = {
  'Manhã': { start: '08:00', end: '11:00' },
  'Tarde': { start: '14:00', end: '17:00' },
  'Noite': { start: '19:00', end: '22:00' }
};

function doGet() {
  return HtmlService.createTemplateFromFile('Index')
    .evaluate()
    .setTitle('Carga Horária Docente')
    .addMetaTag(
      'viewport',
      'width=device-width, initial-scale=1'
    );
}

function text_(value) {
  return value == null ? '' : String(value).trim();
}

function email_(value) {
  return text_(value).toLowerCase();
}

function book_() {
  const book = SpreadsheetApp.getActiveSpreadsheet();

  if (!book) {
    throw new Error(
      'Este projeto precisa estar vinculado à planilha do sistema.'
    );
  }

  return book;
}

function sheet_(name) {
  const sheet = book_().getSheetByName(name);

  if (!sheet) {
    throw new Error('A aba "' + name + '" não foi encontrada.');
  }

  return sheet;
}

function timezone_() {
  return book_().getSpreadsheetTimeZone();
}

function locked_(callback) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    return callback();
  } finally {
    lock.releaseLock();
  }
}

function boolean_(value) {
  if (value === true) return true;

  return ['sim', 's', 'true', '1'].includes(
    text_(value).toLowerCase()
  );
}

function active_(value) {
  // Cadastros antigos, sem a coluna preenchida, são ativos.
  if (text_(value) === '') return true;
  return boolean_(value);
}

function turno_(value) {
  const text = text_(value).toLowerCase();

  if (text === 'm' || text.startsWith('man')) return 'Manhã';
  if (text === 't' || text.startsWith('tar')) return 'Tarde';
  if (text === 'n' || text.startsWith('noi')) return 'Noite';

  return '';
}

function type_(value) {
  const text = text_(value).toLowerCase();

  if (text === 'titular') return 'Titular';
  if (text === 'substituto') return 'Substituto';

  return '';
}

function time_(value) {
  if (value instanceof Date) {
    return Utilities.formatDate(
      value,
      timezone_(),
      'HH:mm'
    );
  }

  if (typeof value === 'number' && value >= 0 && value < 1) {
    const minutes = Math.round(value * 1440) % 1440;

    return String(Math.floor(minutes / 60)).padStart(2, '0') +
      ':' +
      String(minutes % 60).padStart(2, '0');
  }

  const match = text_(value).match(
    /^(\d{1,2}):(\d{2})(?::\d{2})?$/
  );

  if (!match) return '';

  const hour = Number(match[1]);
  const minute = Number(match[2]);

  if (hour > 23 || minute > 59) return '';

  return String(hour).padStart(2, '0') + ':' + match[2];
}

function date_(value) {
  if (value instanceof Date) {
    return Utilities.formatDate(
      value,
      timezone_(),
      'yyyy-MM-dd'
    );
  }

  return text_(value);
}

function validDate_(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;

  const parsed = new Date(value + 'T12:00:00Z');

  return !isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value;
}

function hours_(start, end) {
  start = time_(start);
  end = time_(end);

  if (!start || !end) return 0;

  const toMinutes = function(value) {
    const parts = value.split(':').map(Number);
    return parts[0] * 60 + parts[1];
  };

  return Math.max(0, toMinutes(end) - toMinutes(start)) / 60;
}

/*
 * Evita que textos cadastrados sejam interpretados
 * como fórmulas pela planilha.
 */
function cellText_(value) {
  const text = text_(value);
  return /^[=+\-@]/.test(text) ? "'" + text : text;
}

/* ---------------- AUTORIZAÇÃO ---------------- */

function getCurrentUserInfo() {
  const email = email_(Session.getActiveUser().getEmail());

  const coordinators = sheet_(APP_SHEETS.coordenadores)
    .getDataRange()
    .getValues()
    .slice(1);

  const authorized = !!email && coordinators.some(function(row) {
    return email_(row[0]) === email;
  });

  return {
    email: email,
    authorized: authorized,
    isCoordinator: authorized
  };
}

function requireCoordinator_() {
  if (!getCurrentUserInfo().authorized) {
    throw new Error(
      'Acesso restrito aos coordenadores cadastrados.'
    );
  }
}

/* ---------------- ESTRUTURA ---------------- */

function ensureStructure_() {
  const professors = sheet_(APP_SHEETS.professores);
  const records = sheet_(APP_SHEETS.registros);

  if (professors.getMaxColumns() < 11) {
    professors.insertColumnsAfter(
      professors.getMaxColumns(),
      11 - professors.getMaxColumns()
    );
  }

  const headers = professors.getRange(1, 1, 1, 11)
    .getValues()[0];

  if (
    text_(headers[0]) !== 'Nome' ||
    text_(headers[1]) !== 'ProfessorId'
  ) {
    throw new Error(
      'A aba Professores precisa usar a estrutura com ProfessorId. ' +
      'Nenhum cadastro foi alterado.'
    );
  }

  const additions = [
    [10, 'Ativo'],
    [11, 'MotivoDesligamento']
  ];

  additions.forEach(function(item) {
    const current = text_(headers[item[0] - 1]);

    if (current && current !== item[1]) {
      throw new Error(
        'A coluna ' + item[0] +
        ' da aba Professores já contém outro campo: ' +
        current + '. Nenhum dado será sobrescrito.'
      );
    }
  });

  const recordHeaders = records.getRange(1, 1, 1, 10)
    .getValues()[0];

  if (
    text_(recordHeaders[0]) !== 'Data' ||
    text_(recordHeaders[1]) !== 'ProfessorId'
  ) {
    throw new Error(
      'A aba Registros precisa usar a estrutura com ProfessorId.'
    );
  }

  additions.forEach(function(item) {
    if (!text_(headers[item[0] - 1])) {
      professors.getRange(1, item[0]).setValue(item[1]);
    }
  });

  // Garante a coluna RegistroId (11) na aba Registros, preservando
  // qualquer outro conteúdo já existente nessa coluna.
  if (records.getMaxColumns() < 12) {
    records.insertColumnsAfter(
      records.getMaxColumns(),
      12 - records.getMaxColumns()
    );
  }

  // Coluna 12 (Reuniao): marca dias de reunião dos tutores.
  const meetingHeader = text_(records.getRange(1, 12).getValue());

  if (meetingHeader && meetingHeader !== 'Reuniao') {
    throw new Error(
      'A coluna 12 da aba Registros já contém outro campo: ' +
      meetingHeader + '. Nenhum dado será sobrescrito.'
    );
  }

  if (!meetingHeader) {
    records.getRange(1, 12).setValue('Reuniao');
  }

  const recordIdHeader = text_(
    records.getRange(1, 11).getValue()
  );

  if (recordIdHeader && recordIdHeader !== 'RegistroId') {
    throw new Error(
      'A coluna 11 da aba Registros já contém outro campo: ' +
      recordIdHeader + '. Nenhum dado será sobrescrito.'
    );
  }

  if (!recordIdHeader) {
    records.getRange(1, 11).setValue('RegistroId');
  }

  // Preenche RegistroId para lançamentos antigos que ainda não têm.
  const lastRow = records.getLastRow();

  if (lastRow > 1) {
    const idRange = records.getRange(2, 11, lastRow - 1, 1);
    const dataRange = records.getRange(2, 1, lastRow - 1, 1);
    const ids = idRange.getValues();
    const dates = dataRange.getValues();
    let changed = false;

    for (let i = 0; i < ids.length; i++) {
      const hasDate = text_(dates[i][0]) !== '' ||
        dates[i][0] instanceof Date;

      if (hasDate && !text_(ids[i][0])) {
        ids[i][0] = 'R-' + Utilities.getUuid();
        changed = true;
      }
    }

    if (changed) {
      idRange.setValues(ids);
    }
  }

  let reasons = book_().getSheetByName(APP_SHEETS.motivos);

  if (!reasons) {
    reasons = book_().insertSheet(APP_SHEETS.motivos);
  }

  if (reasons.getLastRow() === 0) {
    reasons.getRange(1, 1, 6, 2).setValues([
      ['Motivo', 'Ativo'],
      ['Doença', 'Sim'],
      ['Atestado médico', 'Sim'],
      ['Compromisso institucional', 'Sim'],
      ['Congresso ou evento acadêmico', 'Sim'],
      ['Licença', 'Sim']
    ]);
  }

  const reasonHeaders = reasons.getRange(1, 1, 1, 2)
    .getValues()[0];

  if (
    text_(reasonHeaders[0]) !== 'Motivo' ||
    text_(reasonHeaders[1]) !== 'Ativo'
  ) {
    throw new Error(
      'A aba MotivosAusencia deve ter as colunas Motivo e Ativo.'
    );
  }
}

function prepararSistema() {
  requireCoordinator_();

  return locked_(function() {
    ensureStructure_();

    return {
      success: true,
      message: 'Estrutura preparada. Registros preservados.'
    };
  });
}

/* ---------------- LEITURA ---------------- */

function professors_() {
  return sheet_(APP_SHEETS.professores)
    .getDataRange()
    .getValues()
    .slice(1)
    .map(function(row, index) {
      const shift = turno_(row[5]);
      const defaults = APP_TIMES[shift] || {};

      return {
        row: index + 2,
        id: text_(row[1]),
        name: text_(row[0]),
        type: type_(row[2]) || 'Titular',
        plannedClasses: Number(row[3]) || 0,
        semester: text_(row[4]),
        turno: shift,
        defaultStart: time_(row[6]) || defaults.start || '',
        defaultEnd: time_(row[7]) || defaults.end || '',
        email: email_(row[8]),
        active: active_(row[9]),
        departureReason: text_(row[10])
      };
    })
    .filter(function(professor) {
      return professor.name !== '';
    });
}

function records_() {
  return sheet_(APP_SHEETS.registros)
    .getDataRange()
    .getValues()
    .slice(1)
    .filter(function(row) {
      return text_(row[0]) !== '';
    })
    .map(function(row) {
      const absent = boolean_(row[6]);
      const responsibleId = text_(row[1]);
      const plannedStart = time_(row[2]);
      const plannedEnd = time_(row[3]);
      const realStart = time_(row[4]);
      const realEnd = time_(row[5]);
      const plannedHours = hours_(plannedStart, plannedEnd);
      const hours = hours_(realStart, realEnd);

      return {
        id: text_(row[10]),
        meeting: !absent && boolean_(row[11]),
        date: date_(row[0]),
        responsibleId: responsibleId,
        plannedStart: plannedStart,
        plannedEnd: plannedEnd,
        realStart: realStart,
        realEnd: realEnd,
        absent: absent,
        titularId: text_(row[7]) || (!absent ? responsibleId : ''),
        substituteId: text_(row[8]) || (absent ? responsibleId : ''),
        reason: text_(row[9]),
        plannedHours: plannedHours,
        hours: hours,
        saldo: hours - plannedHours
      };
    });
}

function recordRow_(id) {
  const sheet = sheet_(APP_SHEETS.registros);
  const values = sheet.getDataRange().getValues();

  for (let i = 1; i < values.length; i++) {
    if (text_(values[i][0]) !== '' && text_(values[i][10]) === id) {
      return i + 1;
    }
  }

  return 0;
}

function hasRecords_(id) {
  return records_().some(function(record) {
    return record.responsibleId === id ||
      record.titularId === id ||
      record.substituteId === id;
  });
}

function reasons_() {
  return sheet_(APP_SHEETS.motivos)
    .getDataRange()
    .getValues()
    .slice(1)
    .filter(function(row) {
      return text_(row[0]) !== '';
    })
    .map(function(row) {
      return {
        reason: text_(row[0]),
        active: active_(row[1])
      };
    });
}

function bootstrap_() {
  return {
    professors: professors_(),
    records: records_(),
    reasons: reasons_(),
    coordinators: coordinators_().map(function(item) {
      return item.email;
    })
  };
}

function getCoordBootstrap() {
  requireCoordinator_();

  return locked_(function() {
    ensureStructure_();
    return bootstrap_();
  });
}

/*
 * Uma única chamada para abrir o sistema: identificação +
 * autorização + todos os dados iniciais, no mesmo round-trip.
 * Antes disso o frontend fazia getCurrentUserInfo() e depois
 * getCoordBootstrap() em sequência — duas idas e voltas ao servidor
 * só para carregar a tela inicial. Cada chamada ao Apps Script tem
 * uma latência própria considerável, então juntar as duas é a
 * melhoria de carregamento com mais impacto.
 */
function boot() {
  const info = getCurrentUserInfo();

  if (!info.authorized) {
    return { info: info, data: null };
  }

  return locked_(function() {
    ensureStructure_();

    return {
      info: info,
      data: bootstrap_()
    };
  });
}

/* ---------------- CADASTRAR / EDITAR ---------------- */

function validateProfessor_(data) {
  data = data || {};

  const professor = {
    id: text_(data.id),
    name: text_(data.name),
    email: email_(data.email),
    type: type_(data.type),
    plannedClasses: Number(data.plannedClasses),
    semester: text_(data.semester),
    turno: turno_(data.turno)
  };

  if (!professor.name) {
    throw new Error('Informe o nome do professor.');
  }

  if (professor.name.length > 200) {
    throw new Error('O nome deve ter até 200 caracteres.');
  }

  if (
    professor.email &&
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(professor.email)
  ) {
    throw new Error('Informe um e-mail válido ou deixe em branco.');
  }

  if (!professor.type) {
    throw new Error('Selecione Titular ou Substituto.');
  }

  if (!professor.semester) {
    throw new Error('Informe o semestre.');
  }

  if (!professor.turno) {
    throw new Error('Selecione um turno válido.');
  }

  if (professor.type === 'Substituto') {
    professor.plannedClasses = 0;
  }

  if (
    !Number.isInteger(professor.plannedClasses) ||
    professor.plannedClasses < 0
  ) {
    throw new Error(
      'Aulas previstas deve ser um número inteiro igual ou maior que zero.'
    );
  }

  return professor;
}

function saveProfessor(data) {
  requireCoordinator_();

  return locked_(function() {
    ensureStructure_();

    const professor = validateProfessor_(data);
    const all = professors_();

    const existing = professor.id
      ? all.find(function(item) {
          return item.id === professor.id;
        })
      : null;

    if (professor.id && !existing) {
      throw new Error('Professor não encontrado. Atualize a página.');
    }

    const linked = existing && hasRecords_(existing.id);

    if (
      linked &&
      (
        existing.semester !== professor.semester ||
        existing.turno !== professor.turno ||
        existing.type !== professor.type
      )
    ) {
      throw new Error(
        'Este professor possui registros. Semestre, turno e tipo ' +
        'não podem ser alterados para preservar o histórico.'
      );
    }

    const duplicate = all.some(function(item) {
      return item.id !== professor.id &&
        item.name.toLowerCase() === professor.name.toLowerCase() &&
        item.semester === professor.semester &&
        item.turno === professor.turno &&
        item.type === professor.type;
    });

    if (duplicate) {
      throw new Error(
        'Já existe um cadastro com este nome, tipo, semestre e turno. ' +
        'Confira também os professores desligados.'
      );
    }

    const defaults = APP_TIMES[professor.turno];

    // Mantém o horário cadastrado de quem possui histórico.
    const start = linked
      ? existing.defaultStart
      : defaults.start;

    const end = linked
      ? existing.defaultEnd
      : defaults.end;

    const id = existing
      ? existing.id
      : 'P-' + Utilities.getUuid();

    const values = [
      cellText_(professor.name),
      id,
      professor.type,
      professor.plannedClasses,
      cellText_(professor.semester),
      professor.turno,
      start,
      end,
      cellText_(professor.email),
      existing && !existing.active ? 'Não' : 'Sim',
      cellText_(existing ? existing.departureReason : '')
    ];

    const sheet = sheet_(APP_SHEETS.professores);
    const row = existing ? existing.row : sheet.getLastRow() + 1;

    sheet.getRange(row, 1, 1, 11).setValues([values]);

    return bootstrap_();
  });
}

/* ---------------- EXCLUIR / DESLIGAR ---------------- */

function removeProfessor(id, reason) {
  requireCoordinator_();

  return locked_(function() {
    ensureStructure_();

    id = text_(id);
    reason = text_(reason);

    const professor = professors_().find(function(item) {
      return item.id === id;
    });

    if (!professor) {
      throw new Error('Professor não encontrado. Atualize a página.');
    }

    const linked = hasRecords_(id);
    const sheet = sheet_(APP_SHEETS.professores);
    let message;

    if (linked) {
      if (!reason) {
        throw new Error(
          'Este professor possui registros. Informe o motivo do desligamento.'
        );
      }

      if (reason.length > 200) {
        throw new Error('O motivo deve ter até 200 caracteres.');
      }

      sheet.getRange(professor.row, 10, 1, 2)
        .setValues([['Não', cellText_(reason)]]);

      message =
        'Professor desligado. Todos os registros foram preservados.';
    } else {
      sheet.deleteRow(professor.row);

      message =
        'Cadastro sem registros excluído definitivamente.';
    }

    return {
      data: bootstrap_(),
      message: message
    };
  });
}

function reactivateProfessor(id) {
  requireCoordinator_();

  return locked_(function() {
    ensureStructure_();

    const professor = professors_().find(function(item) {
      return item.id === text_(id);
    });

    if (!professor) {
      throw new Error('Professor não encontrado.');
    }

    // Preserva o último motivo na planilha para consulta administrativa.
    sheet_(APP_SHEETS.professores)
      .getRange(professor.row, 10)
      .setValue('Sim');

    return bootstrap_();
  });
}

/* ---------------- MOTIVOS ---------------- */

function addAbsenceReason(reason) {
  requireCoordinator_();

  return locked_(function() {
    ensureStructure_();
    reason = text_(reason);

    if (!reason || reason.length > 150) {
      throw new Error('Informe um motivo com até 150 caracteres.');
    }

    if (reason.toLowerCase() === 'outro') {
      throw new Error(
        'A opção Outro já existe no formulário de lançamento.'
      );
    }

    if (reasons_().some(function(item) {
      return item.reason.toLowerCase() === reason.toLowerCase();
    })) {
      throw new Error('Este motivo já está cadastrado.');
    }

    sheet_(APP_SHEETS.motivos)
      .appendRow([cellText_(reason), 'Sim']);

    return reasons_();
  });
}

function setAbsenceReasonActive(reason, active) {
  requireCoordinator_();

  return locked_(function() {
    ensureStructure_();

    const sheet = sheet_(APP_SHEETS.motivos);
    const rows = sheet.getDataRange().getValues();

    for (let i = 1; i < rows.length; i++) {
      if (text_(rows[i][0]) === text_(reason)) {
        sheet.getRange(i + 1, 2)
          .setValue(boolean_(active) ? 'Sim' : 'Não');

        return reasons_();
      }
    }

    throw new Error('Motivo não encontrado.');
  });
}

/* ---------------- LANÇAMENTOS ---------------- */

function addRecord(
  titularId,
  date,
  absent,
  substituteId,
  reason,
  realStart,
  realEnd,
  meeting,
  overwriteToken
) {
  requireCoordinator_();

  return locked_(function() {
    ensureStructure_();

    titularId = text_(titularId);
    substituteId = text_(substituteId);
    date = date_(date);
    absent = boolean_(absent);
    // Reunião dos tutores é só uma marca no relatório: não altera
    // horários nem contagem, e não combina com falta.
    meeting = boolean_(meeting) && !absent;
    reason = text_(reason);
    realStart = time_(realStart);
    realEnd = time_(realEnd);

    if (!validDate_(date)) {
      throw new Error('Informe uma data válida.');
    }

    if (!realStart || !realEnd || hours_(realStart, realEnd) <= 0) {
      throw new Error(
        'Informe horários reais válidos. O fim deve ser depois do início.'
      );
    }

    const all = professors_();

    const titular = all.find(function(item) {
      return item.id === titularId &&
        item.type === 'Titular';
    });

    if (!titular || !titular.active) {
      throw new Error(
        'Selecione um professor titular ativo. Atualize a página.'
      );
    }

    let substitute = null;

    if (absent) {
      substitute = all.find(function(item) {
        return item.id === substituteId &&
          item.type === 'Substituto';
      });

      if (!substitute || !substitute.active) {
        throw new Error('Selecione um professor substituto ativo.');
      }

      if (
        substitute.semester !== titular.semester ||
        substitute.turno !== titular.turno
      ) {
        throw new Error(
          'O substituto deve pertencer ao mesmo semestre e turno do titular.'
        );
      }

      if (!reason || reason.length > 150) {
        throw new Error(
          'Informe o motivo da ausência, com até 150 caracteres.'
        );
      }
    } else {
      substituteId = '';
      reason = '';
    }

    const plannedStart = titular.defaultStart;
    const plannedEnd = titular.defaultEnd;
    const plannedHours = hours_(plannedStart, plannedEnd);

    if (!plannedHours) {
      throw new Error(
        'O titular está com horário previsto inválido no cadastro.'
      );
    }

    const responsibleId = absent ? substitute.id : titular.id;
    const hours = hours_(realStart, realEnd);

    // A conferência e a gravação usam o mesmo lock.
    const sh = sheet_(APP_SHEETS.registros);
    const matches = sh.getDataRange().getValues().slice(1)
      .map(function(value, index) { return { value: value, row: index + 2 }; })
      .filter(function(item) {
        const value = item.value;
        const owner = text_(value[7]) || (!boolean_(value[6]) ? text_(value[1]) : '');
        return date_(value[0]) === date && owner === titular.id;
      });
    if (matches.length > 1) {
      throw new Error('Há mais de um lançamento deste titular nesta data. Revise as duplicidades na aba Registros antes de continuar. Nenhum dado foi alterado.');
    }

    // Mantém o mesmo RegistroId quando o lançamento é substituído;
    // gera um novo apenas para lançamentos inéditos.
    const recordId = matches.length
      ? (text_(matches[0].value[10]) || 'R-' + Utilities.getUuid())
      : 'R-' + Utilities.getUuid();

    const row = [
      date,
      responsibleId,
      plannedStart,
      plannedEnd,
      realStart,
      realEnd,
      absent ? 'Sim' : 'Não',
      titular.id,
      absent ? substitute.id : '',
      cellText_(reason),
      recordId,
      meeting ? 'Sim' : 'Não'
    ];

    if (matches.length) {
      const token = JSON.stringify(matches[0].value);
      if (overwriteToken !== token) {
        return { needsOverwrite: true, token: token,
          realStart: time_(matches[0].value[4]), realEnd: time_(matches[0].value[5]) };
      }
      sh.getRange(matches[0].row, 1, 1, row.length).setValues([row]);
    } else {
      if (overwriteToken) {
        throw new Error('O lançamento mudou desde a confirmação. Atualize a página e tente novamente.');
      }
      sh.appendRow(row);
    }

    return {
      id: recordId,
      meeting: meeting,
      date: date,
      responsibleId: responsibleId,
      plannedStart: plannedStart,
      plannedEnd: plannedEnd,
      realStart: realStart,
      realEnd: realEnd,
      absent: absent,
      titularId: titular.id,
      substituteId: absent ? substitute.id : '',
      reason: reason,
      plannedHours: plannedHours,
      hours: hours,
      saldo: hours - plannedHours
    };
  });
}

/* ---------------- EDITAR LANÇAMENTO ---------------- */

/*
 * Corrige um lançamento já existente (de qualquer data), sem passar
 * pelo fluxo normal de "Lançar horas" (addRecord), que continua
 * funcionando exatamente como hoje para lançamentos novos ou para
 * sobrescrever o lançamento do dia atual.
 *
 * O titular do lançamento não é alterável por aqui — isso evita
 * confundir "corrigir um erro de horário" com "mudar de quem é a
 * aula", que deve ser feito excluindo e lançando de novo.
 */
function editRecord(
  id,
  date,
  absent,
  substituteId,
  reason,
  realStart,
  realEnd,
  meeting
) {
  requireCoordinator_();

  return locked_(function() {
    ensureStructure_();

    id = text_(id);

    if (!id) {
      throw new Error('Informe o lançamento a ser editado.');
    }

    const sh = sheet_(APP_SHEETS.registros);
    const row = recordRow_(id);

    if (!row) {
      throw new Error(
        'Lançamento não encontrado. Atualize a página e tente novamente.'
      );
    }

    const current = sh.getRange(row, 1, 1, 11).getValues()[0];
    const currentAbsent = boolean_(current[6]);
    const titularId = text_(current[7]) ||
      (!currentAbsent ? text_(current[1]) : '');

    date = date_(date);
    absent = boolean_(absent);
    meeting = boolean_(meeting) && !absent;
    substituteId = text_(substituteId);
    reason = text_(reason);
    realStart = time_(realStart);
    realEnd = time_(realEnd);

    if (!validDate_(date)) {
      throw new Error('Informe uma data válida.');
    }

    if (!realStart || !realEnd || hours_(realStart, realEnd) <= 0) {
      throw new Error(
        'Informe horários reais válidos. O fim deve ser depois do início.'
      );
    }

    const all = professors_();

    const titular = all.find(function(item) {
      return item.id === titularId && item.type === 'Titular';
    });

    if (!titular) {
      throw new Error(
        'O titular deste lançamento não foi encontrado no cadastro. ' +
        'Exclua o lançamento e lance novamente.'
      );
    }

    let substitute = null;

    if (absent) {
      substitute = all.find(function(item) {
        return item.id === substituteId && item.type === 'Substituto';
      });

      if (!substitute) {
        throw new Error('Selecione um professor substituto válido.');
      }

      if (
        substitute.semester !== titular.semester ||
        substitute.turno !== titular.turno
      ) {
        throw new Error(
          'O substituto deve pertencer ao mesmo semestre e turno do titular.'
        );
      }

      if (!reason || reason.length > 150) {
        throw new Error(
          'Informe o motivo da ausência, com até 150 caracteres.'
        );
      }
    } else {
      substituteId = '';
      reason = '';
    }

    const plannedStart = titular.defaultStart;
    const plannedEnd = titular.defaultEnd;
    const plannedHours = hours_(plannedStart, plannedEnd);

    if (!plannedHours) {
      throw new Error(
        'O titular está com horário previsto inválido no cadastro.'
      );
    }

    // A edição não pode criar uma duplicidade com outro lançamento já
    // existente deste titular na mesma data (compara contra as demais
    // linhas, nunca contra a própria linha que está sendo editada).
    const duplicate = sh.getDataRange().getValues().slice(1)
      .some(function(value, index) {
        const otherRow = index + 2;
        if (otherRow === row) return false;

        const owner = text_(value[7]) ||
          (!boolean_(value[6]) ? text_(value[1]) : '');

        return date_(value[0]) === date && owner === titular.id;
      });

    if (duplicate) {
      throw new Error(
        'Já existe outro lançamento deste titular nesta data. ' +
        'Exclua um dos dois antes de continuar.'
      );
    }

    const responsibleId = absent ? substitute.id : titular.id;
    const hours = hours_(realStart, realEnd);

    const values = [
      date,
      responsibleId,
      plannedStart,
      plannedEnd,
      realStart,
      realEnd,
      absent ? 'Sim' : 'Não',
      titular.id,
      absent ? substitute.id : '',
      cellText_(reason),
      id,
      meeting ? 'Sim' : 'Não'
    ];

    sh.getRange(row, 1, 1, values.length).setValues([values]);

    return {
      data: bootstrap_(),
      message: 'Lançamento atualizado.'
    };
  });
}

/* ---------------- EXCLUIR LANÇAMENTO ---------------- */

function deleteRecord(id) {
  requireCoordinator_();

  return locked_(function() {
    ensureStructure_();

    id = text_(id);

    if (!id) {
      throw new Error('Informe o lançamento a ser excluído.');
    }

    const sheet = sheet_(APP_SHEETS.registros);
    const row = recordRow_(id);

    if (!row) {
      throw new Error(
        'Lançamento não encontrado. Atualize a página e tente novamente.'
      );
    }

    sheet.deleteRow(row);

    return {
      data: bootstrap_(),
      message: 'Lançamento excluído definitivamente.'
    };
  });
}

/* ---------------- BACKUP ---------------- */

/*
 * Cria uma cópia estática (só valores, sem fórmulas nem vínculo) de
 * todas as abas de dados numa nova aba oculta "Backup_AAAA-MM-DD_HHmm".
 * Não altera nenhuma aba original. Serve como um "antes de continuar"
 * rápido antes de uma operação arriscada (editar estrutura, limpar
 * dados em massa etc.).
 */
function exportBackup() {
  requireCoordinator_();

  return locked_(function() {
    ensureStructure_();

    const book = book_();

    const sheetNames = [
      APP_SHEETS.professores,
      APP_SHEETS.registros,
      APP_SHEETS.coordenadores,
      APP_SHEETS.motivos
    ];

    const blocks = sheetNames.map(function(name) {
      return {
        name: name,
        values: sheet_(name).getDataRange().getValues()
      };
    });

    const maxCols = Math.max.apply(null, [1].concat(
      blocks.reduce(function(cols, block) {
        return cols.concat(block.values.map(function(row) {
          return row.length;
        }));
      }, [])
    ));

    function pad(row) {
      row = row.slice();
      while (row.length < maxCols) row.push('');
      return row;
    }

    const rows = [];

    blocks.forEach(function(block, index) {
      if (index > 0) rows.push(pad(['']));
      rows.push(pad(['== ' + block.name + ' ==']));

      block.values.forEach(function(row) {
        rows.push(pad(row));
      });
    });

    const timestamp = Utilities.formatDate(
      new Date(), timezone_(), 'yyyy-MM-dd_HHmm'
    );

    let name = 'Backup_' + timestamp;
    let suffix = 2;

    while (book.getSheetByName(name)) {
      name = 'Backup_' + timestamp + '_' + suffix;
      suffix++;
    }

    const backupSheet = book.insertSheet(name);
    backupSheet.getRange(1, 1, rows.length, maxCols).setValues(rows);
    backupSheet.hideSheet();

    return {
      sheetName: name,
      message: 'Backup criado na aba "' + name +
        '" (oculta). Nenhum dado original foi alterado.'
    };
  });
}

/* ---------------- COORDENADORES ---------------- */

function coordinators_() {
  return sheet_(APP_SHEETS.coordenadores)
    .getDataRange()
    .getValues()
    .slice(1)
    .map(function(row, index) {
      return { row: index + 2, email: email_(row[0]) };
    })
    .filter(function(item) {
      return item.email !== '';
    });
}

function listCoordinators() {
  requireCoordinator_();
  return coordinators_().map(function(item) { return item.email; });
}

function addCoordinator(email) {
  requireCoordinator_();

  return locked_(function() {
    email = email_(email);

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new Error('Informe um e-mail válido.');
    }

    const all = coordinators_();

    if (all.some(function(item) { return item.email === email; })) {
      throw new Error('Este e-mail já é coordenador.');
    }

    sheet_(APP_SHEETS.coordenadores).appendRow([cellText_(email)]);

    return coordinators_().map(function(item) { return item.email; });
  });
}

function removeCoordinator(email) {
  requireCoordinator_();

  return locked_(function() {
    email = email_(email);

    const all = coordinators_();

    const target = all.find(function(item) {
      return item.email === email;
    });

    if (!target) {
      throw new Error('Coordenador não encontrado.');
    }

    if (all.length <= 1) {
      throw new Error(
        'Não é possível remover o único coordenador cadastrado. ' +
        'Cadastre outro e-mail antes de remover este.'
      );
    }

    sheet_(APP_SHEETS.coordenadores).deleteRow(target.row);

    return coordinators_().map(function(item) { return item.email; });
  });
}

// FIM DO CÓDIGO.GS