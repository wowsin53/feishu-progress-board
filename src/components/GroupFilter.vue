<script setup lang="ts">
import { useDashboard } from '../stores/dashboard'
import type { Group } from '../types/dashboard'
const store=useDashboard(),groups: (Group|'全部成员')[]=['全部成员','机械组','电控组','视觉组','其他']
</script>
<template><nav class="group-filter" aria-label="按组别筛选"><button v-for="group in groups" :key="group" :class="{active:store.group===group}" :aria-pressed="store.group===group" @click="store.group=group">{{ group }}<span v-if="store.group===group" class="filter-dot" /></button></nav></template>
