import { useCallback, useEffect, useState } from 'react';

import {
  requestUserRegion,
  type LocationStatus,
} from '@/src/services/location';
import type { MapRegion } from '@/src/types/database';

export function useUserLocation() {
  const [region, setRegion] = useState<MapRegion | null>(null);
  const [status, setStatus] = useState<LocationStatus | 'pending'>('pending');

  const request = useCallback(async () => {
    setStatus('pending');
    const result = await requestUserRegion();
    if (result.status === 'granted') {
      setRegion(result.region);
      setStatus('granted');
      return result;
    }
    setStatus(result.status);
    return result;
  }, []);

  useEffect(() => {
    void request();
  }, [request]);

  return { region, status, request };
}
