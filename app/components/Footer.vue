<script setup lang="ts">
// 从设置中获取 ICP 备案信息
const icpNumber = computed(() => getSetting('app:icpNumber') || '')
</script>

<template>
  <footer v-if="icpNumber" class="fixed bottom-0 left-0 right-0 z-40 bg-background/90 backdrop-blur-sm border-t border-border/50">
    <div class="container mx-auto px-4 py-2">
      <div class="flex flex-col sm:flex-row items-center justify-center gap-3 text-xs text-muted-foreground">
        <!-- 版权信息 -->
        <div class="flex items-center gap-2">
          <span>© {{ $dayjs().format('YYYY') }}{{ getSetting('app:author') || getSetting('app:title') }}</span>
          <span class="text-border">|</span>
        </div>

        <!-- ICP备案信息 -->
        <a
          href="https://beian.miit.gov.cn/"
          target="_blank"
          rel="noopener noreferrer"
          class="hover:text-foreground transition-colors duration-200 flex items-center gap-1"
        >
          <span>{{ icpNumber }}</span>
        </a>
      </div>
    </div>
  </footer>
</template>

<style scoped>
footer {
  /* 确保在所有页面上都显示 */
  position: fixed;
  bottom: 0;
  /* 添加轻微的阴影效果 */
  box-shadow: 0 -1px 3px 0 rgb(0 0 0 / 0.1);
}

/* 响应式调整 */
@media (max-width: 640px) {
  footer {
    position: relative;
    margin-top: auto;
  }
}
</style>