/**
 * Bare token-refresh call — intentionally bypasses the shared Axios instance
 * so the 401 interceptor cannot recurse into itself.
 */

import axios from 'axios';
import type { AuthToken } from '@/types/api';

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

export async function requestTokenRefresh(
  refreshToken: string,
): Promise<AuthToken> {
  const res = await axios.post<AuthToken>(
    `${API_BASE}/auth/refresh`,
    { refresh_token: refreshToken },
    {
      headers: { 'Content-Type': 'application/json' },
      timeout: 30000,
    },
  );
  return res.data;
}
