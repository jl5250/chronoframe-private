#!/usr/bin/env node
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import Database from 'better-sqlite3'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { mkdirSync } from 'node:fs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

console.log('Running database migrations...')

try {
  const dataDir = join(__dirname, '../data')
  mkdirSync(dataDir, { recursive: true })

  const dbPath =
    process.env.DATABASE_URL || join(dataDir, 'app.sqlite3') || '/app/data/app.sqlite3'

  const sqlite = new Database(dbPath)
  const db = drizzle(sqlite)

  await migrate(db, {
    migrationsFolder: join(__dirname, '../server/database/migrations'),
  })

  console.log('Database migrations completed successfully!')
  sqlite.close()
} catch (error) {
  console.error('Migration failed:', error)
  process.exit(1)
}
