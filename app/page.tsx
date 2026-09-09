'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Activity, AlertTriangle, Aperture, ArrowRight, BookOpenCheck, CheckCircle2,
  ChevronRight, CircleHelp, Clock3, Eye, FileClock, FlaskConical, Gauge, Info,
  LockKeyhole, RadioTower, RefreshCw, Search, ShieldAlert, Sparkles, Trash2, UserRoundSearch, X,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { seedPortals } from '@/lib/seed-data';
import {
  applyPortalAction, calculateRisk, formatTime, getRecommendedAction, getRiskBreakdown,
  getRiskLevel, validateAction, type Portal, type PortalAction, type RiskLevel,
} from '@/lib/portal-engine';

type View = 'dashboard' | 'journal' | 'worklog';
type Filter = 'all' | RiskLevel | 'closed';
type EventKind = 'success' | 'warning' | 'info';

interface LabEvent {
  id: string;
  portalId: string;
  portalName: string;
  action: string;
  detail: string;
  at: string;
  kind: EventKind;
}

const initialEvents: LabEvent[] = [
  { id: 'seed-1', portalId: 'glass-garden', portalName: 'Сад стеклянных птиц', action: 'Наблюдатель отправлен', detail: 'Экспедиция «Орион-4» вошла в контур.', at: '2026-09-08T13:42:00.000Z', kind: 'info' },
  { id: 'seed-2', portalId: 'north-cascade', portalName: 'Северный каскад', action: 'Требует внимания', detail: 'Портал отмечен для разбора текущей сменой.', at: '2026-09-08T13:28:00.000Z', kind: 'warning' },
  { id: 'seed-3', portalId: 'amber-gate', portalName: 'Янтарные врата', action: 'Портал закрыт', detail: 'Эвакуация завершена, контур погашен.', at: '2026-09-08T12:11:00.000Z', kind: 'success' },
];

const actionLabels: Record<PortalAction, string> = {
  stabilize: 'Стабилизация', close: 'Закрытие', observe: 'Отправка наблюдателя', flag: 'Изменение отметки',
};

const levelLabels: Record<RiskLevel, string> = { low: 'Низкий', medium: 'Средний', high: 'Высокий', critical: 'Критический' };
const statusLabels: Record<Portal['status'], string> = { open: 'Открыт', observing: 'Наблюдатель внутри', flagged: 'Под вопросом', closed: 'Закрыт' };

const levelStyle: Record<RiskLevel, { text: string; dot: string; bg: string; bar: string }> = {
  critical: { text: 'text-rose-300', dot: 'bg-rose-400 shadow-[0_0_10px_#fb7185]', bg: 'border-rose-300/20 bg-rose-300/[0.07]', bar: 'bg-rose-400' },
  high: { text: 'text-amber-300', dot: 'bg-amber-300', bg: 'border-amber-300/20 bg-amber-300/[0.06]', bar: 'bg-amber-300' },
  medium: { text: 'text-sky-300', dot: 'bg-sky-300', bg: 'border-sky-300/20 bg-sky-300/[0.06]', bar: 'bg-sky-300' },
  low: { text: 'text-emerald-300', dot: 'bg-emerald-300', bg: 'border-emerald-300/20 bg-emerald-300/[0.06]', bar: 'bg-emerald-300' },
};

function makeEvent(portal: Portal, action: string, detail: string, kind: EventKind): LabEvent {
  return { id: `${Date.now()}-${Math.random()}`, portalId: portal.id, portalName: portal.name, action, detail, kind, at: new Date().toISOString() };
}

function eventTime(iso: string) {
  return new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' }).format(new Date(iso));
}

