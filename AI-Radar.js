// AI Radar v0.9 — Scriptable
const REPO='https://raw.githubusercontent.com/shayanhaider-pdf/llm-arena-widget/main/data/widget.json';
const OLD_FEED='https://raw.githubusercontent.com/shayanhaider-pdf/llm-arena-widget/main/data/latest.json';
const ACCESS='https://raw.githubusercontent.com/shayanhaider-pdf/llm-arena-widget/main/data/access.json';
const C={work:['Work capability','agent_capability:work'],search:['Search','search:overall'],reasoning:['Reasoning','text_style_control:hard_prompts'],writing:['Creative writing','text_style_control:creative_writing'],vision:['Vision','vision_style_control:overall'],documents:['Documents','document_style_control:overall'],text:['Overall text','text_style_control:overall'],webdev:['Web development','webdev:overall'],image:['Image generation','text_to_image:overall'],editing:['Image editing','image_edit:overall'],video:['Video generation','text_to_video:overall'],agent:['Agent capability','agent_capability:overall'],imagevideo:['Image to video','image_to_video:overall'],videoedit:['Video editing','video_edit:overall'],steering:['Steering','agent_steerability:overall'],instruction:['Instruction following','text_style_control:instruction_following'],chatagent:['Agent chat','agent_capability:chat']};
const defaults=['work','text','documents','search','image'];
const oldDefaults=['search','work','text','vision','documents'];
const fm=FileManager.local(),dir=fm.joinPath(fm.documentsDirectory(),'AI-Radar');
if(!fm.fileExists(dir))fm.createDirectory(dir,true);
const path=n=>fm.joinPath(dir,n+'.json');
function read(n,d){try{return JSON.parse(fm.readString(path(n)))}catch{return d}}
function save(n,v){fm.writeString(path(n),JSON.stringify(v))}
const record=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
let settings=read('settings',{});if(!record(settings))settings={};
if(!record(settings.registry))settings.registry={};if(!Array.isArray(settings.large)||settings.large.join(',')===oldDefaults.join(',')&&!settings.largeCustomized)settings.large=defaults.slice();if(!https(settings.feed)||settings.feed===OLD_FEED)settings.feed=REPO;
let cache=read('monthly-cache',{});if(!record(cache))cache={};
let access=read('access',{});if(!record(access))access={};
let sync=read('monthly-sync',{});if(!record(sync))sync={};
const id=s=>String(s||'').trim().toLowerCase();
const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
const category=k=>typeof k==='string'&&own(C,k);
const safeKey=k=>!['__proto__','constructor','prototype'].includes(k);
const today=()=>new Date().toISOString().slice(0,10);
const dayAgo=(d,n)=>new Date(Date.parse(d+'T00:00:00Z')-n*86400000).toISOString().slice(0,10);
function keys(s){return [...new Set(String(s||'').split(',').map(x=>{let t=id(x);return category(t)?t:Object.keys(C).find(k=>C[k][1]===t)}).filter(Boolean))]}
function https(s){return typeof s==='string'&&/^https:\/\/[a-z0-9.-]+(?::\d+)?(?:[/?#][^\s\\]*)?$/i.test(s)}
function validDate(d){if(typeof d!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(d))return false;const t=Date.parse(d+'T00:00:00Z');return Number.isFinite(t)&&new Date(t).toISOString().slice(0,10)===d}
function freshDate(d){return validDate(d)&&d<=today()&&d>=dayAgo(today(),62)}
// Route by original Arena model ID, never by the user's display label.
const providerLinks=[
  [/^(?:gpt(?:[-\s\d]|$)|chatgpt|openai[\s/:_-]|o[134](?:[-\s.]|$)|dall[- ]?e|sora)/i,'https://chatgpt.com/'],
  [/^(?:claude|anthropic[\s/:_-])/i,'https://claude.ai/new'],
  [/^(?:gemini|google[\s/:_-]|gemma|imagen|veo|nano[- ]?banana)/i,'https://gemini.google.com/'],
  [/^(?:qwen|qwq|qvq|alibaba[\s/:_-])/, 'https://chat.qwen.ai/'],
  [/^(?:deepseek)/i,'https://chat.deepseek.com/'],
  [/^(?:grok|xai[\s/:_-]|x\.ai)/i,'https://grok.com/'],
  [/^(?:mistral|mixtral|magistral|ministral|devstral|pixtral|codestral)/i,'https://chat.mistral.ai/'],
  [/^(?:kimi|moonshot)/i,'https://www.kimi.com/'],
  [/^(?:glm(?:[-\s\d]|$)|zai[\s/:_-]|z\.ai|zhipu|chatglm)/i,'https://chat.z.ai/'],
  [/^(?:llama|muse|meta[\s/:_-])/, 'https://www.meta.ai/'],
  [/^(?:perplexity|sonar)/i,'https://www.perplexity.ai/'],
  [/^(?:ideogram)/i,'https://ideogram.ai/'],
  [/^(?:midjourney)/i,'https://www.midjourney.com/'],
  [/^(?:runway)/i,'https://app.runwayml.com/'],
  [/^(?:minimax)/i,'https://agent.minimax.io/'],
  [/^(?:ernie|baidu)/i,'https://yiyan.baidu.com/'],
  [/^(?:hunyuan|hy4)/i,'https://yuanbao.tencent.com/'],
  [/^(?:step[- ]?\d|stepfun)/i,'https://stepfun.com/']
];
function providerURL(model){
  const key=id(model).replace(/^models\//,'');
  for(const [pattern,url] of providerLinks)if(pattern.test(key))return url;
  return null;
}
function destination(model,k){
  const url=providerURL(model)||'https://arena.ai/';
  if(url==='https://chatgpt.com/'&&['work','agent','chatagent','steering'].includes(k))return 'https://chatgpt.com/work/';
  if(url==='https://chatgpt.com/'&&k==='webdev')return 'https://chatgpt.com/codex/';
  return url;
}
// Access is data, not code: exact IDs only, with local overrides.
function accessEntry(model,k){
  const key=id(model);
  const x=own(settings.registry,key)?settings.registry[key]:null;
  const workKeys=['work','agent','chatagent','steering'];
  const scope=workKeys.includes(k)?'work':k==='webdev'?'code':'chat';
  let entry=null,provider=null;
  if(access.schemaVersion===1&&freshDate(access.reviewedAt)&&Array.isArray(access.providers))for(const p of access.providers){
    if(!freshDate(p.reviewedAt||access.reviewedAt))continue;
    const match=p.models.find(m=>id(m.id)===key&&(!m.expiresAt||m.expiresAt>today())&&(m.scope||'chat')===scope);
    if(match){entry=match;provider=p;break}
  }
  const status=entry?.status||'unknown';
  return {free:typeof x?.free==='boolean'?x.free:status==='free',plus:typeof x?.plus==='boolean'?x.plus:status==='plus',reportedFree:x?.free!==false&&status==='reported_free',plusCandidate:x?.plus!==false&&status==='plus_candidate',notes:entry?.notes||'',provider:provider?.provider||'',status}
}
if(!validAccess(access))access={};
function previousMonthRank(g,m){
  const observed=String(g.observed||g.date||'');
  if(!validDate(observed)||observed>today())return null;
  const last=new Date(observed+'T00:00:00Z');
  last.setUTCDate(1);last.setUTCMonth(last.getUTCMonth()-1);
  const month=last.toISOString().slice(0,7);
  const day=Object.keys(g.history||{}).filter(d=>validDate(d)&&d.slice(0,7)===month).sort().pop();
  const rank=day?g.history[day]?.[id(m.id)]:null;
  return Number.isInteger(rank)?rank:null;
}
function winners(g,k){
  if(!g||!Array.isArray(g.models))return [null,null,null];
  const ranked=g.models.filter(m=>m&&typeof m.id==='string'&&Number.isInteger(m.rank)&&m.rank>0).slice().sort((a,b)=>a.rank-b.rank||a.id.localeCompare(b.id));
  const eligible=ranked.map(m=>({m,e:accessEntry(m.id,k)}));
  const plus=eligible.find(x=>x.e.plus)?.m;
  const free=eligible.find(x=>x.e.free)?.m;
  const plusCandidate=plus?null:eligible.find(x=>x.e.plusCandidate)?.m;
  const freeCandidate=free?null:eligible.find(x=>x.e.reportedFree)?.m;
  return [ranked[0],plus||plusCandidate,free||freeCandidate].map((m,i)=>{
    if(!m)return null;
    const x=settings.registry[id(m.id)]||{},prior=previousMonthRank(g,m);
    return {...m,name:x.name||m.id,url:destination(m.id,k),unconfirmed:(i===1&&!plus)||(i===2&&!free),delta:prior==null?null:prior-m.rank}
  })
}
let diagnostic='';
async function request(url){
  const r=new Request(url);
  r.timeoutInterval=8;
  const j=await r.loadJSON();
  if(!record(j)||r.response&&r.response.statusCode>=400||j.error)throw Error(String(j?.error||'HTTP '+r.response?.statusCode));
  return j;
}
function validGroup(g){
  if(!record(g)||!validDate(g.date)||g.date>today()||!Array.isArray(g.models)||!g.models.length||g.models.length>10000)return false;
  if(g.observed!==undefined&&(!validDate(g.observed)||g.observed<g.date||g.observed>today()))return false;
  if(g.partial!==undefined&&typeof g.partial!=='boolean')return false;
  const ids=new Set();let first=false;
  for(const m of g.models){
    if(!record(m)||typeof m.id!=='string'||!m.id.trim()||!safeKey(id(m.id))||ids.has(id(m.id))||!Number.isInteger(m.rank)||m.rank<1)return false;
    ids.add(id(m.id));if(m.rank===1)first=true;
  }
  return first;
}
function mergeFeed(feed){
  if(!record(feed)||!record(feed.subsets))throw Error('Invalid ranking feed');
  const next={...cache};let valid=0;
  for(const [sub,incoming] of Object.entries(feed.subsets)){
    if(!safeKey(sub)||!record(incoming)||!record(incoming.groups)||!validDate(incoming.checked)||incoming.checked>today())continue;
    const old=record(cache[sub])?cache[sub]:{groups:{}};
    const groups=record(old.groups)?{...old.groups}:{};
    let accepted=0;
    for(const [key,g] of Object.entries(incoming.groups)){
      if(!safeKey(key)||!validGroup(g)||g.date>incoming.checked||(g.observed&&g.observed>incoming.checked))continue;
      valid++;
      const prior=groups[key];
      if(validGroup(prior)){
        if(prior.date>g.date)continue;
        if(prior.date===g.date&&((!prior.partial&&g.partial)||(!!prior.partial===!!g.partial&&(prior.observed||'')>(g.observed||''))))continue;
      }
      groups[key]=g;accepted++;
    }
    if(accepted)next[sub]={checked:[old.checked||'',incoming.checked].sort().pop(),groups};
  }
  if(!valid)throw Error('No valid rankings in feed');
  save('monthly-cache',next);cache=next;
}
function validAccess(j){
  const statuses=['free','plus','reported_free','plus_candidate','unverified','paid'];
  if(!record(j)||j.schemaVersion!==1||!validDate(j.reviewedAt)||j.reviewedAt>today()||!Array.isArray(j.providers)||!j.providers.length)return false;
  const ids=new Set();
  return j.providers.every(p=>record(p)&&typeof p.provider==='string'&&p.provider.trim()&&https(p.url)&&https(p.source)&&(!p.reviewedAt||validDate(p.reviewedAt)&&p.reviewedAt<=j.reviewedAt)&&Array.isArray(p.models)&&p.models.every(m=>{
    if(!record(m)||typeof m.id!=='string'||!m.id.trim()||!safeKey(id(m.id))||!statuses.includes(m.status)||!['chat','work','code'].includes(m.scope||'chat')||(m.expiresAt&&!validDate(m.expiresAt)))return false;
    const key=id(m.id)+':'+(m.scope||'chat');
    if(ids.has(key))return false;ids.add(key);return true;
  }));
}
// Collection happens on GitHub; only read the published JSON here.
async function refresh(ks,force=false){
  const tasks=[],errors=[],day=today();
  const feedURL=settings.feed||REPO;
  if(force||sync.feed!==day||sync.feedURL!==feedURL||!Object.values(cache).some(s=>record(s)&&record(s.groups)&&Object.values(s.groups).some(validGroup)))tasks.push((async()=>{
    try{mergeFeed(await request(feedURL));sync.feed=day;sync.feedURL=feedURL}
    catch(e){errors.push('Rankings: '+String(e))}
  })());
  if(force||sync.access!==day||!validAccess(access))tasks.push((async()=>{
    try{
      const incoming=await request(ACCESS);
      if(!validAccess(incoming))throw Error('Invalid access registry');
      if(!validAccess(access)||incoming.reviewedAt>=access.reviewedAt){save('access',incoming);access=incoming}
      sync.access=day;
    }catch(e){errors.push('Access: '+String(e))}
  })());
  await Promise.all(tasks);
  try{save('monthly-sync',sync)}catch(e){errors.push('Sync cache: '+String(e))}
  diagnostic=errors.join('\n');
  if(diagnostic)console.log(diagnostic);
}
function get(k){if(!category(k))return null;const [sub,cat]=C[k][1].split(':');const groups=cache[sub]?.groups||{};const aliases=k==='reasoning'?[cat,'hard_6','hard']: [cat];for(const key of aliases)if(validGroup(groups[key]))return groups[key];return null}
const link=(k,mode='details')=>'scriptable:///run/'+encodeURIComponent(Script.name())+'?category='+encodeURIComponent(k)+'&mode='+encodeURIComponent(mode);
// Graphite: native stacks preserve independent tap targets.
const ink='#F2F3F6',muted='#B5BBC7';
const labels=['FRONTIER','CHATGPT PLUS','FREE'];
const colors=['#C5A6FF','#90E8B9','#80CBFF'];
const surfaces=['#292439','#21332E','#202D40'];
const edges=['#594873','#38594B','#3C5875'];
const tierSymbols=['crown.fill','bolt.fill','square.stack.3d.up'];
const categorySymbols={search:'magnifyingglass',work:'briefcase',text:'text.alignleft',documents:'doc.text',vision:'photo',reasoning:'brain',writing:'pencil',image:'photo.artframe',editing:'wand.and.stars',video:'video',webdev:'chevron.left.forwardslash.chevron.right',agent:'cpu',imagevideo:'film',videoedit:'film',steering:'slider.horizontal.3',instruction:'list.bullet',chatagent:'bubble.left.and.bubble.right'};
const shortTitles={work:'Work',text:'Text',documents:'Docs',reasoning:'Reasoning',writing:'Writing',image:'Images',editing:'Edit image',video:'Video',webdev:'Web dev',agent:'Agent',imagevideo:'Img → video',videoedit:'Edit video',steering:'Steering',instruction:'Instruction',chatagent:'Agent chat'};
function txt(s,v,size=10,c=ink,bold=false,lines=1){
  const t=s.addText(String(v));
  t.font=bold?Font.semiboldSystemFont(size):Font.systemFont(size);
  t.textColor=new Color(c);t.lineLimit=lines;t.minimumScaleFactor=.8;
  return t;
}
function symbol(s,name,size,color=muted){
  const sf=SFSymbol.named(name)||SFSymbol.named('circle');
  const i=s.addImage(sf.image);
  i.imageSize=new Size(size,size);i.tintColor=new Color(color);return i;
}
// Apple HIG sizes in points. Conservative fallback fits smaller supported devices.
function widgetSize(family){
  const screen=typeof Device!=='undefined'?Device.screenSize():{width:393,height:852};
  const w=Math.min(screen.width,screen.height),h=Math.max(screen.width,screen.height);
  const sizes={'375x667':[148,321,324],'375x812':[155,329,345],'390x844':[158,338,354],'393x852':[158,338,354],'402x874':[162,344,366],'414x896':[169,360,379],'428x926':[170,364,382],'430x932':[170,364,382],'440x956':[173,370,390],'360x780':[155,329,345],'320x568':[141,292,311]};
  const [small,wide,tall]=sizes[w+'x'+h]||[141,292,311];
  return family==='small'?[small,small]:family==='medium'?[wide,small]:[wide,tall];
}
function panel(parent,width,height,i,pad=6){
  const p=parent.addStack();p.size=new Size(width,height);p.cornerRadius=9;
  p.backgroundColor=new Color(surfaces[i]);p.borderWidth=.6;p.borderColor=new Color(edges[i]);
  p.setPadding(pad,pad,pad,pad);return p;
}
function modelName(m){
  return (m?.name||'').replace(/^Amazon-Web-Search-Agent$/i,'Amazon Web Search').replace(/Qwen(\d)/i,'Qwen $1').replace(/\s*\(([^)]+)\)/g,' $1');
}
function rank(m){return m?'#'+m.rank+(m.unconfirmed?'?':''):'–'}
function modelLink(m,k){return m?.url||link(k,'details')}
function header(w,k,large,width){
  const h=w.addStack();h.size=new Size(width,18);h.centerAlignContent();
  if(!large){symbol(h,categorySymbols[k]||'circle',14,ink);h.addSpacer(5);txt(h,C[k][0],14,ink,true)}
  else txt(h,'',1);
  h.addSpacer();const gear=h.addStack();gear.centerAlignContent();
  symbol(gear,'gearshape',15,muted);
  if(large)gear.url=link(k,'settings');
  return gear;
}
function smallCard(parent,m,k,i,width,height){
  const p=panel(parent,width,height,i,4);p.centerAlignContent();
  symbol(p,tierSymbols[i],12,colors[i]);p.addSpacer(4);
  const body=p.addStack();body.layoutVertically();body.spacing=1;
  const line=body.addStack();line.centerAlignContent();
  txt(line,labels[i],8,colors[i],true);line.addSpacer();txt(line,rank(m),12,colors[i],true);
  txt(body,modelName(m)||'–',10,ink,true,1);
}
function mediumCard(parent,m,k,i,width,height){
  const p=panel(parent,width,height,i,7);p.layoutVertically();p.url=modelLink(m,k);
  const h=p.addStack();h.centerAlignContent();symbol(h,tierSymbols[i],11,colors[i]);h.addSpacer(3);
  txt(h,labels[i],8,colors[i],true);p.addSpacer(4);
  txt(p,rank(m),27,colors[i],true);p.addSpacer(3);
  txt(p,modelName(m)||'–',11,ink,true,2);p.addSpacer();
  // A restrained accent stripe, not fabricated historical data.
  const accent=p.addStack();accent.size=new Size(Math.max(12,width-14),3);
  accent.cornerRadius=1.5;accent.backgroundColor=new Color(edges[i]);
}
function largeCell(parent,m,k,i,width,height){
  const p=panel(parent,width,height,i,5);p.layoutVertically();p.url=modelLink(m,k);
  txt(p,rank(m),13,colors[i],true);p.addSpacer(1);
  txt(p,modelName(m)||'–',9.5,ink,true,2);
}
function widget(ks,family){
  const [width,height]=widgetSize(family);
  const small=family==='small',large=family==='large',pad=small?8:10,gap=small?3:5;
  const inner=width-2*pad;
  const w=new ListWidget();w.backgroundColor=new Color('#15181F');w.setPadding(pad,pad,pad,pad);
  w.refreshAfterDate=new Date(Date.now()+6*3600000);
  w.url=link(ks[0]);const gear=header(w,ks[0],large,inner);
  if(!small)gear.url=link(ks[0],'settings');
  w.addSpacer(gap);
  if(small){
    const k=ks[0],m=winners(get(k),k),rh=Math.floor((height-2*pad-18-3*gap)/3);
    for(let i=0;i<3;i++){smallCard(w,m[i],k,i,inner,rh);if(i<2)w.addSpacer(gap)}
  }else if(!large){
    const k=ks[0],m=winners(get(k),k),cw=Math.floor((inner-2*gap)/3),rh=height-2*pad-18-gap;
    const row=w.addStack();row.spacing=gap;
    for(let i=0;i<3;i++)mediumCard(row,m[i],k,i,cw,rh);
  }else{
    const catW=Math.floor(inner*.20),cw=Math.floor((inner-catW-3*gap)/3);
    const headings=w.addStack();headings.spacing=gap;headings.addSpacer(catW);
    for(let i=0;i<3;i++){const h=headings.addStack();h.size=new Size(cw,19);h.centerAlignContent();h.addSpacer();txt(h,labels[i],8,colors[i],true);h.addSpacer()}
    w.addSpacer(gap);
    const rh=Math.min(66,Math.floor((height-2*pad-18-19-2*gap-(ks.length-1)*gap)/ks.length));
    for(let j=0;j<ks.length;j++){
      const k=ks[j],m=winners(get(k),k),r=w.addStack();r.spacing=gap;r.centerAlignContent();
      const cat=r.addStack();cat.size=new Size(catW,rh);cat.cornerRadius=9;cat.backgroundColor=new Color('#242932');cat.setPadding(5,5,5,5);cat.layoutVertically();cat.url=link(k);
      symbol(cat,categorySymbols[k]||'circle',13,muted);cat.addSpacer(3);txt(cat,shortTitles[k]||C[k][0],10,ink,true,2);
      for(let i=0;i<3;i++)largeCell(r,m[i],k,i,cw,rh);
      if(j<ks.length-1)w.addSpacer(gap);
    }
  }
  // Missing ranking data is still discoverable via the detail screen; no footer.
  return w;
}
async function choose(title,items){const a=new Alert();a.title=title;for(const s of items)a.addAction(s);a.addCancelAction('Cancel');return await a.presentSheet()}
async function note(title,message){const a=new Alert();a.title=title;a.message=message;a.addAction('OK');await a.presentAlert()}
async function edit(model){
  const k=id(model);if(!k||!safeKey(k))return;
  const x=own(settings.registry,k)?settings.registry[k]:{};
  const a=new Alert();
  a.title=model;
  a.message='Choose which access you have. The chat website is selected automatically.';
  a.addTextField('Display name',x.name||model);
  ['ChatGPT Plus','Free','Both','Neither','Reset override'].forEach(v=>a.addAction(v));
  a.addCancelAction('Cancel');
  const i=await a.presentAlert();if(i<0)return;
  if(i===4)delete settings.registry[k];
  else settings.registry[k]={name:a.textFieldValue(0).trim()||model,plus:i===0||i===2,free:i===1||i===2};
  save('settings',settings)
}
async function accessMenu(k){
  await refresh([k]);
  const g=get(k);
  if(!g){await note('Rankings unavailable',diagnostic||'No rankings for this category');return}
  const models=g.models.slice().sort((a,b)=>a.rank-b.rank);
  let page=0;
  while(true){
    const slice=models.slice(page*15,page*15+15);
    const options=slice.map(m=>'#'+m.rank+' '+m.id);
    if(page>0)options.push('Previous page');
    if((page+1)*15<models.length)options.push('Next page');
    const i=await choose('Set model access',options);
    if(i<0)return;
    if(i<slice.length){await edit(slice[i].id);return}
    if(options[i]==='Previous page')page--;else page++;
  }
}
const boardURLs={work:'https://arena.ai/leaderboard/agent/work',search:'https://arena.ai/leaderboard/chat/search',text:'https://arena.ai/leaderboard/chat/text',reasoning:'https://arena.ai/leaderboard/chat/text/hard-prompts',writing:'https://arena.ai/leaderboard/chat/text/creative-writing',vision:'https://arena.ai/leaderboard/chat/vision',documents:'https://arena.ai/leaderboard/chat/document',agent:'https://arena.ai/leaderboard/agent'};
async function details(k){
  await refresh([k]);
  const g=get(k);
  if(!g){const j=await choose('No published data for '+C[k][0],['Open Arena leaderboard','Settings']);if(j===0)Safari.open(boardURLs[k]||'https://arena.ai/leaderboard');if(j===1)await menu();return}
  const models=g.models.slice().sort((a,b)=>a.rank-b.rank||a.id.localeCompare(b.id));
  const top=models.slice(0,20);
  const table=new UITable();table.showSeparators=true;
  let selected=null;
  function row(title,subtitle,action){const r=new UITableRow();r.height=action?54:70;r.addText(title,subtitle||'');if(action){r.dismissOnSelect=true;r.onSelect=()=>{selected=action}}table.addRow(r)}
  row(C[k][0]+' · Top '+top.length,g.date+(g.partial?' · Partial snapshot':' · Official dataset')+' · ? = unconfirmed access');
  row('Open Arena leaderboard','Compare with the public leaderboard',()=>Safari.open(boardURLs[k]||'https://arena.ai/leaderboard'));
  row('Settings','Choose categories and model access',async()=>await menu());
  const leaders=winners(g,k);for(let i=0;i<3;i++){const m=leaders[i];if(m)row(labels[i]+' · #'+m.rank+' '+m.name,m.unconfirmed?'Access not independently confirmed':'Open provider',()=>Safari.open(destination(m.id,k)))}
  for(const m of top){const metric=m.rating??m.score;const e=accessEntry(m.id,k);const availability=e.free?'Free':e.plus?'Plus':e.reportedFree?'Free?':e.plusCandidate?'Plus?':'';row('#'+m.rank+' '+(settings.registry[id(m.id)]?.name||m.id),[availability,m.organization||'',metric!=null?'Score '+(Number.isFinite(metric)?Number(metric.toFixed(2)):metric):''].filter(Boolean).join(' · '),()=>Safari.open(destination(m.id,k)))}
  await table.present();
  if(selected)await selected();
}
async function editRows(current){
  let rows=current.slice(0,5);
  while(true){
    const actions=rows.map((k,i)=>(i+1)+'. '+C[k][0]).concat(['Add row','Reset default order','Save order']);
    const i=await choose('Large widget rows',actions);
    if(i<0)return null;
    if(i===rows.length+2)return rows.length?rows:null;
    if(i===rows.length+1){rows=defaults.slice();continue}
    if(i===rows.length){
      if(rows.length>=5){await note('Five row limit','Replace an existing row instead.');continue}
      const choices=Object.keys(C).filter(k=>!rows.includes(k));const j=await choose('Add category',choices.map(k=>C[k][0]));if(j>=0)rows.push(choices[j]);continue
    }
    const ops=['Move up','Move down','Replace category','Remove row'];
    const j=await choose(C[rows[i]][0],ops);
    if(j===0&&i>0)[rows[i-1],rows[i]]=[rows[i],rows[i-1]];
    if(j===1&&i<rows.length-1)[rows[i],rows[i+1]]=[rows[i+1],rows[i]];
    if(j===2){const choices=Object.keys(C).filter(k=>!rows.includes(k));const n=await choose('Replace with',choices.map(k=>C[k][0]));if(n>=0)rows[i]=choices[n]}
    if(j===3&&rows.length>1)rows.splice(i,1);
  }
}
async function menu(){const i=await choose('Widget settings',['Browse top 20 by category','Set model access','Edit large categories','Edit existing model access','Set optional feed URL','Refresh published data','Free-tier provider directory']);if(i===0){const a=Object.keys(C),j=await choose('Category',a.map(k=>C[k][0]));if(j>=0)await details(a[j])}if(i===1){const a=Object.keys(C),j=await choose('Set model access',a.map(k=>C[k][0]));if(j>=0)await accessMenu(a[j])}if(i===2){const rows=await editRows(keys(settings.large.join(',')));if(rows){settings.large=rows;settings.largeCustomized=true;save('settings',settings)}}if(i===3){const a=Object.keys(settings.registry);if(!a.length){await note('No saved models','Browse a category or add an exact Arena model ID first.');return}const j=await choose('Saved models',a);if(j>=0)await edit(a[j])}if(i===4){const a=new Alert();a.title='Hosted feed';a.addTextField('HTTPS URL',settings.feed||REPO);a.addAction('Save');a.addCancelAction('Cancel');if(await a.presentAlert()>=0){const v=a.textFieldValue(0).trim();if(!v||https(v)){settings.feed=v||REPO;save('settings',settings)}else await note('Invalid URL','Enter an HTTPS feed URL.')}}if(i===5){await refresh(Object.keys(C),true);await note('Refresh',diagnostic||'Published files checked. Ranking collection runs monthly.')}if(i===6){await refresh([]);const p=Array.isArray(access.providers)?access.providers:[];if(!p.length){await note('No registry','Access data not yet available');return}const j=await choose('Free-tier directory',p.map(x=>x.provider+' · '+(x.freeTier||'unverified')));if(j>=0){const x=p[j];await note(x.provider,[...(x.freeModelFamilies||[]),x.notes,'Reviewed '+(x.reviewedAt||access.reviewedAt)].filter(Boolean).join('\\n'));Safari.open(x.url)}}}
async function main(){if(config.runsInWidget){const family=['small','medium','large'].includes(config.widgetFamily)?config.widgetFamily:'small';let ks=keys(args.widgetParameter||'');if(family==='large')ks=keys(settings.large.join(','));else if(!ks.length)ks=['search'];if(!ks.length)ks=defaults;ks=ks.slice(0,family==='large'?5:1);await refresh(ks);Script.setWidget(widget(ks,family))}else{const k=args.queryParameters?.category;if(args.queryParameters?.mode==='settings'||!category(k))await menu();else await details(k)}}
try{await main()}catch(e){console.log('AI Radar error: '+String(e));if(config.runsInWidget){const w=new ListWidget();w.backgroundColor=new Color('#121821');w.setPadding(12,12,12,12);txt(w,'Rankings unavailable',13,ink,true);txt(w,'Open settings to troubleshoot',9,muted);w.url=link('search','settings');Script.setWidget(w)}else await note('AI Radar error',String(e))}finally{Script.complete()}
