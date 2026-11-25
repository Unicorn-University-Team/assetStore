import { prisma } from "../db/prisma";
import type { Status } from "../generated/prisma/client";

// AM userAccount limit maxConfirmedViolations: the account is suspended at this count.
export const MAX_CONFIRMED_VIOLATIONS = 5;

// What user/list, user/get, user/addViolation and auth/getCurrentUser return (AM userAccount without the password).
const ACCOUNT = {
  id: true,
  username: true,
  email: true,
  role: true,
  status: true,
  confirmedViolations: true,
  suspendedAt: true,
  createdAt: true,
} as const;

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
      select: { id: true, username: true, status: true },
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
        confirmedViolations: true,
        suspendedAt: true,
      },
    });
  },

  // AM user/get.
  async findAccount(id: string) {
    return prisma.user.findUnique({ where: { id }, select: ACCOUNT });
  },

  // AM user/list: a page of accounts, optionally only one status (suspended = US-8 list), newest suspension first
  // for suspended accounts, otherwise newest account first.
  async findPage(filter: { status: Status | null; pageIndex: number; pageSize: number }) {
    const where = filter.status ? { status: filter.status } : {};
    const [items, total] = await prisma.$transaction([
      prisma.user.findMany({
        where,
        select: ACCOUNT,
        orderBy: filter.status === "SUSPENDED" ? [{ suspendedAt: "desc" }, { createdAt: "desc" }] : [{ createdAt: "desc" }],
        skip: filter.pageIndex * filter.pageSize,
        take: filter.pageSize,
      }),
      prisma.user.count({ where }),
    ]);
    return { items, total };
  },

  // AM user/addViolation (US-6): +1 confirmed violation for this accepted report. The same report again changes
  // nothing. At the 5th violation the account is suspended and every session is revoked (access tokens still live up
  // to 15 minutes). null = no such account.
  async addViolation(id: string, reportId: string) {
    return prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({ where: { id }, select: { id: true } });
      if (!user) return null;
      const { count } = await tx.violation.createMany({ data: [{ reportId, userId: id }], skipDuplicates: true });
      if (count > 0) {
        const updated = await tx.user.update({
          where: { id },
          data: { confirmedViolations: { increment: 1 } },
          select: { confirmedViolations: true, status: true },
        });
        if (updated.confirmedViolations >= MAX_CONFIRMED_VIOLATIONS && updated.status === "ACTIVE") {
          await tx.user.update({ where: { id }, data: { status: "SUSPENDED", suspendedAt: new Date() } });
          await tx.session.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } });
        }
      }
      return tx.user.findUniqueOrThrow({ where: { id }, select: ACCOUNT });
    });
  },

  // AM user/removeViolation (US-6): takes back the violation of this report when report/accept could not save its
  // decision. A suspension caused by it is lifted (the revoked sessions stay revoked; the user signs in again).
  // false = no such account; a report that was never counted changes nothing.
  async removeViolation(id: string, reportId: string): Promise<boolean> {
    return prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({ where: { id }, select: { id: true } });
      if (!user) return false;
      const { count } = await tx.violation.deleteMany({ where: { reportId, userId: id } });
      if (count === 0) return true;
      const updated = await tx.user.update({
        where: { id },
        data: { confirmedViolations: { decrement: 1 } },
        select: { confirmedViolations: true, status: true },
      });
      if (updated.status === "SUSPENDED" && updated.confirmedViolations < MAX_CONFIRMED_VIOLATIONS) {
        await tx.user.update({ where: { id }, data: { status: "ACTIVE", suspendedAt: null } });
      }
      return true;
    });
  },
};
