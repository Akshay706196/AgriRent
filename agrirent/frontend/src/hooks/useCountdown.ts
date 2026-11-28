import { useState, useEffect } from 'react';
import { parseISO, isValid } from 'date-fns';

export interface CountdownState {
  secondsLeft: number;
  formatted: string;
  formattedTime: string;
  isExpired: boolean;
}

export function useCountdown(targetInput: string | Date | number | null | undefined): CountdownState {
  const [secondsLeft, setSecondsLeft] = useState<number>(0);

  useEffect(() => {
    if (!targetInput) {
      setSecondsLeft(0);
      return;
    }

    let targetTimeMs = 0;
    if (typeof targetInput === 'number') {
      targetTimeMs = Date.now() + targetInput * 1000;
    } else {
      const d = typeof targetInput === 'string' ? parseISO(targetInput) : targetInput;
      if (isValid(d)) {
        targetTimeMs = d.getTime();
      }
    }

    const update = () => {
      const diffMs = targetTimeMs - Date.now();
      const remainingSec = Math.max(0, Math.floor(diffMs / 1000));
      setSecondsLeft(remainingSec);
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [targetInput]);

  const isExpired = secondsLeft <= 0;

  const hours = Math.floor(secondsLeft / 3600);
  const minutes = Math.floor((secondsLeft % 3600) / 60);
  const seconds = secondsLeft % 60;

  let formatted = '';
  if (hours > 0) {
    formatted = `${hours}h ${String(minutes).padStart(2, '0')}m`;
  } else {
    formatted = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }

  return {
    secondsLeft,
    formatted,
    formattedTime: formatted,
    isExpired,
  };
}
