import { useCallback, useEffect, useMemo, useState } from 'react';
import type { StandbyDisplay } from '../api';
import { kioskApi } from '../api';

interface Props {
  clock: string;
}

const SLIDE_INTERVAL_MS = 8000;
const POLL_MS = 30_000;

type Slide =
  | { kind: 'carousel'; key: string; title: string; imageUrl: string | null }
  | { kind: 'countdown'; key: string; title: string; targetAt: string }
  | { kind: 'mission'; key: string; board: StandbyDisplay['missionBoards'][0] }
  | { kind: 'birthday'; key: string; userName: string; message: string | null };

function hoursUntil(iso: string | null): number | null {
  if (!iso) return null;
  const diff = new Date(iso).getTime() - Date.now();
  if (diff <= 0) return 0;
  return Math.ceil(diff / 3600000);
}

function buildSlides(data: StandbyDisplay | null): Slide[] {
  if (!data) return [];

  const slides: Slide[] = [];

  const carousel = data.carousel.length
    ? data.carousel
    : [
        { id: -1, title: '轮播图1', imageUrl: null },
        { id: -2, title: '轮播图2', imageUrl: null },
        { id: -3, title: '轮播图3', imageUrl: null },
      ];

  for (const c of carousel) {
    slides.push({
      kind: 'carousel',
      key: `carousel-${c.id}`,
      title: c.title,
      imageUrl: c.imageUrl,
    });
  }

  for (const c of data.countdowns) {
    slides.push({
      kind: 'countdown',
      key: `countdown-${c.id}`,
      title: c.title,
      targetAt: c.targetAt,
    });
  }

  for (const b of data.missionBoards) {
    slides.push({ kind: 'mission', key: `mission-${b.id}`, board: b });
  }

  for (const b of data.birthdays) {
    slides.push({
      kind: 'birthday',
      key: `birthday-${b.id}`,
      userName: b.userName,
      message: b.message,
    });
  }

  return slides;
}

function CountdownUnits({ targetAt }: { targetAt: string }) {
  const [parts, setParts] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0, past: false });

  useEffect(() => {
    const tick = () => {
      const diff = new Date(targetAt).getTime() - Date.now();
      if (diff <= 0) {
        setParts({ days: 0, hours: 0, minutes: 0, seconds: 0, past: true });
        return;
      }
      const totalSec = Math.floor(diff / 1000);
      const days = Math.floor(totalSec / 86400);
      const hours = Math.floor((totalSec % 86400) / 3600);
      const minutes = Math.floor((totalSec % 3600) / 60);
      const seconds = totalSec % 60;
      setParts({ days, hours, minutes, seconds, past: false });
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [targetAt]);

  if (parts.past) {
    return <div className="standby-countdown__past">已到达</div>;
  }

  const units = [
    { label: '天', value: parts.days },
    { label: '时', value: parts.hours },
    { label: '分', value: parts.minutes },
    { label: '秒', value: parts.seconds },
  ];

  return (
    <div className="standby-countdown__units">
      {units.map((u) => (
        <div key={u.label} className="standby-countdown__unit">
          <div className="standby-countdown__num">{String(u.value).padStart(2, '0')}</div>
          <div className="standby-countdown__lbl">{u.label}</div>
        </div>
      ))}
    </div>
  );
}

export default function KioskStandby({ clock }: Props) {
  const [display, setDisplay] = useState<StandbyDisplay | null>(null);
  const [index, setIndex] = useState(0);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const d = await kioskApi.standbyDisplay();
      setDisplay(d);
      setError('');
    } catch (e: any) {
      setError(e?.message || '无法加载待机内容');
    }
  }, []);

  useEffect(() => {
    load();
    const poll = setInterval(load, POLL_MS);
    return () => clearInterval(poll);
  }, [load]);

  const slides = useMemo(() => buildSlides(display), [display]);

  useEffect(() => {
    if (index >= slides.length) setIndex(0);
  }, [slides.length, index]);

  useEffect(() => {
    if (slides.length <= 1) return;
    const t = setInterval(() => setIndex((i) => (i + 1) % slides.length), SLIDE_INTERVAL_MS);
    return () => clearInterval(t);
  }, [slides.length]);

  const current = slides[index] ?? null;

  return (
    <div className="kiosk-standby-full">
      <div className="kiosk-standby-full__stage">
        {error && !display ? (
          <div className="standby-slide standby-slide--placeholder">
            <div className="standby-slide__placeholder-text">{error}</div>
          </div>
        ) : !current ? (
          <div className="standby-slide standby-slide--placeholder">
            <div className="standby-slide__placeholder-text">加载中…</div>
          </div>
        ) : current.kind === 'carousel' ? (
          <div
            className="standby-slide standby-slide--carousel"
            style={
              current.imageUrl
                ? { backgroundImage: `url(${current.imageUrl})` }
                : undefined
            }
          >
            {!current.imageUrl && (
              <div className="standby-slide__placeholder-text">{current.title}</div>
            )}
          </div>
        ) : current.kind === 'countdown' ? (
          <div className="standby-slide standby-slide--countdown">
            <div className="standby-countdown__title">{current.title}</div>
            <CountdownUnits targetAt={current.targetAt} />
            <div className="standby-countdown__target">
              目标：{new Date(current.targetAt).toLocaleString('zh-CN')}
            </div>
          </div>
        ) : current.kind === 'mission' ? (
          <div className="standby-slide standby-slide--mission">
            <div className="standby-mission__header">
              {current.board.teamName && (
                <div className="standby-mission__team">{current.board.teamName}</div>
              )}
              <h2 className="standby-mission__title">{current.board.title}</h2>
              {(() => {
                const h = hoursUntil(current.board.deadlineAt);
                if (h == null) return null;
                return (
                  <div className="standby-mission__deadline">
                    {h > 0 ? `仅剩 ${h} 小时` : '已截止'}
                  </div>
                );
              })()}
            </div>
            {current.board.headline && (
              <pre className="standby-mission__headline">{current.board.headline}</pre>
            )}
            {current.board.gaps.length > 0 && (
              <ol className="standby-mission__gaps">
                {current.board.gaps.map((g, i) => (
                  <li key={i}>
                    <strong>{g.deliverable}</strong>：{g.assignees}
                  </li>
                ))}
              </ol>
            )}
            {current.board.progress.length > 0 && (
              <div className="standby-mission__progress">
                {current.board.progress.map((p) => (
                  <div key={p.label} className="standby-progress-row">
                    <div className="standby-progress-row__label">
                      {p.label}：{p.percent}%
                    </div>
                    <div className="standby-progress-row__bar">
                      <div
                        className="standby-progress-row__fill"
                        style={{ width: `${Math.min(100, Math.max(0, p.percent))}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="standby-slide standby-slide--birthday">
            <div className="standby-birthday__emoji">🎂🎉</div>
            <div className="standby-birthday__label">生日快乐</div>
            <h1 className="standby-birthday__name">{current.userName}</h1>
            {current.message && <p className="standby-birthday__msg">{current.message}</p>}
          </div>
        )}
      </div>

      {slides.length > 1 && (
        <div className="kiosk-standby-full__dots">
          {slides.map((s, i) => (
            <button
              key={s.key}
              type="button"
              className={`kiosk-standby-full__dot${i === index ? ' kiosk-standby-full__dot--active' : ''}`}
              onClick={() => setIndex(i)}
              aria-label={`第 ${i + 1} 页`}
            />
          ))}
        </div>
      )}

      <div className="kiosk-standby-full__footer">
        <span className="kiosk-standby-full__clock">{clock}</span>
      </div>
    </div>
  );
}