export default function Home() {
  const [view, setView] = useState<View>('dashboard');
  const [portals, setPortals] = useState<Portal[]>(seedPortals);
  const [events, setEvents] = useState<LabEvent[]>(initialEvents);
  const [selectedId, setSelectedId] = useState(seedPortals[0].id);
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const [notice, setNotice] = useState<{ kind: EventKind; text: string } | null>(null);
  const [storageError, setStorageError] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [closeDialogOpen, setCloseDialogOpen] = useState(false);

  useEffect(() => {
    let parsedState: { portals: Portal[]; events: LabEvent[] } | null = null;
    let failed = false;
    try {
      const saved = window.localStorage.getItem('portal-lab-state-v1');
      if (saved) {
        const parsed = JSON.parse(saved) as { portals: Portal[]; events: LabEvent[] };
        if (!Array.isArray(parsed.portals) || !Array.isArray(parsed.events)) throw new Error('Некорректная структура');
        parsedState = parsed;
      }
    } catch {
      failed = true;
    }
    const timer = window.setTimeout(() => {
      if (parsedState) {
        setPortals(parsedState.portals);
        setEvents(parsedState.events);
        setSelectedId(parsedState.portals[0]?.id ?? '');
      }
      if (failed) setStorageError(true);
      setHydrated(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem('portal-lab-state-v1', JSON.stringify({ portals, events }));
    } catch {
      // The in-memory application remains fully usable when storage is unavailable.
    }
  }, [events, hydrated, portals]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 4200);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const selected = portals.find((portal) => portal.id === selectedId);
  const visiblePortals = useMemo(() => portals
    .filter((portal) => {
      const matchesQuery = `${portal.name} ${portal.world}`.toLowerCase().includes(query.toLowerCase());
      if (!matchesQuery) return false;
      if (filter === 'all') return true;
      if (filter === 'closed') return portal.status === 'closed';
      return portal.status !== 'closed' && getRiskLevel(calculateRisk(portal)) === filter;
    })
    .sort((a, b) => calculateRisk(b) - calculateRisk(a)), [filter, portals, query]);

  const openCount = portals.filter((p) => p.status !== 'closed').length;
  const closedCount = portals.length - openCount;
  const critical = portals.filter((p) => p.status !== 'closed' && getRiskLevel(calculateRisk(p)) === 'critical');
  const observers = portals.filter((p) => p.status === 'observing').length;
  const averageRisk = openCount ? Math.round(portals.filter((p) => p.status !== 'closed').reduce((sum, p) => sum + calculateRisk(p), 0) / openCount) : 0;

  function addEvent(event: LabEvent) {
    setEvents((current) => [event, ...current]);
  }

  function runAction(action: PortalAction, confirmed = false) {
    if (!selected) return;
    const validation = validateAction(selected, action);
    if (!validation.allowed) {
      const text = validation.reason ?? 'Действие запрещено правилами лаборатории.';
      setNotice({ kind: 'warning', text });
      addEvent(makeEvent(selected, `${actionLabels[action]} отклонено`, text, 'warning'));
      return;
    }
    if (action === 'close' && validation.requiresConfirmation && !confirmed) {
      setCloseDialogOpen(true);
      return;
    }

    const beforeRisk = calculateRisk(selected);
    const next = applyPortalAction(selected, action);
    const afterRisk = calculateRisk(next);
    setPortals((current) => current.map((portal) => portal.id === next.id ? next : portal));

    const details: Record<PortalAction, string> = {
      stabilize: `Риск снижен: ${beforeRisk} → ${afterRisk}. Запас времени увеличен на 3 часа.`,
      close: 'Контур погашен. Энергия сброшена, портал переведён в архив.',
      observe: 'Наблюдатель получил допуск и вошёл в контур.',
      flag: next.status === 'flagged' ? 'Портал добавлен в очередь приоритетного разбора.' : 'Отметка «Под вопросом» снята.',
    };
    const actionNames: Record<PortalAction, string> = {
      stabilize: 'Портал стабилизирован', close: 'Портал закрыт', observe: 'Наблюдатель отправлен', flag: next.status === 'flagged' ? 'Требует внимания' : 'Отметка снята',
    };
    addEvent(makeEvent(next, actionNames[action], details[action], 'success'));
    setNotice({ kind: 'success', text: details[action] });
    setCloseDialogOpen(false);
  }

  function resetDemo() {
    setPortals(seedPortals);
    setEvents(initialEvents);
    setSelectedId(seedPortals[0].id);
    setFilter('all');
    setQuery('');
    setNotice({ kind: 'info', text: 'Демонстрационные данные восстановлены.' });
    setStorageError(false);
  }

  function clearPortals() {
    setPortals([]);
    setSelectedId('');
    setNotice({ kind: 'info', text: 'Список очищен. Пустое состояние готово к проверке.' });
  }

  return (
    <main className="min-h-screen text-foreground">
      <header className="sticky top-0 z-40 border-b border-white/8 bg-[#080b12]/92 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1500px] items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <button onClick={() => setView('dashboard')} className="flex min-w-0 items-center gap-3 text-left">
            <div className="grid size-9 shrink-0 place-items-center rounded-xl border border-cyan-300/25 bg-cyan-300/8 text-cyan-200"><Aperture className="size-5" /></div>
            <div className="min-w-0"><p className="truncate text-sm font-semibold sm:text-[15px]">Лаборатория порталов</p><p className="hidden text-[10px] uppercase tracking-[0.17em] text-slate-500 sm:block">Смена 07 · Контур стабилен</p></div>
          </button>
          <nav aria-label="Основная навигация" className="hidden items-center rounded-xl border border-white/8 bg-white/[0.025] p-1 md:flex">
            {([['dashboard', 'Обзор'], ['journal', 'Журнал'], ['worklog', 'AI Worklog']] as const).map(([id, label]) => (
              <button key={id} onClick={() => setView(id)} className={`rounded-lg px-3 py-1.5 text-xs transition ${view === id ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-slate-200'}`}>{label}</button>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <div className="hidden items-center gap-2 rounded-full border border-emerald-300/15 bg-emerald-300/6 px-3 py-1.5 text-xs text-emerald-200 sm:flex"><span className="size-1.5 rounded-full bg-emerald-300 shadow-[0_0_12px_#6ee7b7]" />Система онлайн</div>
            <Button aria-label="Восстановить демоданные" title="Восстановить демоданные" onClick={resetDemo} variant="outline" size="icon" className="border-white/10 bg-white/[0.025]"><RefreshCw /></Button>
          </div>
        </div>
        <nav aria-label="Мобильная навигация" className="grid grid-cols-3 border-t border-white/7 md:hidden">
          {([['dashboard', 'Обзор'], ['journal', 'Журнал'], ['worklog', 'AI Worklog']] as const).map(([id, label]) => <button key={id} onClick={() => setView(id)} className={`py-2.5 text-xs ${view === id ? 'border-b-2 border-cyan-300 text-cyan-200' : 'text-slate-500'}`}>{label}</button>)}
        </nav>
      </header>

      {storageError && (
        <div role="alert" className="mx-auto mt-4 flex max-w-[1436px] items-start gap-3 rounded-xl border border-amber-300/20 bg-amber-300/[0.07] px-4 py-3 text-sm text-amber-100">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" /><div><p className="font-medium">Не удалось прочитать локальные данные</p><p className="mt-0.5 text-xs text-amber-100/65">Приложение продолжило работу с безопасным демонабором. Нажмите «Восстановить», чтобы перезаписать хранилище.</p></div>
        </div>
      )}

      {notice && (
        <output aria-live="polite" className={`fixed right-4 top-20 z-50 flex max-w-sm items-start gap-3 rounded-xl border px-4 py-3 shadow-2xl backdrop-blur-xl ${notice.kind === 'success' ? 'border-emerald-300/20 bg-[#0b201c]/95 text-emerald-100' : notice.kind === 'warning' ? 'border-amber-300/20 bg-[#241d0d]/95 text-amber-100' : 'border-cyan-300/20 bg-[#0a1c25]/95 text-cyan-100'}`}>
          {notice.kind === 'success' ? <CheckCircle2 className="mt-0.5 size-4 shrink-0" /> : notice.kind === 'warning' ? <AlertTriangle className="mt-0.5 size-4 shrink-0" /> : <Info className="mt-0.5 size-4 shrink-0" />}
          <p className="text-xs leading-5">{notice.text}</p><button aria-label="Закрыть сообщение" onClick={() => setNotice(null)}><X className="size-4 opacity-60" /></button>
        </output>
      )}

      {view === 'dashboard' && (
        <div className="mx-auto max-w-[1500px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <div className="mb-7 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div><p className="eyebrow"><RadioTower /> Оперативный обзор</p><h1 className="page-title">Контроль нестабильности</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">Оцените угрозу и выберите безопасное действие до схлопывания контура.</p></div>
            <div className="flex items-center gap-3"><p className="font-mono text-[11px] text-slate-500">ЛОКАЛЬНАЯ ДЕМОСЕССИЯ</p><Button onClick={clearPortals} variant="ghost" size="sm" className="text-slate-500 hover:bg-rose-300/8 hover:text-rose-200"><Trash2 />Очистить</Button></div>
          </div>

          <section aria-label="Сводка" className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <SummaryCard label="Открыто" value={String(openCount)} note={`из ${portals.length} порталов`} icon={Activity} />
            <SummaryCard label="Критический риск" value={String(critical.length)} note={critical[0] ? `первым: ${critical[0].name}` : 'критических угроз нет'} icon={ShieldAlert} alert={critical.length > 0} />
            <SummaryCard label="Наблюдатели" value={String(observers)} note="в активной миссии" icon={UserRoundSearch} />
            <SummaryCard label="Средний индекс" value={String(averageRisk)} note={`${closedCount} контур(а) закрыто`} icon={Gauge} />
          </section>

          {portals.length === 0 ? (
            <section className="surface-card grid min-h-[420px] place-items-center rounded-2xl p-8 text-center">
              <div className="max-w-md"><div className="mx-auto mb-5 grid size-14 place-items-center rounded-2xl border border-white/10 bg-white/[0.035] text-slate-500"><Aperture className="size-6" /></div><h2 className="text-xl font-semibold">Активных порталов нет</h2><p className="mt-2 text-sm leading-6 text-slate-500">Список пуст. Восстановите демоданные, чтобы проверить расчёт риска, ограничения и журнал действий.</p><Button onClick={resetDemo} className="mt-5 bg-cyan-300 text-slate-950 hover:bg-cyan-200"><RefreshCw />Восстановить демоданные</Button></div>
            </section>
          ) : (
            <section className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(390px,.65fr)]">
              <div className="surface-card overflow-hidden rounded-2xl">
                <div className="flex flex-col gap-3 border-b border-white/8 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                  <div><h2 className="text-sm font-semibold">Реестр порталов</h2><p className="mt-1 text-xs text-slate-500">Приоритет рассчитан автоматически</p></div>
                  <div className="flex flex-wrap gap-2">
                    <label className="flex h-8 min-w-0 flex-1 items-center gap-2 rounded-lg border border-white/10 bg-black/15 px-2.5 sm:w-44"><Search className="size-3.5 text-slate-500" /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Поиск" className="min-w-0 bg-transparent text-xs outline-none placeholder:text-slate-600" /></label>
                    <select aria-label="Фильтр риска" value={filter} onChange={(e) => setFilter(e.target.value as Filter)} className="h-8 rounded-lg border border-white/10 bg-[#0b1019] px-2.5 text-xs text-slate-300 outline-none focus:border-cyan-300/40">
                      <option value="all">Все риски</option><option value="critical">Критические</option><option value="high">Высокие</option><option value="medium">Средние</option><option value="low">Низкие</option><option value="closed">Закрытые</option>
                    </select>
                  </div>
                </div>
                {visiblePortals.length === 0 ? <div className="grid min-h-64 place-items-center p-8 text-center"><div><Search className="mx-auto mb-3 size-6 text-slate-600" /><p className="text-sm font-medium">Ничего не найдено</p><p className="mt-1 text-xs text-slate-500">Измените запрос или фильтр риска.</p></div></div> : (
                  <div className="divide-y divide-white/7">
                    {visiblePortals.map((portal) => <PortalRow key={portal.id} portal={portal} selected={selectedId === portal.id} onSelect={() => setSelectedId(portal.id)} />)}
                  </div>
                )}
              </div>

              {selected ? <PortalDetail portal={selected} events={events.filter((event) => event.portalId === selected.id)} onAction={runAction} /> : <aside className="surface-card rounded-2xl p-6 text-sm text-slate-500">Выберите портал из списка.</aside>}
            </section>
          )}
        </div>
      )}

      {view === 'journal' && <Journal events={events} onBack={() => setView('dashboard')} />}
      {view === 'worklog' && <Worklog onBack={() => setView('dashboard')} />}

      {closeDialogOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center p-4">
          <button aria-label="Закрыть окно подтверждения" onClick={() => setCloseDialogOpen(false)} className="absolute inset-0 h-full w-full bg-black/65 backdrop-blur-sm" />
          <section role="alertdialog" aria-modal="true" aria-labelledby="close-title" aria-describedby="close-description" className="relative w-full max-w-sm rounded-2xl border border-white/10 bg-[#101722] p-5 shadow-2xl">
            <div className="mb-4 grid size-10 place-items-center rounded-xl bg-rose-300/10 text-rose-300"><ShieldAlert className="size-5" /></div>
            <h2 id="close-title" className="text-base font-semibold">Закрыть портал с существами?</h2>
            <p id="close-description" className="mt-2 text-sm leading-6 text-slate-400">Внутри «{selected?.name}» остаются существа: {selected?.beings}. После закрытия вернуть их будет невозможно. Подтвердите, что эвакуация учтена.</p>
            <div className="mt-5 flex justify-end gap-2"><Button onClick={() => setCloseDialogOpen(false)} variant="outline" className="border-white/10 bg-white/[0.025]">Отмена</Button><Button onClick={() => runAction('close', true)} className="bg-rose-400 text-slate-950 hover:bg-rose-300">Подтвердить закрытие</Button></div>
          </section>
        </div>
      )}
    </main>
  );
}

function SummaryCard({ label, value, note, icon: Icon, alert }: { label: string; value: string; note: string; icon: typeof Activity; alert?: boolean }) {
  return <article className={`surface-card rounded-2xl p-4 ${alert ? 'ring-1 ring-rose-300/15' : ''}`}><div className="mb-4 flex items-start justify-between"><p className="text-xs text-slate-400">{label}</p><Icon className={`size-4 ${alert ? 'text-rose-300' : 'text-slate-500'}`} /></div><p className="font-mono text-3xl font-medium tracking-[-0.05em]">{value}</p><p className="mt-1 truncate text-[11px] text-slate-500">{note}</p></article>;
}

function PortalRow({ portal, selected, onSelect }: { portal: Portal; selected: boolean; onSelect: () => void }) {
  const risk = calculateRisk(portal);
  const level = getRiskLevel(risk);
  const style = levelStyle[level];
  return <button onClick={onSelect} className={`group grid w-full grid-cols-[1fr_auto] items-center gap-4 px-4 py-4 text-left transition-colors sm:grid-cols-[1.25fr_.62fr_.72fr_.75fr_auto] sm:px-5 ${selected ? 'bg-cyan-300/[0.055]' : 'hover:bg-white/[0.025]'}`}>
    <div className="min-w-0"><div className="flex items-center gap-2"><span className={`size-2 shrink-0 rounded-full ${style.dot}`} /><p className="truncate text-sm font-medium">{portal.name}</p></div><p className="ml-4 mt-1 truncate text-xs text-slate-500">{portal.world}</p></div>
    <div className="hidden sm:block"><p className={`font-mono text-lg ${style.text}`}>{risk}</p><p className="micro-label">риск / 100</p></div>
    <div className="hidden sm:block"><p className="flex items-center gap-1.5 font-mono text-sm"><Clock3 className="size-3.5 text-slate-500" />{formatTime(portal.minutesToCollapse)}</p><p className="micro-label">до схлопывания</p></div>
    <div className="hidden sm:block"><Badge className={`border bg-transparent text-[10px] ${portal.status === 'closed' ? 'border-white/10 text-slate-500' : portal.status === 'flagged' ? 'border-amber-300/15 text-amber-200' : portal.status === 'observing' ? 'border-violet-300/15 text-violet-200' : 'border-cyan-300/15 text-cyan-200'}`}>{statusLabels[portal.status]}</Badge></div>
    <ChevronRight className={`size-4 ${selected ? 'text-cyan-300' : 'text-slate-600 group-hover:text-slate-400'}`} />
  </button>;
}

function PortalDetail({ portal, events, onAction }: { portal: Portal; events: LabEvent[]; onAction: (action: PortalAction) => void }) {
  const risk = calculateRisk(portal);
  const level = getRiskLevel(risk);
  const style = levelStyle[level];
  const recommendation = getRecommendedAction(portal);
  const breakdown = getRiskBreakdown(portal);
  return <aside className="surface-card self-start rounded-2xl p-5 xl:sticky xl:top-24">
    <div className="mb-5 flex items-start justify-between gap-4"><div><p className={`mb-2 text-[10px] font-semibold uppercase tracking-[.16em] ${style.text}`}>{levelLabels[level]} риск</p><h2 className="text-xl font-semibold tracking-[-0.02em]">{portal.name}</h2><p className="mt-1 text-sm text-slate-500">Назначение: {portal.world}</p></div><span className={`grid size-14 shrink-0 place-items-center rounded-full border font-mono text-lg ${style.bg} ${style.text}`}>{risk}</span></div>
    <div className="mb-4 grid grid-cols-3 gap-2">{[['Энергия', `${portal.energy}%`], ['Стабильность', `${portal.stability}%`], ['Существа', String(portal.beings)]].map(([label, value]) => <div key={label} className="rounded-xl border border-white/7 bg-black/15 p-3"><p className="text-[10px] text-slate-500">{label}</p><p className="mt-1 font-mono text-sm">{value}</p></div>)}</div>
    <div className="mb-4 rounded-xl border border-white/7 bg-black/15 p-3.5"><div className="mb-2 flex items-center justify-between"><p className="text-xs font-medium">Формула риска</p><p className="font-mono text-xs text-slate-500">45% · 30% · 20% · 5%</p></div><div className="h-1.5 overflow-hidden rounded-full bg-white/5"><div className={`h-full rounded-full transition-all ${style.bar}`} style={{ width: `${risk}%` }} /></div><div className="mt-3 grid grid-cols-4 gap-1 text-center">{[['Стаб.', breakdown.stability], ['Энерг.', breakdown.energy], ['Срочн.', breakdown.urgency], ['Жизнь', breakdown.beings]].map(([label, value]) => <div key={String(label)}><p className="font-mono text-[11px]">+{Math.round(Number(value))}</p><p className="mt-0.5 text-[9px] text-slate-600">{String(label)}</p></div>)}</div></div>
    <div className="mb-4 rounded-xl border border-cyan-300/12 bg-cyan-300/[0.035] p-4"><p className="flex items-center gap-2 text-xs font-semibold text-cyan-200"><Sparkles className="size-3.5" />{recommendation.title}</p><p className="mt-1.5 text-xs leading-5 text-slate-400">{recommendation.explanation}</p></div>
    <p className="mb-4 rounded-lg bg-white/[0.025] px-3 py-2 text-[11px] leading-5 text-slate-500">{portal.note}</p>
    <Button onClick={() => onAction('stabilize')} className="h-10 w-full bg-cyan-300 text-slate-950 hover:bg-cyan-200"><FlaskConical />Стабилизировать</Button>
    <div className="mt-2 grid grid-cols-2 gap-2"><Button onClick={() => onAction('observe')} variant="outline" className="border-white/10 bg-white/[0.025] text-slate-300 hover:bg-white/[0.06]"><Eye />Наблюдатель</Button><Button onClick={() => onAction('flag')} variant="outline" className="border-amber-300/15 bg-amber-300/[0.025] text-amber-200 hover:bg-amber-300/[0.08]"><CircleHelp />{portal.status === 'flagged' ? 'Снять отметку' : 'Под вопросом'}</Button></div>
    <Button onClick={() => onAction('close')} variant="ghost" className="mt-2 w-full text-rose-300 hover:bg-rose-300/8 hover:text-rose-200"><LockKeyhole />Закрыть портал</Button>
    <div className="mt-5 border-t border-white/7 pt-4"><p className="mb-3 flex items-center gap-2 text-xs font-medium"><FileClock className="size-3.5 text-slate-500" />Последние события</p>{events.length ? <div className="space-y-3">{events.slice(0, 2).map((event) => <div key={event.id} className="flex gap-2.5"><span className={`mt-1.5 size-1.5 shrink-0 rounded-full ${event.kind === 'warning' ? 'bg-amber-300' : event.kind === 'success' ? 'bg-emerald-300' : 'bg-sky-300'}`} /><div><p className="text-[11px] text-slate-300">{event.action}</p><p className="mt-0.5 text-[10px] text-slate-600">{eventTime(event.at)}</p></div></div>)}</div> : <p className="text-[11px] text-slate-600">Действий с порталом пока не было.</p>}</div>
  </aside>;
}

function Journal({ events, onBack }: { events: LabEvent[]; onBack: () => void }) {
  return <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6"><p className="eyebrow"><FileClock /> Аудит действий</p><div className="mb-7 flex items-end justify-between gap-4"><div><h1 className="page-title">Журнал лаборатории</h1><p className="mt-2 text-sm text-slate-400">Успешные операции и отклонённые попытки сохраняются вместе.</p></div><Button onClick={onBack} variant="outline" className="border-white/10 bg-white/[0.025]">К обзору<ArrowRight /></Button></div>
    <section className="surface-card overflow-hidden rounded-2xl">{events.length ? <div className="divide-y divide-white/7">{events.map((event) => <article key={event.id} className="grid gap-2 px-5 py-4 sm:grid-cols-[130px_1fr_1.4fr]"><p className="font-mono text-[11px] text-slate-500">{eventTime(event.at)}</p><div className="flex items-start gap-2"><span className={`mt-1.5 size-1.5 shrink-0 rounded-full ${event.kind === 'warning' ? 'bg-amber-300' : event.kind === 'success' ? 'bg-emerald-300' : 'bg-sky-300'}`} /><div><p className="text-sm font-medium">{event.action}</p><p className="mt-0.5 text-xs text-slate-500">{event.portalName}</p></div></div><p className="text-xs leading-5 text-slate-400">{event.detail}</p></article>)}</div> : <div className="grid min-h-72 place-items-center text-center"><div><FileClock className="mx-auto mb-3 size-7 text-slate-600" /><p className="text-sm font-medium">Журнал пока пуст</p><p className="mt-1 text-xs text-slate-500">Выполните действие на экране обзора.</p></div></div>}</section>
  </div>;
}

function Worklog({ onBack }: { onBack: () => void }) {
  const stages = [
    {
      title: 'Продуктовая рамка',
      human: 'Я выбрал сценарий лаборатории и сформулировал главную задачу: оператор должен за минуту понять, какой портал опаснее, почему и какое действие безопасно. Первую версию ограничил одним цельным рабочим контуром, чтобы довести основной сценарий до конца.',
      ai: 'AI собрал карту требований, выделил данные портала, состояния системы, рискованные переходы и предложил последовательность реализации.',
      result: 'Фокус продукта — быстрое и объяснимое решение оператора, а не набор декоративных экранов.',
      prompt: '«Сравни варианты, выбери сценарий с лучшим балансом логики и объёма и разложи его на законченный MVP».',
    },
    {
      title: 'Модель риска и правила',
      human: 'Я зафиксировал принцип объяснимости: итоговый риск должен раскладываться на понятные факторы, а каждое запрещённое действие — сопровождаться конкретной причиной. Для закрытия портала с существами выбрал осознанное подтверждение вместо глухой блокировки.',
      ai: 'AI формализовал веса стабильности, энергии, срочности и наличия существ, вынес расчёт и проверки переходов в чистые функции и связал их с рекомендациями.',
      result: 'Одинаковые правила управляют оценкой риска, подсказками, действиями и сообщениями об ошибках.',
      prompt: '«Построй прозрачную формулу риска, опиши допустимые переходы и объясняй пользователю каждое ограничение».',
    },
    {
      title: 'Сценарий оператора и интерфейс',
      human: 'Я определил порядок принятия решения: сначала общая ситуация, затем самый опасный портал, объяснение риска и только после этого действие. Потребовал короткую навигацию и заметный доступ к журналу операций.',
      ai: 'AI спроектировал и реализовал сводку, реестр с поиском и фильтрами, детальную карточку, рекомендации, предупреждения, журнал и адаптивную компоновку.',
      result: 'Ключевой путь читается сверху вниз и не требует инструкции перед первым использованием.',
      prompt: '«Собери интерфейс вокруг решения оператора: приоритет, причина риска, рекомендация и безопасное действие — без лишних экранов».',
    },
    {
      title: 'Проверка поведения',
      human: 'Я не принимал визуально готовый экран без проверки логики. Задал приёмочные ситуации: критический риск, запрещённый наблюдатель, снижение риска после стабилизации, закрытие с существами, пустой реестр и несколько последовательных операций.',
      ai: 'AI добавил автоматические проверки доменных правил, прошёл пользовательские сценарии, исправил несогласованные состояния и проверил сохранение данных между перезагрузками.',
      result: 'Проверены не только успешные действия, но и запреты, предупреждения, восстановление и история операций.',
      prompt: '«Пройди продукт как оператор: проверь расчёты, запреты, изменение состояния, журнал, пустой экран и восстановление данных».',
    },
    {
      title: 'Доведение до публикации',
      human: 'Я провёл финальную приёмку, запросил повторную сверку функциональности, потребовал усилить описание моей роли и открыть приложение без авторизационного барьера. Публикацию подтвердил только после исправлений.',
      ai: 'AI доработал документацию и Worklog, выполнил сборку, синхронизировал исходники, опубликовал новую версию и проверил доступность публичной ссылки.',
      result: 'Приложение, документация и публичная версия синхронизированы и готовы к самостоятельному просмотру.',
      prompt: '«Проведи финальный аудит, исправь слабые места, обнови документацию и опубликуй проверенную версию».',
    },
  ];
  return <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6"><p className="eyebrow"><Sparkles /> Прозрачность AI-процесса</p><div className="mb-7 flex items-end justify-between gap-4"><div><h1 className="page-title">AI Worklog</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">Как продуктовые решения превращались в работающую систему: моя зона ответственности, работа AI и проверяемый результат каждого этапа.</p></div><Button onClick={onBack} variant="outline" className="border-white/10 bg-white/[0.025]">К обзору<ArrowRight /></Button></div>
    <section className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><InfoCard label="Модель работы" value="Человек — владелец решений" note="AI — инструмент анализа и реализации" /><InfoCard label="AI-инструменты" value="AI-ассистент OpenAI · GPT-5" note="Анализ, код, UI, тесты и документация" /><InfoCard label="Время разработки" value="≈ 4 часа" note="Активная работа от анализа до публикации" /><InfoCard label="Токены" value="Не считались" note="Инструмент не показывает точную статистику" /></section>
    <section className="mb-5 rounded-2xl border border-cyan-300/15 bg-cyan-300/[0.04] p-5 sm:p-6"><div className="flex items-start gap-4"><div className="grid size-10 shrink-0 place-items-center rounded-xl border border-cyan-300/15 bg-cyan-300/[0.06]"><UserRoundSearch className="size-5 text-cyan-300" /></div><div><h2 className="text-base font-semibold">Моя роль — сформулировать продукт и отвечать за результат</h2><p className="mt-2 max-w-4xl text-sm leading-6 text-slate-300">Я определял, какую проблему решает интерфейс, где проходит граница первой версии, какие правила должны быть прозрачными и что считать готовым результатом. На каждом этапе я принимал продуктовые решения, проверял последствия и возвращал работу на доработку, если она была визуально убедительной, но недостаточно понятной или надёжной. AI помогал быстрее исследовать варианты и реализовывать выбранное направление.</p></div></div></section>
    <section className="surface-card mb-5 rounded-2xl p-5 sm:p-6"><div className="mb-5 flex items-center gap-3"><BookOpenCheck className="size-5 text-cyan-300" /><div><h2 className="text-sm font-semibold">От замысла до работающего продукта</h2><p className="mt-1 text-xs text-slate-500">Для каждого этапа зафиксированы ответственность, работа AI и полученный результат</p></div></div><div className="grid gap-4 md:grid-cols-2">{stages.map((stage, index) => <article key={stage.title} className="rounded-2xl border border-white/8 bg-black/15 p-5"><div className="flex items-center gap-3"><span className="font-mono text-[10px] text-cyan-300">0{index + 1}</span><h3 className="text-base font-medium">{stage.title}</h3></div><div className="mt-4 space-y-3"><div className="rounded-xl border border-cyan-300/12 bg-cyan-300/[0.04] p-4"><p className="mb-2 text-[9px] font-semibold uppercase tracking-[.14em] text-cyan-300">Моя ответственность</p><p className="text-xs leading-5 text-slate-300">{stage.human}</p></div><div className="rounded-xl border border-white/7 bg-white/[0.02] p-4"><p className="mb-2 text-[9px] font-semibold uppercase tracking-[.14em] text-slate-500">Работа AI</p><p className="text-xs leading-5 text-slate-400">{stage.ai}</p></div><div className="flex gap-2.5 rounded-xl border border-emerald-300/10 bg-emerald-300/[0.025] p-4"><CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-emerald-300" /><div><p className="mb-1 text-[9px] font-semibold uppercase tracking-[.14em] text-emerald-300/80">Результат этапа</p><p className="text-xs leading-5 text-slate-400">{stage.result}</p></div></div></div><div className="mt-3 border-t border-white/7 px-1 pt-3"><p className="mb-1 text-[9px] uppercase tracking-[.13em] text-slate-600">Ключевой промпт</p><p className="text-[11px] leading-5 text-slate-500">{stage.prompt}</p></div></article>)}</div></section>
    <div className="grid gap-5 lg:grid-cols-2"><WorklogList icon={CheckCircle2} title="Пять моих ключевых решений" items={['Сфокусировать продукт на одном решении оператора: быстро определить приоритетный портал и безопасно изменить его состояние.', 'Сделать риск объяснимым: показать вклад каждого фактора, а не ограничиваться цветом и итоговым числом.', 'Не прятать запрещённые действия: позволить попытку, объяснить отказ и сохранить его в журнале.', 'Заменить безусловный запрет закрытия портала с существами на предупреждение и осознанное подтверждение.', 'Считать продукт готовым только после проверки крайних состояний, публичной доступности и синхронизации документации.']} /><WorklogList icon={AlertTriangle} title="Где я скорректировал работу AI" items={['Первый интерфейс выглядел как обычный dashboard — я вернул его на доработку и потребовал выстроить экран вокруг решения оператора.', 'AI предложил отключать недоступные кнопки — я настоял на объяснимом отказе, чтобы правило было видно и проверяемо.', 'Ранний вариант полностью запрещал закрытие портала с существами — я выбрал предупреждение с подтверждением ответственности.', 'Первая формула давала число без достаточного объяснения — я потребовал разложить риск на четыре видимых фактора.', 'Первый Worklog перечислял действия сухими служебными фразами — я запросил содержательное описание ответственности, решений и результата.']} /><WorklogList icon={FlaskConical} title="Как подтверждалась готовность" items={['Автоматические проверки подтвердили расчёт критического риска и корректные переходы состояний.', 'Вручную пройдена попытка запрещённого действия с объяснением причины и записью в журнал.', 'Проверено, что стабилизация действительно снижает риск и увеличивает доступное время.', 'Проверены предупреждение при закрытии с существами, пустой реестр и восстановление данных.', 'Production-сборка, публичная ссылка и актуальная версия репозитория проверены отдельно.']} /><WorklogList icon={Sparkles} title="Следующий уровень продукта" items={['Перенести состояние в серверную базу и добавить роли операторов с разными правами.', 'Синхронизировать смены в реальном времени и предупреждать о конкурирующих действиях.', 'Версионировать формулу риска и дать экспертам безопасно настраивать пороги.', 'Добавить отмену операций, неизменяемый аудит и экспорт журнала инцидента.', 'Расширить доступность интерфейса и покрыть основные пути браузерными e2e-сценариями.']} /></div>
  </div>;
}

function InfoCard({ label, value, note }: { label: string; value: string; note: string }) { return <article className="surface-card rounded-2xl p-5"><p className="micro-label">{label}</p><p className="mt-3 text-lg font-semibold">{value}</p><p className="mt-1 text-xs text-slate-500">{note}</p></article>; }

function WorklogList({ icon: Icon, title, items }: { icon: typeof Activity; title: string; items: string[] }) { return <section className="surface-card rounded-2xl p-5"><div className="mb-4 flex items-center gap-2"><Icon className="size-4 text-cyan-300" /><h2 className="text-sm font-semibold">{title}</h2></div><ul className="space-y-3">{items.map((item) => <li key={item} className="flex gap-2.5 text-xs leading-5 text-slate-400"><span className="mt-2 size-1 shrink-0 rounded-full bg-slate-600" />{item}</li>)}</ul></section>; }
