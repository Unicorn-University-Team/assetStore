// Prisma passes `contains` and `startsWith` to LIKE as they are, so % and _ typed by the user would work as wildcards.
export function escapeLike(text: string): string {
  return text.replace(/[\\%_]/g, '\\$&');
}
