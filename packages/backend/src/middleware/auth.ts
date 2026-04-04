import { Request, Response, NextFunction } from 'express'

export interface AuthUser {
  id: string
  name?: string
  email?: string
}

export declare global {
  namespace Express {
    interface Request {
      user?: AuthUser
    }
  }
}

export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  // TODO: 对接内部 SSO 系统
  // 当前使用简单的 header 传递用户信息
  const userId = req.headers['x-user-id'] as string
  
  if (!userId) {
    // 开发模式：自动生成临时用户 ID
    req.user = { id: 'dev-user' }
    return next()
  }
  
  req.user = {
    id: userId,
    name: req.headers['x-user-name'] as string,
    email: req.headers['x-user-email'] as string
  }
  
  next()
}

export function ssoLogin(req: Request, res: Response) {
  // TODO: 实现 SSO 登录跳转
  // const redirectUrl = process.env.SSO_LOGIN_URL
  // res.redirect(redirectUrl)
  res.json({ message: 'SSO login not implemented yet' })
}

export function ssoCallback(req: Request, res: Response) {
  // TODO: 实现 SSO 回调处理
  // 1. 验证 SSO 返回的 token
  // 2. 获取用户信息
  // 3. 创建/更新本地用户
  // 4. 设置 session/cookie
  // 5. 重定向到前端
  res.json({ message: 'SSO callback not implemented yet' })
}
