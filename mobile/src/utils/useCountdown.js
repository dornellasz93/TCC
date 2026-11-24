import { useState, useEffect } from 'react';

export function useCountdown(expiresAt, onExpire) {
  const calc = () => {
    if (!expiresAt) {
      return { totalSeconds: 0, formatted: '00:00', isExpired: true };
    }
    const diff = Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000));
    const mins = Math.floor(diff / 60);
    const secs = diff % 60;
    return {
      totalSeconds: diff,
      formatted: `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`,
      isExpired: diff <= 0
    };
  };

  const [timeLeft, setTimeLeft] = useState(calc);

  useEffect(() => {
    setTimeLeft(calc());
    if (!expiresAt) return;
    const timer = setInterval(() => {
      const next = calc();
      setTimeLeft(next);
      if (next.isExpired) {
        clearInterval(timer);
        if (typeof onExpire === 'function') onExpire();
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [expiresAt]);

  return timeLeft;
}
