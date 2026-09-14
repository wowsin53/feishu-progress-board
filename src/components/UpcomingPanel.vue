<script setup lang="ts">
import { Timer } from 'lucide-vue-next'
import type { Member,Task } from '../types/dashboard'
defineProps<{tasks:Task[];members:Member[];now:number}>()
defineEmits<{select:[id:string]}>()
</script>
<template><section class="panel upcoming-panel"><div class="panel-heading"><h2><Timer :size="17" />即将到期</h2><span class="micro orange">NEXT 48H</span></div><div class="upcoming-list"><button v-for="task in tasks" :key="task.id" @click="$emit('select',task.memberIds[0]!)"><i class="tiny-dot orange"/><div><h3>{{ task.title }}</h3><span>{{ members.filter(m=>task.memberIds.includes(m.id)).map(m=>m.name).join('、') }}</span></div><b class="mono orange">{{ Math.max(1,Math.ceil((Date.parse(task.deadline!)-now)/3600000)) }}<small>H</small></b></button><div v-if="!tasks.length" class="empty-state"><span class="micro">NO UPCOMING DEADLINES</span><p>未来 48 小时暂无截止任务</p></div></div></section></template>
