<script setup lang="ts">
import { computed } from 'vue';
import awsLogo from '../assets/aws.svg';
import azureLogo from '../assets/azure.svg';
import gcsLogo from '../assets/gc.svg';
import localLogo from '../assets/local.svg';

const props = defineProps<{
  type: string;
  size?: number;
}>();

const logoMap: Record<string, string> = {
  s3: awsLogo,
  gcs: gcsLogo,
  azure: azureLogo,
  local: localLogo,
};

const logo = computed(() => logoMap[props.type] || localLogo);
</script>

<template>
  <img :src="logo" :width="size || 20" :height="size || 20" class="object-contain" />
</template>
