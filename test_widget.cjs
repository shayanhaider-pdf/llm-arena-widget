// Regression suite for the actual Scriptable source; no Apple runtime or network.
const fs=require('node:fs');
const assert=require('node:assert/strict');
const source=fs.readFileSync(__dirname+'/AI-Radar.js','utf8');
const AsyncFunction=Object.getPrototypeOf(async function(){}).constructor;
const today=new Date().toISOString().slice(0,10);
const prev=new Date();prev.setUTCDate(1);prev.setUTCMonth(prev.getUTCMonth()-1);const past=prev.toISOString().slice(0,10);
const reg={schemaVersion:1,reviewedAt:today,providers:[{provider:'Qwen',url:'https://chat.qwen.ai/',source:'https://qwen.ai/',models:[{id:'Qwen3.8-Max',status:'free'}]},{provider:'OpenAI',url:'https://chatgpt.com/',source:'https://help.openai.com/',models:[{id:'GPT-6.2 Sol',status:'plus_candidate'}]}]};
let count=0;
function check(value,msg){assert.ok(value,msg);count++}
class Stack{
  constructor(){this.children=[]}
  addText(value){assert.equal(typeof value,'string');const t={value};this.children.push(t);return t}
  addStack(){const s=new Stack;this.children.push(s);return s}
  addImage(image){const i={image};this.children.push(i);return i}
  addSpacer(n){this.children.push({spacer:n??0})}setPadding(...p){this.padding=p}centerAlignContent(){}layoutVertically(){this.vertical=true}
}
const group={date:today,observed:today,models:[{id:'B',rank:2},{id:'A',rank:1},{id:'C',rank:3}],history:{[past]:{a:2,b:2,c:1},[today]:{a:1,b:2,c:3}}};
const fixture={subsets:{search:{checked:today,groups:{overall:group}},text_style_control:{checked:today,groups:{hard_6:group}}}};
const flat=w=>[w,...(w.children||[]).flatMap(flat)];
async function run({family='small',param='search',feed=fixture,registry=reg,stored={},app=false,query={},selection=-1,choices=[],screen={width:393,height:852}}={}){
  let result=null,requests=0,completed=false,tableRows=[],opened=[],alerts=[];const logs=[],files={...stored};
  const env={FileManager:{local:()=>({documentsDirectory:()=>'/d',joinPath:(a,b)=>a+'/'+b,fileExists:p=>p in files,createDirectory(){},readString:p=>{if(!(p in files))throw Error('missing');return files[p]},writeString:(p,v)=>{files[p]=v}})},Request:class{constructor(url){this.url=url;requests++;this.response={statusCode:200}}async loadJSON(){const v=this.url.includes('/access.json')?registry:feed;if(v===null)throw Error('offline');return v}},ListWidget:Stack,Color:class{},Size:class{constructor(width,height){this.width=width;this.height=height}},SFSymbol:{named:name=>({image:{symbol:name}})},Device:{screenSize:()=>screen},DrawContext:class{addPath(){}setStrokeColor(){}setLineWidth(){}strokePath(){}getImage(){return {chart:true}}},Path:class{move(){}addLine(){}},Point:class{},Font:{systemFont:n=>n,semiboldSystemFont:n=>n},Script:{name:()=>'AI Radar',setWidget:w=>{result=w},complete:()=>{completed=true}},config:{runsInWidget:!app,widgetFamily:family},args:{widgetParameter:param,queryParameters:query},console:{log:v=>logs.push(v)},UITable:class{addRow(r){tableRows.push(r)}async present(){if(selection>=0)tableRows[selection]?.onSelect?.()}},UITableRow:class{addText(title,subtitle){this.title=title;this.subtitle=subtitle}},Safari:{open:url=>opened.push(url)},Alert:class{addAction(){}addCancelAction(){}addTextField(){}textFieldValue(){return ''}async presentSheet(){alerts.push(this.title);return choices.length?choices.shift():-1}async presentAlert(){alerts.push(this.title);return 0}}};
  await new AsyncFunction(...Object.keys(env),source)(...Object.values(env));return {result,requests,completed,logs,files,tableRows,opened,alerts};
}
(async()=>{
  for(const family of ['small','medium','large']){
    const r=await run({family,stored:{'/d/AI-Radar/settings.json':JSON.stringify({large:['search'],largeCustomized:true,registry:{b:{plus:true,url:'https://example.com/b'},c:{free:true,url:'https://example.com/c'}}})}});
    check(r.completed&&r.result,family+' render');check(r.requests===2,'bounded requests');
    const cells=flat(r.result);
    for(const name of ['A','B','C'])check(cells.some(x=>x.value===name),'winner '+name);
    check(!cells.some(x=>x.value==='AI Radar'),'no branding');
    check(family==='small'||cells.some(x=>x.url==='https://arena.ai/'),'unknown provider fallback');
    check(!cells.some(x=>['↑','−','↓','Snapshot','Cached','Access unknown'].includes(x.value)),'no trend arrows or status footer');check(family==='medium'?cells.some(x=>x.image?.chart):!cells.some(x=>x.image?.chart),'real chart only in medium');
  }
  const cold=await run({feed:null});check(cold.completed&&flat(cold.result).some(x=>x.value==='–')&&!flat(cold.result).some(x=>x.value==='A'),'cold offline');check(cold.requests===2,'cold request limit');
  const good=await run();const offline=await run({feed:null,stored:good.files});check(flat(offline.result).some(x=>x.value==='A'),'offline cache');
  const broken=await run({feed:{subsets:null},stored:{'/d/AI-Radar/settings.json':'null','/d/AI-Radar/monthly-cache.json':'[]'}});check(broken.completed&&broken.result,'corrupt settings');
  const reason=await run({param:'reasoning'});check(flat(reason.result).some(x=>x.value==='A'),'hard_6 resolves');
  const app=await run({app:true});check(app.completed,'first app launch');
  const invalid=await run({param:'coding,math'});check(flat(invalid.result).some(x=>x.value==='Search'),'excluded categories fallback');
  const unconfirmed=await run();check(flat(unconfirmed.result).filter(x=>x.value==='–').length===4,'no invented access');
  const offline2=await run({feed:null,registry:null,stored:good.files});check(offline2.requests===0,'no unnecessary same-day requests');
  const changed=await run({family:'medium',feed:{subsets:{search:{checked:today,groups:{overall:{...group,models:[{id:'New monthly model',rank:1}]}}}}},stored:{...good.files,'/d/AI-Radar/monthly-sync.json':'{}'}});check(flat(changed.result).some(x=>x.value==='New monthly model'),'data update with unchanged code');
  const names=['GPT-6.2 Sol','Claude Opus 5','Gemini 4 Carbon','Qwen3.8-Max','DeepSeek V4','Grok 4.5','Mistral Large','Kimi K3','GLM-5.1','Amazon-Web-Search-Agent'];
  const expected=['https://chatgpt.com/','https://claude.ai/new','https://gemini.google.com/','https://chat.qwen.ai/','https://chat.deepseek.com/','https://grok.com/','https://chat.mistral.ai/','https://www.kimi.com/','https://chat.z.ai/','https://arena.ai/'];
  for(let i=0;i<names.length;i++){
    const model=names[i],g={date:today,observed:today,models:[{id:model,rank:1}],history:{}};
    const f={subsets:{search:{checked:today,groups:{overall:g}}}};
    const r=await run({family:'medium',feed:f,stored:{'/d/AI-Radar/settings.json':JSON.stringify({registry:{[model.toLowerCase()]:{plus:true,name:'Custom name',url:'https://example.com/old'}}})}});
    check(flat(r.result).some(x=>x.url===expected[i]),'provider '+model);
    check(!flat(r.result).some(x=>x.url==='https://example.com/old'),'ignore old URL '+model);
  }
  const accessFeed={subsets:{search:{checked:today,groups:{overall:{date:today,observed:today,models:[{id:'GPT-6.2 Sol',rank:1},{id:'Qwen3.8-Max',rank:2}],history:{}}}}}};
  const access=await run({family:'medium',feed:accessFeed});
  check(flat(access.result).some(x=>x.value==='#1?'),'unconfirmed OpenAI is marked');
  check(flat(access.result).some(x=>x.value==='Qwen 3.8-Max'),'user-confirmed free model preselected');
  const paid={...reg,providers:[{provider:'Qwen',url:'https://chat.qwen.ai/',source:'https://qwen.ai/',models:[{id:'Qwen3.8-Max',status:'unverified'}]}]};const removed=await run({family:'medium',feed:accessFeed,registry:paid});check(flat(removed.result).filter(x=>x.value==='Qwen 3.8-Max').length===0,'free removed by updated registry'); 
  const warm={...good.files,'/d/AI-Radar/monthly-sync.json':'{}'};
  for(const models of [[{id:'Invalid',rank:2}],[{id:'Duplicate',rank:1},{id:'duplicate',rank:2}],[{id:'__proto__',rank:1}]]){
    const bad=await run({feed:{subsets:{search:{checked:today,groups:{overall:{...group,models}}}}},stored:warm});
    check(flat(bad.result).some(x=>x.value==='A'),'reject malformed replacement');
  }
  const badDate=await run({feed:{subsets:{search:{checked:today,groups:{overall:{...group,date:'2026-02-30',models:[{id:'Bad date',rank:1}]}}}}},stored:warm});
  check(flat(badDate.result).some(x=>x.value==='A'),'invalid calendar date rejected');
  const partial=await run({feed:{subsets:{search:{checked:today,groups:{overall:{...group,partial:true,models:[{id:'Partial',rank:1}]}}}}},stored:warm});
  check(flat(partial.result).some(x=>x.value==='A'),'partial cannot replace complete same-date group');
  const wrongScope=await run({family:'medium',param:'work',feed:{subsets:{agent_capability:{checked:today,groups:{work:{...group,models:[{id:'GPT-6.2 Sol',rank:1},{id:'Qwen3.8-Max',rank:2}]}}}}}});
  check(flat(wrongScope.result).filter(x=>x.value==='–').length===4,'chat access not treated as work access');
  const duplicateReg={...reg,providers:[...reg.providers,reg.providers[0]]};
  const badReg=await run({family:'medium',feed:accessFeed,registry:duplicateReg});
  check(flat(badReg.result).filter(x=>x.value==='–').length===4,'reject duplicate registry entries');
  const expired={...reg,providers:[{...reg.providers[0],models:[{id:'Qwen3.8-Max',status:'free',expiresAt:today}]}]};
  const expiredResult=await run({family:'medium',feed:accessFeed,registry:expired});
  check(flat(expiredResult.result).filter(x=>x.value==='–').length===4,'expired access excluded');
  const stale={...reg,reviewedAt:'2020-01-01'};
  const staleResult=await run({family:'medium',feed:accessFeed,registry:stale});
  check(flat(staleResult.result).filter(x=>x.value==='–').length===4,'stale access excluded');
  const refreshError=await run({feed:fixture,registry:null,app:true,choices:[5]});
  check(refreshError.logs.some(x=>x.includes('Access:')),'manual refresh surfaces registry failure');
  const corruptWarm={...good.files,'/d/AI-Radar/monthly-cache.json':'{"search":{"groups":{"overall":{}}}}'};
  const repaired=await run({stored:corruptWarm});
  check(repaired.requests===1&&flat(repaired.result).some(x=>x.value==='A'),'corrupt same-day cache refetched');
  const production=JSON.parse(fs.readFileSync(__dirname+'/data/widget.json','utf8'));
  const productionRegistry=JSON.parse(fs.readFileSync(__dirname+'/data/access.json','utf8'));
  const categories=['work','search','reasoning','writing','vision','documents','text','webdev','image','editing','video','agent','imagevideo','videoedit','steering','instruction','chatagent'];
  for(const param of categories){
    const r=await run({family:'medium',param,feed:production,registry:productionRegistry});
    check(r.completed&&r.result&&flat(r.result).some(x=>x.value==='#1')&&!flat(r.result).some(x=>x.value==='Rankings unavailable'),'production group '+param);
    const detail=await run({app:true,query:{category:param},feed:production,registry:productionRegistry});
    const expected=param==='videoedit'?Math.min(20,production.subsets.video_edit.groups.overall.models.length):20;
    check(detail.tableRows.filter(row=>/^#\d+ /.test(row.title)).length===expected,'top rows '+param);
  }
  const tapped=await run({app:true,query:{category:'search'},feed:accessFeed,selection:3});
  check(tapped.opened.length===1&&tapped.opened[0]==='https://chatgpt.com/'&&tapped.completed,'native-style table action executed before completion');
  const large=await run({family:'large',param:'',feed:production,registry:productionRegistry});
  const titles=flat(large.result).filter(x=>['Work capability','Overall text','Documents','Search','Images'].includes(x.value)).map(x=>x.value);
  check(titles.join(',')==='Work capability,Overall text,Documents,Search,Images','default five category order');
  check(!flat(large.result).some(x=>x.image?.chart||x.value==='AI Radar'),'large has no charts or branding');
  const reordered=await run({app:true,choices:[2,0,1,7]});
  const custom=JSON.parse(reordered.files['/d/AI-Radar/settings.json']);
  check(custom.largeCustomized&&custom.large.join(',')==='text,work,documents,search,image','row editor moves and saves');
  const replaced=await run({app:true,choices:[2,4,2,0,7]});
  const replacedSettings=JSON.parse(replaced.files['/d/AI-Radar/settings.json']);
  check(replacedSettings.large.join(',')==='work,text,documents,search,reasoning','row editor replaces category without duplicates');
  const cancelled=await run({app:true,choices:[2,0,1,-1]});
  check(!cancelled.files['/d/AI-Radar/settings.json'],'cancel does not persist changes');
  const customWidget=await run({family:'large',param:'search,work,text,vision,documents',feed:production,registry:productionRegistry,stored:reordered.files});
  check(flat(customWidget.result).find(x=>['Work capability','Overall text'].includes(x.value)).value==='Overall text','saved row order supersedes old parameter');
  const dimensions=[[320,568,141,292,311],[393,852,158,338,354],[430,932,170,364,382]];
  for(const [sw,sh,sm,wide,tall] of dimensions)for(const family of ['small','medium','large']){
    const r=await run({family,param:'',screen:{width:sw,height:sh},feed:production,registry:productionRegistry});
    const width=family==='small'?sm:wide,height=family==='large'?tall:sm,pad=family==='small'?8:10;
    const nodes=flat(r.result);
    check(r.completed&&r.result&&nodes.some(x=>x.value==='#1'),'render '+family+' '+sw);
    check(nodes.filter(x=>x.size).every(x=>x.size.width<=width-2*pad&&x.size.height<=height-2*pad),'individual panel bounds '+family+' '+sw);
    const rowWidths=r.result.children.filter(x=>x.children&&!x.vertical).map(row=>row.children.reduce((sum,c)=>sum+(c.size?.width||c.spacer||0),0)+(row.spacing||0)*Math.max(0,row.children.length-1));
    check(rowWidths.every(w=>w<=width-2*pad),'row widths '+family+' '+sw);
  }
  const workTest=await run({family:'medium',param:'work',feed:production,registry:productionRegistry});
  check(flat(workTest.result).some(x=>x.url==='https://chatgpt.com/work/'),'work opens Work');
  const codeTest=await run({family:'medium',param:'webdev',feed:production,registry:productionRegistry});
  check(flat(codeTest.result).some(x=>x.url==='https://chatgpt.com/codex/'),'coding opens Codex');
  const imageTest=await run({family:'medium',param:'image',feed:production,registry:productionRegistry});
  check(flat(imageTest.result).filter(x=>x.value==='#2?').length===2,'image family marked uncertain in both columns');
  console.log(count+' assertions passed');
})().catch(e=>{console.error(e);process.exitCode=1});
