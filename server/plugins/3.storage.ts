import path from 'node:path'
import type { LocalStorageConfig, StorageConfig } from '../services/storage'
import { StorageManager, getGlobalStorageManager } from '../services/storage'
import { setGlobalStorageManager } from '../services/storage/events'
import { logger } from '../utils/logger'
import { settingsManager } from '../services/settings/settingsManager'

/**
 * Get the global storage manager instance
 * Used in non-request context (e.g., background tasks, event handlers)
 */
export function getStorageManager() {
  const storageManager = getGlobalStorageManager()
  if (!storageManager) {
    throw new Error('Storage manager not initialized')
  }
  return storageManager
}

export default nitroPlugin(async (nitroApp) => {
  // const config = useRuntimeConfig()

  // Wait for settings migration to complete if still initializing
  // This ensures we get the active provider after config migration
  let activeProvider = await settingsManager.storage.getActiveProvider()
  
  if (!activeProvider) {
    // Retry while settings manager is still initializing
    let attempts = 0
    const maxAttempts = 100 // 5 seconds max with 50ms intervals
    
    while (!activeProvider && attempts < maxAttempts && settingsManager.isInitializing_()) {
      await new Promise(resolve => setTimeout(resolve, 50))
      activeProvider = await settingsManager.storage.getActiveProvider()
      attempts++
    }
  }
  
  let storageConfiguration: StorageConfig

  if (!activeProvider) {
    logger.storage.warn('未配置活动的存储提供商，将使用默认的本地存储')
    storageConfiguration = {
      provider: 'local',
      basePath: path.resolve(process.cwd(), './data/storage'),
      baseUrl: '/storage',
      prefix: 'photos/',
    } as LocalStorageConfig
  } else {
    storageConfiguration = activeProvider.config
  }

  let storageManager: StorageManager
  try {
    storageManager = new StorageManager(
      storageConfiguration,
      logger.storage,
    )
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    logger.storage.error(`初始化存储提供程序失败：${errorMessage}`)

    if (errorMessage.includes('accessKeyId') || errorMessage.includes('secretAccessKey')) {
      logger.storage.warn('S3 配置缺失必需的 accessKeyId 或 secretAccessKey，回退到本地存储')
    }

    logger.storage.warn('由于配置错误，回退到本地存储')
    storageConfiguration = {
      provider: 'local',
      basePath: path.resolve(process.cwd(), './data/storage'),
      baseUrl: '/storage',
      prefix: 'photos/',
    } as LocalStorageConfig

    storageManager = new StorageManager(
      storageConfiguration,
      logger.storage,
    )
  }

  // 设置全局实例
  setGlobalStorageManager(storageManager)

  // Set storage manager in context for each request
  nitroApp.hooks.hook('request', (event) => {
    event.context.storage = storageManager
  })

  // Initialize local storage directory if needed
  const isLocalStorageProvider = (
    provider: StorageConfig,
  ): provider is LocalStorageConfig => {
    return provider?.provider === 'local'
  }

  if (isLocalStorageProvider(storageConfiguration)) {
    const localBase = storageConfiguration.basePath
    try {
      if (!path.isAbsolute(localBase)) {
        logger.storage.warn(`LOCAL basePath 不是绝对路径：${localBase}`)
      }
      await import('node:fs').then(async (m) => {
        const fs = m.promises as typeof import('node:fs').promises
        await fs.mkdir(localBase, { recursive: true })
      })
      logger.storage.success(`本地存储已就绪，位于：${localBase}`)
    } catch (err) {
      logger.storage.error('未能准备本地存储目录', err)
    }
  }

  // Setup event listeners for storage manager
  storageManager.on('provider-changed', async (event) => {
    logger.storage.info(
      `存储提供商已从 ${event.oldProvider} 更改为 ${event.provider}`,
    )

    // Re-initialize local storage if switching to local provider
    if (event.provider === 'local') {
      try {
        const newProvider = await settingsManager.storage.getActiveProvider()
        if (
          newProvider &&
          isLocalStorageProvider(newProvider.config)
        ) {
          const localBase = newProvider.config.basePath
          await import('node:fs').then(async (m) => {
            const fs = m.promises as typeof import('node:fs').promises
            await fs.mkdir(localBase, { recursive: true })
          })
          logger.storage.success(`本地存储已准备就绪，位于：${localBase}`)
        }
      } catch (error) {
        logger.storage.error('无法初始化本地存储：', error)
      }
    }
  })

  storageManager.on('provider-error', (event) => {
    logger.storage.error(
      `存储提供商 ${event.provider} 出错：${event.error?.message}`,
    )
  })

  logger.storage.success('存储插件初始化成功')
})
