<script setup lang="ts">
import { defineAsyncComponent, onBeforeUnmount, onMounted, ref } from 'vue'
const ReportAdminView = defineAsyncComponent(() => import('./views/ReportAdminView.vue'))
import DashboardView from './views/DashboardView.vue'
import WallDashboard from './views/WallDashboard.vue'
const requestedView = new URLSearchParams(window.location.search).get('view')
const compactQuery = window.matchMedia('(max-width: 1024px)')
const compact = ref(compactQuery.matches)
const updateLayout = () => { compact.value = compactQuery.matches }
onMounted(() => compactQuery.addEventListener('change', updateLayout))
onBeforeUnmount(() => compactQuery.removeEventListener('change', updateLayout))
</script>
<template>
  <ReportAdminView v-if="requestedView === 'admin'" />
  <DashboardView v-else-if="requestedView === 'desktop' || compact" />
  <WallDashboard v-else />
</template>
