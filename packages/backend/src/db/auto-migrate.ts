import { migrate } from 'drizzle-orm/libsql/migrator'
import { db } from './index.js'
import { resolve } from 'path'
import { existsSync } from 'fs'

export async function autoMigrate() {
  const migrationsFolder = resolve(process.cwd(), 'drizzle')
  
  if (!existsSync(migrationsFolder)) {
    console.warn('Migrations folder not found, skipping migration')
    return
  }
  
  console.log('Running database migrations...')
  await migrate(db, { migrationsFolder })
  console.log('Migrations applied successfully')
}
