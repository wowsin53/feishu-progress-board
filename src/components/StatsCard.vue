<script setup lang="ts">
import type { Component } from 'vue'
defineProps<{label:string;english:string;value:number;total?:number;tone:string;icon:Component;hint:string}>()
</script>
<template><article class="stat-card" :class="tone"><div class="stat-top"><span class="micro">{{ english }}</span><component :is="icon" :size="20" /></div><div class="stat-main"><strong class="mono">{{ String(value).padStart(2,'0') }}</strong><span v-if="total !== undefined" class="stat-total mono">/ {{ String(total).padStart(2,'0') }}</span><h2>{{ label }}</h2></div><div class="stat-bottom"><span><i class="tiny-dot" />{{ hint }}</span><span class="stat-bars" aria-hidden="true"><i v-for="n in 14" :key="n" :style="{opacity:n <= Math.max(2, value) ? 0.9 : 0.16}" /></span></div></article></template>
