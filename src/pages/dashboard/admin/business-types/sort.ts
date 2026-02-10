export const isOthers = (value: unknown) => String(value ?? "").trim().toLowerCase() === "others";

/** Always push label "Others" to the bottom, regardless of asc/desc. */
export const compareWithOthersLast = (a: unknown, b: unknown, dir: "asc" | "desc" = "asc") => {
  const ao = isOthers(a);
  const bo = isOthers(b);
  if (ao && !bo) return 1;
  if (!ao && bo) return -1;
  const dirMult = dir === "asc" ? 1 : -1;
  return dirMult * String(a ?? "").localeCompare(String(b ?? ""));
};
