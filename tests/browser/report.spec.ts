import {test,expect} from '@playwright/test'
import {createMockDashboard} from '../../src/mock/dashboard'
test('未填写截止日期单独警告，四个区域固定且不撑高页面',async({page})=>{
  const data=createMockDashboard();data.source='feishu';data.checkInSource='mock'
  const base={...data.tasks[0]!,status:'进行中' as const}
  data.tasks=[{...base,id:'missing',title:'缺日期任务',deadline:undefined}, {...base,id:'overdue',title:'真正逾期任务',deadline:new Date(Date.now()-86400000).toISOString()}, {...base,id:'upcoming',title:'即将到期任务',deadline:new Date(Date.now()+3600000).toISOString()}, {...base,id:'done',title:'完成无日期',status:'已完成',deadline:undefined}]
  await page.route('**/api/dashboard',r=>r.fulfill({json:data}))
  await page.setViewportSize({width:1920,height:1080});await page.goto('/')
  await expect(page.locator('.wall-missing-deadlines .wall-deadline-row')).toHaveCount(1)
  await expect(page.locator('.wall-missing-deadlines')).toContainText('缺日期任务')
  const overdue=page.getByRole('region',{name:'逾期任务自动滚动',exact:true})
  await expect(overdue).toContainText('真正逾期任务');await expect(overdue).not.toContainText('缺日期任务')
  await expect(page.getByRole('region',{name:'即将到期任务自动滚动',exact:true})).toContainText('即将到期任务')
  const titles=await page.locator('.wall-alerts > section .wall-panel-title h2').allTextContents()
  expect(titles.map(t=>t.trim())).toEqual(['今日未打卡 虚拟数据','逾期任务','未填写截止日期','即将到期'])
  expect(await page.evaluate(()=>document.documentElement.scrollHeight<=innerHeight && document.documentElement.scrollWidth<=innerWidth)).toBe(true)
  const box=await page.locator('.wall-alerts').boundingBox();expect(box!.y+box!.height).toBeLessThanOrEqual(1080)
})
test('管理员页面仅点击发送才调用发送接口，令牌不持久化',async({page})=>{
  let sends=0
  await page.route('**/api/admin/reports/**',route=>{
    const path=new URL(route.request().url()).pathname.split('/').pop()
    if(path==='send'){sends++;return route.fulfill({json:{status:'sent'}})}
    return route.fulfill({json:path==='status'?{time:'00:30',enabled:true,webhookConfigured:true}:path==='history'?{records:[]}:{text:'真实数据日报预览'}})
  })
  await page.goto('/?view=admin')
  await expect(page.getByRole('button',{name:'立即发送前一日任务日报',exact:true})).toBeDisabled()
  await page.getByPlaceholder('输入服务器 ADMIN_REPORT_TOKEN').fill('test-only-token')
  await page.getByRole('button',{name:'读取配置并预览前一日日报'}).click()
  await expect(page.locator('pre')).toContainText('真实数据日报预览');expect(sends).toBe(0)
  await page.getByRole('button',{name:'立即发送前一日任务日报',exact:true}).click()
  await expect(page.getByRole('status')).toHaveText('日报已发送。');expect(sends).toBe(1)
  expect(await page.evaluate(()=>JSON.stringify(localStorage)+JSON.stringify(sessionStorage))).not.toContain('test-only-token')
})
