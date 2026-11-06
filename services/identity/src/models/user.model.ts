import { prisma } from "../db/prisma";

export const UserModel = {
  async findById(userId: string) {
    return await prisma.user.findUnique({
      where: { id: userId },
    });
  },

  async findByUsername(username: string) {
    return await prisma.user.findUnique({
      where: { username: username },
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
