import { Router } from "express";
import { prisma } from "../db/prisma";
import * as argon2 from "argon2";
import { Prisma } from "../generated/prisma/client";
import { signAccessToken } from "../auth/jwt";
import { requireAuth } from "../middleware/requireAuth";
import { hashRefreshToken } from "../auth/refreshToken";
import { generateRefreshToken } from "../auth/refreshToken";
import { env } from "../config/env";

export const router = Router();
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
async function findExistingUser(value: string) {
  return await prisma.user.findUnique({
    where: { username: value },
  });
}

async function findExistingEmail(value: string) {
  return await prisma.user.findUnique({
    where: { email: value },
  });
}

router.post("/register", async (req, res) => {
  const rawUsername = req.body.username;
  const rawEmail = req.body.email;
  const password = req.body.password;
  //const status, id,  мы должны присваивать default

  // валидация входных данных
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

  // обработка регистрации

  const existingUser = await findExistingUser(username);
  if (existingUser !== null) {
    return res.status(409).json({ error: "This username already exists." });
  }

  const existingEmail = await findExistingEmail(email);
  if (existingEmail !== null) {
    return res.status(409).json({ error: "This email already exists" });
  }

  const passwordHash = await argon2.hash(password);

  //создание пользователя
  try {
    const createdUser = await prisma.user.create({
      data: {
        username: username,
        email: email,
        passwordHash: passwordHash,
      },
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
});

router.post("/login", async (req, res) => {
  const rawEmail = req.body.email;
  const password = req.body.password;

  if (!isValidEmail(rawEmail)) {
    return res.status(400).json({ error: "Invalid email." });
  }

  if (!isValidLoginPassword(password)) {
    return res.status(400).json({ error: "Invalid password format." });
  }

  const email = rawEmail.trim().toLowerCase();

  const user = await findExistingEmail(email);
  if (user === null) {
    return res.status(401).json({ error: "Invalid email or password." });
  }

  const isPasswordCorrect = await argon2.verify(user.passwordHash, password); //true or false
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

  const session = await prisma.session.create({
    data: {
      userId: user.id,
      refreshTokenHash: refreshTokenHash,
      expiresAt: expiresAt,
    },
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
});

router.get("/me", requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: res.locals.userId },
    select: {
      //не передаем пароль
      id: true,
      username: true,
      email: true,
      role: true,
      status: true,
    },
  });

  if (user === null) {
    return res.status(401).json({ error: "User no longer exists." });
  }

  return res.status(200).json({ user });
});

router.post("/refresh", async (req, res, next) => {
  const refreshToken = req.cookies?.refresh_token;
  if (typeof refreshToken !== "string" || refreshToken.length === 0) {
    return res.status(401).json({ error: "Refresh token is required." });
  }
  const refreshTokenHash = hashRefreshToken(refreshToken);
  const session = await prisma.session.findUnique({
    where: { refreshTokenHash: refreshTokenHash },
  });
  if (!session) {
    return res.status(401).json({ error: "Invalid refresh token." });
  }

  if (session.expiresAt.getTime() <= Date.now() || session.revokedAt !== null) {
    return res.status(401).json({ error: "Unable to refresh the token." });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
  });

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

  const result = await prisma.session.updateMany({
    where: {
      id: session.id,
      refreshTokenHash: refreshTokenHash,
      revokedAt: null,
      expiresAt: { gt: new Date() },
    },
    data: {
      refreshTokenHash: newRefreshTokenHash,
    },
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
});

router.post("/logout", async (req, res) => {
  const refreshToken = req.cookies?.refresh_token;

  if (typeof refreshToken === "string" && refreshToken.length > 0) {
    const refreshTokenHash = hashRefreshToken(refreshToken);

    await prisma.session.updateMany({
      where: { refreshTokenHash: refreshTokenHash, revokedAt: null },
      data: {
        revokedAt: new Date(),
      },
    });
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
});
