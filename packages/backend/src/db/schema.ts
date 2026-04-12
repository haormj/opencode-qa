import { sqliteTable, text, integer, uniqueIndex, index } from 'drizzle-orm/sqlite-core'
import { relations } from 'drizzle-orm'

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  username: text('username').notNull().unique(),
  password: text('password'),
  email: text('email').unique(),
  displayName: text('display_name').notNull(),
  ssoProvider: text('sso_provider'),
  ssoUserId: text('sso_user_id'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull()
}, (table) => ({
  ssoUnique: uniqueIndex('sso_unique').on(table.ssoProvider, table.ssoUserId)
}))

export const roles = sqliteTable('roles', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull().unique(),
  description: text('description'),
  permissions: text('permissions').notNull()
})

export const userRoles = sqliteTable('user_roles', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  roleId: integer('role_id').notNull().references(() => roles.id, { onDelete: 'cascade' }),
  assignedAt: integer('assigned_at', { mode: 'timestamp' }).notNull()
}, (table) => ({
  userRoleUnique: uniqueIndex('user_role_unique').on(table.userId, table.roleId)
}))

export const bots = sqliteTable('bots', {
  id: text('id').primaryKey(),
  name: text('name').notNull().unique(),
  displayName: text('display_name').notNull(),
  avatar: text('avatar'),
  apiUrl: text('api_url').notNull(),
  apiKey: text('api_key'),
  provider: text('provider').notNull(),
  model: text('model').notNull(),
  agent: text('agent').notNull().default('plan'),
  description: text('description'),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull()
})

export const sessions = sqliteTable('sessions', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  status: text('status').notNull().default('active'),
  needHuman: integer('need_human', { mode: 'boolean' }).notNull().default(false),
  isDeleted: integer('is_deleted', { mode: 'boolean' }).notNull().default(false),
  opencodeSessionId: text('opencode_session_id'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull()
})

export const messages = sqliteTable('messages', {
  id: text('id').primaryKey(),
  sessionId: text('session_id').notNull().references(() => sessions.id, { onDelete: 'cascade' }),
  senderType: text('sender_type').notNull(),
  content: text('content').notNull(),
  reasoning: text('reasoning'),
  metadata: text('metadata'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  userId: text('user_id').references(() => users.id, { onDelete: 'cascade' }),
  botId: text('bot_id').references(() => bots.id, { onDelete: 'cascade' })
})

export const userTokens = sqliteTable('user_tokens', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  token: text('token').notNull().unique(),
  userAgent: text('user_agent'),
  ipAddress: text('ip_address'),
  expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  revokedAt: integer('revoked_at', { mode: 'timestamp' })
}, (table) => ({
  userIdIdx: index('user_tokens_user_id_idx').on(table.userId)
}))

export const systemSettings = sqliteTable('system_settings', {
  id: text('id').primaryKey(),
  key: text('key').notNull().unique(),
  value: text('value').notNull(),
  description: text('description'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull()
})

export const ssoProviders = sqliteTable('sso_providers', {
  id: text('id').primaryKey(),
  name: text('name').notNull().unique(),
  displayName: text('displayName').notNull(),
  icon: text('icon'),
  iconMimeType: text('icon_mime_type'),
  enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),
  sortOrder: integer('sortOrder').notNull().default(0),
  type: text('type').notNull().default('GENERIC'),
  authorizeUrl: text('authorize_url').notNull(),
  tokenUrl: text('token_url').notNull(),
  userInfoUrl: text('user_info_url'),
  clientId: text('client_id'),
  clientSecret: text('client_secret'),
  appId: text('app_id'),
  appSecret: text('app_secret'),
  scope: text('scope').notNull().default('openid profile email'),
  userIdField: text('user_id_field').notNull().default('sub'),
  usernameField: text('username_field').notNull().default('preferred_username'),
  emailField: text('email_field').notNull().default('email'),
  displayNameField: text('display_name_field').notNull().default('name'),
  advancedConfig: text('advanced_config'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull()
})

export const usersRelations = relations(users, ({ many }) => ({
  sessions: many(sessions),
  messages: many(messages),
  userRoles: many(userRoles),
  tokens: many(userTokens)
}))

export const rolesRelations = relations(roles, ({ many }) => ({
  userRoles: many(userRoles)
}))

export const userRolesRelations = relations(userRoles, ({ one }) => ({
  user: one(users, {
    fields: [userRoles.userId],
    references: [users.id]
  }),
  role: one(roles, {
    fields: [userRoles.roleId],
    references: [roles.id]
  })
}))

export const botsRelations = relations(bots, ({ many }) => ({
  messages: many(messages)
}))

export const sessionsRelations = relations(sessions, ({ one, many }) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id]
  }),
  messages: many(messages)
}))

export const messagesRelations = relations(messages, ({ one }) => ({
  session: one(sessions, {
    fields: [messages.sessionId],
    references: [sessions.id]
  }),
  user: one(users, {
    fields: [messages.userId],
    references: [users.id]
  }),
  bot: one(bots, {
    fields: [messages.botId],
    references: [bots.id]
  })
}))

export const userTokensRelations = relations(userTokens, ({ one }) => ({
  user: one(users, {
    fields: [userTokens.userId],
    references: [users.id]
  })
}))

export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert
export type Role = typeof roles.$inferSelect
export type NewRole = typeof roles.$inferInsert
export type UserRole = typeof userRoles.$inferSelect
export type NewUserRole = typeof userRoles.$inferInsert
export type Bot = typeof bots.$inferSelect
export type NewBot = typeof bots.$inferInsert
export type Session = typeof sessions.$inferSelect
export type NewSession = typeof sessions.$inferInsert
export type Message = typeof messages.$inferSelect
export type NewMessage = typeof messages.$inferInsert
export type UserToken = typeof userTokens.$inferSelect
export type NewUserToken = typeof userTokens.$inferInsert
export type SystemSetting = typeof systemSettings.$inferSelect
export type NewSystemSetting = typeof systemSettings.$inferInsert
export type SsoProvider = typeof ssoProviders.$inferSelect
export type NewSsoProvider = typeof ssoProviders.$inferInsert
