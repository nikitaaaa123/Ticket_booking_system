import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { store } from '../db/store.ts';
import { config } from '../config/env.ts';
import { User, UserRole, UserJWTPayload, RegisterRequestDTO, LoginRequestDTO } from '../types/index.ts';

export class AuthController {
  public static async register(req: Request, res: Response): Promise<void> {
    try {
      const { email, password, fullName, phoneNumber, role }: RegisterRequestDTO = req.body;

      // Validation
      if (!email || !password || !fullName) {
        res.status(400).json({
          error: 'ValidationError',
          message: 'Fields email, password, and fullName are required.',
        });
        return;
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        res.status(400).json({
          error: 'ValidationError',
          message: 'Please provide a valid email address.',
        });
        return;
      }

      if (password.length < 6) {
        res.status(400).json({
          error: 'ValidationError',
          message: 'Password must be at least 6 characters long.',
        });
        return;
      }

      const normalizedEmail = email.toLowerCase().trim();

      // Check existing user
      const existing = Array.from(store.users.values()).find(
        (u) => u.email.toLowerCase() === normalizedEmail
      );
      if (existing) {
        res.status(409).json({
          error: 'Conflict',
          message: 'An account with this email address already exists.',
        });
        return;
      }

      // Hash password
      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(password, salt);

      const assignedRole: UserRole = role && ['ADMIN', 'ORGANISER', 'CUSTOMER'].includes(role)
        ? role
        : 'CUSTOMER';

      const newUser: User = {
        id: `u-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        email: normalizedEmail,
        passwordHash,
        fullName: fullName.trim(),
        phoneNumber: phoneNumber?.trim(),
        role: assignedRole,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      store.users.set(newUser.id, newUser);

      // Generate JWT
      const payload: UserJWTPayload = {
        id: newUser.id,
        email: newUser.email,
        role: newUser.role,
        fullName: newUser.fullName,
      };

      const token = jwt.sign(payload, config.jwtSecret, {
        expiresIn: config.jwtExpiresIn as any,
      });

      res.status(201).json({
        message: 'User registered successfully',
        token,
        user: {
          id: newUser.id,
          email: newUser.email,
          fullName: newUser.fullName,
          phoneNumber: newUser.phoneNumber,
          role: newUser.role,
          createdAt: newUser.createdAt,
        },
      });
    } catch (error: any) {
      res.status(500).json({
        error: 'InternalServerError',
        message: error.message || 'An error occurred during registration',
      });
    }
  }

  public static async login(req: Request, res: Response): Promise<void> {
    try {
      const { email, password }: LoginRequestDTO = req.body;

      if (!email || !password) {
        res.status(400).json({
          error: 'ValidationError',
          message: 'Email and password are required.',
        });
        return;
      }

      const normalizedEmail = email.toLowerCase().trim();
      const user = Array.from(store.users.values()).find(
        (u) => u.email.toLowerCase() === normalizedEmail
      );

      if (!user) {
        res.status(401).json({
          error: 'InvalidCredentials',
          message: 'Invalid email or password.',
        });
        return;
      }

      const isMatch = await bcrypt.compare(password, user.passwordHash);
      if (!isMatch) {
        res.status(401).json({
          error: 'InvalidCredentials',
          message: 'Invalid email or password.',
        });
        return;
      }

      const payload: UserJWTPayload = {
        id: user.id,
        email: user.email,
        role: user.role,
        fullName: user.fullName,
      };

      const token = jwt.sign(payload, config.jwtSecret, {
        expiresIn: config.jwtExpiresIn as any,
      });

      res.status(200).json({
        message: 'Login successful',
        token,
        user: {
          id: user.id,
          email: user.email,
          fullName: user.fullName,
          phoneNumber: user.phoneNumber,
          role: user.role,
          createdAt: user.createdAt,
        },
      });
    } catch (error: any) {
      res.status(500).json({
        error: 'InternalServerError',
        message: error.message || 'An error occurred during login',
      });
    }
  }

  public static async getProfile(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Unauthorized', message: 'Not authenticated' });
        return;
      }

      const user = store.users.get(req.user.id);
      if (!user) {
        res.status(404).json({ error: 'NotFound', message: 'User not found' });
        return;
      }

      res.status(200).json({
        user: {
          id: user.id,
          email: user.email,
          fullName: user.fullName,
          phoneNumber: user.phoneNumber,
          role: user.role,
          createdAt: user.createdAt,
        },
      });
    } catch (error: any) {
      res.status(500).json({
        error: 'InternalServerError',
        message: error.message || 'Failed to fetch user profile',
      });
    }
  }
}
