<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { HugeiconsIcon } from '@hugeicons/vue'

export interface MenuItem {
  label: string
  icon?: any
  action: () => void
  danger?: boolean
}

const props = defineProps<{
  x: number
  y: number
  items: MenuItem[]
}>()

const emit = defineEmits<{
  close: []
}>()

const menuRef = ref<HTMLElement>()
const adjustedX = ref(props.x)
const adjustedY = ref(props.y)

function onClickOutside() {
  emit('close')
}

onMounted(() => {
  if (menuRef.value) {
    const rect = menuRef.value.getBoundingClientRect()
    const vw = window.innerWidth
    const vh = window.innerHeight

    if (props.x + rect.width > vw) {
      adjustedX.value = props.x - rect.width
    }
    if (props.y + rect.height > vh) {
      adjustedY.value = props.y - rect.height
    }
  }

  setTimeout(() => {
    document.addEventListener('click', onClickOutside)
    document.addEventListener('contextmenu', onClickOutside)
  }, 0)
})

onUnmounted(() => {
  document.removeEventListener('click', onClickOutside)
  document.removeEventListener('contextmenu', onClickOutside)
})
</script>

<template>
  <Teleport to="body">
    <div
      ref="menuRef"
      class="fixed z-50 bg-white rounded-lg shadow-lg border border-gray-200 py-1 min-w-44"
      :style="{ left: `${adjustedX}px`, top: `${adjustedY}px` }"
    >
      <button
        v-for="(item, i) in items"
        :key="i"
        @click="item.action(); emit('close')"
        class="w-full flex items-center gap-2.5 px-3 py-1.5 text-sm transition-colors"
        :class="item.danger ? 'text-red-600 hover:bg-red-50' : 'text-gray-700 hover:bg-gray-100'"
      >
        <HugeiconsIcon v-if="item.icon" :icon="item.icon" :size="16" />
        {{ item.label }}
      </button>
    </div>
  </Teleport>
</template>
