import { useEffect, useState } from 'react';
import type { StandbyDisplay } from '../api';

type BirthdayItem = StandbyDisplay['birthdays'][0];

interface Props {
  birthdays: BirthdayItem[];
  clock: string;
}

const ROTATE_MS = 12_000;

export default function KioskBirthdayCelebration({ birthdays, clock }: Props) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (birthdays.length <= 1) return;
    const t = setInterval(() => setIndex((i) => (i + 1) % birthdays.length), ROTATE_MS);
    return () => clearInterval(t);
  }, [birthdays.length]);

  useEffect(() => {
    if (index >= birthdays.length) setIndex(0);
  }, [birthdays.length, index]);

  const current = birthdays[index] ?? birthdays[0];
  if (!current) return null;

  return (
    <div className="kiosk-standby-full kiosk-standby-full--birthday">
      <div className="kiosk-standby-full__stage">
        <div className="standby-slide standby-slide--birthday">
          <div className="standby-birthday__emoji">🎂🎉</div>
          <div className="standby-birthday__label">生日快乐</div>
          <h1 className="standby-birthday__name">{current.userName}</h1>
          {current.message && <p className="standby-birthday__msg">{current.message}</p>}
        </div>
      </div>

      {birthdays.length > 1 && (
        <div className="kiosk-standby-full__dots">
          {birthdays.map((b, i) => (
            <button
              key={b.id}
              type="button"
              className={`kiosk-standby-full__dot${i === index ? ' kiosk-standby-full__dot--active' : ''}`}
              onClick={() => setIndex(i)}
              aria-label={`${b.userName} 生日页`}
            />
          ))}
        </div>
      )}

      <div className="kiosk-standby-full__footer">
        <span className="kiosk-standby-full__clock">{clock}</span>
        <span className="kiosk-standby-full__next">今日生日庆祝 · {current.startTime} 起展示</span>
      </div>
    </div>
  );
}
