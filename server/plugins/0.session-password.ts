export default defineNitroPlugin(() => {
  const password = process.env.NUXT_SESSION_PASSWORD

  if (!password) {
    throw new Error('Missing NUXT_SESSION_PASSWORD (required for session encryption)')
  }

  if (password.length < 32) {
    throw new Error('NUXT_SESSION_PASSWORD must be at least 32 characters long')
  }
})


