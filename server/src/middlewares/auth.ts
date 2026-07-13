import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface AuthRequest extends Request {
  userId?: string;
}

export const authenticateToken = (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Expecting "Bearer <token>"

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, process.env.JWT_ACCESS_SECRET || 'default_jwt_access_secret_key_12345!', (err: any, user: any) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired access token' });
    }
    req.userId = user.userId;
    next();
  });
};
