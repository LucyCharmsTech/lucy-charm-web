"use client"

import { useEffect } from 'react';
import { useHealthStore } from '@/stores/healthIndicatorStore';

export default function HealthIndicator() {
  const { status, loading, fetchHealth } = useHealthStore();

  useEffect(() => {
    fetchHealth();
    // Optional: recheck every 10s
    const interval = setInterval(() => fetchHealth(), 10000);
    return () => clearInterval(interval);
  }, [fetchHealth]);

  // Determine color
  const color =
    loading ? 'gray' : status === 'ok' ? 'green' : 'red';

  return (
    <div
      style={{
        height: '4px',
        width: '100%',
        backgroundColor: color,
        transition: 'background-color 0.3s ease',
      }}
    />
  );
}