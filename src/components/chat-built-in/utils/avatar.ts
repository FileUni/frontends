const GRADIENTS = [
  ['#FF6B6B', '#EE5A24'],
  ['#A29BFE', '#6C5CE7'],
  ['#55E6C1', '#00B894'],
  ['#FDCB6E', '#E17055'],
  ['#74B9FF', '#0984E3'],
  ['#E17055', '#D63031'],
  ['#00CEC9', '#00B894'],
  ['#6C5CE7', '#4834D4'],
  ['#FDA7DF', '#E84393'],
  ['#DFE6E9', '#636E72'],
];

function hashUserId(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = ((hash << 5) - hash) + id.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

export function getAvatarGradient(userId: string): string {
  const idx = hashUserId(userId) % GRADIENTS.length;
  const gradient = GRADIENTS[idx]!;
  return `linear-gradient(135deg, ${gradient[0]}, ${gradient[1]})`;
}

export function getInitials(name: string): string {
  const parts = name.split(' ').filter(Boolean);
  return parts
    .map((s) => s[0] ?? '')
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

export function getSenderColor(userId: string): string {
  const idx = hashUserId(userId) % GRADIENTS.length;
  return GRADIENTS[idx]![0]!;
}
