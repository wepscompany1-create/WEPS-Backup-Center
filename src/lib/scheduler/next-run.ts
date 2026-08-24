import { DateTime } from "luxon";

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function isValidLocalTime(value: string) {
  return TIME_PATTERN.test(value);
}

export function computeNextScheduledBackupAt(options: {
  now: Date;
  localTime: string;
  timezone: string;
  intervalDays: number;
  lastScheduledAt?: Date | null;
}): Date {
  const { now, localTime, timezone, intervalDays, lastScheduledAt } = options;
  if (!isValidLocalTime(localTime)) {
    throw new Error("Invalid local time, expected HH:mm");
  }
  if (intervalDays < 1) {
    throw new Error("intervalDays must be >= 1");
  }

  const [hour, minute] = localTime.split(":").map(Number);
  const nowLocal = DateTime.fromJSDate(now, { zone: timezone });

  if (lastScheduledAt) {
    let candidate = DateTime.fromJSDate(lastScheduledAt, { zone: timezone }).set({
      hour,
      minute,
      second: 0,
      millisecond: 0,
    });
    do {
      candidate = candidate.plus({ days: intervalDays });
    } while (candidate <= nowLocal);
    return candidate.toUTC().toJSDate();
  }

  let next = nowLocal.set({ hour, minute, second: 0, millisecond: 0 });
  if (next <= nowLocal) {
    next = next.plus({ days: 1 });
  }
  return next.toUTC().toJSDate();
}

export function formatDateTimeAr(date: Date, timezone = "Asia/Aden") {
  return DateTime.fromJSDate(date, { zone: timezone }).setLocale("ar").toFormat("dd LLL yyyy، hh:mm a");
}

export function formatRelativeAr(date: Date, timezone = "Asia/Aden") {
  return DateTime.fromJSDate(date, { zone: timezone }).setLocale("ar").toRelative() ?? "";
}
