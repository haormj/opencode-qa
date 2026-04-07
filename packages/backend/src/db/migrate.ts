import { drizzle } from 'drizzle-orm/libsql/node'
import { migrate } from 'drizzle-orm/libsql/migrator'
import { createClient } from '@libsql/client'
import { resolve } from 'path'

const dbUrl = process.env.DATABASE_URL || 'file:./data/data.db'
let clientUrl
if (dbUrl.startsWith('file:')) {
  const filePath = dbUrl.replace('file:', '')
  clientUrl = `file:${resolve(process.cwd(), filePath)}`
} else {
  clientUrl = dbUrl
}

const client = createClient({ url: clientUrl })
const db = drizzle(client)

const migrationsFolder = resolve(process.cwd(), 'drizzle')

migrate(db, { migrationsFolder })
  .then(() => {
    console.log('Migration completed successfully')
    process.exit(0)
  })
  .catch((error) => {
    console.error('Migration failed:', error)
    process.exit(1)
  })
