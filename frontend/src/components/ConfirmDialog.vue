<script setup lang="ts">
defineProps<{
  title: string
  message: string
  confirmLabel?: string
  confirmColor?: string
}>()

const emit = defineEmits<{
  confirm: []
  cancel: []
}>()
</script>

<template>
  <Teleport to="body">
    <div class="fixed inset-0 z-50 flex items-center justify-center">
      <div class="absolute inset-0 bg-black/40" @click="emit('cancel')" />
      <div class="relative bg-panel rounded-xl shadow-xl max-w-sm w-full mx-4 p-6">
        <h3 class="text-base font-semibold text-heading">{{ title }}</h3>
        <p class="mt-2 text-sm text-subtle">{{ message }}</p>
        <div class="mt-5 flex justify-end gap-2">
          <button
            @click="emit('cancel')"
            class="px-4 py-2 text-sm font-medium text-body bg-panel-alt rounded-lg hover:bg-panel-hover transition-colors"
          >
            Cancel
          </button>
          <button
            @click="emit('confirm')"
            class="px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors"
            :class="confirmColor ?? 'bg-red-600 hover:bg-red-700'"
          >
            {{ confirmLabel ?? 'Delete' }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
