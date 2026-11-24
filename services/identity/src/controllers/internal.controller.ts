import type { Request, Response } from "express";
import { HttpError } from "@assetstore/shared";
import { UserModel } from "../models/user.model";

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
};
