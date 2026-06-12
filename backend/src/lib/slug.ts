// Turn a group name into a URL-friendly slug: "Q3 Launch!" -> "q3-launch".
export function slugify(input: string): string {
  return (
    input
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "group"
  );
}
