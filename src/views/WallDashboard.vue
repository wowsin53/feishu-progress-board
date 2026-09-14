<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { Crosshair, UsersRound, UserRoundCheck, ListTodo, TriangleAlert, Radio, Timer, UserRoundX } from 'lucide-vue-next'
import { useDashboard } from '../stores/dashboard'
import { chinaTime, shortDate } from '../utils/date'
import { deriveDashboard, overdueDays } from '../utils/dashboard'
import { dailyQuote } from '../utils/quotes'
import { GROUP_CONFIG, groupLabel } from '../config/groups'
import type { Task } from '../types/dashboard'
import StatsCard from '../components/StatsCard.vue'
import WallMemberCard from '../components/WallMemberCard.vue'
import MemberCarousel from '../components/MemberCarousel.vue'
import AutoScroll from '../components/AutoScroll.vue'
import '../wall.css'

const store = useDashboard()
const board = ref<HTMLElement>()
const scale = ref(1)
const offset = ref({ x: 0, y: 0 })
const view = computed(() => store.data ? deriveDashboard(store.data, '全部成员', store.now) : null)
const groups = GROUP_CONFIG
const time = computed(() => chinaTime(store.now))
const owners = (task: Task) => store.data?.members.filter(m => task.memberIds.includes(m.id)).map(m => `${m.name} · ${groupLabel(m.group)}`).join(' / ')
const remaining = (task: Task) => Math.max(1, Math.ceil((Date.parse(task.deadline!) - store.now) / 3600000))
let clock: ReturnType<typeof setInterval>
let poll: ReturnType<typeof setInterval>
let observer: ResizeObserver | undefined
let frame = 0

// Keep the typography fixed as data grows. Only lists scroll inside the 4K canvas.
function fit() {
  cancelAnimationFrame(frame)
  frame = requestAnimationFrame(() => {
    if (!board.value) return
    const width = 3840
    const height = 2160
    const factor = Math.min(window.innerWidth / width, window.innerHeight / height)
    scale.value = factor
    offset.value = { x: (window.innerWidth - width * factor) / 2, y: (window.innerHeight - height * factor) / 2 }
  })
}
const onVisible = () => {
  if (document.visibilityState === 'visible') {
    store.now = Date.now()
    void store.refresh()
  }
}
onMounted(async () => {
  void store.refresh()
  clock = setInterval(() => { store.now = Date.now() }, 1000)
  poll = setInterval(() => { if (document.visibilityState === 'visible') void store.refresh() }, 60000)
  window.addEventListener('resize', fit)
  document.addEventListener('visibilitychange', onVisible)
  await nextTick()
  observer = new ResizeObserver(fit)
  if (board.value) observer.observe(board.value)
  void document.fonts.ready.then(fit)
  fit()
})
onBeforeUnmount(() => {
  clearInterval(clock)
  clearInterval(poll)
  cancelAnimationFrame(frame)
  observer?.disconnect()
  window.removeEventListener('resize', fit)
  document.removeEventListener('visibilitychange', onVisible)
})
</script>

