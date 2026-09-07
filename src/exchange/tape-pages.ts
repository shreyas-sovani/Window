/**
 * Pages a newest-first indexer read until the tape is exhausted or `hardCap`
 * rows have been read. Proof reads name exact transactions, and a single
 * tail-capped query can miss a named tx on a busy pool — so the tape pages —
 * while the hard cap keeps one hostile pool from looping the reader forever.
 */
export async function readTapePages<T>(
  fetchPage: (offset: number) => Promise<T[]>,
  pageSize: number,
  hardCap: number,
): Promise<T[]> {
  const rows: T[] = [];
  for (let offset = 0; offset < hardCap; offset += pageSize) {
    const page = await fetchPage(offset);
    rows.push(...page);
    if (page.length < pageSize) break;
    if (rows.length >= hardCap) break;
  }
  return rows;
}
