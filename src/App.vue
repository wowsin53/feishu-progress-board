<script setup lang="ts">
import DashboardView from './views/DashboardView.vue'
import WallDashboard from './views/WallDashboard.vue'
const desktopView = new URLSearchParams(window.location.search).get('view') === 'desktop'
</script>
<template><DashboardView v-if="desktopView" /><WallDashboard v-else /></template>
