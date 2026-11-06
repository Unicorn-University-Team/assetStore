import type { Request, Response } from "express";
import { UserModel } from "../models/user.model";
import { SessionModel } from "../models/session.model";
import { Prisma } from "../generated/prisma/client";
import * as argon2 from "argon2";
import { hashRefreshToken, generateRefreshToken } from "../auth/refreshToken";
import { signAccessToken } from "../auth/jwt";
import { env } from "../config/env";

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isValidUsername(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.trim().length > 0 &&
    value.trim().length <= 50
  );
}
function isValidEmail(value: unknown): value is string {
  return (
    typeof value === "string" &&
    emailRegex.test(value.trim()) &&
    value.trim().length > 0 &&
    value.trim().length <= 254
  );
}
function isValidRegistrationPassword(value: unknown): value is string {
  return typeof value === "string" && value.length >= 8;
}
function isValidLoginPassword(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}
export const AuthController = {
  async register(req: Request, res: Response) {
    const rawUsername = req.body.username;
    const rawEmail = req.body.email;
    const password = req.body.password;

    if (!isValidUsername(rawUsername)) {
      return res.status(400).json({ error: "Invalid username." });
    }
    const username = rawUsername.trim();

    if (!isValidEmail(rawEmail)) {
      return res.status(400).json({ error: "Invalid email." });
    }
    const email = rawEmail.trim().toLowerCase();

    if (!isValidRegistrationPassword(password)) {
      return res.status(400).json({ error: "Invalid password format." });
    }

    const existingUser = await UserModel.findByUsername(username);
    if (existingUser !== null) {
      return res.status(409).json({ error: "This username already exists." });
    }

    const existingEmail = await UserModel.findByEmail(email);
    if (existingEmail !== null) {
      return res.status(409).json({ error: "This email already exists" });
    }

    const passwordHash = await argon2.hash(password);

    try {
      const createdUser = await UserModel.create({
        username: username,
        email: email,
        passwordHash: passwordHash,
      });
      return res.status(201).json({
        id: createdUser.id,
        username: createdUser.username,
        email: createdUser.email,
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        return res
          .status(409)
          .json({ error: "Username or email already exists." });
      }
      throw error;
    }
  },

  async login(req: Request, res: Response) {
    const rawEmail = req.body.email;
    const password = req.body.password;

    if (!isValidEmail(rawEmail)) {
      return res.status(400).json({ error: "Invalid email." });
    }

    if (!isValidLoginPassword(password)) {
      return res.status(400).json({ error: "Invalid password format." });
    }

    const email = rawEmail.trim().toLowerCase();

    const user = await UserModel.findByEmail(email);
    if (user === null) {
      return res.status(401).json({ error: "Invalid email or password." });
    }

    const isPasswordCorrect = await argon2.verify(user.passwordHash, password);
    if (!isPasswordCorrect) {
      return res.status(401).json({
        error: "Invalid email or password.",
      });
    }

    if (user.status === "SUSPENDED") {
      return res.status(403).json({ error: "Account is suspended." });
    }

    const refreshToken = generateRefreshToken();
    const refreshTokenHash = hashRefreshToken(refreshToken);

    const refreshTokenLifetimeMs = 30 * 24 * 60 * 60 * 1000;
    const expiresAt = new Date(Date.now() + refreshTokenLifetimeMs);

    const userId = user.id;
    const session = await SessionModel.create({
      userId,
      refreshTokenHash,
      expiresAt,
    });

    const token = await signAccessToken(user.id, user.role, session.expiresAt);

    return res
      .cookie("access_token", token, {
        httpOnly: true,
        secure: env.cookieSecure,
        sameSite: "lax",
        maxAge: 15 * 60 * 1000,
      })
      .cookie("refresh_token", refreshToken, {
        httpOnly: true,
        secure: env.cookieSecure,
        sameSite: "lax",
        maxAge: 30 * 24 * 60 * 60 * 1000,
      })
      .status(200)
      .json({ message: "Login successful." });
  },

  async me(req: Request, res: Response) {
    const user = await UserModel.findPublicById(res.locals.userId);

    if (user === null) {
      return res.status(401).json({ error: "User no longer exists." });
    }

    return res.status(200).json({ user });
  },

  async refresh(req: Request, res: Response) {
    const refreshToken = req.cookies?.refresh_token;
    if (typeof refreshToken !== "string" || refreshToken.length === 0) {
      return res.status(401).json({ error: "Refresh token is required." });
    }
    const refreshTokenHash = hashRefreshToken(refreshToken);
    const session = await SessionModel.findByRefreshTokenHash(refreshTokenHash);
    if (!session) {
      return res.status(401).json({ error: "Invalid refresh token." });
    }

    if (
      session.expiresAt.getTime() <= Date.now() ||
      session.revokedAt !== null
    ) {
      return res.status(401).json({ error: "Unable to refresh the token." });
    }

    const user = await UserModel.findById(session.userId);

    if (!user) {
      return res.status(401).json({ error: "Invalid user." });
    }

    if (user.status !== "ACTIVE") {
      return res.status(401).json({ error: "Unable to refresh the token." });
    }

    const newRefreshToken = generateRefreshToken();
    const newRefreshTokenHash = hashRefreshToken(newRefreshToken);
    const newAccessToken = await signAccessToken(
      user.id,
      user.role,
      session.expiresAt,
    );

    const result = await SessionModel.updateRefreshTokenHash({
      sessionId: session.id,
      refreshTokenHash: refreshTokenHash,
      newRefreshTokenHash: newRefreshTokenHash,
    });

    if (result.count !== 1) {
      return res.status(401).json({ error: "Unable to refresh the token." });
    }

    return res
      .cookie("access_token", newAccessToken, {
        httpOnly: true,
        secure: env.cookieSecure,
        sameSite: "lax",
        maxAge: 15 * 60 * 1000,
      })
      .cookie("refresh_token", newRefreshToken, {
        httpOnly: true,
        secure: env.cookieSecure,
        sameSite: "lax",
        maxAge: session.expiresAt.getTime() - Date.now(),
      })
      .status(200)
      .json({ message: "Token refreshed successfully." });
  },

  async logout(req: Request, res: Response) {
    const refreshToken = req.cookies?.refresh_token;

    if (typeof refreshToken === "string" && refreshToken.length > 0) {
      const refreshTokenHash = hashRefreshToken(refreshToken);

      await SessionModel.revokeByRefreshTokenHash(refreshTokenHash);
    }

    return res
      .clearCookie("access_token", {
        httpOnly: true,
        secure: env.cookieSecure,
        sameSite: "lax",
        path: "/",
      })
      .clearCookie("refresh_token", {
        httpOnly: true,
        secure: env.cookieSecure,
        sameSite: "lax",
        path: "/",
      })
      .status(200)
      .json({ message: "Logout successful." });
  },
};
