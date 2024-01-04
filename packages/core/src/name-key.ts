/**
 * Folds a name so accents, case and punctuation don't hide a match:
 * "Müller-Lüdenscheidt" and "MULLER-LUDENSCHEIDT" both give "mullerludenscheidt".
 * Steps follow the project spec: NFKD, drop combining marks, lower-case, keep only
 * letters/digits/spaces (so a hyphen disappears rather than becoming a space),
 * collapse spaces.
 */
export function normaliseName(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N} ]/gu, "")
    .replace(/ +/g, " ")
    .trim();
}

/** Identity of a guest by name, used by W203 and by the diff. */
export function nameKey(entry: {
  lastName?: string | undefined;
  firstName?: string | undefined;
}): string {
  return `${normaliseName(entry.lastName ?? "")}|${normaliseName(entry.firstName ?? "")}`;
}
