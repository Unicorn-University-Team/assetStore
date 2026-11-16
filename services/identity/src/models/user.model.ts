import { prisma } from "../db/prisma";

export const UserModel = {
  async findById(userId: string) {
    return await prisma.user.findUnique({
      where: { id: userId },
    });
  },

  // Ignores case: "Tester" and "tester" are the same name (unique index on lower(username) in the migration).
  async findByUsername(username: string) {
    return await prisma.user.findFirst({
      where: { username: { equals: username, mode: "insensitive" } },
    });
  },

  async findByEmail(email: string) {
    return await prisma.user.findUnique({
      where: { email: email },
    });
  },

  async create(data: {
    username: string;
    email: string;
    passwordHash: string;
  }) {
    return prisma.user.create({
      data: {
        username: data.username,
        email: data.email,
        passwordHash: data.passwordHash,
      },
    });
  },

  // Usernames for other services (GET /internal/users).
  async findUsernames(ids: string[]) {
    return await prisma.user.findMany({
      where: { id: { in: ids } },
      select: { id: true, username: true },
    });
  },

  async findPublicById(resLocalUserId: string) {
    return await prisma.user.findUnique({
      where: { id: resLocalUserId },
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        status: true,
      },
    });
  },
};
