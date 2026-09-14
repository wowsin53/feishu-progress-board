import { test, expect } from '@playwright/test'
import { createMockDashboard } from '../../src/mock/dashboard'
import { GROUPS } from '../../src/config/groups'

function crowded(){
  const data=createMockDashboard()
  data.source='feishu';data.checkInSource='mock'
  data.members.forEach((m,i)=>{m.group=i<6?'机械组':i<12?'电控组':GROUPS[(i-12)%3+2]!})
  const m=data.members[0]!
  data.tasks=Array.from({length:7},(_,i)=>({...data.tasks[0]!,id:'task-'+i,memberIds:[m.id],title:i===6?'不应在首页展示的完成详情':'当前任务'+i,status:i===6?'已完成' as const:'进行中' as const}))
  return data
}
test('1080p 和 4K 保持五组一行、三条任务上限及准确统计',async({page})=>{
  const data=crowded()
  data.tasks[0]!.category='其他任务';data.tasks[1]!.category='其他'
  await page.route('**/api/dashboard',r=>r.fulfill({json:data}))
  await page.setViewportSize({width:1920,height:1080});await page.goto('/')
  await expect(page.locator('.wall-lane')).toHaveCount(5)
  await expect(page.getByText('不应在首页展示的完成详情',{exact:false})).toHaveCount(0)
  const original=page.locator('.carousel-item:not(.carousel-copy) .wall-member')
  await expect(original).toHaveCount(16)
  await expect(original.first().locator('.task-line')).toHaveCount(3)
  await expect(original.first().locator('.task-category')).toHaveCount(2)
  await expect(original.first().locator('.task-category').first()).toContainText('联调任务')
  await expect(original.first().locator('.more-tasks')).toHaveText('+3 项任务')
  await expect(page.locator('.wall-stats .stat-card').nth(2).locator('.stat-main > strong')).toHaveText('06')
  for(const [width,height] of [[1920,1080],[3840,2160]]){
    await page.setViewportSize({width:width!,height:height!})
    await expect.poll(()=>page.locator('.wall-board').evaluate(e=>Math.round(e.getBoundingClientRect().width))).toBe(width)
    const rows=await page.locator('.wall-lane-title').evaluateAll(es=>es.map(e=>Math.round(e.getBoundingClientRect().top)))
    expect(new Set(rows).size).toBe(1)
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth && document.documentElement.scrollHeight<=innerHeight)).toBe(true)
  }
  await expect(page.locator('.wall-clock strong')).toBeVisible()
  await expect(page.locator('.wall-quote')).toContainText('RM DAILY')
  await expect(page.locator('.wall-completed')).toHaveCount(0)
})

test('独立轮播、悬停暂停、小组静止与无缝循环',async({page})=>{
  await page.clock.install()
  await page.route('**/api/dashboard',r=>r.fulfill({json:crowded()}))
  await page.setViewportSize({width:1920,height:1080});await page.goto('/')
  const mechanical=page.getByRole('region',{name:'机械组成员自动轮播',exact:true})
  const electronic=page.getByRole('region',{name:'电控组成员自动轮播',exact:true})
  const vision=page.getByRole('region',{name:'视觉组成员自动轮播',exact:true})
  await expect(mechanical).toHaveAttribute('data-looping','true')
  await expect(vision).toHaveAttribute('data-looping','false')
  await page.mouse.move(0,0)
  await page.clock.fastForward(4000)
  await expect(mechanical).toHaveAttribute('data-index','1')
  await expect(electronic).toHaveAttribute('data-index','1')
  await expect(vision).toHaveAttribute('data-index','0')
  await page.clock.fastForward(600)
  await mechanical.hover()
  await page.clock.fastForward(4000)
  await expect(mechanical).toHaveAttribute('data-index','1')
  await expect(electronic).toHaveAttribute('data-index','2')
  await page.mouse.move(0,0)
  await page.clock.fastForward(600)
  await page.clock.fastForward(3400)
  await expect(mechanical).toHaveAttribute('data-index','2')
  await page.clock.fastForward(600)
  for(let i=3;i<=6;i++){
    await page.clock.fastForward(3400)
    await expect(mechanical).toHaveAttribute('data-index',String(i))
    if(i===6){
      const track=mechanical.locator('.member-carousel-track')
      expect(await track.getAttribute('style')).toContain('600ms')
      await expect(mechanical.locator('.carousel-copy').first()).toHaveAttribute('aria-hidden','true')
    }
    await page.clock.fastForward(600)
  }
  await expect(mechanical).toHaveAttribute('data-index','0')
  expect(await mechanical.locator('.member-carousel-track').getAttribute('style')).toContain('transition: none')
})

test('后台恢复不追赶定时器；刷新人数和断线恢复保持统计',async({page})=>{
  const data=crowded()
  await page.clock.install()
  await page.route('**/api/dashboard',r=>r.fulfill({json:data}))
  await page.goto('/')
  const region=page.getByRole('region',{name:'机械组成员自动轮播',exact:true})
  await expect(region).toHaveAttribute('data-looping','true')
  await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'))})
  await page.clock.fastForward(300000)
  await expect(region).toHaveAttribute('data-index','0')
  await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:false});document.dispatchEvent(new Event('visibilitychange'))})
  await page.clock.fastForward(3000);await expect(region).toHaveAttribute('data-index','0')
  await page.clock.fastForward(1000);await expect(region).toHaveAttribute('data-index','1')
  await page.unroute('**/api/dashboard')
  await page.route('**/api/dashboard',r=>r.fulfill({status:502,json:{error:'DATA_CONNECTION_LOST'}}))
  await page.clock.fastForward(61000)
  await page.clock.fastForward(1100)
  await expect(page.getByRole('alert')).toContainText('保留上次同步数据')
  await expect(page.locator('.carousel-item:not(.carousel-copy) .wall-member')).toHaveCount(16)
  await page.unroute('**/api/dashboard')
  data.members=data.members.slice(0,2)
  await page.route('**/api/dashboard',r=>r.fulfill({json:data}))
  await page.clock.fastForward(60000)
  await expect(page.getByRole('alert')).toHaveCount(0)
  await expect(region).toHaveAttribute('data-looping','false')
  await expect(region.locator('.carousel-copy')).toHaveCount(0)
  await expect(region).toHaveAttribute('data-index','0')
})
