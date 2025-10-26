// web/src/lib/useMe.js
import { useEffect, useState, useCallback } from "react";
import { getMe } from "./auth";

/** Lightweight session hook; caches user until hard refresh. */
export default function useMe() {
  const [me, setMe] = useState(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const u = await getMe();
      setMe(u || null);
    } catch {
      setMe(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { me, loading, refresh, isAuthed: !!me };
}
