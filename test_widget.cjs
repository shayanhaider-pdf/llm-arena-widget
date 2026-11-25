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
  async presentSmall(){this.presented='small'}async presentMedium(){this.presented='medium'}async presentLarge(){this.presented='large'}
  addSpacer(n){this.children.push({spacer:n??0})}setPadding(...p){this.padding=p}centerAlignContent(){}layoutVertically(){this.vertical=true}
}
const group={date:today,observed:today,models:[{id:'B',rank:2},{id:'A',rank:1},{id:'C',rank:3}],history:{[past]:{a:2,b:2,c:1},[today]:{a:1,b:2,c:3}}};
const fixture={subsets:{search:{checked:today,groups:{overall:group}},text_style_control:{checked:today,groups:{hard_6:group}}}};
const flat=w=>[w,...(w.children||[]).flatMap(flat)];
async function run({family='small',param='search',feed=fixture,registry=reg,stored={},app=false,query={},selection=-1,choices=[],screen={width:393,height:852}}={}){
  let result=null,requests=0,completed=false,tableRows=[],opened=[],alerts=[],menus=[],previews=[];const logs=[],files={...stored};
  const env={FileManager:{local:()=>({documentsDirectory:()=>'/d',joinPath:(a,b)=>a+'/'+b,fileExists:p=>p in files,createDirectory(){},readString:p=>{if(!(p in files))throw Error('missing');return files[p]},writeString:(p,v)=>{files[p]=v}})},Request:class{constructor(url){this.url=url;requests++;this.response={statusCode:200}}async loadJSON(){const v=this.url.includes('/access.json')?registry:feed;if(v===null)throw Error('offline');return v}},ListWidget:class extends Stack{constructor(){super();this.vertical=true;previews.push(this)}},Color:class{},Size:class{constructor(width,height){this.width=width;this.height=height}},SFSymbol:{named:name=>({image:{symbol:name}})},Device:{screenSize:()=>screen},DrawContext:class{addPath(){}setStrokeColor(){}setLineWidth(){}strokePath(){}getImage(){return {chart:true}}},Path:class{move(){}addLine(){}},Point:class{},Font:{systemFont:n=>n,semiboldSystemFont:n=>n},Script:{name:()=>'AI Radar',setWidget:w=>{result=w},complete:()=>{completed=true}},config:{runsInWidget:!app,widgetFamily:family},args:{widgetParameter:param,queryParameters:query},console:{log:v=>logs.push(v)},UITable:class{addRow(r){tableRows.push(r)}async present(){if(selection>=0)tableRows[selection]?.onSelect?.()}},UITableRow:class{addText(title,subtitle){this.title=title;this.subtitle=subtitle}},Safari:{open:url=>opened.push(url)},Alert:class{constructor(){this.options=[]}addAction(x){this.options.push(x)}addCancelAction(){}addTextField(){}textFieldValue(){return ''}async presentSheet(){alerts.push(this.title);menus.push({title:this.title,options:this.options.slice()});return choices.length?choices.shift():-1}async presentAlert(){alerts.push(this.title);return 0}}};
  await new AsyncFunction(...Object.keys(env),source)(...Object.values(env));return {result,requests,completed,logs,files,tableRows,opened,alerts,menus,previews};
}
(async()=>{
  for(const family of ['small','medium','large']){
    const r=await run({family,stored:{'/d/AI-Radar/settings.json':JSON.stringify({cardAppearance:'graphite',large:['search'],largeCustomized:true,registry:{b:{plus:true,url:'https://example.com/b'},c:{free:true,url:'https://example.com/c'}}})}});
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
  const invalid=await run({param:'math,invalid'});check(flat(invalid.result).some(x=>x.value==='Search'),'invalid category fallback');
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
  const categories=['agent','alignment','work','coding','chatagent','taskoutcome','steering','tooluse','text','search','vision','documents','webdev','imagewebdev','image','editing','multiedit','video','imagevideo','videoedit','reasoning','writing','instruction'];
  for(const param of categories){
    const r=await run({family:'medium',param,feed:production,registry:productionRegistry});
    check(r.completed&&r.result&&flat(r.result).some(x=>x.value==='#1')&&!flat(r.result).some(x=>x.value==='Rankings unavailable'),'production group '+param);
    const detail=await run({app:true,query:{category:param},feed:production,registry:productionRegistry});
    const expected=param==='alignment'?Math.min(20,production.subsets.agent_alignment.groups.overall.models.length):param==='videoedit'?Math.min(20,production.subsets.video_edit.groups.overall.models.length):20;
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
  const replaced=await run({app:true,choices:[2,4,2,0,0,7]});
  const replacedSettings=JSON.parse(replaced.files['/d/AI-Radar/settings.json']);
  check(replacedSettings.large.join(',')==='work,text,documents,search,agent','row editor replaces category without duplicates');
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
  // Verify every category on each tested device width, not just the default Search row.
  const configured=source.slice(source.indexOf('const C=')+8,source.indexOf('const categorySections=')).trim().replace(/;$/,'');
  const mapping=JSON.parse(configured);
  check(Object.keys(mapping).length===23,'exact 23 configured categories');
  const sections=new Set();
  const rootBudget=(w,width,height,pad)=>{
    const nodes=flat(w),innerWidth=width-pad*2,innerHeight=height-pad*2;
    const usedHeight=w.children.reduce((sum,c)=>sum+(c.size?.height||c.spacer||(c.children?.length?Math.max(0,...c.children.map(x=>x.size?.height||0)):0)),0);
    check(usedHeight<=innerHeight,'total vertical layout budget');
    for(const node of nodes){
      if(!node.size||!node.children)continue;
      const [top=0,left=0,bottom=0,right=0]=node.padding||[];
      if(node.size.width>0&&!node.vertical){
        const widthUsed=node.children.reduce((sum,c)=>sum+(c.size?.width||c.imageSize?.width||c.spacer||0),0)+(node.spacing||0)*Math.max(0,node.children.length-1);
        check(widthUsed<=node.size.width-left-right+.01,'nested horizontal budget');
      }
      if(node.size.height>0&&node.vertical){
        const fixed=node.children.reduce((sum,c)=>sum+(c.size?.height||c.imageSize?.height||c.spacer||0),0)+(node.spacing||0)*Math.max(0,node.children.length-1);
        check(fixed<=node.size.height-top-bottom+.01,'nested vertical budget');
      }
      check(node.size.width<=innerWidth&&node.size.height<=innerHeight,'panel within root');
    }
  };
  for(const [sw,sh,sm,wide,tall] of dimensions){
    for(const param of categories)for(const family of ['small','medium']){
      const runResult=await run({family,param,screen:{width:sw,height:sh},feed:production,registry:productionRegistry});
      const [subset,category]=mapping[param][1].split(':');
      const expected=production.subsets[subset].groups[category].models.slice().sort((a,b)=>a.rank-b.rank||a.id.localeCompare(b.id))[0];
      const display=expected.id.replace(/^Amazon-Web-Search-Agent$/i,'Amazon Web Search').replace(/Qwen(\d)/i,'Qwen $1').replace(/\s*\(([^)]+)\)/g,' $1');
      check(runResult.completed&&flat(runResult.result).some(x=>x.value===display),'actual frontier '+param+' '+family+' '+sw);
      rootBudget(runResult.result,family==='small'?sm:wide,sm,family==='small'?8:10);
    }
    for(let offset=0;offset<categories.length;offset+=5){
      const list=categories.slice(offset,offset+5);
      const r=await run({family:'large',screen:{width:sw,height:sh},feed:production,registry:productionRegistry,stored:{'/d/AI-Radar/settings.json':JSON.stringify({large:list,largeCustomized:true})}});
      check(r.completed&&flat(r.result).filter(x=>x.value==='#1').length>=list.length,'large renders custom group '+offset+' '+sw);
      check(!flat(r.result).some(x=>x.image?.chart||x.value==='AI Radar'),'large remains graph-free');
      rootBudget(r.result,wide,tall,10);
    }
  }
  // Browse and choose across every section; verify each detail screen uses its selected category.
  const sectionKeys=[['agent','alignment','work','coding','chatagent','taskoutcome','steering','tooluse'],['text','search','vision','documents'],['webdev','imagewebdev'],['image','editing','multiedit'],['video','imagevideo','videoedit'],['reasoning','writing','instruction']];
  for(let i=0;i<sectionKeys.length;i++)for(let j=0;j<sectionKeys[i].length;j++){
    const k=sectionKeys[i][j];sections.add(k);
    const r=await run({app:true,choices:[0,i,j],feed:production,registry:productionRegistry});
    check(r.tableRows[0]?.title.startsWith(mapping[k][0]+' · Top '),'grouped picker '+k);
  }
  check(sections.size===23,'all categories reachable through grouped settings');
  for(const [family,i] of [['small',0],['medium',1],['large',2]]){
    const r=await run({app:true,choices:family==='large'?[7,i]:[7,i,1,1],feed:production,registry:productionRegistry});
    check(r.completed&&r.previews.some(w=>w.presented===family),'native preview route '+family);
  }
  const routes={imagewebdev:'https://arena.ai/leaderboard/code/image-to-webdev',multiedit:'https://arena.ai/leaderboard/image/image-edit/multi-image',editing:'https://arena.ai/leaderboard/image/image-edit/single-image',video:'https://arena.ai/leaderboard/video/text-to-video',imagevideo:'https://arena.ai/leaderboard/video/image-to-video',videoedit:'https://arena.ai/leaderboard/video/video-edit',image:'https://arena.ai/leaderboard/image/text-to-image'};
  for(const [category,url] of Object.entries(routes)){
    const r=await run({app:true,query:{category},selection:1,feed:production,registry:productionRegistry});
    check(r.opened[0]===url,'exact leaderboard link '+category);
  }
  // Accented iOS rendering can replace opaque internal backgrounds with white.
  // Check the tree for the offending fills, not just the presence of text nodes.
  for(const family of ['small','medium','large']){
    const safe=await run({family,param:'search',feed:production,registry:productionRegistry});
    check(safe.completed&&safe.result,'glass-safe default renders '+family);
    check(flat(safe.result).slice(1).every(n=>!n.backgroundColor&&!n.borderColor&&!n.backgroundImage&&!n.backgroundGradient),'no opaque internal fills '+family);
    check(flat(safe.result).some(n=>n.value==='#1'),'ranking retained '+family);
    check(!flat(safe.result).some(n=>n.image?.chart),'no opaque chart risk '+family);
    const full=await run({family,param:'search',feed:production,registry:productionRegistry,stored:{'/d/AI-Radar/settings.json':JSON.stringify({cardAppearance:'graphite'})}});
    check(flat(full.result).slice(1).some(n=>n.backgroundColor),'opt-in original cards '+family);
    check(flat(full.result).some(n=>n.value==='#1'),'full-colour rank retained '+family);
    check(JSON.stringify(flat(safe.result).filter(n=>n.url).map(n=>n.url))===JSON.stringify(flat(full.result).filter(n=>n.url).map(n=>n.url)),'tap targets unchanged '+family);
  }
  const graphite=await run({app:true,choices:[8,1],stored:reordered.files});
  const gs=JSON.parse(graphite.files['/d/AI-Radar/settings.json']);
  check(gs.cardAppearance==='graphite'&&gs.large.join(',')==='text,work,documents,search,image','appearance switch preserves preferences');
  const glass=await run({app:true,choices:[8,0],stored:graphite.files});
  check(JSON.parse(glass.files['/d/AI-Radar/settings.json']).cardAppearance==='glass','return to glass-safe mode');
  const noChange=await run({app:true,choices:[8,-1],stored:graphite.files});
  check(noChange.files['/d/AI-Radar/settings.json']===graphite.files['/d/AI-Radar/settings.json'],'cancel appearance unchanged');
  // Category selection has a distinct persisted profile for each size and slot.
  const prefs='/d/AI-Radar/widget-categories.json';
  const q=(family,slot,mode='settings')=>({family,slot,mode,category:'search'});
  const pickSmall=await run({app:true,query:q('small','default'),choices:[9,0,2],feed:production,registry:productionRegistry,stored:graphite.files});
  check(JSON.parse(pickSmall.files[prefs]).small.default==='work','small picker saves work');
  check(pickSmall.files['/d/AI-Radar/settings.json']===graphite.files['/d/AI-Radar/settings.json'],'picker preserves existing settings');
  const smallSelected=await run({family:'small',param:'',stored:pickSmall.files,feed:production,registry:productionRegistry});
  check(flat(smallSelected.result).some(x=>x.value==='Work'),'blank small uses saved category');
  check(smallSelected.result.url.includes('family=small&slot=default'),'small deep link carries profile');
  const mediumUnchanged=await run({family:'medium',param:'',stored:pickSmall.files,feed:production,registry:productionRegistry});
  check(flat(mediumUnchanged.result).some(x=>x.value==='Search'),'medium independent from small');
  const pickMedium=await run({app:true,choices:[9,1,0,1,3],stored:pickSmall.files});
  check(JSON.parse(pickMedium.files[prefs]).medium.default==='documents','standalone settings selects medium');
  const mediumSelected=await run({family:'medium',param:'',stored:pickMedium.files,feed:production,registry:productionRegistry});
  check(flat(mediumSelected.result).some(x=>x.value==='Documents'),'medium saved category');
  check(flat(mediumSelected.result).some(x=>x.url?.includes('mode=settings&family=medium&slot=default')),'medium gear carries profile');
  const slot2=await run({app:true,query:q('small','slot:2'),choices:[9,3,0],stored:pickMedium.files});
  const selectedSlot=await run({family:'small',param:'slot:2',stored:slot2.files,feed:production,registry:productionRegistry});
  check(flat(selectedSlot.result).some(x=>x.value==='Text to image'),'named slot category');
  check(selectedSlot.result.url.includes('slot=slot%3A2'),'named slot identity encoded');
  const originalSlot=await run({family:'small',param:'',stored:slot2.files,feed:production,registry:productionRegistry});
  check(flat(originalSlot.result).some(x=>x.value==='Work'),'slot does not change default');
  const pinned=await run({family:'small',param:'vision',stored:slot2.files,feed:production,registry:productionRegistry});
  check(flat(pinned.result).some(x=>x.value==='Vision'),'legacy parameter remains pinned');
  const fixed=await run({app:true,query:q('small','fixed:vision'),choices:[9],stored:slot2.files});
  check(fixed.alerts.includes('Fixed widget parameter')&&fixed.files[prefs]===slot2.files[prefs],'fixed parameter explains migration without changing settings');
  const cancelPicker=await run({app:true,query:q('small','default'),choices:[9,-1],stored:slot2.files});
  check(cancelPicker.files[prefs]===slot2.files[prefs],'cancel does not overwrite selection');
  const tappedPicker=await run({app:true,query:q('small','default','details'),selection:3,choices:[1,2],stored:slot2.files,feed:production,registry:productionRegistry});
  check(JSON.parse(tappedPicker.files[prefs]).small.default==='vision','small detail change-category action saves selected category');
  const staleLink=await run({app:true,query:q('small','default','details'),stored:tappedPicker.files,feed:production,registry:productionRegistry});
  check(staleLink.tableRows[0]?.title.startsWith('Vision · Top '),'stale widget link resolves current category');
  const corrupted=await run({family:'small',param:'',stored:{[prefs]:'{"small":{"default":"constructor"}}'},feed:production,registry:productionRegistry});
  check(flat(corrupted.result).some(x=>x.value==='Search'),'corrupted category preference safely falls back');
  const malicious=await run({app:true,query:q('large','__proto__'),choices:[9,-1],stored:slot2.files});
  check(malicious.files[prefs]===slot2.files[prefs],'invalid profile cannot overwrite preferences');
  for(const family of ['small','medium'])for(let i=0;i<sectionKeys.length;i++)for(let j=0;j<sectionKeys[i].length;j++){
    const k=sectionKeys[i][j];
    const saved=await run({app:true,query:q(family,'default'),choices:[9,i,j]});
    check(JSON.parse(saved.files[prefs])[family].default===k,'picker supports '+family+' '+k);
    const rendered=await run({family,param:'',stored:saved.files,feed:production,registry:productionRegistry});
    check(rendered.completed&&flat(rendered.result).some(x=>x.value==='#1'),'saved category renders '+family+' '+k);
  }
  console.log(count+' assertions passed');
})().catch(e=>{console.error(e);process.exitCode=1});
