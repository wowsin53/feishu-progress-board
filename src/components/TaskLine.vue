<script setup lang="ts">
import { normalizeTaskCategory } from '../config/groups'
import type { Task } from '../types/dashboard'
import { taskStatus } from '../utils/dashboard'
import { useDashboard } from '../stores/dashboard'
import { shortDate } from '../utils/date'
defineProps<{task:Task}>()
const store=useDashboard()
const tones:Record<string,string>={'已完成':'green','进行中':'blue','待验收':'purple','未开始':'muted','已逾期':'red','已停滞':'red','已放弃':'muted','未填写截止日期':'orange','截止日期无效':'orange','未完成':'muted'}
</script>
<template><div class="task-line" :class="tones[taskStatus(task,store.now)]"><span class="task-indicator">{{ task.status==='已完成' ? '✓' : '●' }}</span><span class="task-title" :title="[task.title,...(task.parentTitles || []),...(task.tags || [])].join(' · ')">{{ task.parentIds?.length ? '↳ ' : '' }}{{ task.title }}<small v-if="normalizeTaskCategory(task.category) === '联调任务'" class="task-category"> · 联调任务</small></span><span class="task-meta" :title="shortDate(task.deadline)">{{ taskStatus(task,store.now) }}</span></div></template>
