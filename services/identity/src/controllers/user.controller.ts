import type { Request, Response } from "express";
import { HttpError } from "@assetstore/shared";
import type { Status } from "../generated/prisma/client";
import { UserModel } from "../models/user.model";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

type Account = NonNullable<Awaited<ReturnType<typeof UserModel.findAccount>>>;

// AM user/list and user/get dtoOut item.
export function toAccountView(user: Account) {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    role: user.role,
    status: user.status,
    confirmedViolations: user.confirmedViolations,
    suspendedAt: user.suspendedAt?.toISOString() ?? null,
    createdAt: user.createdAt.toISOString(),
  };
}

// AM status oneOf(active, suspended); the stored values are upper case.
function readStatus(value: unknown): Status | null {
  if (value === undefined) return null;
  const status = typeof value === "string" ? value.toUpperCase() : "";
  if (status !== "ACTIVE" && status !== "SUSPENDED") throw new HttpError(400, '"status" must be active or suspended');
  return status;
}

function readInteger(field: string, value: unknown, min: number, max: number | null, fallback: number): number {
  if (value === undefined) return fallback;
  const number = typeof value === "string" && /^\d+$/.test(value) ? Number(value) : NaN;
  if (!Number.isSafeInteger(number) || number < min || (max !== null && number > max)) {
    throw new HttpError(400, `"${field}" must be an integer ${max === null ? `>= ${min}` : `from ${min} to ${max}`}`);
  }
  return number;
}

// Admin only (routes/user.routes.ts). US-8: the list of suspended users and the profile of one user.
export const UserController = {
  // GET /api/users?status=&pageIndex=&pageSize= (AM user/list)
  async list(req: Request, res: Response) {
    const status = readStatus(req.query.status);
    const pageIndex = readInteger("pageIndex", req.query.pageIndex, 0, null, 0);
    const pageSize = readInteger("pageSize", req.query.pageSize, 1, MAX_PAGE_SIZE, DEFAULT_PAGE_SIZE);
    const { items, total } = await UserModel.findPage({ status, pageIndex, pageSize });
    res.json({ itemList: items.map(toAccountView), pageInfo: { pageIndex, pageSize, total } });
  },

  // GET /api/users/:id (AM user/get); the violation history comes from report/list (community).
  async get(req: Request<{ id: string }>, res: Response) {
    const user = UUID.test(req.params.id) ? await UserModel.findAccount(req.params.id.toLowerCase()) : null;
    if (!user) throw new HttpError(404, "User account not found");
    res.json(toAccountView(user));
  },
};
