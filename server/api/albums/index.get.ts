export default eventHandler(async (event) => {
  const db = useDB()
  const session = await getUserSession(event)
  const isLoggedIn = !!session.user

  // 获取所有相册，按创建时间倒序
  let albumsQuery = db.select().from(tables.albums)

  if (!isLoggedIn) {
    albumsQuery = albumsQuery.where(eq(tables.albums.isHidden, 0))
  }

  const albums = await albumsQuery

  // 如果用户未登录，获取所有隐藏相册中的照片ID，用于过滤
  let hiddenPhotoIds: string[] = []
  if (!isLoggedIn) {
    const hiddenAlbumIds = db
      .select({ id: tables.albums.id })
      .from(tables.albums)
      .where(eq(tables.albums.isHidden, 1))
      .all()
      .map((album) => album.id)

    if (hiddenAlbumIds.length > 0) {
      hiddenPhotoIds = db
        .select({ photoId: tables.albumPhotos.photoId })
        .from(tables.albumPhotos)
        .where(inArray(tables.albumPhotos.albumId, hiddenAlbumIds))
        .all()
        .map((row) => row.photoId)
    }
  }

  // 为每个相册获取照片 ID 列表（避免循环引用）
  const albumsWithPhotoIds = await Promise.all(
    albums.map(async (album) => {
      const photoIds = await db
        .select({
          photoId: tables.albumPhotos.photoId,
          position: tables.albumPhotos.position,
        })
        .from(tables.albumPhotos)
        .where(eq(tables.albumPhotos.albumId, album.id))
        .orderBy(tables.albumPhotos.position)

      // 如果用户未登录，过滤掉在隐藏相册中的照片
      const filteredPhotoIds = !isLoggedIn
        ? photoIds.filter((p) => !hiddenPhotoIds.includes(p.photoId))
        : photoIds

      return {
        ...album,
        // 即使是空相册，也返回空数组而不是 undefined
        photoIds:
          filteredPhotoIds.length > 0
            ? filteredPhotoIds.map((p) => p.photoId)
            : [],
      }
    }),
  )

  // 按创建时间倒序排列
  return albumsWithPhotoIds.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  )
})
