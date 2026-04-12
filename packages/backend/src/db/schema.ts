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

export const assistants = sqliteTable('assistants', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  description: text('description'),
  defaultBotId: text('default_bot_id').notNull().references(() => bots.id, { onDelete: 'restrict' }),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull()
})

export const userAssistantBots = sqliteTable('user_assistant_bots', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  assistantId: text('assistant_id').notNull().references(() => assistants.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  botId: text('bot_id').notNull().references(() => bots.id, { onDelete: 'restrict' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull()
}, (table) => ({
  userAssistantUnique: uniqueIndex('user_assistant_unique').on(table.assistantId, table.userId)
}))

export const sessions = sqliteTable('sessions', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  assistantId: text('assistant_id').references(() => assistants.id, { onDelete: 'set null' }),
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
  botId: text('bot_id').references(() => bots.id, { onDelete: 'set null' })
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

export const skillCategories = sqliteTable('skill_categories', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  icon: text('icon'),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull()
})

export const skills = sqliteTable('skills', {
  id: text('id').primaryKey(),
  name: text('name').notNull().unique(),
  displayName: text('display_name').notNull(),
  slug: text('slug').notNull().unique(),
  description: text('description'),
  content: text('content'),
  categoryId: integer('category_id').notNull().references(() => skillCategories.id, { onDelete: 'restrict' }),
  authorId: text('author_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  version: text('version').notNull().default('1.0.0'),
  icon: text('icon'),
  tags: text('tags'),
  installCommand: text('install_command'),
  status: text('status').notNull().default('pending'),
  rejectReason: text('reject_reason'),
  downloadCount: integer('download_count').notNull().default(0),
  favoriteCount: integer('favorite_count').notNull().default(0),
  averageRating: integer('average_rating', { mode: 'real' }).notNull().default(0),
  ratingCount: integer('rating_count').notNull().default(0),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull()
})

export const skillFavorites = sqliteTable('skill_favorites', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  skillId: text('skill_id').notNull().references(() => skills.id, { onDelete: 'cascade' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull()
}, (table) => ({
  userSkillUnique: uniqueIndex('user_skill_unique').on(table.userId, table.skillId)
}))

export const skillRatings = sqliteTable('skill_ratings', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  skillId: text('skill_id').notNull().references(() => skills.id, { onDelete: 'cascade' }),
  score: integer('score').notNull(),
  review: text('review'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull()
}, (table) => ({
  userSkillRatingUnique: uniqueIndex('user_skill_rating_unique').on(table.userId, table.skillId)
}))

export const usersRelations = relations(users, ({ many }) => ({
  sessions: many(sessions),
  messages: many(messages),
  userRoles: many(userRoles),
  tokens: many(userTokens),
  skills: many(skills),
  skillFavorites: many(skillFavorites),
  skillRatings: many(skillRatings)
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
  messages: many(messages),
  assistants: many(assistants),
  userAssistantBots: many(userAssistantBots)
}))

export const assistantsRelations = relations(assistants, ({ one, many }) => ({
  defaultBot: one(bots, {
    fields: [assistants.defaultBotId],
    references: [bots.id]
  }),
  sessions: many(sessions),
  userAssistantBots: many(userAssistantBots)
}))

export const userAssistantBotsRelations = relations(userAssistantBots, ({ one }) => ({
  assistant: one(assistants, {
    fields: [userAssistantBots.assistantId],
    references: [assistants.id]
  }),
  user: one(users, {
    fields: [userAssistantBots.userId],
    references: [users.id]
  }),
  bot: one(bots, {
    fields: [userAssistantBots.botId],
    references: [bots.id]
  })
}))

export const sessionsRelations = relations(sessions, ({ one, many }) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id]
  }),
  assistant: one(assistants, {
    fields: [sessions.assistantId],
    references: [assistants.id]
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

export const skillCategoriesRelations = relations(skillCategories, ({ many }) => ({
  skills: many(skills)
}))

export const skillsRelations = relations(skills, ({ one, many }) => ({
  category: one(skillCategories, {
    fields: [skills.categoryId],
    references: [skillCategories.id]
  }),
  author: one(users, {
    fields: [skills.authorId],
    references: [users.id]
  }),
  favorites: many(skillFavorites),
  ratings: many(skillRatings)
}))

export const skillFavoritesRelations = relations(skillFavorites, ({ one }) => ({
  user: one(users, {
    fields: [skillFavorites.userId],
    references: [users.id]
  }),
  skill: one(skills, {
    fields: [skillFavorites.skillId],
    references: [skills.id]
  })
}))

export const skillRatingsRelations = relations(skillRatings, ({ one }) => ({
  user: one(users, {
    fields: [skillRatings.userId],
    references: [users.id]
  }),
  skill: one(skills, {
    fields: [skillRatings.skillId],
    references: [skills.id]
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
export type Assistant = typeof assistants.$inferSelect
export type NewAssistant = typeof assistants.$inferInsert
export type UserAssistantBot = typeof userAssistantBots.$inferSelect
export type NewUserAssistantBot = typeof userAssistantBots.$inferInsert
export type SkillCategory = typeof skillCategories.$inferSelect
export type NewSkillCategory = typeof skillCategories.$inferInsert
export type Skill = typeof skills.$inferSelect
export type NewSkill = typeof skills.$inferInsert
export type SkillFavorite = typeof skillFavorites.$inferSelect
export type NewSkillFavorite = typeof skillFavorites.$inferInsert
export type SkillRating = typeof skillRatings.$inferSelect
export type NewSkillRating = typeof skillRatings.$inferInsert
