// AI Radar v0.6 — Scriptable
const REPO='https://raw.githubusercontent.com/shayanhaider-pdf/llm-arena-widget/main/data/latest.json';
const DATASET='lmarena-ai/leaderboard-dataset';
const C={work:['Work','work:overall'],search:['Search','search:overall'],reasoning:['Reasoning','text_style_control:hard_6'],writing:['Creative writing','text_style_control:creative_writing'],vision:['Vision','vision_style_control:overall'],documents:['Documents','document_style_control:overall'],text:['Overall text','text_style_control:overall'],webdev:['Web development','webdev:overall'],image:['Image generation','text_to_image:overall'],editing:['Image editing','image_edit:overall'],video:['Video generation','text_to_video:overall'],agent:['Agent Index','agent_index:overall'],imagevideo:['Image to video','image_to_video:overall'],videoedit:['Video editing','video_edit:overall'],alignment:['Alignment','alignment:overall']};
const defaults=['search','work','text','vision','documents'];
const fm=FileManager.local(),dir=fm.joinPath(fm.documentsDirectory(),'AI-Radar');
if(!fm.fileExists(dir))fm.createDirectory(dir,true);
const path=n=>fm.joinPath(dir,n+'.json');
function read(n,d){try{return JSON.parse(fm.readString(path(n)))}catch{return d}}
function save(n,v){fm.writeString(path(n),JSON.stringify(v))}
const record=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
let settings=read('settings',{});if(!record(settings))settings={};
if(!record(settings.registry))settings.registry={};if(!Array.isArray(settings.large))settings.large=defaults;if(typeof settings.feed!=='string'||!settings.feed)settings.feed=REPO;
let cache=read('cache',{});if(!record(cache))cache={};
const  id=s=>String(s||'').trim().toLowerCase(), norm=s=>id(s).replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,'');
const today=()=>new Date().toISOString().slice(0,10);
const dayAgo=(d,n)=>new Date(Date.parse(d+'T00:00:00Z')-n*86400000).toISOString().slice(0,10);
function keys(s){return [...new Set(String(s||'').split(',').map(x=>{let t=id(x);return C[t]?t:Object.keys(C).find(k=>C[k][1]===t)}).filter(Boolean))]}
function https(s){return /^https:\/\/[^\s/]+(?:[/?#][^\s]*)?$/i.test(s)}
function group(rows,previous={},date=today()){
  const out={};
  for(const r of rows){const rank=Number(r.rank), d=String(r.leaderboard_publish_date||'').slice(0,10),k=norm(r.category||'overall');if(!r.model_name||!Number.isInteger(rank)||rank<1||!/^\d{4}-\d{2}-\d{2}$/.test(d))continue;if(!out[k]||out[k].date<d)out[k]={date:d,models:[]};if(out[k].date===d)out[k].models.push({id:String(r.model_name),rank})}
  for(const [k,g] of Object.entries(out)){const old=previous[k]||{};if(old.date>g.date){out[k]=old;continue}g.models.sort((a,b)=>a.rank-b.rank||a.id.localeCompare(b.id));g.history={...(old.history||{})};g.history[date]=Object.fromEntries(g.models.map(m=>[id(m.id),m.rank]));for(const d of Object.keys(g.history))if(d<dayAgo(date,14))delete g.history[d];g.observed=date}
  return out
}
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
  [/^(?:glm(?:[-\s\d]|$)|zai[\s/:_-]|z\.ai|zhipu|chatglm)/i,'https://z.ai/chat'],
  [/^(?:llama|meta[\s/:_-])/, 'https://www.meta.ai/'],
  [/^(?:perplexity|sonar)/i,'https://www.perplexity.ai/'],
  [/^(?:ideogram)/i,'https://ideogram.ai/'],
  [/^(?:midjourney)/i,'https://www.midjourney.com/'],
  [/^(?:runway)/i,'https://app.runwayml.com/']
];
function providerURL(model){
  const key=id(model).replace(/^models\//,'');
  for(const [pattern,url] of providerLinks)if(pattern.test(key))return url;
  return null;
}
function destination(model){
  return providerURL(model)||'https://arena.ai/';
}
function winners(g){if(!g||!Array.isArray(g.models))return [null,null,null];const reg=settings.registry;const ranked=g.models.filter(m=>m&&typeof m.id==='string'&&Number.isInteger(m.rank)&&m.rank>0).slice().sort((a,b)=>a.rank-b.rank||a.id.localeCompare(b.id));return [ranked[0],ranked.find(m=>reg[id(m.id)]?.plus===true),ranked.find(m=>reg[id(m.id)]?.free===true)].map(m=>{if(!m)return null;const x=reg[id(m.id)]||{}, prior=g.history?.[dayAgo(g.observed||today(),7)]?.[id(m.id)];return {...m,name:x.name||m.id,url:destination(m.id),delta:prior==null?null:prior-m.rank}})}
let diagnostic='';
async function request(url){const r=new Request(url);r.timeoutInterval=8;const j=await r.loadJSON();if(!j||r.response&&r.response.statusCode>=400||j.error)throw Error(String(j&&j.error||'HTTP '+(r.response&&r.response.statusCode)));return j}
function validGroup(g){return record(g)&&/^\d{4}-\d{2}-\d{2}$/.test(g.date||'')&&Array.isArray(g.models)&&g.models.length>0&&g.models.every(m=>record(m)&&typeof m.id==='string'&&m.id.trim()&&Number.isInteger(m.rank)&&m.rank>0)}
function mergeFeed(feed){if(!record(feed)||!record(feed.subsets))throw Error('Invalid ranking feed');let accepted=0;for(const [sub,incoming] of Object.entries(feed.subsets)){if(!record(incoming)||!record(incoming.groups)||!/^\d{4}-\d{2}-\d{2}$/.test(incoming.checked||''))continue;const old=record(cache[sub])?cache[sub]:{groups:{}};const groups=record(old.groups)?{...old.groups}:{};for(const [key,g] of Object.entries(incoming.groups)){if(!validGroup(g))continue;const prior=groups[key];if(validGroup(prior)&&(prior.date>g.date||(prior.date===g.date&&((!prior.partial&&g.partial)||(prior.partial===g.partial&&(prior.observed||'')>(g.observed||''))))))continue;groups[key]=g;accepted++}cache[sub]={checked:[old.checked||'',incoming.checked].sort().pop(),groups}}if(!accepted)throw Error('No valid rankings in feed');save('cache',cache)}
async function fetchDirect(k,full=false){
  const [sub,cat]=C[k][1].split(':');
  const base='https://datasets-server.huggingface.co/';
  const common='?dataset='+encodeURIComponent(DATASET)+'&config='+encodeURIComponent(sub)+'&split=latest';
  const where='"category"=\''+cat+'\'';
  let rows=[],offset=0,total=null;
  const limit=full?25:1;
  for(let page=0;page<limit;page++){
    let j;
    try{
      j=await request(base+'filter'+common+'&where='+encodeURIComponent(where)+'&orderby='+encodeURIComponent('"rank"')+'&length=100&offset='+offset)
    }catch(e){
      if(k!=='search'||offset!==0)throw e;
      j=await request(base+'rows'+common+'&length=100&offset=0');
      if(j.num_rows_total>100)throw Error('Search fallback cannot establish complete rankings');
    }
    if(j.partial===true||!Array.isArray(j.rows)||!Number.isInteger(j.num_rows_total)||j.num_rows_total<1||j.num_rows_total>2500||!j.rows.length||total!==null&&total!==j.num_rows_total)throw Error('Incomplete Arena response');
    total=j.num_rows_total;
    rows.push(...j.rows.map(x=>x.row).filter(record));
    offset+=j.rows.length;
    if(offset>=total)break;
  }
  const old=cache[sub]?.groups||{};
  const groups=group(rows,old);
  const g=groups[cat];
  if(!validGroup(g)||Math.min(...g.models.map(m=>m.rank))!==1)throw Error('No rank-one model in '+cat);
  if(old[cat]&&old[cat].date>g.date)return;
  if(offset<total){
    if(validGroup(old[cat])&&old[cat].date===g.date&&!old[cat].partial)return;
    g.partial=true;
    g.totalModels=total;
    g.history={...(old[cat]?.history||{})};
  }
  g.source='https://huggingface.co/datasets/'+DATASET;
  cache[sub]={checked:today(),groups:{...old,[cat]:g}};
}
async function refresh(ks,allowDirect=false){
  try{mergeFeed(await request(settings.feed||REPO));diagnostic=''}catch(e){diagnostic=String(e);console.log('Feed unavailable: '+diagnostic)}
  const needed=ks.filter(k=>{const g=get(k);return !g||g.observed!==today()});
  // One category can fetch from Arena directly, even if GitHub has never run.
  // Large widgets rely on the feed for all other categories to stay within iOS limits.
  for(const k of (allowDirect?needed:needed.slice(0,1))){
    try{await fetchDirect(k,allowDirect)}catch(e){diagnostic=String(e);console.log('Arena direct: '+diagnostic)}
  }
  try{save('cache',cache)}catch(e){console.log('Cache write: '+e)}
}
function get(k){if(!C[k])return null;const [sub,cat]=C[k][1].split(':');const groups=cache[sub]?.groups||{};const aliases=k==='reasoning'?[cat,'hard_prompts','hard']: [cat];for(const key of aliases)if(validGroup(groups[key]))return groups[key];return null}
const link=(k,mode='details')=>'scriptable:///run/'+encodeURIComponent(Script.name())+'?category='+encodeURIComponent(k)+'&mode='+encodeURIComponent(mode);
const ink='#E8EEF7',muted='#9CA3AF',labels=['FRONTIER','CHATGPT PLUS','FREE'],colors=['#F5C76B','#65D6A8','#8AB4F8'];
function txt(s,v,size=10,c=ink,bold=false){const t=s.addText(String(v));t.font=bold?Font.semiboldSystemFont(size):Font.systemFont(size);t.textColor=new Color(c);t.lineLimit=1;t.minimumScaleFactor=.6;return t}
function cell(s,m,i,small=false,large=false,k='search'){const c=s.addStack();c.layoutVertically();if(!small)c.url=m?.url||link(k,'settings');if(small){txt(c,labels[i],8,colors[i],true)}const row=c.addStack();row.centerAlignContent();txt(row,m?.name||(i===0?'No rankings':'Set access'),small?9:10);if(small){row.addSpacer(3);if(m)txt(row,'#'+m.rank,8,muted)}else{const r=c.addStack();if(m)txt(r,'#'+m.rank,9,muted);if(large&&m?.delta!=null){r.addSpacer(3);txt(r,m.delta>0?'↑':m.delta<0?'↓':'−',10,m.delta>0?'#34D399':m.delta<0?'#F87171':muted)}}return c}
function widget(ks,family){const small=family==='small',large=family==='large';const w=new ListWidget();w.backgroundColor=new Color('#121821');w.setPadding(12,12,12,12);w.refreshAfterDate=new Date(Date.now()+6*3600000);w.url=link(ks[0]);const h=w.addStack();h.centerAlignContent();if(!large)txt(h,C[ks[0]][0],15,ink,true);if(ks.some(k=>get(k)?.partial)){h.addSpacer(4);txt(h,'Snapshot',8,muted)}else if(ks.some(k=>get(k)&&(cache[C[k][1].split(':')[0]]?.checked!==today()||get(k).observed!==today()))){h.addSpacer(4);txt(h,'Cached',8,muted)}h.addSpacer();const gear=h.addStack();txt(gear,'⚙',15,muted);if(!small)gear.url=link(ks[0],'settings');w.addSpacer(large?4:8);
if(!small){const r=w.addStack();if(large)r.addSpacer(60);for(let i=0;i<3;i++){const c=r.addStack();c.size=new Size(large?76:90,0);txt(c,labels[i],8,colors[i],true);if(i<2)r.addSpacer(4)}w.addSpacer(7)}
for(const k of ks){const g=get(k),m=winners(g);const r=w.addStack();if(small){r.layoutVertically();for(let i=0;i<3;i++){cell(r,m[i],i,true,false,k);if(i!==2)r.addSpacer(4)}}else{r.centerAlignContent();if(large){const c=r.addStack();c.size=new Size(60,0);txt(c,C[k][0],9,muted,true)}for(let i=0;i<3;i++){const c=cell(r,m[i],i,false,large,k);c.size=new Size(large?76:90,0);if(i<2)r.addSpacer(4)}}if(!g)txt(w,'Data unavailable · open settings',8,muted);if(large)w.addSpacer(12)}
return w}
async function choose(title,items){const a=new Alert();a.title=title;for(const s of items)a.addAction(s);a.addCancelAction('Cancel');return await a.presentSheet()}
async function note(title,message){const a=new Alert();a.title=title;a.message=message;a.addAction('OK');await a.presentAlert()}
async function edit(model){
  const k=id(model);if(!k)return;
  const x=settings.registry[k]||{};
  const a=new Alert();
  a.title=model;
  a.message='Choose which access you have. The chat website is selected automatically.';
  a.addTextField('Display name',x.name||model);
  ['ChatGPT Plus','Free','Both','Clear access'].forEach(v=>a.addAction(v));
  a.addCancelAction('Cancel');
  const i=await a.presentAlert();if(i<0)return;
  if(i===3)delete settings.registry[k];
  else settings.registry[k]={name:a.textFieldValue(0).trim()||model,plus:i===0||i===2,free:i===1||i===2};
  save('settings',settings)
}
async function modelMenu(m){
  Safari.open(destination(m.id))
}
async function accessMenu(k){
  await refresh([k],true);
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
  await refresh([k],true);
  const g=get(k);
  if(!g){const j=await choose('No published data for '+C[k][0],['Open Arena leaderboard','Settings']);if(j===0)Safari.open(boardURLs[k]||'https://arena.ai/leaderboard');if(j===1)await menu();return}
  const models=g.models.slice().sort((a,b)=>a.rank-b.rank||a.id.localeCompare(b.id));
  const top=models.slice(0,20);
  const table=new UITable();table.showSeparators=true;
  function row(title,subtitle,action){const r=new UITableRow();r.height=action?54:70;r.addText(title,subtitle||'');if(action){r.dismissOnSelect=true;r.onSelect=action}table.addRow(r)}
  row(C[k][0]+' · Top '+top.length,g.date+(g.partial?' · Dated snapshot':' · Official dataset'));
  row('Open complete Arena leaderboard','See full rankings on Arena',()=>Safari.open(boardURLs[k]||'https://arena.ai/leaderboard'));
  row('Settings','Choose categories and model access',async()=>await menu());
  const leaders=winners(g);for(let i=0;i<3;i++){const m=leaders[i];if(m)row(labels[i]+' · #'+m.rank+' '+m.name,'Open provider',()=>Safari.open(destination(m.id)))}
  for(const m of top){const metric=m.rating??m.score;row('#'+m.rank+' '+(settings.registry[id(m.id)]?.name||m.id),[m.organization||'',metric!=null?'Score '+metric:''].filter(Boolean).join(' · '),()=>Safari.open(destination(m.id)))}
  await table.present();
}
async function menu(){const i=await choose('Widget settings',['Browse top 20 by category','Set model access','Edit large categories','Edit existing model access','Set optional feed URL']);if(i===0){const a=Object.keys(C),j=await choose('Category',a.map(k=>C[k][0]));if(j>=0)await details(a[j])}if(i===1){const a=Object.keys(C),j=await choose('Set model access',a.map(k=>C[k][0]));if(j>=0)await accessMenu(a[j])}if(i===2){const a=new Alert();a.title='Large categories';a.message=Object.keys(C).join(', ');a.addTextField('Up to five',keys(settings.large.join(',')).join(','));a.addAction('Save');a.addCancelAction('Cancel');if(await a.presentAlert()>=0){const v=keys(a.textFieldValue(0)).slice(0,5);if(v.length){settings.large=v;save('settings',settings)}}}if(i===3){const a=Object.keys(settings.registry);if(!a.length){await note('No saved models','Browse a category or add an exact Arena model ID first.');return}const j=await choose('Saved models',a);if(j>=0)await edit(a[j])}if(i===4){const a=new Alert();a.title='Hosted feed';a.addTextField('HTTPS URL',settings.feed||REPO);a.addAction('Save');a.addCancelAction('Cancel');if(await a.presentAlert()>=0){const v=a.textFieldValue(0).trim();if(!v||https(v)){settings.feed=v||REPO;save('settings',settings)}}}}
async function main(){if(config.runsInWidget){const family=['small','medium','large'].includes(config.widgetFamily)?config.widgetFamily:'small';let ks=keys(args.widgetParameter||'');if(!ks.length)ks=family==='large'?keys(settings.large.join(',')):['search'];if(!ks.length)ks=defaults;ks=ks.slice(0,family==='large'?5:1);await refresh(ks);Script.setWidget(widget(ks,family))}else{const k=args.queryParameters?.category;if(args.queryParameters?.mode==='settings'||!C[k])await menu();else await details(k)}}
try{await main()}catch(e){console.log('AI Radar error: '+String(e));if(config.runsInWidget){const w=new ListWidget();w.backgroundColor=new Color('#121821');w.setPadding(12,12,12,12);txt(w,'Rankings unavailable',13,ink,true);txt(w,'Open settings to troubleshoot',9,muted);w.url=link('search','settings');Script.setWidget(w)}else await note('AI Radar error',String(e))}finally{Script.complete()}
