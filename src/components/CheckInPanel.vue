<script setup lang="ts">
import { groupLabel } from '../config/groups'
import { UserRoundX } from 'lucide-vue-next'
import type { MemberView } from '../types/dashboard'
defineProps<{members:MemberView[]}>()
defineEmits<{select:[member:MemberView]}>()
</script>
<template><section class="panel checkin-panel"><div class="panel-heading"><h2><UserRoundX :size="17"/>今日未打卡</h2><span class="count orange mono">{{ String(members.length).padStart(2,'0') }}</span></div><p class="panel-caption micro">CHECK-IN WATCHLIST</p><div class="panel-scroll"><button v-for="(member,i) in members" :key="member.id" class="absent-row" @click="$emit('select',member)"><span class="row-number mono">{{ String(i+1).padStart(2,'0') }}</span><span class="absent-name">{{ member.name }}<small>{{ groupLabel(member.group) }}</small></span><span class="streak" :class="member.missedDays>=3 ? 'red' : member.missedDays===2 ? 'deep-orange' : 'orange'">{{ member.missedDays }}{{ member.missedIsMinimum ? '+' : '' }} <span class="micro">DAYS</span><small>连续未打卡</small></span></button><div v-if="!members.length" class="empty-state green"><span class="micro">ALL MEMBERS CHECKED IN</span><p>今日全员完成打卡</p></div></div></section></template>
