import { drizzle } from 'drizzle-orm/libsql/node'
import { createClient } from '@libsql/client'
import * as schema from './schema.js'
import 'dotenv/config'
import { resolve } from 'path'

const dbUrl = process.env.DATABASE_URL || 'file:./data/data.db'

let clientUrl: string
if (dbUrl.startsWith('file:')) {
  const filePath = dbUrl.replace('file:', '')
  const absolutePath = resolve(process.cwd(), filePath)
  clientUrl = `file:${absolutePath}`
} else {
  clientUrl = dbUrl
}

const client = createClient({
  url: clientUrl
})

export const db = drizzle(client, { schema })

export * from './schema.js'
