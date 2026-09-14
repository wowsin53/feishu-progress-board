<script setup lang="ts">
import { TriangleAlert } from 'lucide-vue-next'
import type { Member, Task } from '../types/dashboard'
import { overdueDays } from '../utils/dashboard'
import { shortDate } from '../utils/date'
defineProps<{tasks:Task[];members:Member[];now:number}>()
defineEmits<{select:[id:string]}>()
</script>
<template><section class="panel overdue-panel"><div class="panel-heading"><h2><TriangleAlert :size="17"/>逾期任务</h2><span class="count red mono">{{ String(tasks.length).padStart(2,'0') }}</span></div><p class="panel-caption micro">ATTENTION REQUIRED</p><div class="panel-scroll"><button class="alert-task" v-for="task in tasks" :key="task.id" @click="$emit('select',task.memberIds[0]!)"><div><h3>{{ task.title }}</h3><span>{{ members.filter(m=>task.memberIds.includes(m.id)).map(m=>`${m.name} · ${m.group}`).join('、') }}</span><small class="mono">截止 {{ shortDate(task.deadline) }}</small></div><b class="overdue-badge mono" :class="overdueDays(task,now)>5 ? 'severe' : overdueDays(task,now)>2 ? 'red' : 'deep-orange'">+{{ overdueDays(task,now) }}<span>DAYS</span></b></button><div v-if="!tasks.length" class="empty-state green">暂无逾期任务</div></div></section></template>
