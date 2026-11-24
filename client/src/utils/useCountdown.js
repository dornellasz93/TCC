import { useState, useEffect } from 'react';

/**
 * Hook to manage countdown for 20-minute presence windows
 * @param {string|null} expiresAt ISO Date string or null
 * @param {Function} onExpire Callback when timer reaches 00:00
 */
export function useCountdown(expiresAt, onExpire) {
  const calculateRemaining = () => {
    if (!expiresAt) {
      return { totalSeconds: 0, minutes: '00', seconds: '00', formatted: '00:00', isExpired: true };
    }
    const diff = Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000));
    const mins = Math.floor(diff / 60);
    const secs = diff % 60;
    return {
      totalSeconds: diff,
      minutes: String(mins).padStart(2, '0'),
      seconds: String(secs).padStart(2, '0'),
      formatted: `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`,
      isExpired: diff <= 0
    };
  };

  const [timeLeft, setTimeLeft] = useState(calculateRemaining);

  useEffect(() => {
    setTimeLeft(calculateRemaining());
    if (!expiresAt) return;

    const interval = setInterval(() => {
      const current = calculateRemaining();
      setTimeLeft(current);
      if (current.isExpired) {
        clearInterval(interval);
        if (typeof onExpire === 'function') {
          onExpire();
        }
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [expiresAt]);

  return timeLeft;
}
