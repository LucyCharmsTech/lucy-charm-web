'use client';

import { useEffect } from 'react';
import { useHealthStore } from '@/stores/healthIndicatorStore';

/** A development-only API health strip. */
export default function HealthIndicator() {
  const isDev = process.env.NODE_ENV !== 'production';
  const { status, loading, fetchHealth } = useHealthStore();

  useEffect(() => {
    if (!isDev) return;
    fetchHealth();
    const interval = setInterval(() => fetchHealth(), 10000);
    return () => clearInterval(interval);
  }, [fetchHealth, isDev]);

  if (!isDev) return null;

  const color = loading ? 'gray' : status === 'ok' ? 'green' : 'red';

  return (
    <div
      aria-hidden="true"
      title={`API health (development only): ${loading ? 'checking' : status}`}
      style={{
        height: '4px',
        width: '100%',
        backgroundColor: color,
        transition: 'background-color 0.3s ease',
      }}
    />
  );
}
