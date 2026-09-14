<script setup lang="ts">
import { RefreshCw } from 'lucide-vue-next'
import { useDashboard } from '../stores/dashboard'
import { chinaTime } from '../utils/date'
const store=useDashboard()
</script>
<template><div class="sync"><div><span class="micro">LAST SYNC</span><span class="mono">{{ store.data ? chinaTime(store.data.syncedAt).format('HH:mm:ss') : '--:--:--' }}</span></div><button class="icon-button" :disabled="store.loading" aria-label="刷新数据" title="刷新数据" @click="store.refresh"><RefreshCw :size="17" :class="{ spinning:store.loading }" /></button></div></template>
