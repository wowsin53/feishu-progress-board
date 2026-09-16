import { test, expect } from '@playwright/test'
import { createMockDashboard } from '../../src/mock/dashboard'
test.beforeEach(async({page})=>{
 const data=createMockDashboard()
 data.tasks[0]!.deadline=undefined
 data.tasks[0]!.status='进行中'
 await page.route('**/api/dashboard',r=>r.fulfill({json:data}))
})
test('手机首页可阅读、筛选、翻页和查看任务',async({page})=>{
 await page.setViewportSize({width:390,height:844})
 await page.goto('/')
 await expect(page.locator('.member-card')).toHaveCount(6)
 await expect(page.locator('.wall-board')).toHaveCount(0)
 await expect(page.getByRole('note')).toContainText('不代表真实考勤')
 await page.getByRole('button',{name:'下一页成员'}).click()
 await page.getByRole('button',{name:'机械组',exact:true}).click()
 await expect(page.locator('.member-card')).toHaveCount(3)
 await page.locator('.member-card').first().click()
 await expect(page.getByRole('dialog')).toBeVisible()
 await page.keyboard.press('Escape')
 await expect(page.getByRole('dialog')).toHaveCount(0)
 await page.getByRole('button',{name:'全部成员',exact:true}).click()
 await expect(page.locator('.compact-missing-deadlines')).toContainText('未填写截止日期')
 for(const [width,height] of [[320,740],[390,844],[844,390],[768,1024],[1024,768]]){
  await page.setViewportSize({width:width!,height:height!})
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
  expect(await page.locator('.member-card').first().evaluate(el=>el.getBoundingClientRect().width)).toBeGreaterThan(250)
 }
 await page.setViewportSize({width:390,height:844})
 await page.screenshot({path:'test-results/mobile-home.png',fullPage:true})
})
test('手机与大屏布局切换保持统计',async({page})=>{
 await page.setViewportSize({width:390,height:844})
 await page.goto('/')
 await expect(page.locator('.member-card')).toHaveCount(6)
 const count=await page.locator('.stat-card').first().locator('.stat-total').textContent()
 await page.setViewportSize({width:1920,height:1080})
 await expect(page.locator('.wall-board')).toBeVisible()
 await expect(page.locator('.wall-lane')).toHaveCount(5)
 await expect(page.locator('.stat-card').first().locator('.stat-total')).toHaveText(count!)
 await page.setViewportSize({width:390,height:844})
 await expect(page.locator('.wall-board')).toHaveCount(0)
 await expect(page.locator('.member-card')).toHaveCount(6)
})
