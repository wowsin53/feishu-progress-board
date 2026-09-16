<script setup lang="ts">
import { TriangleAlert } from 'lucide-vue-next'
import type { Task, Member } from '../types/dashboard'
import { groupLabel } from '../config/groups'
import AutoScroll from './AutoScroll.vue'
defineProps<{tasks:Task[];members:Member[]; compact?:boolean}>()
</script>
<template><section v-if="compact" class="panel compact-missing-deadlines"><div class="panel-heading"><h2><TriangleAlert :size="17"/>未填写截止日期</h2><span class="count orange mono">{{ tasks.length }}</span></div><div class="panel-scroll"><article v-for="task in tasks" :key="task.id" class="alert-task"><div><h3>{{ task.title }}</h3><span>{{ members.filter(m=>task.memberIds.includes(m.id)).map(m=>m.name+' · '+groupLabel(m.group)).join(' / ') }}</span></div></article><p v-if="!tasks.length" class="empty-state green">所有未完成任务均已填写截止日期</p></div></section><section v-else class="wall-panel wall-missing-deadlines">
  <div class="wall-panel-title"><h2><TriangleAlert :size="28"/>未填写截止日期</h2><strong class="orange mono">{{ String(tasks.length).padStart(2,'0') }}</strong></div>
  <AutoScroll label="未填写截止日期自动滚动">
    <article v-for="task in tasks" :key="task.id" class="wall-deadline-row"><div><h3><span class="orange">● </span>{{ task.title }}</h3><p>{{ members.filter(m=>task.memberIds.includes(m.id)).map(m=>m.name+' · '+groupLabel(m.group)).join(' / ') }}</p></div></article>
    <p v-if="!tasks.length" class="wall-empty green">所有未完成任务均已填写截止日期</p>
  </AutoScroll>
</section></template>
