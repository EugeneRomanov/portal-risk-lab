import type { Portal } from './portal-engine';

export const seedPortals: Portal[] = [
  { id: 'luna-rift', name: 'Разлом Тихой Луны', world: 'Люмен-7', energy: 96, stability: 12, minutesToCollapse: 42, beings: 3, status: 'open', note: 'Фазовый шум растёт последние 18 минут.' },
  { id: 'north-cascade', name: 'Северный каскад', world: 'Эйдолон', energy: 76, stability: 42, minutesToCollapse: 198, beings: 0, status: 'flagged', note: 'Нестабильная кромка. Допуск только для техников.' },
  { id: 'glass-garden', name: 'Сад стеклянных птиц', world: 'Миралис', energy: 41, stability: 81, minutesToCollapse: 1134, beings: 12, status: 'observing', note: 'Существа не проявляют агрессии.' },
  { id: 'ash-arch', name: 'Арка пепельного ветра', world: 'Кальдера', energy: 58, stability: 57, minutesToCollapse: 510, beings: 0, status: 'open', note: 'Показатели в допустимом коридоре.' },
  { id: 'midnight-well', name: 'Полуночный колодец', world: 'Ноктюрн', energy: 33, stability: 74, minutesToCollapse: 920, beings: 1, status: 'open', note: 'Зафиксирован единичный биосигнал.' },
  { id: 'amber-gate', name: 'Янтарные врата', world: 'Соларис', energy: 0, stability: 100, minutesToCollapse: 0, beings: 0, status: 'closed', note: 'Закрыт после завершения эвакуации.' },
  { id: 'silent-orbit', name: 'Безмолвная орбита', world: 'Ковчег-12', energy: 0, stability: 100, minutesToCollapse: 0, beings: 0, status: 'closed', note: 'Контур законсервирован.' },
];
