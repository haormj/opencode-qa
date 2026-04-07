import { createClient } from '@libsql/client'
import 'dotenv/config'
import { existsSync } from 'fs'
import { resolve } from 'path'

const dbUrl = process.env.DATABASE_URL || 'file:./data/data.db'
let dbPath: string

if (dbUrl.startsWith('file:')) {
  dbPath = dbUrl.replace('file:', '')
} else {
  console.error('DATABASE_URL must be a file path for SQLite')
  process.exit(1)
}

const absoluteDbPath = resolve(process.cwd(), dbPath)
const dbExists = existsSync(absoluteDbPath)

if (dbExists) {
  console.log('Database already exists at:', absoluteDbPath)
  process.exit(0)
}

console.log('Database not found, creating at:', absoluteDbPath)

const client = createClient({
  url: `file:${absoluteDbPath}`
})

async function createTables() {
  const statements = [
    `CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      password TEXT,
      email TEXT UNIQUE,
      display_name TEXT NOT NULL,
      sso_provider TEXT,
      sso_user_id TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS sso_unique ON users (sso_provider, sso_user_id)`,
    
    `CREATE TABLE IF NOT EXISTS roles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      description TEXT,
      permissions TEXT NOT NULL
    )`,
    
    `CREATE TABLE IF NOT EXISTS user_roles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
      assigned_at INTEGER NOT NULL
    )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS user_role_unique ON user_roles (user_id, role_id)`,
    
    `CREATE TABLE IF NOT EXISTS bots (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      display_name TEXT NOT NULL,
      avatar TEXT,
      api_url TEXT NOT NULL,
      api_key TEXT,
      provider TEXT NOT NULL,
      model TEXT NOT NULL,
      agent TEXT NOT NULL DEFAULT 'plan',
      description TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )`,
    
    `CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      need_human INTEGER NOT NULL DEFAULT 0,
      is_deleted INTEGER NOT NULL DEFAULT 0,
      opencode_session_id TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )`,
    
    `CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
      sender_type TEXT NOT NULL,
      content TEXT NOT NULL,
      reasoning TEXT,
      metadata TEXT,
      created_at INTEGER NOT NULL,
      user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
      bot_id TEXT REFERENCES bots(id) ON DELETE CASCADE
    )`,
    
    `CREATE TABLE IF NOT EXISTS user_tokens (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token TEXT NOT NULL UNIQUE,
      user_agent TEXT,
      ip_address TEXT,
      expires_at INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      revoked_at INTEGER
    )`,
    `CREATE INDEX IF NOT EXISTS user_tokens_user_id_idx ON user_tokens (user_id)`,
    
    `CREATE TABLE IF NOT EXISTS sso_providers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      displayName TEXT NOT NULL,
      icon TEXT,
      icon_mime_type TEXT,
      enabled INTEGER NOT NULL DEFAULT 1,
      sortOrder INTEGER NOT NULL DEFAULT 0,
      type TEXT NOT NULL DEFAULT 'GENERIC',
      authorize_url TEXT NOT NULL,
      token_url TEXT NOT NULL,
      user_info_url TEXT,
      client_id TEXT,
      client_secret TEXT,
      app_id TEXT,
      app_secret TEXT,
      scope TEXT NOT NULL DEFAULT 'openid profile email',
      user_id_field TEXT NOT NULL DEFAULT 'sub',
      username_field TEXT NOT NULL DEFAULT 'preferred_username',
      email_field TEXT NOT NULL DEFAULT 'email',
      display_name_field TEXT NOT NULL DEFAULT 'name',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )`
  ]
  
  for (const stmt of statements) {
    await client.execute(stmt)
  }
  
  console.log('Database tables created successfully')
}

createTables()
  .then(() => {
    console.log('Database initialization completed')
    process.exit(0)
  })
  .catch((error) => {
    console.error('Database initialization failed:', error)
    process.exit(1)
  })