<template>
  <div class="wall-viewport">
    <div ref="board" class="wall-board" :style="{ transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})` }">
      <header class="wall-header">
        <div class="wall-brand">
          <div class="wall-emblem"><Crosshair :size="64" /></div>
          <div><p>ROBOMASTER / MISSION CONTROL</p><h1>基地任务指挥中心</h1></div>
        </div>
        <div class="wall-header-status">
          <div class="wall-data-state" :class="{ 'red': store.error }">
            <Radio :size="28" /><div><strong>{{ store.error ? '数据连接异常' : store.data?.source === 'mock' ? '演示任务 · 虚拟打卡' : store.data ? `飞书任务 · ${store.data.checkInSource === 'mock' ? '虚拟打卡' : '飞书打卡'}` : '正在连接数据' }}</strong><span>LAST SYNC {{ store.data ? chinaTime(store.data.syncedAt).format('HH:mm:ss') : '--:--:--' }} · 每 60 秒同步 · 成员自动轮播</span></div>
          </div>
          <div class="wall-clock"><strong class="mono">{{ time.format('HH:mm:ss') }}</strong><span>{{ time.format('YYYY / MM / DD') }} · {{ ['星期日','星期一','星期二','星期三','星期四','星期五','星期六'][time.day()] }} · 北京时间</span></div>
        </div>
      </header>

      <section v-if="view" class="wall-stats" aria-label="核心统计">
        <StatsCard label="今日未打卡" english="AWAITING CHECK-IN" :value="view.summary.notCheckedIn" :total="view.members.length" :tone="view.summary.notCheckedIn ? 'orange' : 'green'" :icon="UsersRound" :hint="store.data?.checkInSource === 'mock' || store.data?.source === 'mock' ? '虚拟打卡数据 · 不代表真实考勤' : '未打卡成员见右侧名单'" />
        <StatsCard label="今日已打卡" english="CHECKED IN TODAY" :value="view.summary.checkedIn" :total="view.members.length" tone="cyan" :icon="UserRoundCheck" :hint="store.data?.checkInSource === 'mock' || store.data?.source === 'mock' ? '虚拟打卡数据 · 不代表真实考勤' : '当日有效打卡 · 自动去重'" />
        <StatsCard label="未完成任务" english="ACTIVE MISSIONS" :value="view.summary.unfinishedTasks" tone="blue" :icon="ListTodo" hint="未开始 / 进行中 / 待验收" />
        <StatsCard label="逾期任务" english="OVERDUE MISSIONS" :value="view.summary.overdueTasks" :tone="view.summary.overdueTasks ? 'red' : 'green'" :icon="TriangleAlert" hint="超过截止时间且尚未完成" />
      </section>
      <div v-else class="wall-waiting" role="status">{{ store.error ? 'DATA CONNECTION LOST · 等待自动重新连接' : '正在读取基地成员与任务…' }}</div>

      <main class="wall-main">
        <section class="wall-members" aria-label="全部成员及完整任务">
          <div class="wall-section-title"><h2><span>01 /</span> 全员任务总览</h2><div class="wall-legend"><span class="green">● 已完成</span><span class="blue">● 进行中</span><span class="purple">● 待验收</span><span class="muted">● 未开始</span><span class="red">● 已逾期</span></div><b>{{ view?.members.length ?? 0 }} 名在队成员</b></div>
          <div v-if="view" class="wall-lanes">
            <section v-for="group in groups" :key="group.name" class="wall-lane">
              <header class="wall-lane-title"><h3>{{ group.name }}<span>{{ group.code }}</span></h3><b class="mono">{{ String(view.members.filter(m => m.group === group.name).length).padStart(2, '0') }}</b></header>
              <MemberCarousel :members="view.members.filter(m => m.group === group.name)" :label="group.name + '成员自动轮播'">
                <template #default="{member}"><WallMemberCard :member="member" /></template>
              </MemberCarousel>
            </section>
          </div>
          <div v-else class="wall-empty">{{ store.error ? '飞书数据连接异常，系统将自动重试' : 'INITIALIZING MISSION CONTROL' }}</div>
        </section>

        <aside v-if="view" class="wall-alerts" aria-label="全部执行预警">
          <section v-if="store.data?.incompleteTasks?.length || view.members.some(m=>!m.group)" class="wall-panel wall-quality">
            <div class="wall-panel-title"><h2>待补充信息</h2><span class="orange">请完善飞书字段</span></div>
            <AutoScroll label="待补充信息自动滚动">
              <article v-for="task in store.data?.incompleteTasks" :key="task.id" class="wall-deadline-row"><div><h3>{{ task.title }}</h3><p class="orange">{{ task.reason }}</p></div></article>
              <article v-for="member in view.members.filter(m=>!m.group)" :key="member.id" class="wall-deadline-row"><div><h3>{{ member.name }} · 待分组</h3><p>已完成 {{ member.completed.length }} / 未完成 {{ member.pending.length }} · 已计入统计</p><p v-for="task in member.pending.slice(0,3)" :key="task.id">● {{ task.title }}</p><p v-if="member.pending.length>3">+{{ member.pending.length-3 }} 项任务</p></div></article>
            </AutoScroll>
          </section>
          <section class="wall-panel wall-attendance">
            <div class="wall-panel-title"><h2><UserRoundX :size="30" />今日未打卡 <small v-if="store.data?.checkInSource === 'mock' || store.data?.source === 'mock'">虚拟数据</small></h2><strong class="orange mono">{{ String(view.absent.length).padStart(2,'0') }}</strong></div>
            <AutoScroll label="未打卡名单自动滚动">
            <div class="wall-absent-list"><div v-for="member in view.absent" :key="member.id" class="wall-absent"><div><strong>{{ member.name }}</strong><span>{{ groupLabel(member.group) }}</span></div><b :class="member.missedDays >= 3 ? 'red' : 'orange'">{{ member.missedDays }}{{ member.missedIsMinimum ? '+' : '' }} 天<span>连续未打卡</span></b></div></div>
            <p v-if="!view.absent.length" class="wall-empty green">今日全员完成打卡</p>
            </AutoScroll>
          </section>
          <section class="wall-panel">
            <div class="wall-panel-title"><h2><TriangleAlert :size="30" />逾期任务</h2><strong class="red mono">{{ String(view.overdue.length).padStart(2,'0') }}</strong></div>
            <AutoScroll label="逾期任务自动滚动">
            <div v-for="task in view.overdue" :key="task.id" class="wall-deadline-row"><div><h3>{{ task.title }}</h3><p>{{ owners(task) }}<span>截止 {{ shortDate(task.deadline) }}</span></p></div><b class="red mono">+{{ overdueDays(task,store.now) }}<small>天</small></b></div>
            <p v-if="!view.overdue.length" class="wall-empty green">暂无逾期任务</p>
            </AutoScroll>
          </section>
          <section class="wall-panel">
            <div class="wall-panel-title"><h2><Timer :size="30" />即将到期</h2><span class="orange mono">48H</span></div>
            <AutoScroll label="即将到期任务自动滚动">
            <div v-for="task in view.upcoming" :key="task.id" class="wall-deadline-row wall-upcoming"><div><h3>{{ task.title }}</h3><p>{{ owners(task) }}</p></div><b class="orange mono">{{ remaining(task) }}<small>小时</small></b></div>
            <p v-if="!view.upcoming.length" class="wall-empty">未来 48 小时暂无截止任务</p>
            </AutoScroll>
          </section>
        </aside>
      </main>

      <footer class="wall-quote"><div><strong class="mono">RM DAILY</strong><span>工程师的日常</span></div><blockquote>“{{ dailyQuote(store.now) }}”</blockquote><span class="mono">— ROBOMASTER BASE</span></footer>
      <div class="wall-bottom" :class="{ 'wall-bottom-error': store.error }" :role="store.error ? 'alert' : undefined"><span>{{ store.error ? 'DATA CONNECTION LOST · 飞书数据连接异常 · 保留上次同步数据 · 自动重试中' : store.data?.warnings.join(' · ') || 'ROBOMASTER BASE / 全员任务与执行预警' }}</span><span>{{ store.data?.source === 'mock' ? '演示数据' : '飞书数据源' }} · UTC+8</span></div>
    </div>
  </div>
</template>
