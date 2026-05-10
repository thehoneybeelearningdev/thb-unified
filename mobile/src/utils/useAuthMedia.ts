/**
 * useAuthMedia — Downloads a remote media URL with auth headers
 * and returns a local file URI for rendering.
 * Caches by URL so repeat renders don't re-download.
 */
import { useState, useEffect, useRef } from 'react';
import { cacheDirectory, downloadAsync, getInfoAsync } from 'expo-file-system/legacy';
import { auth } from '../config/firebase';
import { Logger } from './logger';

const TAG = 'AuthMedia';

// In-memory cache: remote URL → local URI
const mediaCache = new Map<string, string>();

export function useAuthMedia(remoteUrl: string | undefined) {
  const [localUri, setLocalUri] = useState<string | null>(() => {
    if (!remoteUrl) return null;
    return mediaCache.get(remoteUrl) || null;
  });
  const [loading, setLoading] = useState(!localUri && !!remoteUrl);
  const [error, setError] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    if (!remoteUrl) return;

    // Already cached in memory
    const cached = mediaCache.get(remoteUrl);
    if (cached) {
      setLocalUri(cached);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(false);

    (async () => {
      try {
        const token = await auth.currentUser?.getIdToken(false);
        const headers: Record<string, string> = token
          ? { Authorization: `Bearer ${token}` }
          : {};

        // Create a safe filename from the URL
        const urlHash = remoteUrl.split('/').pop() || `${Date.now()}`;
        const safeName = urlHash.replace(/[^a-zA-Z0-9._-]/g, '_');
        const localPath = `${cacheDirectory}media_${safeName}`;

        // Check if file already exists on disk
        const fileInfo = await getInfoAsync(localPath);
        if (fileInfo.exists && fileInfo.size && fileInfo.size > 0) {
          if (!cancelled && mountedRef.current) {
            mediaCache.set(remoteUrl, localPath);
            setLocalUri(localPath);
            setLoading(false);
          }
          return;
        }

        // Download with auth headers
        const result = await downloadAsync(remoteUrl, localPath, { headers });

        if (cancelled || !mountedRef.current) return;

        if (result.status === 200) {
          mediaCache.set(remoteUrl, result.uri);
          setLocalUri(result.uri);
        } else {
          Logger.error(TAG, `Download failed: status ${result.status} for ${remoteUrl}`);
          setError(true);
        }
      } catch (err) {
        if (!cancelled && mountedRef.current) {
          Logger.error(TAG, `Error downloading media`, err);
          setError(true);
        }
      } finally {
        if (!cancelled && mountedRef.current) {
          setLoading(false);
        }
      }
    })();

    return () => { cancelled = true; };
  }, [remoteUrl]);

  return { localUri, loading, error };
}

/**
 * Download a file with auth headers and return the local URI.
 * Standalone function for imperative use (not a hook).
 */
export async function downloadWithAuth(
  remoteUrl: string,
  fileName?: string
): Promise<string | null> {
  try {
    const cached = mediaCache.get(remoteUrl);
    if (cached) return cached;

    const token = await auth.currentUser?.getIdToken(false);
    const headers: Record<string, string> = token
      ? { Authorization: `Bearer ${token}` }
      : {};

    const safeName = (fileName || remoteUrl.split('/').pop() || `${Date.now()}`)
      .replace(/[^a-zA-Z0-9._-]/g, '_');
    const localPath = `${cacheDirectory}dl_${safeName}`;

    const result = await downloadAsync(remoteUrl, localPath, { headers });
    if (result.status === 200) {
      mediaCache.set(remoteUrl, result.uri);
      return result.uri;
    }

    Logger.error(TAG, `Download failed: ${result.status}`);
    return null;
  } catch (err) {
    Logger.error(TAG, 'downloadWithAuth error', err);
    return null;
  }
}
