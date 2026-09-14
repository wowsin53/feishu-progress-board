import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc.js'
import timezone from 'dayjs/plugin/timezone.js'
dayjs.extend(utc)
dayjs.extend(timezone)
export const ZONE = 'Asia/Shanghai'
export const chinaTime = (date: string | number | Date = new Date()) => dayjs(date).tz(ZONE)
export const dateKey = (date: string | number | Date = new Date()) => chinaTime(date).format('YYYY-MM-DD')
export const dayStart = (date: string) => dayjs.tz(date, ZONE).startOf('day')
export const shiftDay = (date: string, days: number) => dayStart(date).add(days, 'day').format('YYYY-MM-DD')
export const deadlineValue = (value: string | number, exact = false) => {
  const parsed = /^\d{4}-\d{2}-\d{2}$/.test(String(value)) ? dayStart(String(value)) : chinaTime(value)
  if (!parsed.isValid()) throw new Error('INVALID_DATE')
  return (exact ? parsed : parsed.endOf('day')).toISOString()
}
export const shortDate = (date?: string) => date ? chinaTime(date).format('MM / DD') : '未设截止'
