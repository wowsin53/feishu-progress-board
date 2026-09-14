import { app } from './app'
import { startReportScheduler } from './reports/scheduler'
const port=Number(process.env.PORT || 3001)
const server=app.listen(port,process.env.HOST || '127.0.0.1',()=>console.log(`Mission Control API: http://localhost:${port}`))

const stopReports=startReportScheduler()
const shutdown=()=>{stopReports();server.close(()=>process.exit(0));setTimeout(()=>process.exit(1),20000).unref()}
process.on('SIGTERM',shutdown)
process.on('SIGINT',shutdown)
