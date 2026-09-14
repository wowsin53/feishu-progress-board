<script setup lang="ts">
import type { Task } from '../types/dashboard'
import { taskStatus } from '../utils/dashboard'
import { useDashboard } from '../stores/dashboard'
import { shortDate } from '../utils/date'
defineProps<{task:Task}>()
const store=useDashboard()
const tones:Record<string,string>={'已完成':'green','进行中':'blue','待验收':'purple','未开始':'muted','已逾期':'red','已停滞':'red','已放弃':'muted'}
</script>
<template><div class="task-line" :class="tones[taskStatus(task,store.now)]"><span class="task-indicator">{{ task.status==='已完成' ? '✓' : '●' }}</span><span class="task-title" :title="[task.title,...(task.parentTitles || []),...(task.tags || [])].join(' · ')">{{ task.parentIds?.length ? '↳ ' : '' }}{{ task.title }}</span><span class="task-meta" :title="shortDate(task.deadline)">{{ taskStatus(task,store.now) }}</span></div></template>
