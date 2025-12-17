import type { H3Event } from 'h3'

export async function safeUseTranslation(event: H3Event) {
  try {
    return await useTranslation(event)
  } catch (error) {
    return (key: string, fallback?: string) => fallback || key
  }
}
