// Atualização exclusivamente visual. RPC, funções e cálculos originais preservados.
const chOriginalShell=shell,chOriginalRender=render;
const chIcons={painel:'▦',lancar:'◷',relatorios:'▥',ficha:'▤',titulares:'♙',substitutos:'♧',motivos:'ⓘ',coordenadores:'⚙'};
shell=function visualShell(content){
  let html=chOriginalShell(content);
  html=html.replace('<nav class="nav no-print">','<nav class="nav no-print" aria-label="Menu principal"><div class="ch-brand"><span class="ch-crest">U</span><div><b>Unichristus</b><small>CARGA HORÁRIA DOCENTE</small></div></div><div class="ch-navlabel">ACOMPANHAMENTO</div>');
  html=html.replace('<div class="system-name">','<button type="button" class="theme-button ch-mobile" id="ch-mobile" aria-label="Abrir menu">☰</button><div class="system-name">');
  html=html.replace('<span class="user-email">','<button type="button" class="theme-button ch-collapse" id="ch-collapse" aria-label="Recolher ou expandir menu">☰</button><span class="user-email">');
  html=html.replace('<div class="fields no-print">','<div class="ch-banner no-print" role="note"><b>ATUALIZAÇÃO VISUAL</b><span>As funções, os cálculos e os layouts de impressão continuam os mesmos.</span></div><div class="fields no-print">');
  if(state.view==='painel')html=html.replace('<h1 class="page-title">','<div class="ch-hero no-print"><small>GESTÃO ACADÊMICA · UNICHRISTUS</small><h2>Cada hora faz parte da formação.</h2><p>Mesmos fluxos de trabalho, uma nova apresentação.</p></div><h1 class="page-title">');
  return html;
};
function bindVisualUpdate(){
  const nav=document.querySelector('.nav'),details=nav?.querySelector('details');
  if(details){details.open=true;details.querySelector('summary').onclick=e=>e.preventDefault()}
  nav?.querySelectorAll('[data-view]').forEach(button=>{
    button.dataset.icon=chIcons[button.dataset.view]||'•';button.title=button.textContent.trim();
    if(button.dataset.view===state.view)button.classList.add('active');
    const nativeClick=button.onclick;button.onclick=()=>{document.body.classList.remove('ch-menu-open');nativeClick()};
  });
  if($('ch-collapse'))$('ch-collapse').onclick=()=>document.body.classList.toggle('ch-compact');
  if($('ch-mobile'))$('ch-mobile').onclick=()=>document.body.classList.toggle('ch-menu-open');
}
render=function visualRender(){chOriginalRender();bindVisualUpdate()};
