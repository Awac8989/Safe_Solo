import { useEffect, useState } from "react";

export interface Countdown {
  hours: number;
  minutes: number;
  seconds: number;
  totalMs: number;
  expired: boolean;
  pctRemaining: number; // 0..1
}

export const useCountdown = (lastCheckIn: number, graceHours: number): Countdown => {
  const total = graceHours * 60 * 60 * 1000;
  const calc = (): Countdown => {
    const elapsed = Date.now() - lastCheckIn;
    const remaining = Math.max(0, total - elapsed);
    const hours = Math.floor(remaining / 3_600_000);
    const minutes = Math.floor((remaining % 3_600_000) / 60_000);
    const seconds = Math.floor((remaining % 60_000) / 1000);
    return {
      hours,
      minutes,
      seconds,
      totalMs: remaining,
      expired: remaining <= 0,
      pctRemaining: total > 0 ? remaining / total : 0,
    };
  };
  const [c, setC] = useState<Countdown>(calc);
  useEffect(() => {
    setC(calc());
    const id = setInterval(() => setC(calc()), 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastCheckIn, graceHours]);
  return c;
};

export const fmt2 = (n: number) => n.toString().padStart(2, "0");
