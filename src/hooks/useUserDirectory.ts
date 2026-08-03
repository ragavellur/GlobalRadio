import { useEffect, useState } from 'react';
import {
  fetchUserDirectory,
  SUPABASE_ENABLED,
  type DirectoryScope,
  type UserDirectoryEntry,
} from '../lib/social';

const POLL_INTERVAL = 10_000;

/**
 * Polls the user directory while the panel is open. Refetches when the
 * scope (country / city / station) changes.
 */
export function useUserDirectory(active: boolean, scope: DirectoryScope): UserDirectoryEntry[] {
  const [users, setUsers] = useState<UserDirectoryEntry[]>([]);

  useEffect(() => {
    setUsers([]);
    if (!active || !SUPABASE_ENABLED) return;
    let mounted = true;

    const load = async () => {
      const list = await fetchUserDirectory(scope);
      if (mounted) setUsers(list);
    };

    load();
    const t = setInterval(load, POLL_INTERVAL);
    return () => {
      mounted = false;
      clearInterval(t);
    };
  }, [active, scope.country, scope.cityKey, scope.stationUrl]);

  return users;
}
