export type RenewalCadence = "Monthly" | "Yearly";

export type RenewalPeriodState = {
  billingDate?: string;
  resolution: "paid" | "not_charged" | null;
  scheduledRenewalDate: string;
};

function validDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function renewalDateFromAnchor(anchorDate: string, cadence: RenewalCadence, sequenceIndex: number) {
  if (!validDate(anchorDate) || !Number.isInteger(sequenceIndex) || sequenceIndex < 0) {
    throw new Error("Invalid renewal cadence input.");
  }
  const [year, month, day] = anchorDate.split("-").map(Number);
  const monthOffset = cadence === "Monthly" ? sequenceIndex : sequenceIndex * 12;
  const target = new Date(Date.UTC(year, month - 1 + monthOffset, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(day, lastDay));
  return target.toISOString().slice(0, 10);
}

export function renewalSequenceIndex(anchorDate: string, cadence: RenewalCadence, scheduledDate: string, maximum = 12000) {
  if (!validDate(scheduledDate)) return null;
  for (let index = 0; index <= maximum; index += 1) {
    const candidate = renewalDateFromAnchor(anchorDate, cadence, index);
    if (candidate === scheduledDate) return index;
    if (candidate > scheduledDate) return null;
  }
  return null;
}

export function dueRenewalDates(anchorDate: string, nextRenewalDate: string, cadence: RenewalCadence, asOfDate: string, maximum = 1200) {
  if (!validDate(asOfDate)) throw new Error("Invalid renewal cutoff date.");
  const startIndex = renewalSequenceIndex(anchorDate, cadence, nextRenewalDate);
  if (startIndex === null) throw new Error("Next renewal does not match its cadence anchor.");
  const dates: string[] = [];
  for (let offset = 0; offset < maximum; offset += 1) {
    const candidate = renewalDateFromAnchor(anchorDate, cadence, startIndex + offset);
    if (candidate >= asOfDate) return dates;
    dates.push(candidate);
  }
  throw new Error("Renewal generation exceeded its safety limit.");
}

export function nextRenewalAfterResolution(anchorDate: string, cadence: RenewalCadence, periods: RenewalPeriodState[]) {
  const ordered = [...periods].sort((left, right) => left.scheduledRenewalDate.localeCompare(right.scheduledRenewalDate));
  const firstUnresolved = ordered.find((period) => period.resolution === null);
  if (firstUnresolved) return firstUnresolved.scheduledRenewalDate;
  const latest = ordered.at(-1);
  if (!latest) return null;
  const latestIndex = renewalSequenceIndex(anchorDate, cadence, latest.scheduledRenewalDate);
  if (latestIndex === null) throw new Error("A renewal period does not match its cadence anchor.");
  return renewalDateFromAnchor(anchorDate, cadence, latestIndex + 1);
}

export function unresolvedOverdueRenewalPeriods<T extends RenewalPeriodState>(periods: T[], asOfDate: string) {
  if (!validDate(asOfDate)) throw new Error("Invalid renewal cutoff date.");
  return periods
    .filter((period) => period.resolution === null && validDate(period.billingDate || period.scheduledRenewalDate) && (period.billingDate || period.scheduledRenewalDate) < asOfDate)
    .sort((left, right) => (left.billingDate || left.scheduledRenewalDate).localeCompare(right.billingDate || right.scheduledRenewalDate));
}

export function newestFirstUnresolvedRenewalPeriods<T extends RenewalPeriodState>(periods: T[]) {
  return periods
    .filter((period) => period.resolution === null && validDate(period.billingDate || period.scheduledRenewalDate))
    .sort((left, right) => (right.billingDate || right.scheduledRenewalDate).localeCompare(left.billingDate || left.scheduledRenewalDate));
}

export function nextFutureRenewalFromAnchor(anchorDate: string, cadence: RenewalCadence, onOrAfterDate: string) {
  if (!validDate(onOrAfterDate)) throw new Error("Invalid renewal reference date.");
  const [anchorYear, anchorMonth] = anchorDate.split("-").map(Number);
  const [targetYear, targetMonth] = onOrAfterDate.split("-").map(Number);
  let index = cadence === "Monthly"
    ? Math.max(0, (targetYear - anchorYear) * 12 + targetMonth - anchorMonth)
    : Math.max(0, targetYear - anchorYear);
  let candidate = renewalDateFromAnchor(anchorDate, cadence, index);
  if (candidate < onOrAfterDate) candidate = renewalDateFromAnchor(anchorDate, cadence, ++index);
  return candidate;
}

export function unresolvedRenewalReviewGroups<T extends RenewalPeriodState & { relationshipId: string }>(periods: T[]) {
  const groups = new Map<string, T[]>();
  newestFirstUnresolvedRenewalPeriods(periods).forEach((period) => {
    groups.set(period.relationshipId, [...(groups.get(period.relationshipId) ?? []), period]);
  });
  return [...groups.entries()].map(([relationshipId, groupedPeriods]) => ({ relationshipId, periods: groupedPeriods }));
}
