import { createHash } from 'node:crypto'
export interface RawRecord { record_id:string; fields:Record<string,unknown> }
export const reviewFields={task:'任务描述',result:'最终效果',difficulty:'遇到的困难',solution:'解决措施'} as const
export function text(v:unknown):string { if(typeof v==='string')return v; if(Array.isArray(v))return v.map(x=>typeof x==='string'?x:x?.text||'').join('');return '' }
export function snapshot(r:RawRecord){return Object.fromEntries(Object.entries(reviewFields).map(([k,f])=>[k,text(r.fields[f]).replace(/\r\n/g,'\n')])) as Record<keyof typeof reviewFields,string>}
export function fingerprint(r:RawRecord){const fields=Object.fromEntries(Object.entries(r.fields).filter(([k])=>!['填写审核结果','审核提醒状态'].includes(k)).sort(([a],[b])=>a.localeCompare(b)));return createHash('sha256').update(JSON.stringify(fields)).digest('hex')}
export function linkedIds(v:unknown):string[]{if(!Array.isArray(v))return [];return v.flatMap(x=>typeof x==='string'?[x]:typeof x?.record_id==='string'?[x.record_id]:[])}
export interface Decision {version:1;verdict:'pass'|'reject'|'uncertain';snapshot:Record<string,string>;issues:{rule:string;field:string;evidence:string;suggestion:string}[];advice:string}
export function decisionFor(r:RawRecord):Decision|null {
  let d:Decision;try { d=JSON.parse(text(r.fields['填写审核结果']).replace(/^\s*```(?:json)?\s*|\s*```\s*$/g,'')) }catch{return null}
  if(d?.version!==1||!['pass','reject','uncertain'].includes(d.verdict)||!d.snapshot||!Array.isArray(d.issues)||typeof d.advice!=='string'||d.advice.length>4000)return null
  const actual=snapshot(r);for(const [k,v]of Object.entries(actual))if(d.snapshot[k]!==v)return null
  if(d.verdict==='reject'){
    if(!d.issues.length||d.issues.length>15)return null
    for(const i of d.issues){
      if(!i||!Object.hasOwn(actual,i.field)||!/^([12]-[1-4]|3-[2-5]|D-[1-3])$/.test(i.rule)||typeof i.suggestion!=='string'||!i.suggestion.trim()||i.suggestion.length>1000||typeof i.evidence!=='string')return null
      const original=actual[i.field as keyof typeof actual];if(original.trim()?(!i.evidence.trim()||!original.includes(i.evidence)):i.evidence!=='')return null
      if(['difficulty','solution'].includes(i.field)&&!actual.difficulty.trim())return null
    }
    if(!d.advice.trim())return null
  }
  return d
}
export function creator(r:RawRecord){const v=r.fields['填写人（系统）'];const a=Array.isArray(v)?v[0]:v;return a&&typeof a==='object'&&'id'in a&&typeof a.id==='string'&&/^ou_[a-zA-Z0-9]+$/.test(a.id)?{id:a.id,name:'name'in a&&typeof a.name==='string'?a.name:'填写人'}:null}
export function reminder(r:RawRecord,d:Decision){const c=creator(r);if(!c)throw new Error('CREATOR_UNKNOWN');const safe=(v:string)=>v.replace(/[<>]/g,'').slice(0,6000);return '【RoboMaster 新任务填写退回】\n<at user_id="'+c.id+'">'+safe(c.name)+'</at>\n任务：'+safe(snapshot(r).task)+'\n审核未通过，请按以下建议重新填写。系统核验内容未变化后将删除此行；删除前会保留备份。\n'+d.issues.map(i=>'• '+i.rule+'：'+safe(i.suggestion)).join('\n')+'\n'+safe(d.advice)+'\n填写入口：https://girtrobotlab.feishu.cn/base/IPtmbKzAlalpS1sHv4Wc5YvhnHg?table=tbl1uFSLHGgU3a4u'}
