export type PortalStatus = 'open' | 'observing' | 'flagged' | 'closed';
export type PortalAction = 'stabilize' | 'close' | 'observe' | 'flag';
export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

export interface Portal {
  id: string;
  name: string;
  world: string;
  energy: number;
  stability: number;
  minutesToCollapse: number;
  beings: number;
  status: PortalStatus;
  note: string;
}

export interface RiskBreakdown {
  stability: number;
  energy: number;
  urgency: number;
  beings: number;
  total: number;
}

export interface ValidationResult {
  allowed: boolean;
  reason?: string;
  requiresConfirmation?: boolean;
}

const clamp = (value: number) => Math.min(100, Math.max(0, value));

export function urgencyScore(minutes: number) {
  if (minutes <= 60) return 100;
  if (minutes <= 240) return 75;
  if (minutes <= 720) return 45;
  return 15;
}

export function getRiskBreakdown(portal: Portal): RiskBreakdown {
  if (portal.status === 'closed') {
    return { stability: 0, energy: 0, urgency: 0, beings: 0, total: 0 };
  }

  const stability = (100 - clamp(portal.stability)) * 0.45;
  const energy = clamp(portal.energy) * 0.3;
  const urgency = urgencyScore(portal.minutesToCollapse) * 0.2;
  const beings = (portal.beings > 0 ? 60 : 0) * 0.05;
  const total = Math.round(clamp(stability + energy + urgency + beings));
  return { stability, energy, urgency, beings, total };
}

export function calculateRisk(portal: Portal) {
  return getRiskBreakdown(portal).total;
}

export function getRiskLevel(risk: number): RiskLevel {
  if (risk >= 80) return 'critical';
  if (risk >= 60) return 'high';
  if (risk >= 35) return 'medium';
  return 'low';
}

export function getRecommendedAction(portal: Portal): { title: string; explanation: string } {
  if (portal.status === 'closed') {
    return { title: 'Действий не требуется', explanation: 'Контур закрыт и больше не создаёт угрозу лаборатории.' };
  }

  const risk = calculateRisk(portal);
  if (risk >= 80) {
    return { title: 'Немедленно стабилизировать', explanation: 'Сочетание низкой стабильности, высокой энергии и малого запаса времени создаёт критический риск.' };
  }
  if (risk >= 60) {
    return { title: 'Стабилизировать в этой смене', explanation: 'Риск высокий: коррекция энергии заметно увеличит безопасное окно.' };
  }
  if (risk >= 35) {
    return { title: 'Отправить наблюдателя', explanation: 'Контур допускает исследование, но требует контроля параметров.' };
  }
  return { title: 'Оставить открытым', explanation: 'Параметры находятся в безопасном диапазоне, достаточно штатного мониторинга.' };
}

export function validateAction(portal: Portal, action: PortalAction): ValidationResult {
  if (portal.status === 'closed') {
    return { allowed: false, reason: 'Портал уже закрыт. Изменение его состояния невозможно.' };
  }
  if (action === 'stabilize' && portal.stability >= 85) {
    return { allowed: false, reason: 'Стабильность уже выше 85%. Дополнительная стабилизация не требуется.' };
  }
  if (action === 'observe' && calculateRisk(portal) >= 80) {
    return { allowed: false, reason: 'Нельзя отправить наблюдателя: риск критический. Сначала стабилизируйте портал.' };
  }
  if (action === 'observe' && portal.status === 'observing') {
    return { allowed: false, reason: 'Наблюдатель уже находится внутри этого портала.' };
  }
  if (action === 'close' && portal.beings > 0) {
    return { allowed: true, requiresConfirmation: true, reason: `Внутри остаются существа: ${portal.beings}. Закрытие требует подтверждения.` };
  }
  return { allowed: true };
}

export function applyPortalAction(portal: Portal, action: PortalAction): Portal {
  const validation = validateAction(portal, action);
  if (!validation.allowed) throw new Error(validation.reason);

  switch (action) {
    case 'stabilize':
      return { ...portal, stability: clamp(portal.stability + 25), energy: clamp(portal.energy - 15), minutesToCollapse: portal.minutesToCollapse + 180, status: 'open' };
    case 'close':
      return { ...portal, energy: 0, stability: 100, minutesToCollapse: 0, beings: 0, status: 'closed' };
    case 'observe':
      return { ...portal, status: 'observing' };
    case 'flag':
      return { ...portal, status: portal.status === 'flagged' ? 'open' : 'flagged' };
  }
}

export function formatTime(minutes: number) {
  if (minutes <= 0) return '—';
  const hours = Math.floor(minutes / 60).toString().padStart(2, '0');
  const rest = (minutes % 60).toString().padStart(2, '0');
  return `${hours}:${rest}`;
}
