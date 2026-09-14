<script setup lang="ts">
import { defineAsyncComponent } from 'vue'
const ReportAdminView=defineAsyncComponent(()=>import('./views/ReportAdminView.vue'))
const adminView = new URLSearchParams(window.location.search).get('view') === 'admin'
import DashboardView from './views/DashboardView.vue'
import WallDashboard from './views/WallDashboard.vue'
const desktopView = new URLSearchParams(window.location.search).get('view') === 'desktop'
</script>
<template><ReportAdminView v-if="adminView"/><DashboardView v-else-if="desktopView" /><WallDashboard v-else /></template>
