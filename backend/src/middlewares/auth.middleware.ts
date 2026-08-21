import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config/env.ts';
import { UserJWTPayload, UserRole } from '../types/index.ts';

// Extend Express Request to include authenticated user
declare global {
  namespace Express {
    interface Request {
      user?: UserJWTPayload;
    }
  }
}

export function authenticate(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Access token is required in Authorization header (Format: Bearer <token>)',
    });
    return;
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, config.jwtSecret) as UserJWTPayload;
    req.user = decoded;
    next();
  } catch (err: any) {
    if (err.name === 'TokenExpiredError') {
      res.status(401).json({ error: 'TokenExpired', message: 'JWT token has expired. Please log in again.' });
      return;
    }
    res.status(401).json({ error: 'InvalidToken', message: 'Invalid or malformed authentication token.' });
    return;
  }
}

/**
 * Optional authentication: attaches user if token is present and valid, but doesn't block unauthenticated requests.
 */
export function optionalAuthenticate(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    try {
      const decoded = jwt.verify(token, config.jwtSecret) as UserJWTPayload;
      req.user = decoded;
    } catch {
      // Ignore errors for optional auth
    }
  }
  next();
}

/**
 * Role-based authorization guard
 */
export function authorizeRoles(...roles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized', message: 'User is not authenticated' });
      return;
    }

    if (!roles.includes(req.user.role)) {
      res.status(403).json({
        error: 'Forbidden',
        message: `Access denied. Requires one of [${roles.join(', ')}] role(s). Your role is: ${req.user.role}`,
      });
      return;
    }

    next();
  };
}
