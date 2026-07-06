import { useCallback, useEffect, useState } from 'react';

import { Card, List, Spin, Tag } from 'antd';

import KioskHeader from './components/KioskHeader';

import KioskStandby from './components/KioskStandby';

import KioskBirthdayCelebration from './components/KioskBirthdayCelebration';

import KioskAttendance from './KioskAttendance';

import {

  kioskApi,

  type KioskSchedule,

  type StandbyDisplay,

  type TodayBoard,

  type TodayBoardAbsentItem,

} from './api';

import { avatarSrc } from './utils/avatar';



function nowClock(): string {

  return new Date().toLocaleTimeString('zh-CN', { hour12: false });

}



function avatarClass(index: number) {

  return index % 2 === 0 ? 'feed-avatar--orange' : 'feed-avatar--mint';

}



function FeedAvatar({

  name,

  avatarUrl,

  index,

}: {

  name: string;

  avatarUrl: string | null;

  index: number;

}) {

  const src = avatarSrc(avatarUrl);

  if (src) {

    return <img className="feed-avatar feed-avatar--img" src={src} alt={name} />;

  }

  return <div className={`feed-avatar ${avatarClass(index)}`}>{name.charAt(0)}</div>;

}



function AbsentRow({ item, index }: { item: TodayBoardAbsentItem; index: number }) {

  return (

    <div className="feed-item">

      <FeedAvatar name={item.name} avatarUrl={item.avatarUrl} index={index} />

      <div className="feed-item__main">

        <div className="feed-item__name">{item.name}</div>

        {item.teamName && <div className="feed-item__team">{item.teamName}</div>}

      </div>

      <div className="feed-item__right">

        <Tag>未签到</Tag>

        {!item.faceRegistered && <Tag color="default">未录脸</Tag>}

      </div>

    </div>

  );

}



function FeedListSection<T>({

  items,

  empty,

  renderRow,

  itemKey,

}: {

  items: T[];

  empty: React.ReactNode;

  renderRow: (item: T, index: number) => React.ReactNode;

  itemKey: (item: T, index: number) => string;

}) {

  return (

    <section className="kiosk-feed-section kiosk-feed-section--absent">

      <div className="kiosk-feed-section__body">

        {items.length === 0 ? (

          empty

        ) : (

          <List

            size="small"

            dataSource={items}

            renderItem={(it, index) => (

              <List.Item key={itemKey(it, index)}>{renderRow(it, index)}</List.Item>

            )}

          />

        )}

      </div>

    </section>

  );

}



interface Props {

  onAdminRequest?: () => void;

  headerExtra?: React.ReactNode;

}



const POLL_MS = 20_000;



export default function Kiosk({ onAdminRequest, headerExtra }: Props) {

  const [clock, setClock] = useState(nowClock());

  const [schedule, setSchedule] = useState<KioskSchedule | null>(null);

  const [standbyDisplay, setStandbyDisplay] = useState<StandbyDisplay | null>(null);

  const [scheduleError, setScheduleError] = useState('');

  const [todayBoard, setTodayBoard] = useState<TodayBoard | null>(null);

  const [boardLoading, setBoardLoading] = useState(false);



  const attendanceActive = schedule?.attendanceActive ?? false;

  const activeBirthdays = standbyDisplay?.birthdays ?? [];

  const birthdayActive = activeBirthdays.length > 0;

  const showAttendance = attendanceActive && !birthdayActive;



  const loadSchedule = useCallback(async () => {

    try {

      const s = await kioskApi.schedule();

      setSchedule(s);

      setScheduleError('');

    } catch (e: any) {

      setScheduleError(e?.message || '无法获取出勤调度');

    }

  }, []);



  const loadStandbyDisplay = useCallback(async () => {

    try {

      const d = await kioskApi.standbyDisplay();

      setStandbyDisplay(d);

    } catch {

      /* 待机内容失败不阻断打卡 */

    }

  }, []);



  const loadTodayBoard = useCallback(async () => {

    setBoardLoading(true);

    try {

      const board = await kioskApi.todayBoard();

      setTodayBoard(board);

    } catch {

      /* 看板失败不阻断打卡 */

    } finally {

      setBoardLoading(false);

    }

  }, []);



  useEffect(() => {

    loadSchedule();

    loadStandbyDisplay();

    const poll = setInterval(() => {

      loadSchedule();

      loadStandbyDisplay();

    }, POLL_MS);

    return () => clearInterval(poll);

  }, [loadSchedule, loadStandbyDisplay]);



  useEffect(() => {

    if (showAttendance) {

      loadTodayBoard();

      const poll = setInterval(loadTodayBoard, POLL_MS);

      return () => clearInterval(poll);

    }

  }, [showAttendance, loadTodayBoard]);



  useEffect(() => {

    loadSchedule();

    loadStandbyDisplay();

    if (showAttendance) loadTodayBoard();

  }, [clock.slice(0, 5), loadSchedule, loadStandbyDisplay, loadTodayBoard, showAttendance]);



  useEffect(() => {

    const t = setInterval(() => setClock(nowClock()), 1000);

    return () => clearInterval(t);

  }, []);



  const absent = todayBoard?.absent ?? [];

  const exemptDay = todayBoard?.exemptDay ?? false;



  return (

    <div className="kiosk-shell">

      <KioskHeader clock={clock} onLogoLongPress={onAdminRequest} extra={headerExtra} />



      <div className={`kiosk-body${!showAttendance ? ' kiosk-body--standby' : ''}`}>

        {!schedule && !scheduleError ? (

          <div className="kiosk-stage kiosk-stage--loading">

            <Spin size="large" tip="正在同步出勤安排…" />

          </div>

        ) : scheduleError ? (

          <div className="kiosk-stage">

            <div className="kiosk-hint kiosk-hint--error">{scheduleError}</div>

          </div>

        ) : birthdayActive ? (

          <KioskBirthdayCelebration birthdays={activeBirthdays} clock={clock} />

        ) : showAttendance ? (

          <KioskAttendance active onBoardRefresh={loadTodayBoard} />

        ) : (

          <KioskStandby clock={clock} />

        )}



        {showAttendance && (

          <Card title={`未签到（${absent.length}）`} className="kiosk-feed" size="small">

            {boardLoading && !todayBoard ? (

              <div className="kiosk-feed-loading">

                <Spin size="small" />

              </div>

            ) : exemptDay ? (

              <div className="kiosk-feed-empty">今日为休息日，无需打卡</div>

            ) : (

              <FeedListSection

                items={absent}

                empty={<div className="kiosk-feed-empty kiosk-feed-empty--compact">全员已到岗</div>}

                itemKey={(it) => String(it.userId)}

                renderRow={(it, index) => <AbsentRow item={it} index={index} />}

              />

            )}

          </Card>

        )}

      </div>

    </div>

  );

}


