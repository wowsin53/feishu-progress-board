<script setup lang="ts">
import { groupLabel } from '../config/groups'
import { onMounted,onBeforeUnmount,ref } from 'vue'
import { X } from 'lucide-vue-next'
import type { MemberView } from '../types/dashboard'
import TaskLine from './TaskLine.vue'
import { shortDate } from '../utils/date'
defineProps<{member:MemberView}>()
const emit=defineEmits<{close:[]}>(),dialog=ref<HTMLDialogElement>()
let previous:HTMLElement|null=null
onMounted(()=>{previous=document.activeElement as HTMLElement;dialog.value?.showModal();document.body.style.overflow='hidden'})
onBeforeUnmount(()=>{document.body.style.overflow='';previous?.focus()})
</script>
<template><dialog ref="dialog" class="task-dialog" aria-labelledby="member-dialog-title" @cancel.prevent="emit('close')" @click="($event.target===dialog) && emit('close')"><div class="modal-inner"><div class="modal-header"><div><span class="micro">MEMBER MISSION LOG</span><h2 id="member-dialog-title">{{ member.name }} <small>{{ groupLabel(member.group) }}</small></h2></div><button class="icon-button" aria-label="关闭任务详情" @click="emit('close')"><X :size="22" /></button></div><div class="modal-summary">{{ member.checkedIn ? '今日已打卡' : '今日未打卡' }}<span>已完成 {{ member.completed.length }} / 全部 {{ member.tasks.length }}</span></div><div v-if="!member.tasks.length" class="empty-state">暂无任务</div><section v-for="section in [{label:'当前未完成',tasks:member.pending},{label:'已完成记录',tasks:member.completed}]" :key="section.label"><h3 class="modal-section-title">{{ section.label }} <span>{{ section.tasks.length }}</span></h3><article class="modal-task" v-for="task in section.tasks" :key="task.id"><TaskLine :task="task"/><p>{{ task.description || '暂无任务说明' }}</p><div class="modal-task-meta"><span>截止 {{ shortDate(task.deadline) }}</span><span>优先级 {{ task.priority===3 ? '高' : task.priority===2 ? '中' : '低' }}</span><span v-if="task.completedAt">完成 {{ shortDate(task.completedAt) }}</span></div></article></section></div></dialog></template>
