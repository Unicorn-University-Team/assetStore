import { Router } from "express";
import { prisma } from "../db/prisma";
import * as argon2 from "argon2";
import { Prisma } from "../generated/prisma/client";
import { signAccessToken } from "../auth/jwt";
import { requireAuth } from "../middleware/requireAuth";

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

  const token = await signAccessToken(user.id, user.role);

  return res
    .cookie("access_token", token, {
      httpOnly: true,
      secure: false,
      sameSite: "lax",
      maxAge: 15 * 60 * 1000,
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
    return res.status(401).json({ message: "User no longer exists." });
  }

  return res.status(200).json({ user });
});
