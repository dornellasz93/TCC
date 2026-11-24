import { useState, useEffect } from 'react';

/**
 * Hook para gerenciar a contagem regressiva das janelas de presença de 20 minutos
 * @param {string|null} expiresAt String de data ISO ou null
 * @param {Function} onExpire Callback executado quando o cronômetro chega a 00:00
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
