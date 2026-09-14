import 'dotenv/config'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { ReviewApi } from './feishu'
import { ReviewStore,ReviewWorker,type Baseline } from './worker'
if(process.env.REVIEW_ENABLED!=='true')throw new Error('REVIEW_DISABLED')
const baseline=JSON.parse(readFileSync(process.env.REVIEW_BASELINE_PATH||'data/review-baseline.json','utf8')) as Baseline
if(baseline.base!=='IPtmbKzAlalpS1sHv4Wc5YvhnHg'||baseline.table!=='tbl1uFSLHGgU3a4u')throw new Error('REVIEW_TARGET_MISMATCH')
const store=new ReviewStore(resolve(process.env.REVIEW_DB_PATH||'data/review.sqlite'))
const worker=new ReviewWorker(new ReviewApi(baseline.base,baseline.table),store,baseline)
let stopping=false,timer:ReturnType<typeof setTimeout>|undefined
async function loop(){try{await worker.tick()}catch{console.error(JSON.stringify({event:'task_review',state:'scan_failed'}))}finally{if(!stopping)timer=setTimeout(loop,15000)}}
console.log(JSON.stringify({event:'task_review_started',since:baseline.since,excluded:baseline.recordIds.length,intervalSeconds:15}))
void loop()
for(const signal of ['SIGTERM','SIGINT']as const)process.on(signal,()=>{stopping=true;if(timer)clearTimeout(timer)})
