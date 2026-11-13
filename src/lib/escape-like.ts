/**
 * Escape ILIKE/LIKE wildcards so a value matches literally.
 * Emails containing "_" or "%" would otherwise act as wildcards and
 * could match a different customer's row.
 */
export function escapeLike(value: string): string {
  return value.replace(/([\\%_])/g, "\\$1");
}
