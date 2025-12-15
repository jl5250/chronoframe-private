import { isStorageEncryptionEnabled } from '~~/server/utils/publicFile'

export default defineEventHandler(async (event) => {
  await requireUserSession(event)

  const enabled = await isStorageEncryptionEnabled()
  return enabled
})
