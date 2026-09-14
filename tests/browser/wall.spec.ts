import { test, expect } from '@playwright/test'
import { createMockDashboard } from '../../src/mock/dashboard'

test('4K 非触控大屏：全部成员、完整任务和全部预警在一屏内', async ({ page }) => {
  await page.setViewportSize({ width: 3840, height: 2160 })
  const data = createMockDashboard()
  await page.route('**/api/dashboard', route => route.fulfill({ json: data }))
  await page.goto('/')
  await expect(page.locator('.wall-member')).toHaveCount(data.members.length)
  await expect(page.locator('.wall-member .task-line')).toHaveCount(data.tasks.length)
  await expect(page.getByRole('button')).toHaveCount(0)
  await expect(page.locator('.wall-lane')).toHaveCount(4)
  await expect(page.locator('.wall-absent')).toHaveCount(6)
  await expect(page.locator('.wall-deadline-row:not(.wall-upcoming)')).toHaveCount(6)
  await expect(page.locator('.wall-upcoming')).toHaveCount(6)
  await expect.poll(async () => page.locator('.wall-board').evaluate(el => {
    const bounds = el.getBoundingClientRect()
    return bounds.left >= -1 && bounds.top >= -1 && bounds.right <= innerWidth + 1 && bounds.bottom <= innerHeight + 1
  })).toBe(true)
  const allVisible = await page.locator('.wall-member, .wall-member .task-line, .wall-absent, .wall-deadline-row, .wall-quote').evaluateAll(elements => elements.every(el => {
    const box = el.getBoundingClientRect()
    return box.top >= 0 && box.bottom <= innerHeight + 1 && box.left >= 0 && box.right <= innerWidth + 1
  }))
  expect(allVisible).toBe(true)
  expect(await page.locator('.wall-board').evaluate(el => getComputedStyle(el).transform)).toBe('matrix(1, 0, 0, 1, 0, 0)')
  expect(await page.locator('.wall-member .task-title').first().evaluate(el => getComputedStyle(el).fontSize)).toBe('26px')
  await page.screenshot({ path: 'test-results/wall-4k.png' })
})

test('任务增多时固定画布自动滚动，断线仍自动恢复', async ({ page }) => {
  const data = createMockDashboard()
  // Simulate a skewed group and lengthy task names; the full canvas must still fit.
  data.members.forEach((member, i) => { if (i < 8) member.group = '电控组' })
  data.tasks.push(...data.tasks.slice(0, 12).map((task, i) => ({ ...task, id: `extra-${i}`, title: '步兵机器人底盘速度控制系统与裁判系统通信稳定性联合测试' })))
  await page.route('**/api/dashboard', route => route.fulfill({ json: data }))
  await page.setViewportSize({ width: 1920, height: 1080 })
  await page.clock.install()
  await page.goto('/')
  await expect(page.locator('.wall-member .task-line')).toHaveCount(60)
  await expect.poll(() => page.locator('.wall-board').evaluate(el => el.getBoundingClientRect().bottom <= innerHeight + 1)).toBe(true)
  expect(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight && document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  expect(await page.locator('.wall-board').evaluate(el => getComputedStyle(el).transform)).toBe('matrix(0.5, 0, 0, 0.5, 0, 0)')
  const scrolling = page.getByRole('region', {name:'电控组成员自动滚动',exact:true})
  await page.clock.fastForward(12000)
  expect(await scrolling.evaluate(el=>el.scrollTop)).toBeGreaterThan(0)
  await page.unroute('**/api/dashboard')
  await page.route('**/api/dashboard', route => route.fulfill({ status: 502, json: { error: 'DATA_CONNECTION_LOST' } }))
  await page.clock.fastForward(61000)
  await expect(page.getByRole('alert')).toContainText('保留上次同步数据')
  await expect(page.locator('.wall-member .task-line')).toHaveCount(60)
  await page.unroute('**/api/dashboard')
  await page.route('**/api/dashboard', route => route.fulfill({ json: data }))
  await page.clock.fastForward(60000)
  await expect(page.getByRole('alert')).toHaveCount(0)
})

test('同一成员15项进行中任务会自动滚动且保留全部条目', async ({ page }) => {
  const data=createMockDashboard()
  data.checkInSource='mock'
  data.source='feishu'
  data.tasks=Array.from({length:15},(_,i)=>({...data.tasks[0]!,id:`many-${i}`,title:`进行中任务 ${i+1}`,status:'进行中' as const}))
  await page.route('**/api/dashboard',route=>route.fulfill({json:data}))
  await page.clock.install()
  await page.setViewportSize({width:3840,height:2160})
  await page.goto('/')
  const list=page.getByRole('region',{name:'陈宇航当前任务自动滚动',exact:true})
  await expect(list.locator('.task-line')).toHaveCount(15)
  await expect(page.getByText('飞书任务 · 虚拟打卡',{exact:true})).toBeVisible()
  await page.clock.fastForward(12000)
  expect(await list.evaluate(el=>el.scrollTop)).toBeGreaterThan(0)
  expect(await list.evaluate(el=>el.clientHeight)).toBe(116)
  expect(await page.locator('.wall-board').evaluate(el=>el.getBoundingClientRect().height)).toBe(2160)
})

