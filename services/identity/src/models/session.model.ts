import { prisma } from "../db/prisma";

export const SessionModel = {
  async create(data: {
    userId: string;
    refreshTokenHash: string;
    expiresAt: Date;
  }) {
    return await prisma.session.create({
      data: {
        userId: data.userId,
        refreshTokenHash: data.refreshTokenHash,
        expiresAt: data.expiresAt,
      },
    });
  },

  async findByRefreshTokenHash(refreshTokenHash: string) {
    return await prisma.session.findUnique({
      where: { refreshTokenHash: refreshTokenHash },
    });
  },

  async updateRefreshTokenHash(data: {
    sessionId: string;
    refreshTokenHash: string;
    newRefreshTokenHash: string;
  }) {
    return await prisma.session.updateMany({
      where: {
        id: data.sessionId,
        refreshTokenHash: data.refreshTokenHash,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      data: {
        refreshTokenHash: data.newRefreshTokenHash,
      },
    });
  },

  async revokeByRefreshTokenHash(refreshTokenHash: string) {
    return await prisma.session.updateMany({
      where: { refreshTokenHash: refreshTokenHash, revokedAt: null },
      data: {
        revokedAt: new Date(),
      },
    });
  },
};
