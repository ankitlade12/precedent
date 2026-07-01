/**
 * Canonical JSON serialization: deterministic output with recursively sorted
 * object keys. This is the substrate for content-addressed IDs — the same logical
 * content must always serialize to the same bytes regardless of key order.
 *
 * Array order is preserved because it is semantically meaningful (the order of
 * alternatives or citations is part of the decision). `undefined` values are
 * omitted so that an absent optional field and an explicit `undefined` hash alike.
 */
export function canonicalize(value: unknown): string {
  return JSON.stringify(sortValue(value));
}

function sortValue(value: unknown): unknown {
  if (value === null || typeof value !== 'object') {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(sortValue);
  }
  const record = value as Record<string, unknown>;
  const sorted: Record<string, unknown> = {};
  for (const key of Object.keys(record).sort()) {
    const child = record[key];
    if (child === undefined) {
      continue;
    }
    sorted[key] = sortValue(child);
  }
  return sorted;
}
