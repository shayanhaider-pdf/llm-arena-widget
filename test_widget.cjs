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
  addSpacer(){}setPadding(){}centerAlignContent(){}layoutVertically(){}
}
const group={date:today,observed:today,models:[{id:'B',rank:2},{id:'A',rank:1},{id:'C',rank:3}],history:{[past]:{a:2,b:2,c:1}}};
const fixture={subsets:{search:{checked:today,groups:{overall:group}},text_style_control:{checked:today,groups:{hard_6:group}}}};
const flat=w=>[w,...(w.children||[]).flatMap(flat)];
async function run({family='small',param='search',feed=fixture,registry=reg,stored={},app=false}={}){
  let result=null,requests=0,completed=false;const logs=[],files={...stored};
  const env={FileManager:{local:()=>({documentsDirectory:()=>'/d',joinPath:(a,b)=>a+'/'+b,fileExists:p=>p in files,createDirectory(){},readString:p=>{if(!(p in files))throw Error('missing');return files[p]},writeString:(p,v)=>{files[p]=v}})},Request:class{constructor(url){this.url=url;requests++;this.response={statusCode:200}}async loadJSON(){const v=this.url.includes('/access.json')?registry:feed;if(v===null)throw Error('offline');return v}},ListWidget:Stack,Color:class{},Size:class{},Font:{systemFont:n=>n,semiboldSystemFont:n=>n},Script:{name:()=>'AI Radar',setWidget:w=>{result=w},complete:()=>{completed=true}},config:{runsInWidget:!app,widgetFamily:family},args:{widgetParameter:param,queryParameters:{}},console:{log:v=>logs.push(v)},Alert:class{addAction(){}addCancelAction(){}async presentSheet(){return -1}async presentAlert(){return 0}}};
  await new AsyncFunction(...Object.keys(env),source)(...Object.values(env));return {result,requests,completed,logs,files};
}
(async()=>{
  for(const family of ['small','medium','large']){
    const r=await run({family,stored:{'/d/AI-Radar/settings.json':JSON.stringify({registry:{b:{plus:true,url:'https://example.com/b'},c:{free:true,url:'https://example.com/c'}}})}});
    check(r.completed&&r.result,family+' render');check(r.requests===2,'bounded requests');
    const cells=flat(r.result);
    for(const name of ['A','B','C'])check(cells.some(x=>x.value===name),'winner '+name);
    check(!cells.some(x=>x.value==='AI Radar'),'no branding');
    check(family==='small'||cells.some(x=>x.url==='https://arena.ai/'),'unknown provider fallback');
    check(family==='large'?['↑','−','↓'].every(v=>cells.some(x=>x.value===v)):!cells.some(x=>['↑','−','↓'].includes(x.value)),'monthly trend');
  }
  const cold=await run({feed:null});check(cold.completed&&flat(cold.result).some(x=>x.value==='Data unavailable · open settings'),'cold offline');check(cold.requests===2,'cold request limit');
  const good=await run();const offline=await run({feed:null,stored:good.files});check(flat(offline.result).some(x=>x.value==='A'),'offline cache');
  const broken=await run({feed:{subsets:null},stored:{'/d/AI-Radar/settings.json':'null','/d/AI-Radar/monthly-cache.json':'[]'}});check(broken.completed&&broken.result,'corrupt settings');
  const reason=await run({param:'reasoning'});check(flat(reason.result).some(x=>x.value==='A'),'hard_6 resolves');
  const app=await run({app:true});check(app.completed,'first app launch');
  const invalid=await run({param:'coding,math'});check(flat(invalid.result).some(x=>x.value==='Search'),'excluded categories fallback');
  const unconfirmed=await run();check(flat(unconfirmed.result).filter(x=>x.value==='Access unknown').length===2,'no invented access');
  const offline2=await run({feed:null,registry:null,stored:good.files});check(offline2.requests===0,'no unnecessary same-day requests');
  const changed=await run({family:'medium',feed:{subsets:{search:{checked:today,groups:{overall:{...group,models:[{id:'New monthly model',rank:1}]}}}}},stored:{...good.files,'/d/AI-Radar/monthly-sync.json':'{}'}});check(flat(changed.result).some(x=>x.value==='New monthly model'),'data update with unchanged code');
  const names=['GPT-6.2 Sol','Claude Opus 5','Gemini 4 Carbon','Qwen3.8-Max','DeepSeek V4','Grok 4.5','Mistral Large','Kimi K3','GLM-5.1','Amazon-Web-Search-Agent'];
  const expected=['https://chatgpt.com/','https://claude.ai/new','https://gemini.google.com/','https://chat.qwen.ai/','https://chat.deepseek.com/','https://grok.com/','https://chat.mistral.ai/','https://www.kimi.com/','https://z.ai/chat','https://arena.ai/'];
  for(let i=0;i<names.length;i++){
    const model=names[i],g={date:today,observed:today,models:[{id:model,rank:1}],history:{}};
    const f={subsets:{search:{checked:today,groups:{overall:g}}}};
    const r=await run({family:'medium',feed:f,stored:{'/d/AI-Radar/settings.json':JSON.stringify({registry:{[model.toLowerCase()]:{plus:true,name:'Custom name',url:'https://example.com/old'}}})}});
    check(flat(r.result).some(x=>x.url===expected[i]),'provider '+model);
    check(!flat(r.result).some(x=>x.url==='https://example.com/old'),'ignore old URL '+model);
  }
  const accessFeed={subsets:{search:{checked:today,groups:{overall:{date:today,observed:today,models:[{id:'GPT-6.2 Sol',rank:1},{id:'Qwen3.8-Max',rank:2}],history:{}}}}}};
  const access=await run({family:'medium',feed:accessFeed});
  check(flat(access.result).some(x=>x.value==='#1 · verify'),'unconfirmed OpenAI is marked');
  check(flat(access.result).some(x=>x.value==='Qwen3.8-Max'),'user-confirmed free model preselected');
  const paid={...reg,providers:[{provider:'Qwen',url:'https://chat.qwen.ai/',source:'https://qwen.ai/',models:[{id:'Qwen3.8-Max',status:'unverified'}]}]};const removed=await run({family:'medium',feed:accessFeed,registry:paid});check(flat(removed.result).filter(x=>x.value==='Qwen3.8-Max').length===0,'free removed by updated registry'); 
  console.log(count+' assertions passed');
})().catch(e=>{console.error(e);process.exitCode=1});
