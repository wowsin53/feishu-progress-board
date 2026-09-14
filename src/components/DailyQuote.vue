<script setup lang="ts">
import { computed } from 'vue'
import { dailyQuote } from '../utils/quotes'
const props=defineProps<{now:number}>(),quote=computed(()=>dailyQuote(props.now))
</script>
<template><footer class="daily-quote"><div class="daily-mark"><span class="micro">RM DAILY</span><b>工程师的日常</b></div><blockquote :key="quote">“{{ quote }}”</blockquote><span class="quote-attribution mono">— ROBOMASTER BASE</span><span class="quote-decoration" aria-hidden="true">//</span></footer></template>
