<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { MemberView } from '../types/dashboard'
const props = withDefaults(defineProps<{ members: MemberView[]; label: string; cardHeight?: number; gap?: number }>(), {cardHeight:386,gap:18})
const viewport=ref<HTMLElement>(), height=ref(0), index=ref(0), animated=ref(false)
const step=computed(()=>props.cardHeight+props.gap)
const overflowing=computed(()=>props.members.length*step.value-props.gap>height.value && height.value>0)
const windowHeight=computed(()=>Math.min(height.value,Math.max(1,Math.floor((height.value+props.gap)/step.value))*step.value-props.gap))
const clones=computed(()=>overflowing.value ? props.members.slice(0,Math.min(props.members.length,Math.ceil(height.value/step.value)+1)) : [])
let timer: ReturnType<typeof setTimeout> | undefined, settle: ReturnType<typeof setTimeout> | undefined
let observer: ResizeObserver | undefined, hovered=false, mounted=false
function clearTimers(){clearTimeout(timer);clearTimeout(settle);timer=undefined;settle=undefined}
function schedule(delay=4000){
  clearTimeout(timer)
  if(!mounted || hovered || document.hidden || !overflowing.value) return
  timer=setTimeout(()=>{
    if(hovered || document.hidden) return
    animated.value=true; index.value++
    // A single fallback timer also settles transitions in reduced-motion mode.
    settle=setTimeout(()=>{finish();schedule(3400)},600)
  },delay)
}
function finish(){
  clearTimeout(settle);settle=undefined
  animated.value=false
  if(index.value>=props.members.length) index.value=0
}
function pause(){hovered=true;clearTimeout(timer)}
function resume(){hovered=false;schedule()}
function visibility(){clearTimers();finish();schedule()}
async function reset(){clearTimers();animated.value=false;index.value=0;await nextTick();if(mounted) schedule()}
watch(()=>props.members.map(m=>m.id).join('|'),reset)
watch(overflowing,reset)
onMounted(()=>{
  mounted=true
  observer=new ResizeObserver(()=>{height.value=viewport.value?.clientHeight || 0})
  if(viewport.value) {height.value=viewport.value.clientHeight;observer.observe(viewport.value)}
  document.addEventListener('visibilitychange',visibility);schedule()
})
onBeforeUnmount(()=>{mounted=false;clearTimers();observer?.disconnect();document.removeEventListener('visibilitychange',visibility)})
</script>
<template>
  <div ref="viewport" class="member-carousel" role="region" :aria-label="label" :data-index="index" :data-looping="overflowing" @mouseenter="pause" @mouseleave="resume">
    <div class="member-carousel-window" :style="{height:(members.length ? windowHeight : 0)+'px'}">
    <div class="member-carousel-track" :style="{gap:gap+'px',transform:'translateY(-'+index*step+'px)',transition:animated ? 'transform 600ms ease-in-out' : 'none'}">
      <div v-for="member in members" :key="member.id" class="carousel-item" :style="{height:cardHeight+'px'}"><slot :member="member" /></div>
      <div v-for="member in clones" :key="'clone:'+member.id" class="carousel-item carousel-copy" aria-hidden="true" inert :style="{height:cardHeight+'px'}"><slot :member="member" /></div>
    </div>
    </div>
    <div v-if="!members.length" class="wall-empty">暂无在队成员</div>
  </div>
</template>
