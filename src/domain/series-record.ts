import type { PastWindow, SeriesResult } from "../exchange/port";

export type SeriesRecord = {
  up: number;
  down: number;
  voided: number;
  unknown: number;
  total: number;
  last: SeriesResult | null;
};

/** Tally of recently Finalized Windows for one series. Last is newest expiry. */
export function readSeriesRecord(history: PastWindow[]): SeriesRecord {
  const record: SeriesRecord = { up: 0, down: 0, voided: 0, unknown: 0, total: history.length, last: null };
  let newest = -Infinity;
  for (const row of history) {
    if (row.result === "up") record.up += 1;
    else if (row.result === "down") record.down += 1;
    else if (row.result === "void") record.voided += 1;
    else record.unknown += 1;
    if (row.expiry >= newest) {
      newest = row.expiry;
      record.last = row.result;
    }
  }
  return record;
}

export function seriesRecordCopy(record: SeriesRecord): string {
  if (record.total === 0) return "No settled Windows yet.";
  const parts: string[] = [];
  if (record.up) parts.push(`${record.up} Up`);
  if (record.down) parts.push(`${record.down} Down`);
  if (record.voided) parts.push(`${record.voided} Void`);
  if (record.unknown) parts.push(`${record.unknown} unsettled`);
  const last =
    record.last === "up" ? "Up" : record.last === "down" ? "Down" : record.last === "void" ? "Void" : null;
  if (last) parts.push(`last ${last}`);
  return parts.join(" · ");
}
