// Ponte exclusiva da prévia. Nenhuma chamada ao Apps Script é executada.
// Todas as funções originais de interface e impressão permanecem no arquivo.
const DEMO_ONLY=true;
function demoInitialData(){
  const names=['Dra. Ana Monteiro','Bruno Azevedo','Dr. Carlos Duarte','Daniela Nogueira','Elisa Costa','Fábio Ribeiro','Lívia Albuquerque','Marcos Sampaio'];
  const professors=names.map((name,i)=>({id:'demo-p'+i,name,email:'docente'+i+'@example.com',type:i<6?'Titular':'Substituto',semester:'2026.2',turno:'Manhã',plannedClasses:i<6?20:0,defaultStart:'08:00',defaultEnd:'11:00',active:true,departureReason:''}));
  professors.push({id:'demo-old',name:'Alice Freitas',email:'historico@example.com',type:'Titular',semester:'2026.2',turno:'Manhã',plannedClasses:12,defaultStart:'08:00',defaultEnd:'11:00',active:false,departureReason:'Encerramento do vínculo — exemplo'});
  professors.push({...professors[0],id:'demo-tarde',name:'Clara Dias',semester:'2026.2',turno:'Tarde',defaultStart:'14:00',defaultEnd:'17:00'});
  professors.push({...professors[0],id:'demo-semestre',name:'João Fernandes',semester:'2026.1'});
  const records=[];let id=0;
  for(let i=0;i<6;i++)for(let j=0;j<5;j++){const p=professors[i],absent=(i===0&&j===4)||(i===2&&j===3),substituteId=absent?'demo-p6':'',realStart=i===0?'08:10':i===3?'07:50':'08:00',realEnd=i===1?'10:40':'11:00';records.push({id:'demo-r'+(++id),titularId:p.id,date:['2026-10-12','2026-10-19','2026-10-26','2026-11-02','2026-11-09'][j],absent,meeting:j===2,substituteId,responsibleId:absent?substituteId:p.id,reason:absent?'Atividade institucional':'',plannedStart:p.defaultStart,plannedEnd:p.defaultEnd,plannedHours:hours(p.defaultStart,p.defaultEnd),realStart,realEnd,hours:hours(realStart,realEnd)});}
  records.push({id:'demo-historico',titularId:'demo-old',date:'2026-10-05',absent:false,meeting:false,substituteId:'',responsibleId:'demo-old',reason:'',plannedStart:'08:00',plannedEnd:'11:00',plannedHours:3,realStart:'08:00',realEnd:'10:30',hours:2.5});
  return {professors,records,reasons:[{reason:'Atividade institucional',active:true},{reason:'Compromisso acadêmico',active:true},{reason:'Motivo pessoal',active:true},{reason:'Motivo anterior',active:false}],coordinators:['coordenacao@example.com','apoio@example.com']};
}
let demoDB=demoInitialData(),demoBackups=[];
const demoClone=x=>JSON.parse(JSON.stringify(x));
function demoRecord(args,id){
  const [titularId,date,absence,substituteId,reason,realStart,realEnd,meeting]=args,p=demoDB.professors.find(p=>p.id===titularId),absent=absence==='Sim';
  if(!p||!isActive(p)||p.type!=='Titular')throw Error('Selecione um professor titular ativo.');
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date||''))throw Error('Informe uma data válida.');
  if(!realStart||!realEnd||hours(realStart,realEnd)<=0)throw Error('O fim real precisa ser depois do início.');
  if(absent){const sub=demoDB.professors.find(p=>p.id===substituteId);if(!sub||!isActive(sub)||sub.type!=='Substituto'||sub.semester!==p.semester||sub.turno!==p.turno)throw Error('Selecione um substituto ativo do mesmo contexto.');if(!String(reason||'').trim())throw Error('Informe o motivo da ausência.');}
  return {id:id||'demo-r'+crypto.randomUUID(),titularId,date,absent,meeting:!absent&&meeting==='Sim',substituteId:absent?substituteId:'',responsibleId:absent?substituteId:titularId,reason:absent?reason:'',plannedStart:p.defaultStart,plannedEnd:p.defaultEnd,plannedHours:hours(p.defaultStart,p.defaultEnd),realStart,realEnd,hours:hours(realStart,realEnd)};
}
rpc=async function demoRPC(name,args=[]){
  // Bloqueia por construção qualquer fallback para google.script.run.
  const reply=x=>demoClone(x),get=id=>demoDB.professors.find(p=>p.id===id),fail=s=>{throw Error(s)};
  if(name==='boot')return reply({info:{authorized:true,email:'coordenacao@example.com'},data:demoDB});
  if(name==='addRecord'){
    const previous=demoDB.records.find(r=>r.titularId===args[0]&&r.date===args[1]);
    const updated=demoRecord(args,previous?.id);
    if(previous&&args[8]!=='simulacao-'+previous.id)return {needsOverwrite:true,realStart:previous.realStart,realEnd:previous.realEnd,token:'simulacao-'+previous.id};
    demoDB.records=demoDB.records.filter(r=>r.id!==previous?.id);demoDB.records.push(updated);return reply(updated);
  }
  if(name==='editRecord'){
    const old=demoDB.records.find(r=>r.id===args[0]);if(!old)fail('Lançamento não encontrado.');
    const p=get(old.titularId),active=p.active;p.active=true;
    let updated;try{updated=demoRecord([old.titularId,...args.slice(1)],old.id)}finally{p.active=active}
    if(demoDB.records.some(r=>r.id!==old.id&&r.titularId===old.titularId&&r.date===updated.date))fail('Já existe um lançamento para este professor nessa data.');
    demoDB.records=demoDB.records.map(r=>r.id===old.id?updated:r);return reply({data:demoDB,message:'Lançamento fictício editado.'});
  }
  if(name==='deleteRecord'){demoDB.records=demoDB.records.filter(r=>r.id!==args[0]);return reply({data:demoDB,message:'Lançamento fictício excluído.'});}
  if(name==='saveProfessor'){
    const d={...args[0]},old=get(d.id),hasHistory=old&&demoDB.records.some(r=>[r.titularId,r.substituteId,r.responsibleId].includes(old.id));
    if(!d.name?.trim()||!d.semester||!TIMES[d.turno])fail('Confira nome, semestre e turno.');
    if(!Number.isInteger(d.plannedClasses)||d.plannedClasses<0)fail('Aulas previstas deve ser um inteiro não negativo.');
    if(hasHistory&&(d.type!==old.type||d.semester!==old.semester||d.turno!==old.turno))fail('Tipo, semestre e turno devem preservar o histórico.');
    if(demoDB.professors.some(p=>p.id!==d.id&&p.name.toLocaleLowerCase()===d.name.toLocaleLowerCase()&&p.semester===d.semester&&p.turno===d.turno&&p.type===d.type))fail('Este professor já está cadastrado neste contexto.');
    const time=TIMES[d.turno];const p={...old,...d,id:old?.id||'demo-p'+crypto.randomUUID(),active:old?.active??true,defaultStart:hasHistory?old.defaultStart:time.start,defaultEnd:hasHistory?old.defaultEnd:time.end,plannedClasses:d.type==='Substituto'?0:d.plannedClasses};
    demoDB.professors=demoDB.professors.filter(x=>x.id!==p.id);demoDB.professors.push(p);return reply(demoDB);
  }
  if(name==='removeProfessor'){
    const p=get(args[0]);if(!p)fail('Professor não encontrado.');const history=demoDB.records.some(r=>[r.titularId,r.substituteId,r.responsibleId].includes(p.id));
    if(history){if(!args[1]?.trim())fail('Informe o motivo do desligamento.');p.active=false;p.departureReason=args[1].trim()}else demoDB.professors=demoDB.professors.filter(x=>x.id!==p.id);
    return reply({data:demoDB,message:history?'Professor desligado apenas na demonstração.':'Cadastro fictício excluído.'});
  }
  if(name==='reactivateProfessor'){const p=get(args[0]);if(!p)fail('Professor não encontrado.');p.active=true;p.departureReason='';return reply(demoDB);}
  if(name==='addAbsenceReason'){const reason=args[0]?.trim();if(!reason)fail('Informe o motivo.');if(demoDB.reasons.some(r=>r.reason.toLowerCase()===reason.toLowerCase()))fail('Motivo já cadastrado.');demoDB.reasons.push({reason,active:true});return reply(demoDB.reasons);}
  if(name==='setAbsenceReasonActive'){const r=demoDB.reasons.find(r=>r.reason===args[0]);if(!r)fail('Motivo não encontrado.');r.active=!!args[1];return reply(demoDB.reasons);}
  if(name==='addCoordinator'){const email=args[0]?.trim().toLowerCase();if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email||''))fail('Informe um e-mail válido.');if(demoDB.coordinators.includes(email))fail('Coordenador já cadastrado.');demoDB.coordinators.push(email);return reply(demoDB.coordinators);}
  if(name==='removeCoordinator'){if(demoDB.coordinators.length<=1)fail('Mantenha pelo menos um coordenador.');demoDB.coordinators=demoDB.coordinators.filter(x=>x!==args[0]);return reply(demoDB.coordinators);}
  if(name==='exportBackup'){demoBackups.push(reply(demoDB));return {message:'Backup simulado criado em memória. Nenhuma aba da planilha real foi criada.'};}
  throw Error('Operação não simulada: '+name+'. Nenhum serviço real foi chamado.');
};
const demoOriginalShell=shell,demoOriginalRender=render;
const demoIcons={painel:'▦',lancar:'◷',relatorios:'▥',ficha:'▤',titulares:'♙',substitutos:'♧',motivos:'ⓘ',coordenadores:'⚙'};
shell=function demoVisualShell(content){
  let html=demoOriginalShell(content);
  html=html.replace('<nav class="nav no-print">','<nav class="nav no-print" aria-label="Menu principal"><div class="demo-brand"><span class="demo-crest">U</span><div><b>Unichristus</b><small>CARGA HORÁRIA DOCENTE</small></div></div><div class="demo-navlabel">ACOMPANHAMENTO</div>');
  html=html.replace('<div class="system-name">','<button type="button" class="theme-button demo-mobile" id="demo-mobile" aria-label="Abrir menu">☰</button><div class="system-name">');
  html=html.replace('<span class="user-email">','<button type="button" class="theme-button demo-collapse" id="demo-collapse" aria-label="Recolher ou expandir menu">☰</button><span class="user-email">');
  html=html.replace('<div class="fields no-print">','<div class="demo-banner no-print"><b>PRÉVIA V02 · DADOS FICTÍCIOS</b><span>Fluxos e impressão originais preservados. As ações afetam apenas exemplos nesta página.</span><button type="button" id="demo-reset">Restaurar exemplos</button></div><div class="fields no-print">');
  if(state.view==='painel')html=html.replace('<h1 class="page-title">','<div class="demo-hero no-print"><small>GESTÃO ACADÊMICA · UNICHRISTUS</small><h2>Cada hora faz parte da formação.</h2><p>Mesmos fluxos de trabalho, uma nova apresentação.</p></div><h1 class="page-title">');
  return html;
};
function demoBindVisual(){
  const nav=document.querySelector('.nav'),details=nav?.querySelector('details');if(details){details.open=true;details.querySelector('summary').onclick=e=>e.preventDefault()}
  nav?.querySelectorAll('[data-view]').forEach(b=>{b.dataset.icon=demoIcons[b.dataset.view]||'•';b.title=b.textContent.trim();if(b.dataset.view===state.view)b.classList.add('active');const click=b.onclick;b.onclick=()=>{document.body.classList.remove('demo-menu-open');click()}});
  if($('demo-collapse'))$('demo-collapse').onclick=()=>document.body.classList.toggle('demo-compact');
  if($('demo-mobile'))$('demo-mobile').onclick=()=>document.body.classList.toggle('demo-menu-open');
  if($('demo-reset'))$('demo-reset').onclick=()=>{if(!confirm('Restaurar os dados fictícios desta demonstração?'))return;demoDB=demoInitialData();demoBackups=[];applyData(demoClone(demoDB));state.titularId=null;state.launchDate='';state.fichaId=null;notify('Exemplos restaurados. Nenhum dado real foi alterado.')};
}
render=function demoVisualRender(){demoOriginalRender();demoBindVisual()};
// Chave própria para não mudar a preferência do sistema real neste navegador.
const demoOriginalTheme=setTheme;
setTheme=function demoTheme(theme){document.body.dataset.theme=theme;try{localStorage.setItem('carga-horaria-preview-v02-theme',theme)}catch(e){}if($('theme'))$('theme').textContent=theme==='dark'?'☀':'☾'};
initialTheme=function(){try{return localStorage.getItem('carga-horaria-preview-v02-theme')||'light'}catch(e){return 'light'}};
