import { Request, Response, NextFunction } from 'express';
import { SESSION_COOKIE, findSessionUser, readCookie, type SessionUser } from '../auth/localAuth.ts';

export interface AuthRequest extends Request {
  user?: SessionUser;
}

export const sessionToken = (req: Request) => readCookie(req.headers.cookie, SESSION_COOKIE);

export const requireAuth = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const user = await findSessionUser(sessionToken(req));
    if (!user) {
      return res.status(401).json({ error: 'No autorizado: inicia sesión de nuevo.' });
    }
    req.user = user;
    return next();
  } catch (error) {
    console.error('Error checking session:', error);
    return res.status(500).json({ error: 'No se pudo verificar la sesión.' });
  }
};

/**
 * Like requireAuth, but never blocks: with a valid session it fills req.user,
 * otherwise the request continues as anonymous.
 */
export const optionalAuth = async (req: AuthRequest, _res: Response, next: NextFunction) => {
  try {
    req.user = (await findSessionUser(sessionToken(req))) ?? undefined;
  } catch {
    // Database hiccup: treat as anonymous.
  }
  return next();
};
