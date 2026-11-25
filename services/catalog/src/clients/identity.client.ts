import { callService } from '@assetstore/shared';
import { env } from '../config/env';

// Questions catalog asks the identity service. Its database is not ours, so we ask over HTTP.
export const IdentityClient = {
  // Username by user id. Names are only for display: when identity is down or fails, the error is logged
  // and the map is empty (ownerName null), so the catalogue keeps working.
  async usernames(ids: (string | null)[]): Promise<Map<string, string>> {
    const unique = [...new Set(ids.filter((id): id is string => id !== null))];
    if (unique.length === 0) return new Map();
    try {
      const { itemList } = await callService<{ itemList: { id: string; username: string }[] }>(
        env.identityUrl,
        `/internal/users?ids=${unique.join(',')}`,
        { internalKey: env.internalKey },
      );
      return new Map(itemList.map((user) => [user.id, user.username]));
    } catch {
      // callService has logged the details already.
      return new Map();
    }
  },

  // Account status of one user: 'ACTIVE', 'SUSPENDED', or null when identity does not know the user. Unlike the
  // names this decides whether an action is allowed, so a failure is not hidden: callService throws 503/502.
  async status(userId: string): Promise<string | null> {
    const { itemList } = await callService<{ itemList: { id: string; status: string }[] }>(
      env.identityUrl,
      `/internal/users?ids=${encodeURIComponent(userId)}`,
      { internalKey: env.internalKey },
    );
    // identity answers with ids in lower case.
    return itemList.find((user) => user.id === userId.toLowerCase())?.status ?? null;
  },
};
