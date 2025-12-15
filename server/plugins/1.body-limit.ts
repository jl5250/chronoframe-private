export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('request', (event) => {
    if (event.path === '/api/photos/upload') {
      event.node.req.headers['content-length-limit'] = '536870912'
    }
  })
})
