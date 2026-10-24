// Preserve source precision and exclusive wording instead of inventing a day.
export function graduationDeadline(value, validDate) {
  if (validDate(value)) return { date: value, precision: 'day', inclusive: true };
  if (typeof value !== 'string') return null;
  if (/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) return { date: value, precision: 'month' };
  const before = value.match(/^(\d{4}-\d{2}-\d{2})\s*(?:之前|以前|前)$/);
  if (before && validDate(before[1])) return { date: before[1], precision: 'day', inclusive: false };
  return null;
}

export function graduationDateState(date, deadline, validDate) {
  const boundary = graduationDeadline(deadline, validDate);
  if (!validDate(date) || !boundary) return 'unknown';
  if (boundary.precision === 'month') {
    const month = date.slice(0, 7);
    // A source month alone does not establish the last permitted day in it.
    return month < boundary.date ? 'pass' : month > boundary.date ? 'fail' : 'unknown';
  }
  return (boundary.inclusive ? date <= boundary.date : date < boundary.date) ? 'pass' : 'fail';
}
