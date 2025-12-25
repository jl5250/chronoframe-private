<script lang="ts" setup>
import { twMerge } from 'tailwind-merge'
import type { CSSProperties } from 'vue'

const props = withDefaults(
  defineProps<{
    src: string
    alt: string
    thumbhash?: string | null
    class?: string
    thumbhashClass?: string
    style?: CSSProperties
    threshold?: number | number[]
    rootMargin?: string
    imageContain?: boolean
    lazy?: boolean
  }>(),
  {
    thumbhash: null,
    class: '',
    thumbhashClass: '',
    style: undefined,
    threshold: 0.1,
    rootMargin: '50px',
    imageContain: false,
    lazy: true,
  },
)

const emit = defineEmits<{
  load: []
  error: []
}>()

const elemRef = useTemplateRef('elemRef')
const isElemVisible = ref(false)
const isLoaded = ref(false)
const isError = ref(false)
const isImageLoaded = ref(false)
const showLoadingIndicator = computed(() => {
  return isElemVisible.value && !isImageLoaded.value && !isError.value
})

onMounted(() => {
  if (!props.lazy) {
    isElemVisible.value = true
  }
})

const { stop } = useIntersectionObserver(
  elemRef,
  ([entry], _observerElement) => {
    isElemVisible.value = entry?.isIntersecting || false
    if (isElemVisible.value) {
      stop()
    }
  },
  {
    threshold: props.threshold,
    rootMargin: props.rootMargin,
    immediate: props.lazy,
  },
)

const onLoaded = () => {
  isImageLoaded.value = true
  setTimeout(() => {
    isLoaded.value = true
  }, 50)
  emit('load')
}

const onError = () => {
  isError.value = true
  isImageLoaded.value = false
  emit('error')
}
</script>

<template>
  <div
    ref="elemRef"
    :class="twMerge('relative overflow-hidden bg-neutral-100 dark:bg-neutral-800/50', $props.class)"
    :style="style"
  >
    <ThumbHash
      v-if="thumbhash"
      :thumbhash="thumbhash"
      :class="twMerge(
        'absolute inset-0 transition-opacity duration-500 ease-out',
        thumbhashClass,
        isLoaded ? 'opacity-0 scale-105' : 'opacity-100 scale-110',
      )"
      :style="{
        transform: isLoaded ? 'scale(1.05)' : 'scale(1.10)',
      }"
    />

    <div
      v-else-if="!isLoaded && showLoadingIndicator"
      class="absolute inset-0 bg-neutral-200/50 dark:bg-neutral-800/50"
    >
      <div class="absolute inset-0 animate-pulse">
        <div class="w-full h-full bg-gradient-to-br from-neutral-200/30 to-neutral-300/30 dark:from-neutral-800/30 dark:to-neutral-700/30" />
      </div>
    </div>

    <img
      v-if="isElemVisible"
      loading="lazy"
      :src="src"
      :alt="alt"
      :class="
        twMerge(
          'absolute inset-0 w-full h-full transition-all duration-500 ease-out',
          imageContain ? 'object-contain' : 'object-cover',
          isLoaded ? 'opacity-100 scale-100' : 'opacity-0 scale-105',
        )
      "
      @load="onLoaded"
      @error="onError"
    />

    <div
      v-if="showLoadingIndicator && thumbhash"
      class="absolute inset-0 flex items-center justify-center pointer-events-none"
    >
      <div
        class="w-8 h-8 rounded-full border-2 border-white/30 border-t-white/60 animate-spin"
      />
    </div>

    <div
      v-if="isError"
      class="absolute inset-0 flex flex-col items-center justify-center bg-neutral-200/80 dark:bg-neutral-800/80 backdrop-blur-sm"
    >
      <Icon
        name="tabler:photo-off"
        class="size-8 text-neutral-400 mb-2"
      />
      <p class="text-sm text-neutral-500 dark:text-neutral-400">
        加载图片失败
      </p>
    </div>
  </div>
</template>

<style scoped></style>
