export function timeAgo(dateStr: string | null): string {
  if (!dateStr) return 'unknown';

  const isoDateOnly = /^\d{4}-\d{2}-\d{2}$/;
  const date = new Date(isoDateOnly.test(dateStr) ? `${dateStr}T00:00:00Z` : dateStr);
  if (isNaN(date.getTime())) return 'unknown';

  const diff = Date.now() - date.getTime();
  if (diff < 0) return 'just now';

  const units: Array<[string, number]> = [
    ['year', 31536000000],
    ['month', 2592000000],
    ['week', 604800000],
    ['day', 86400000],
  ];

  for (const [name, ms] of units) {
    const n = Math.floor(diff / ms);
    if (n >= 1) return `${n} ${name}${n !== 1 ? 's' : ''} ago`;
  }

  return 'today';
}
