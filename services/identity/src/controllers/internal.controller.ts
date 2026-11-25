import type { Request, Response } from "express";
import { HttpError } from "@assetstore/shared";
import { UserModel } from "../models/user.model";
import { toAccountView } from "./user.controller";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_IDS = 100;

// Answers for other services (catalog...), not for the browser. See src/routes/internal.routes.ts.
export const InternalController = {
  // GET /internal/users?ids=<id>,<id> -> { itemList: [{ id, username, status }] }. Unknown ids are left out.
  // Catalog uses it to show who uploaded an asset (ownerName); community also checks that the author of a report is
  // not suspended (status ACTIVE or SUSPENDED, AM report/create step 3).
  async usernames(req: Request, res: Response) {
    const raw = req.query.ids;
    if (typeof raw !== "string") throw new HttpError(400, '"ids" must be a comma-separated list of ids');
    const ids = [...new Set(raw.split(",").map((id) => id.trim().toLowerCase()).filter(Boolean))];
    if (ids.length > MAX_IDS || ids.some((id) => !UUID.test(id))) {
      throw new HttpError(400, `"ids" must be at most ${MAX_IDS} uuids`);
    }
    const itemList = ids.length ? await UserModel.findUsernames(ids) : [];
    res.json({ itemList });
  },

  // POST /internal/users/:id/violations { reportId } (AM user/addViolation, called by community report/accept)
  // -> the account. 404 = no such account (userAccountDoesNotExist).
  async addViolation(req: Request<{ id: string }>, res: Response) {
    const { reportId } = (req.body ?? {}) as { reportId?: unknown };
    if (!UUID.test(req.params.id)) throw new HttpError(404, "User account not found");
    if (typeof reportId !== "string" || !UUID.test(reportId)) throw new HttpError(400, '"reportId" must be a uuid');
    const user = await UserModel.addViolation(req.params.id.toLowerCase(), reportId.toLowerCase());
    if (!user) throw new HttpError(404, "User account not found");
    res.json(toAccountView(user));
  },

  // POST /internal/users/:id/violations/:reportId/remove (AM user/removeViolation) -> {}.
  async removeViolation(req: Request<{ id: string; reportId: string }>, res: Response) {
    if (!UUID.test(req.params.id) || !UUID.test(req.params.reportId)) throw new HttpError(404, "User account not found");
    const found = await UserModel.removeViolation(req.params.id.toLowerCase(), req.params.reportId.toLowerCase());
    if (!found) throw new HttpError(404, "User account not found");
    res.json({});
  },
};
