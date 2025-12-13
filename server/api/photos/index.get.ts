import { desc, eq, inArray, notInArray } from 'drizzle-orm'

export default eventHandler(async (event) => {
  const db = useDB()
  const session = await getUserSession(event)

  if (session.user) {
    return db
      .select()
      .from(tables.photos)
      .orderBy(desc(tables.photos.dateTaken))
      .all()
  }

  const hiddenAlbumIds = db
    .select({ id: tables.albums.id })
    .from(tables.albums)
    .where(eq(tables.albums.isHidden, 1))
    .all()
    .map((album) => album.id)

  if (hiddenAlbumIds.length === 0) {
    return db
      .select()
      .from(tables.photos)
      .orderBy(desc(tables.photos.dateTaken))
      .all()
  }

  const hiddenPhotoIds = db
    .select({ photoId: tables.albumPhotos.photoId })
    .from(tables.albumPhotos)
    .where(inArray(tables.albumPhotos.albumId, hiddenAlbumIds))
    .all()
    .map((row) => row.photoId)

  if (hiddenPhotoIds.length === 0) {
    return db
      .select()
      .from(tables.photos)
      .orderBy(desc(tables.photos.dateTaken))
      .all()
  }

  return db
    .select()
    .from(tables.photos)
    .where(notInArray(tables.photos.id, hiddenPhotoIds))
    .orderBy(desc(tables.photos.dateTaken))
    .all()
})
