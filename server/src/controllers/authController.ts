import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../config/db';
import { redis } from '../config/redis';

const ACCESS_TOKEN_SECRET = process.env.JWT_ACCESS_SECRET || 'default_jwt_access_secret_key_12345!';
const REFRESH_TOKEN_SECRET = process.env.JWT_REFRESH_SECRET || 'default_jwt_refresh_secret_key_12345!';

export const register = async (req: Request, res: Response) => {
  try {
    const { name, username, email, password, profilePhoto, bio } = req.body;

    if (!name || !username || !email || !password) {
      return res.status(400).json({ error: 'Name, username, email, and password are required' });
    }

    const emailExists = await prisma.user.findUnique({ where: { email } });
    if (emailExists) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    const usernameExists = await prisma.user.findUnique({ where: { username } });
    if (usernameExists) {
      return res.status(400).json({ error: 'Username already taken' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        name,
        username,
        email,
        passwordHash,
        profilePhoto: profilePhoto || null,
        bio: bio || null,
        settings: {
          create: {} // Create default settings
        }
      },
      include: {
        settings: true
      }
    });

    res.status(201).json({
      message: 'User registered successfully',
      user: {
        id: user.id,
        name: user.name,
        username: user.username,
        email: user.email,
        profilePhoto: user.profilePhoto,
        bio: user.bio,
      }
    });
  } catch (error: any) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = await prisma.user.findUnique({
      where: { email },
      include: { settings: true }
    });

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (user.isSuspended) {
      return res.status(403).json({ error: 'This account has been suspended by the administrator' });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const accessToken = jwt.sign({ userId: user.id }, ACCESS_TOKEN_SECRET, { expiresIn: '15m' });
    const refreshToken = jwt.sign({ userId: user.id }, REFRESH_TOKEN_SECRET, { expiresIn: '7d' });

    // Store refresh token in Redis (active session tracking)
    await redis.set(`refresh_token:${user.id}:${refreshToken}`, 'true', 'EX', 7 * 24 * 60 * 60);

    res.status(200).json({
      message: 'Login successful',
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        name: user.name,
        username: user.username,
        email: user.email,
        profilePhoto: user.profilePhoto,
        bio: user.bio,
        settings: user.settings
      }
    });
  } catch (error: any) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const refreshToken = async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({ error: 'Refresh token is required' });
    }

    let decoded: any;
    try {
      decoded = jwt.verify(refreshToken, REFRESH_TOKEN_SECRET);
    } catch (err) {
      return res.status(403).json({ error: 'Invalid or expired refresh token' });
    }

    // Check if refresh token exists in Redis
    const exists = await redis.get(`refresh_token:${decoded.userId}:${refreshToken}`);
    if (!exists) {
      return res.status(403).json({ error: 'Session invalidated or logged out' });
    }

    const accessToken = jwt.sign({ userId: decoded.userId }, ACCESS_TOKEN_SECRET, { expiresIn: '15m' });

    res.status(200).json({ accessToken });
  } catch (error: any) {
    console.error('Refresh token error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const logout = async (req: Request, res: Response) => {
  try {
    const { refreshToken, userId } = req.body;

    if (refreshToken && userId) {
      // Invalidate specific refresh token in Redis
      await redis.del(`refresh_token:${userId}:${refreshToken}`);
    }

    res.status(200).json({ message: 'Logged out successfully' });
  } catch (error: any) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const forgotPassword = async (req: Request, res: Response) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      // For security, don't reveal if email exists or not
      return res.status(200).json({ message: 'If the email exists, an OTP has been sent' });
    }

    // Generate a 6-digit OTP code
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Save OTP in Redis with 5-minute expiration (300 seconds)
    await redis.set(`otp:${email}`, otp, 'EX', 300);

    // Simulate sending email (print to console as SMTP is not configured)
    console.log(`\n======================================================`);
    console.log(`[PASSWORD RESET OTP FOR ${email}]: ${otp}`);
    console.log(`======================================================\n`);

    res.status(200).json({ message: 'If the email exists, an OTP has been sent' });
  } catch (error: any) {
    console.error('Forgot password error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const resetPassword = async (req: Request, res: Response) => {
  try {
    const { email, otp, newPassword } = req.body;

    if (!email || !otp || !newPassword) {
      return res.status(400).json({ error: 'Email, OTP, and new password are required' });
    }

    const savedOtp = await redis.get(`otp:${email}`);
    if (!savedOtp || savedOtp !== otp) {
      return res.status(400).json({ error: 'Invalid or expired OTP' });
    }

    // OTP is valid, hash new password and update
    const passwordHash = await bcrypt.hash(newPassword, 10);
    const user = await prisma.user.update({
      where: { email },
      data: { passwordHash }
    });

    // Delete OTP from Redis
    await redis.del(`otp:${email}`);

    // Revoke all active sessions for this user for security
    const userKeys = await redis.keys(`refresh_token:${user.id}:*`);
    if (userKeys.length > 0) {
      await redis.del(...userKeys);
    }

    res.status(200).json({ message: 'Password reset successfully' });
  } catch (error: any) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
