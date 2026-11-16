const fs=require('fs'),vm=require('vm'),assert=require('assert'),crypto=require('crypto'),path=require('path');
const root=__dirname,original=fs.readFileSync(path.join(root,'original-current.html'),'utf8'),generated=fs.readFileSync(path.join(root,'dist/index.html'),'utf8');
const source=original.replace(/const svg = <\?!=[\s\S]*?\?>;/,'const svg = \'<strong>Unichristus</strong>\';').match(/<script>([\s\S]*?)<\/script>/)[1].replace(/    init\(\);\s*$/,'');
const preview=generated.match(/<script>([\s\S]*?)<\/script>/)[1].replace(/    init\(\);\s*$/,'');
const make=script=>{const sandbox=vm.createContext({console,crypto,document:{getElementById:()=>null},window:{},localStorage:{}});vm.runInContext(script,sandbox);return sandbox};
const a=make(source),b=make(preview),run=(c,s)=>vm.runInContext(s,c);let passed=0;function check(fn){fn();passed++}
const functions=[...source.matchAll(/^    (?:async )?function (\w+)\(/gm)].map(m=>m[1]);
const overrides=new Set(['rpc','shell','render','setTheme','initialTheme']);
for(const name of functions)if(!overrides.has(name))check(()=>assert.equal(run(a,name+'.toString()'),run(b,name+'.toString()'),name+' alterada'));
check(()=>assert(generated.includes(original.match(/<style>[\s\S]*?<\/style>/)[0]),'CSS original alterado'));
check(()=>assert(fs.readFileSync(path.join(root,'preserved-screen.css'),'utf8').trimStart().startsWith('/* Todas')));
const base=run(b,'demoClone(demoDB)');
function apply(c,data){c.fixture=JSON.parse(JSON.stringify(data));run(c,'applyData(fixture);state.info={email:"coordenacao@example.com",authorized:true};state.reportDate="2026-11-16";state.semester="2026.2";state.turno="Manhã";state.fichaId="demo-p0";')}
apply(a,base);apply(b,base);
for(const expression of ['JSON.stringify(titularStats())','JSON.stringify(ranking())','JSON.stringify(substituteStats())','reportPrintHtml()','fichaHtml()','fichaBatchHtml(ranking())'])check(()=>assert.equal(run(a,expression),run(b,expression),expression));
for(const count of [17,18,25,26]){
 const data=JSON.parse(JSON.stringify(base));data.professors=data.professors.filter(p=>p.type!=='Titular'||p.semester!=='2026.2'||p.turno!=='Manhã');for(let i=0;i<count;i++)data.professors.push({...base.professors[0],id:'batch'+i,name:'Professor exemplo '+i});data.records=[];
 apply(a,data);apply(b,data);
 for(const c of [a,b])run(c,'state.fichaId="batch0";state.fichaPrintMode="todos";');
 const expression='printFicha(professor("batch0"),ranking().find(r=>r.id==="batch0"),ranking())';
 check(()=>assert.equal(run(a,expression),run(b,expression),'Impressão divergente: '+count));
 check(()=>assert.equal(run(b,expression).includes('ficha-compact'),count>17&&count<=25));
 check(()=>assert(!run(b,expression).includes('Professor exemplo 1</'),'Impressão revelou colega'));
}
apply(a,base);apply(b,base);
for(const [mode,date,start,end]of [['semana','2026-11-16','2026-11-16','2026-11-22'],['mes','2026-02-10','2026-02-01','2026-02-28'],['semestre','2026-11-16','2026-07-01','2026-12-31']]){run(b,`state.reportMode=${JSON.stringify(mode)};state.reportDate=${JSON.stringify(date)}`);check(()=>assert.deepEqual(JSON.parse(run(b,'JSON.stringify(reportRange())')),{start,end}));}
check(()=>assert(!run(b,'launchProfessors("Titular").some(p=>p.id==="demo-old")')));
check(()=>assert(run(b,'contextRecords().some(r=>r.titularId==="demo-old")')));
check(()=>assert.deepEqual(JSON.parse(run(b,'JSON.stringify(launchProfessors("Titular").map(p=>p.name))')),['Dra. Ana Monteiro','Bruno Azevedo','Dr. Carlos Duarte','Daniela Nogueira','Elisa Costa','Fábio Ribeiro']));
(async()=>{
 const rpc=(name,args)=>{b.args=args;b.operation=name;return run(b,'rpc(operation,args)')};
 const added=await rpc('addRecord',['demo-p0','2026-11-16','Não','','','08:00','10:30','Não']);check(()=>assert.equal(added.hours,2.5));check(()=>assert.equal(added.responsibleId,'demo-p0'));
 const duplicate=await rpc('addRecord',['demo-p0','2026-11-16','Não','','','08:00','11:00','Não']);check(()=>assert(duplicate.needsOverwrite));
 const overwritten=await rpc('addRecord',['demo-p0','2026-11-16','Não','','','08:00','11:00','Não',duplicate.token]);check(()=>assert.equal(overwritten.hours,3));
 const absent=await rpc('addRecord',['demo-p1','2026-11-16','Sim','demo-p6','Atividade institucional','08:00','10:00','Não']);check(()=>assert.equal(absent.responsibleId,'demo-p6'));
 await assert.rejects(rpc('addRecord',['demo-p1','2026-11-18','Sim','','','08:00','10:00','Não']));passed++;
 const updated=await rpc('editRecord',[absent.id,'2026-11-16','Não','','','09:00','11:00','Sim']);check(()=>assert.equal(updated.data.records.find(r=>r.id===absent.id).meeting,true));
 const removed=await rpc('removeProfessor',['demo-p0','Fim do vínculo — teste']);check(()=>assert.equal(removed.data.professors.find(p=>p.id==='demo-p0').active,false));check(()=>assert(removed.data.records.some(r=>r.titularId==='demo-p0')));
 await rpc('reactivateProfessor',['demo-p0']);check(()=>assert(run(b,'demoDB.professors.find(p=>p.id==="demo-p0").active')));
 await rpc('addAbsenceReason',['Teste fictício']);await rpc('setAbsenceReasonActive',['Teste fictício',false]);check(()=>assert.equal(run(b,'demoDB.reasons.find(r=>r.reason==="Teste fictício").active'),false));
 await rpc('addCoordinator',['novo@example.com']);await rpc('removeCoordinator',['novo@example.com']);check(()=>assert(!run(b,'demoDB.coordinators.includes("novo@example.com")')));
 await rpc('deleteRecord',[added.id]);check(()=>assert(!run(b,'demoDB.records.some(r=>r.id===args[0])')));
 await rpc('exportBackup',[]);check(()=>assert.equal(run(b,'demoBackups.length'),1));
 await assert.rejects(rpc('unknownOperation',[]));passed++;
 const report={passed,originalFunctions:functions.length,unchangedFunctionsCompared:functions.length-overrides.size,printedOutputsEqual:true,printBatchSizes:[17,18,25,26],integration:'simulador somente; backend real não executado'};fs.writeFileSync(path.join(root,'test-results.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
})().catch(e=>{console.error(e);process.exitCode=1});
