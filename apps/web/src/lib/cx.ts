/** Joins the class names that are set: `cx("a", flag && "b")`. A tiny stand-in for clsx (OP7: no new dependencies). */
export function cx(...names: (string | false | null | undefined)[]): string {
  return names.filter(Boolean).join(" ");
}
