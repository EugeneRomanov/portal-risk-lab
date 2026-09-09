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
    { title: 'Разбор задания', human: 'Выбрал вариант с порталами, подтвердил рамки и приоритет: небольшая, но законченная система.', ai: 'Сравнил два варианта, разложил требования на функциональность, edge cases и критерии сдачи.', prompt: '«Проанализируй два задания и помоги выбрать одно для решения».' },
    { title: 'Архитектура и риск-логика', human: 'Утвердил объяснимую формулу и требование показывать причины запретов, а не просто блокировать кнопки.', ai: 'Отделил чистые функции расчёта и переходов состояния от интерфейса, подготовил тестируемую модель.', prompt: '«Сделай прозрачную формулу риска, допустимые переходы и обработай обязательные edge cases».' },
    { title: 'Интерфейс', human: 'Задал критерий: сценарий должен быть понятен проверяющему за одну минуту и работать без обучения.', ai: 'Собрал рабочую поверхность: сводку, реестр, карточку, рекомендации, предупреждения, журнал и адаптивную компоновку.', prompt: '«Интерфейс должен быть понятен за минуту и ощущаться законченным инструментом».' },
    { title: 'Проверка', human: 'Запросил повторный аудит по исходным критериям и проверку обязательных сценариев перед сдачей.', ai: 'Добавил автотесты и чеклист, проверил критический риск, запреты, стабилизацию, подтверждение закрытия и пустое состояние.', prompt: '«Проверь критический риск, запрещённые действия, изменение риска, журнал и пустой список».' },
    { title: 'Публикация', human: 'Подтвердил публикацию исходников и потребовал публичную ссылку без барьера авторизации.', ai: 'Подготовил README, опубликовал репозиторий, собрал production-версию и настроил публичный доступ.', prompt: '«Сделай публичный деплой и внеси улучшения по результатам аудита».' },
  ];
  return <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6"><p className="eyebrow"><Sparkles /> Прозрачность AI-процесса</p><div className="mb-7 flex items-end justify-between gap-4"><div><h1 className="page-title">AI Worklog</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">Честный журнал совместной работы: человек владел продуктовым направлением и приёмкой, AI ускорял анализ и реализацию.</p></div><Button onClick={onBack} variant="outline" className="border-white/10 bg-white/[0.025]">К обзору<ArrowRight /></Button></div>
    <section className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><InfoCard label="Модель работы" value="Человек — владелец решений" note="AI — инструмент анализа и реализации" /><InfoCard label="AI-инструменты" value="AI-ассистент OpenAI · GPT-5" note="Анализ, код, UI, тесты и документация" /><InfoCard label="Время разработки" value="≈ 4 часа" note="Активная работа от анализа до публикации" /><InfoCard label="Токены" value="Не считались" note="Инструмент не показывает точную статистику" /></section>
    <section className="mb-5 rounded-2xl border border-cyan-300/15 bg-cyan-300/[0.04] p-5 sm:p-6"><div className="flex items-start gap-4"><div className="grid size-10 shrink-0 place-items-center rounded-xl border border-cyan-300/15 bg-cyan-300/[0.06]"><UserRoundSearch className="size-5 text-cyan-300" /></div><div><h2 className="text-base font-semibold">Моя роль: продуктовый владелец результата</h2><p className="mt-2 max-w-4xl text-sm leading-6 text-slate-400">Я выбрал задачу и её границы, определил пользовательский сценарий, принимал решения по формуле риска и спорным состояниям, задавал критерии качества, инициировал повторные проверки и принимал готовый результат перед публикацией. AI выступал исполнителем и партнёром по анализу, но не определял продуктовые решения самостоятельно.</p></div></div></section>
    <section className="surface-card mb-5 rounded-2xl p-5 sm:p-6"><div className="mb-5 flex items-center gap-3"><BookOpenCheck className="size-5 text-cyan-300" /><div><h2 className="text-sm font-semibold">Этапы и ключевые промпты</h2><p className="mt-1 text-xs text-slate-500">Решения человека и вклад AI показаны отдельно</p></div></div><div className="grid gap-3 md:grid-cols-2">{stages.map((stage, index) => <article key={stage.title} className="rounded-xl border border-white/7 bg-black/15 p-4"><p className="mb-3 font-mono text-[10px] text-cyan-300">0{index + 1}</p><h3 className="text-sm font-medium">{stage.title}</h3><div className="mt-3 space-y-2 text-xs leading-5"><p className="rounded-lg border border-cyan-300/10 bg-cyan-300/[0.035] p-3 text-slate-300"><strong className="font-semibold text-cyan-200">Решение человека:</strong> {stage.human}</p><p className="px-3 text-slate-500"><strong className="font-medium text-slate-300">Вклад AI:</strong> {stage.ai}</p></div><div className="mt-3 rounded-lg border border-white/6 bg-white/[0.025] p-3"><p className="mb-1 text-[9px] uppercase tracking-[.13em] text-slate-600">Суть промпта</p><p className="text-[11px] leading-5 text-slate-400">{stage.prompt}</p></div></article>)}</div></section>
    <div className="grid gap-5 lg:grid-cols-2"><WorklogList icon={CheckCircle2} title="Как я управлял продуктом" items={['Выбрал «Лабораторию порталов» после сравнения объёма, рисков и демонстрационной ценности двух вариантов.', 'Ограничил продукт одной законченной рабочей поверхностью без сервера и авторизации.', 'Потребовал видимую формулу риска и понятные объяснения каждого запрета.', 'Изменил жёсткую блокировку закрытия портала с существами на осознанное подтверждение.', 'Потребовал сохранять отклонённые попытки в журнале и повторно проверить решение по исходным критериям.', 'Подтвердил публичную публикацию только после тестов и ручной приёмки ключевых сценариев.']} /><WorklogList icon={AlertTriangle} title="Ошибки AI и мои корректировки" items={['Первый вариант был слишком похож на обычный dashboard — по моему запросу усилена визуальная иерархия.', 'Изначально AI предлагал отключать запрещённые кнопки; я выбрал действие с явным объяснением причины отказа.', 'Закрытие портала с существами сначала блокировалось полностью; я заменил правило на осознанное подтверждение.', 'Формула риска была непрозрачной — я зафиксировал требование четырёх объяснимых факторов.', 'Код реализовывался через AI-ассистента; я оставался владельцем постановки, решений, критериев качества и финальной приёмки.']} /><WorklogList icon={FlaskConical} title="Как проверялось" items={['Пять автоматических тестов доменной логики.', 'Production-сборка без ошибок.', 'Ручная проверка критического риска и рекомендации.', 'Ручная проверка отказа с объяснением и записью в журнале.', 'Ручная проверка снижения риска после стабилизации.', 'Ручная проверка предупреждения при закрытии с существами.', 'Проверка пустого состояния, восстановления данных и публичной ссылки.']} /><WorklogList icon={Sparkles} title="Что улучшить в реальном продукте" items={['Серверная база данных и роли операторов.', 'События в реальном времени и синхронизация смен.', 'Настраиваемые пороги риска с версионированием формулы.', 'Отмена операций и защищённый аудит изменений.', 'Доступность по WCAG и e2e-тесты на основных устройствах.']} /></div>
  </div>;
}

function InfoCard({ label, value, note }: { label: string; value: string; note: string }) { return <article className="surface-card rounded-2xl p-5"><p className="micro-label">{label}</p><p className="mt-3 text-lg font-semibold">{value}</p><p className="mt-1 text-xs text-slate-500">{note}</p></article>; }

function WorklogList({ icon: Icon, title, items }: { icon: typeof Activity; title: string; items: string[] }) { return <section className="surface-card rounded-2xl p-5"><div className="mb-4 flex items-center gap-2"><Icon className="size-4 text-cyan-300" /><h2 className="text-sm font-semibold">{title}</h2></div><ul className="space-y-3">{items.map((item) => <li key={item} className="flex gap-2.5 text-xs leading-5 text-slate-400"><span className="mt-2 size-1 shrink-0 rounded-full bg-slate-600" />{item}</li>)}</ul></section>; }
