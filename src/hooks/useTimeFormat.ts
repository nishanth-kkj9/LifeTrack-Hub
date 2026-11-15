import { useEffect, useState } from 'react';
import { getTimeFormatPreference, TimeFormat } from '../lib/dateUtils.ts';

/**
 * Subscribes to 'lifetrack-time-format-changed' events so time displays
 * update immediately across the app when the user switches between 12h and 24h.
 */
export function useTimeFormat(): TimeFormat {
  const [timeFormat, setTimeFormat] = useState<TimeFormat>(() => getTimeFormatPreference());

  useEffect(() => {
    const handleTimeFormatChange = (event: Event) => {
      const detail = (event as CustomEvent<TimeFormat>).detail;
      if (detail === '12h' || detail === '24h') {
        setTimeFormat(detail);
      } else {
        setTimeFormat(getTimeFormatPreference());
      }
    };

    window.addEventListener('lifetrack-time-format-changed', handleTimeFormatChange);
    return () => {
      window.removeEventListener('lifetrack-time-format-changed', handleTimeFormatChange);
    };
  }, []);

  return timeFormat;
}
