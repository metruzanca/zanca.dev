const MONTHS: Record<string, string> = {
	'01': 'Jan',
	'02': 'Feb',
	'03': 'Mar',
	'04': 'Apr',
	'05': 'May',
	'06': 'Jun',
	'07': 'Jul',
	'08': 'Aug',
	'09': 'Sep',
	'10': 'Oct',
	'11': 'Nov',
	'12': 'Dec',
};

export function formatDateRange(start: string, end: string): string {
	const startFmt = formatShortDate(start);
	const endFmt = end.length === 0 ? 'Present' : formatShortDate(end);
	return `${startFmt} – ${endFmt}`;
}

export function formatShortDate(iso: string): string {
	if (iso.length < 7) return iso;
	const month = MONTHS[iso.slice(5, 7)] ?? '';
	const year = iso.slice(0, 4);
	return `${month} ${year}`;
}

/** "Mon DD, YYYY" from an ISO date string (takes the date portion before 'T'). */
export function formatFullDate(iso: string): string {
	const date = iso.split('T')[0];
	if (date.length < 10) return date;
	const month = MONTHS[date.slice(5, 7)] ?? '';
	const year = date.slice(0, 4);
	const day = parseInt(date.slice(8, 10), 10) || 0;
	return `${month} ${String(day).padStart(2, '0')}, ${year}`;
}

/** "Mon YYYY" from an ISO date string. */
export function formatMonthYear(iso: string): string {
	if (iso.length < 10) return '';
	const month = MONTHS[iso.slice(5, 7)] ?? '';
	const year = iso.slice(0, 4);
	return `${month} ${year}`;
}
