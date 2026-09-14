<script setup lang="ts">
import type { MemberView } from '../types/dashboard'
import TaskLine from './TaskLine.vue'
defineProps<{ member: MemberView }>()
</script>
<template>
  <article class="wall-member" :data-member-id="member.id">
    <div class="wall-member-heading"><h3>{{ member.name }}</h3><span :class="member.checkedIn ? 'green' : 'orange'">{{ member.checkedIn ? '✓ 今日已打卡' : '● 今日未打卡' }}</span></div>
    <div class="wall-member-metrics"><span>完成 <b>{{ member.completed.length }}</b><i>/</i>未完成 <b>{{ member.pending.length }}</b></span><strong class="mono">{{ member.completion === null ? '暂无任务' : member.completion + '%' }}</strong></div>
    <div class="wall-progress"><i :style="{width: (member.completion ?? 0) + '%'}" /></div>
    <div class="wall-member-tasks"><h4>当前任务 <span>{{ member.pending.length }}</span></h4>
      <TaskLine v-for="task in member.pending.slice(0,3)" :key="task.id" :task="task" />
      <p v-if="!member.pending.length" class="wall-no-task">暂无未完成任务</p>
      <p v-if="member.pending.length > 3" class="more-tasks">+{{ member.pending.length - 3 }} 项任务</p>
    </div>
  </article>
</template>
