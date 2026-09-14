<script setup lang="ts">
import { computed } from 'vue'
import { Crosshair, Maximize, Minimize } from 'lucide-vue-next'
import { useDashboard } from '../stores/dashboard'
import { chinaTime } from '../utils/date'
import SyncStatus from './SyncStatus.vue'
defineProps<{fullscreen:boolean}>()
defineEmits<{fullscreen:[]}>()
const store=useDashboard(),time=computed(()=>chinaTime(store.now))
</script>
<template><header class="dashboard-header"><div class="brand"><div class="brand-mark"><Crosshair :size="30" /></div><div><div class="brand-eyebrow">ROBOMASTER <span>/</span> MISSION CONTROL</div><h1>基地任务指挥中心<span class="title-corner">⌟</span></h1></div></div><div class="header-right"><div class="connection" :class="{offline:store.error}"><span class="signal-dot" />{{ store.error ? '连接异常' : store.data?.source === 'mock' ? '演示数据' : store.data ? '飞书已连接' : '正在连接' }}<span class="micro">{{ store.data?.source === 'mock' ? 'DEMO MODE' : 'DATA LINK' }}</span></div><SyncStatus /><div class="clock"><strong class="mono">{{ time.format('HH:mm:ss') }}</strong><span class="mono">{{ time.format('YYYY / MM / DD') }} <b>{{ time.format('ddd').toUpperCase() }}</b></span></div><button class="icon-button fullscreen" :aria-label="fullscreen ? '退出全屏' : '进入全屏'" @click="$emit('fullscreen')"><Minimize v-if="fullscreen" :size="18" /><Maximize v-else :size="18" /></button></div></header></template>
