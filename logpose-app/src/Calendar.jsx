import { useState, useEffect, useRef, useCallback } from 'react'
import {
  getCalendarEvents, insertCalendarEvent, updateCalendarEvent,
  markCalendarEventPendingDelete, purgeCalendarEvent,
  markCalendarEventSynced, getUnsyncedCalendarEvents,
  getPendingDeleteCalendarEvents, upsertCalendarEventFromServer,
  pruneStaleCalendarEvents,
} from './db/database'
import {
  isServerReachable,
  fetchAllCalendarEventsFromServer, postCalendarEventToServer,
  putCalendarEventToServer, deleteCalendarEventFromServer,
} from './api/client'
import { useLang } from './LangContext.jsx'
import { IconClose, IconChevronLeft, IconChevronRight } from './Icons.jsx'
import DateField from './DateField.jsx'

let syncingCalendar = false

const HOURS    = Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2,'0')}:00`)
const HOUR_H   = 56
const COLORS   = ['#7c3aed','#2563eb','#16a34a','#ea580c','#dc2626']

function toDateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}
function startOfWeek(d) {
  const day = new Date(d)
  day.setDate(day.getDate() - (day.getDay() + 6) % 7)
  return day
}
function buildMonthCells(year, month) {
  const offset = (new Date(year, month, 1).getDay() + 6) % 7
  const total  = new Date(year, month + 1, 0).getDate()
  const cells  = Array(offset).fill(null)
  for (let d = 1; d <= total; d++) cells.push(d)
  while (cells.length % 7 !== 0) cells.push(null)
  return cells
}
function timeToMinutes(t) {
  if (!t) return 0
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}
function eventsForDate(events, dateStr, dow) {
  return events.filter(e => {
    if (e.recurrence === 'none')   return e.date === dateStr
    if (e.recurrence === 'daily')  return true
    if (e.recurrence === 'weekly') {
      const days = e.days_of_week ? e.days_of_week.split(',').map(Number) : []
      return days.includes(dow)
    }
    return false
  })
}
function useScrollToHour(ref, dayEvents = []) {
  useEffect(() => {
    if (!ref.current) return
    const timed = dayEvents.filter(e => e.start_time)
    const earliest = timed.length
      ? Math.min(...timed.map(e => timeToMinutes(e.start_time)))
      : null
    const scrollHour = earliest !== null
      ? Math.max(0, Math.floor(earliest / 60) - 1)
      : Math.max(0, new Date().getHours() - 1)
    ref.current.scrollTop = scrollHour * HOUR_H
  }, [dayEvents])
}

const EMPTY_FORM = {
  title: '', recurrence: 'none', date: '', days_of_week: [],
  start_time: '', end_time: '', color: '#7c3aed', notes: '',
}

export default function Calendar() {
  const { t: tr, locale } = useLang()
  const now      = new Date()
  const todayStr = toDateStr(now)
  const [view, setView]     = useState('month')
  const [cursor, setCursor] = useState(new Date(now))
  const [events, setEvents]     = useState([])
  const [modal, setModal]       = useState(null)
  const [form, setForm]         = useState(EMPTY_FORM)

  const loadEvents = useCallback(async () => {
    setEvents(await getCalendarEvents())
  }, [])

  const sync = useCallback(async () => {
    if (syncingCalendar) return
    syncingCalendar = true
    try {
      if (!await isServerReachable()) return
      for (const e of await getUnsyncedCalendarEvents()) {
        if (e.server_id) {
          await putCalendarEventToServer(e.server_id, e)
          await markCalendarEventSynced(e.id, e.server_id)
        } else {
          const created = await postCalendarEventToServer(e)
          await markCalendarEventSynced(e.id, created.id)
        }
      }
      for (const e of await getPendingDeleteCalendarEvents()) {
        await deleteCalendarEventFromServer(e.server_id)
        await purgeCalendarEvent(e.id)
      }
      const serverEvents = await fetchAllCalendarEventsFromServer()
      for (const e of serverEvents) await upsertCalendarEventFromServer(e)
      await pruneStaleCalendarEvents(new Set(serverEvents.map(e => e.id)))
    } catch (e) { console.warn('calendar sync failed:', e) } finally {
      syncingCalendar = false
      await loadEvents()
    }
  }, [loadEvents])

  useEffect(() => {
    loadEvents().then(() => sync())
  }, [])

  function prev() {
    const d = new Date(cursor)
    if (view === 'day')       d.setDate(d.getDate() - 1)
    else if (view === 'week') d.setDate(d.getDate() - 7)
    else { d.setDate(1); d.setMonth(d.getMonth() - 1) }
    setCursor(d)
  }
  function next() {
    const d = new Date(cursor)
    if (view === 'day')       d.setDate(d.getDate() + 1)
    else if (view === 'week') d.setDate(d.getDate() + 7)
    else { d.setDate(1); d.setMonth(d.getMonth() + 1) }
    setCursor(d)
  }
  function goToday() { setCursor(new Date(now)) }
  function openDay(d) { setCursor(d); setView('day') }

  function openCreate(prefill = {}) {
    setForm({ ...EMPTY_FORM, ...prefill })
    setModal({ mode: 'create' })
  }
  function openEdit(event) {
    setForm({
      title:        event.title,
      recurrence:   event.recurrence,
      date:         event.date || '',
      days_of_week: event.days_of_week ? event.days_of_week.split(',').map(Number) : [],
      start_time:   event.start_time || '',
      end_time:     event.end_time || '',
      color:        event.color || '#7c3aed',
      notes:        event.notes || '',
    })
    setModal({ mode: 'edit', event })
  }

  async function handleSave(e) {
    e.preventDefault()
    if (form.recurrence === 'none' && !form.date) return  // antes lo cubría el `required` nativo
    if (form.recurrence === 'weekly' && form.days_of_week.length === 0) return  // evita days_of_week="" (rompería el sync)
    const data = {
      title:       form.title.trim(),
      recurrence:  form.recurrence,
      date:        form.recurrence === 'none' ? form.date : null,
      days_of_week: form.recurrence === 'weekly' ? form.days_of_week.sort().join(',') : null,
      start_time:  form.start_time || null,
      end_time:    form.end_time || null,
      color:       form.color,
      notes:       form.notes.trim() || null,
    }
    if (modal.mode === 'create') {
      await insertCalendarEvent(data)
    } else {
      await updateCalendarEvent(modal.event.id, data)
    }
    setModal(null)
    await loadEvents()
    sync()
  }

  async function handleDelete(event) {
    if (event.server_id) {
      await markCalendarEventPendingDelete(event.id)
    } else {
      await purgeCalendarEvent(event.id)
    }
    setModal(null)
    await loadEvents()
    sync()
  }

  function toggleDay(dow) {
    setForm(f => ({
      ...f,
      days_of_week: f.days_of_week.includes(dow)
        ? f.days_of_week.filter(d => d !== dow)
        : [...f.days_of_week, dow],
    }))
  }

  const loc = locale()
  const mName = (d) => d.toLocaleDateString(loc, { month: 'long' })

  let label
  if (view === 'month') {
    const raw = new Date(cursor.getFullYear(), cursor.getMonth(), 1).toLocaleDateString(loc, { month: 'long', year: 'numeric' })
    label = raw.charAt(0).toUpperCase() + raw.slice(1)
  } else if (view === 'week') {
    const start = startOfWeek(cursor), end = new Date(start)
    end.setDate(end.getDate() + 6)
    const sm = start.getMonth() === end.getMonth()
    label = sm
      ? `${start.getDate()} – ${end.getDate()} ${mName(start)} ${start.getFullYear()}`
      : `${start.getDate()} ${mName(start)} – ${end.getDate()} ${mName(end)} ${end.getFullYear()}`
  } else {
    const raw = cursor.toLocaleDateString(loc, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
    label = raw.charAt(0).toUpperCase() + raw.slice(1)
  }

  const daysShort = tr('common.daysShort')

  return (
    <>
      <div className="cal-page">
        <div className="cal-header">
          <div className="cal-nav">
            <button className="cal-arrow" onClick={prev}><IconChevronLeft /></button>
            <span className="cal-period-label">{label}</span>
            <button className="cal-arrow" onClick={next}><IconChevronRight /></button>
            <button className="cal-today-btn" onClick={goToday}>{tr('calendar.today')}</button>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <button className="btn-primary" style={{ fontSize: '0.78rem' }} onClick={() => openCreate({ date: todayStr })}>
              {tr('calendar.newTask')}
            </button>
            <div className="cal-tabs">
              {[['day', tr('calendar.viewDay')], ['week', tr('calendar.viewWeek')], ['month', tr('calendar.viewMonth')]].map(([v, name]) => (
                <button key={v} className={`cal-tab${view===v?' cal-tab--active':''}`} onClick={() => setView(v)}>
                  {name}
                </button>
              ))}
            </div>
          </div>
        </div>

        {view === 'month' && (
          <MonthView cursor={cursor} todayStr={todayStr} events={events}
            onDayClick={openDay} onEventClick={openEdit}
            onSlotClick={d => openCreate({ recurrence: 'none', date: toDateStr(d) })} />
        )}
        {view === 'week' && (
          <WeekView cursor={cursor} todayStr={todayStr} events={events}
            onDayClick={openDay} onEventClick={openEdit}
            onSlotClick={(d, time) => openCreate({ recurrence: 'none', date: toDateStr(d), start_time: time })} />
        )}
        {view === 'day' && (
          <DayView cursor={cursor} todayStr={todayStr} events={events}
            onEventClick={openEdit}
            onSlotClick={time => openCreate({ recurrence: 'none', date: toDateStr(cursor), start_time: time })} />
        )}
      </div>

      {modal && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal" style={{ maxWidth: 420 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{modal.mode === 'create' ? tr('calendar.newTaskModal') : tr('calendar.editTaskModal')}</h3>
              <button className="btn-delete" onClick={() => setModal(null)}><IconClose /></button>
            </div>
            <form onSubmit={handleSave} className="form" style={{ flexDirection: 'column', gap: '0.85rem' }}>

              <div className="field">
                <label>{tr('calendar.taskTitleLabel')}</label>
                <input type="text" placeholder={tr('calendar.taskTitlePh')} required
                  value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
              </div>

              <div className="field">
                <label>{tr('calendar.freqLabel')}</label>
                <div className="cal-tabs" style={{ width: 'fit-content' }}>
                  {[['none', tr('calendar.recNone')], ['daily', tr('calendar.recDaily')], ['weekly', tr('calendar.recWeekly')]].map(([v, name]) => (
                    <button key={v} type="button"
                      className={`cal-tab${form.recurrence===v?' cal-tab--active':''}`}
                      onClick={() => setForm(f => ({ ...f, recurrence: v }))}>
                      {name}
                    </button>
                  ))}
                </div>
              </div>

              {form.recurrence === 'none' && (
                <div className="field">
                  <label>{tr('common.date')}</label>
                  <DateField value={form.date}
                    onChange={v => setForm(f => ({ ...f, date: v }))} />
                </div>
              )}

              {form.recurrence === 'weekly' && (
                <div className="field">
                  <label>{tr('calendar.daysLabel')}</label>
                  <div style={{ display: 'flex', gap: '0.35rem' }}>
                    {daysShort.map((d, i) => (
                      <button key={i} type="button"
                        onClick={() => toggleDay(i)}
                        style={{
                          width: 32, height: 32, borderRadius: '50%', border: 'none',
                          cursor: 'pointer', fontSize: '0.72rem', fontWeight: 600,
                          background: form.days_of_week.includes(i) ? '#7c3aed' : 'var(--surface-2)',
                          color: form.days_of_week.includes(i) ? '#fff' : 'var(--text-3)',
                          transition: 'background 0.15s',
                        }}>
                        {d}
                      </button>
                    ))}
                  </div>
                  {form.days_of_week.length === 0 && (
                    <span style={{ fontSize: '0.72rem', color: 'var(--danger-text)', marginTop: '0.25rem', display: 'block' }}>
                      {tr('calendar.atLeastOneDay')}
                    </span>
                  )}
                </div>
              )}

              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <div className="field" style={{ flex: 1 }}>
                  <label>{tr('calendar.startTimeLabel')}</label>
                  <input type="time" value={form.start_time}
                    onChange={e => setForm(f => ({ ...f, start_time: e.target.value }))} />
                </div>
                <div className="field" style={{ flex: 1 }}>
                  <label>{tr('calendar.endTimeLabel')}</label>
                  <input type="time" value={form.end_time}
                    onChange={e => setForm(f => ({ ...f, end_time: e.target.value }))} />
                </div>
              </div>

              <div className="field">
                <label>{tr('calendar.colorLabel')}</label>
                <div style={{ display: 'flex', gap: '0.4rem' }}>
                  {COLORS.map(c => (
                    <button key={c} type="button"
                      onClick={() => setForm(f => ({ ...f, color: c }))}
                      style={{
                        width: 24, height: 24, borderRadius: '50%',
                        background: c, border: form.color === c ? '2px solid #fff' : '2px solid transparent',
                        cursor: 'pointer', boxSizing: 'border-box',
                        outline: form.color === c ? `2px solid ${c}` : 'none',
                      }} />
                  ))}
                </div>
              </div>

              <div className="field">
                <label>{tr('calendar.notesLabel')}</label>
                <input type="text" placeholder="..." value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.25rem' }}>
                {modal.mode === 'edit'
                  ? <button type="button" className="btn-delete" style={{ fontSize: '0.8rem', padding: '0.3rem 0.7rem' }}
                      onClick={() => handleDelete(modal.event)}>{tr('common.delete')}</button>
                  : <span />
                }
                <button type="submit" className="btn-primary">{tr('common.save')}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}

// ── Month View ────────────────────────────────────────────────────────────────

function MonthView({ cursor, todayStr, events, onDayClick, onEventClick, onSlotClick }) {
  const { t: tr } = useLang()
  const daysShort = tr('common.daysShort')
  const year = cursor.getFullYear(), month = cursor.getMonth()
  const cells = buildMonthCells(year, month)

  return (
    <div className="cal-month-view">
      <div className="cal-month-header">
        {daysShort.map(d => <div key={d} className="cal-day-name">{d}</div>)}
      </div>
      <div className="cal-month-body">
        {cells.map((day, i) => {
          if (!day) return <div key={i} className="cal-month-cell cal-month-cell--empty" />
          const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`
          const isToday = dateStr === todayStr
          const dow = (new Date(year, month, day).getDay() + 6) % 7
          const dayEvents = eventsForDate(events, dateStr, dow)
          return (
            <div key={i} className={`cal-month-cell${isToday?' cal-month-cell--today':''}`}
              onClick={() => onSlotClick(new Date(year, month, day))}>
              <div className="cal-month-cell-top">
                <span className="cal-month-day-num">{day}</span>
              </div>
              <div className="cal-month-events">
                {dayEvents.slice(0, 3).map(ev => (
                  <div key={ev.id} className="cal-event-pill"
                    style={{ background: ev.color || '#7c3aed' }}
                    onClick={e => { e.stopPropagation(); onEventClick(ev) }}>
                    {ev.start_time && <span className="cal-event-pill-time">{ev.start_time}</span>}
                    {ev.title}
                  </div>
                ))}
                {dayEvents.length > 3 && (
                  <div className="cal-event-more">{tr('calendar.moreEvents', { n: dayEvents.length - 3 })}</div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Week View ─────────────────────────────────────────────────────────────────

function WeekView({ cursor, todayStr, events, onDayClick, onEventClick, onSlotClick }) {
  const { t: tr } = useLang()
  const daysShort = tr('common.daysShort')
  const bodyRef = useRef(null)
  const start = startOfWeek(cursor)
  const days  = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start); d.setDate(d.getDate() + i); return d
  })
  const weekEvents = days.flatMap(day => {
    const dow = (day.getDay() + 6) % 7
    return eventsForDate(events, toDateStr(day), dow)
  })
  useScrollToHour(bodyRef, weekEvents)

  return (
    <div className="cal-week-view">
      <div className="cal-week-head">
        <div className="cal-time-gutter" />
        {days.map((day, i) => {
          const isToday = toDateStr(day) === todayStr
          const dow = (day.getDay() + 6) % 7
          const dateStr = toDateStr(day)
          const allDay = eventsForDate(events, dateStr, dow).filter(e => !e.start_time)
          return (
            <div key={i} className={`cal-week-col-header${isToday?' cal-week-col-header--today':''}`}>
              <div onClick={() => onDayClick(day)} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', width: '100%', padding: '0.75rem 0.5rem 0.4rem' }}>
                <span className="cal-week-day-name">{daysShort[i]}</span>
                <span className={`cal-week-day-num${isToday?' cal-week-day-num--today':''}`}>{day.getDate()}</span>
              </div>
              {allDay.length > 0 && (
                <div style={{ width: '100%', padding: '0 0.25rem 0.4rem' }}>
                  {allDay.slice(0, 2).map(ev => (
                    <div key={ev.id} className="cal-event-pill" style={{ background: ev.color || '#7c3aed', marginBottom: 2 }}
                      onClick={e => { e.stopPropagation(); onEventClick(ev) }}>
                      {ev.title}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div className="cal-week-body" ref={bodyRef}>
        <div className="cal-time-col">
          {HOURS.map(h => <div key={h} className="cal-time-slot">{h}</div>)}
        </div>
        <div className="cal-week-grid">
          {days.map((day, i) => {
            const isToday = toDateStr(day) === todayStr
            const dow = (day.getDay() + 6) % 7
            const dateStr = toDateStr(day)
            const timed = eventsForDate(events, dateStr, dow).filter(e => e.start_time)
            return (
              <div key={i} className={`cal-week-day-col${isToday?' cal-week-day-col--today':''}`}
                style={{ position: 'relative' }}
                onClick={e => {
                  const rect = e.currentTarget.getBoundingClientRect()
                  const y = e.clientY - rect.top + e.currentTarget.parentElement.parentElement.scrollTop
                  const h = Math.floor(y / HOUR_H)
                  const m = Math.floor((y % HOUR_H) / HOUR_H * 60 / 15) * 15
                  onSlotClick(day, `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`)
                }}>
                {HOURS.map(h => <div key={h} className="cal-hour-cell" />)}
                {timed.map(ev => <EventBlock key={ev.id} event={ev} onClick={e => { e.stopPropagation(); onEventClick(ev) }} />)}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ── Day View ──────────────────────────────────────────────────────────────────

function DayView({ cursor, todayStr, events, onEventClick, onSlotClick }) {
  const { locale } = useLang()
  const bodyRef = useRef(null)
  const isToday = toDateStr(cursor) === todayStr
  const dow     = (cursor.getDay() + 6) % 7
  const dateStr = toDateStr(cursor)
  const dayEvents = eventsForDate(events, dateStr, dow)
  useScrollToHour(bodyRef, dayEvents)
  const allDay = dayEvents.filter(e => !e.start_time)
  const timed  = dayEvents.filter(e => e.start_time)
  const loc = locale()

  return (
    <div className="cal-day-view">
      <div className={`cal-day-view-header${isToday?' cal-day-view-header--today':''}`}>
        <span className="cal-day-view-name">
          {cursor.toLocaleDateString(loc, { weekday: 'long' })}
        </span>
        <span className="cal-day-view-date">
          {cursor.toLocaleDateString(loc, { day: 'numeric', month: 'long', year: 'numeric' })}
        </span>
        {allDay.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem', marginTop: '0.6rem' }}>
            {allDay.map(ev => (
              <div key={ev.id} className="cal-event-pill" style={{ background: ev.color || '#7c3aed' }}
                onClick={() => onEventClick(ev)}>
                {ev.title}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="cal-day-body" ref={bodyRef}>
        <div className="cal-time-col">
          {HOURS.map(h => <div key={h} className="cal-time-slot">{h}</div>)}
        </div>
        <div className="cal-day-grid" style={{ position: 'relative' }}
          onClick={e => {
            const rect = e.currentTarget.getBoundingClientRect()
            const y = e.clientY - rect.top + e.currentTarget.parentElement.scrollTop
            const h = Math.floor(y / HOUR_H)
            const m = Math.floor((y % HOUR_H) / HOUR_H * 60 / 15) * 15
            onSlotClick(`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`)
          }}>
          {HOURS.map(h => <div key={h} className="cal-hour-cell" />)}
          {timed.map(ev => <EventBlock key={ev.id} event={ev} onClick={e => { e.stopPropagation(); onEventClick(ev) }} />)}
        </div>
      </div>
    </div>
  )
}

// ── Event Block (positioned in time grid) ─────────────────────────────────────

function EventBlock({ event, onClick }) {
  const startMin = timeToMinutes(event.start_time)
  const endMin   = event.end_time ? timeToMinutes(event.end_time) : startMin + 60
  const top      = startMin / 60 * HOUR_H
  const height   = Math.max((endMin - startMin) / 60 * HOUR_H, HOUR_H * 0.5)
  return (
    <div className="cal-event-block" onClick={onClick}
      style={{ top, height, background: event.color || '#7c3aed' }}>
      <span className="cal-event-block-time">{event.start_time}</span>
      <span className="cal-event-block-title">{event.title}</span>
    </div>
  )
}
