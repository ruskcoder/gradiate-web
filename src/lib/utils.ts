import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
export function pathMerge(...paths: string[]) {
  return paths
    .map((path, index) => {
      if (index === 0) return path.replace(/\/+$/g, "");
      else return path.replace(/^\/+|\/+$/g, "");
    })
    .filter((path) => path.length > 0)
    .join("/");
}

/**
 * Flatten a multi-group class (e.g. a Skyward semester, where assignments live
 * under `class.groups` keyed by the component terms) into the flat
 * `categories` + `scores` shape the grade views render. Each nested category
 * keeps its real stats; every assignment is placed under its own
 * group-prefixed category ("3RD - Major Grade") instead of one shared bucket.
 * Classes without `groups` (HAC, single-term Skyward) pass through unchanged.
 */
export function transformGroupsToCategories(classData: any) {
  if (!classData || !classData.groups || typeof classData.groups !== "object") {
    return classData;
  }

  const groups = classData.groups;
  const groupNames = Object.keys(groups);
  if (groupNames.length === 0) return classData;

  const multi = groupNames.length > 1;
  const categories: Record<string, any> = {};
  const scores: any[] = [];

  for (const groupName of groupNames) {
    const group = groups[groupName];
    if (!group) continue;
    const catKey = (catName: string) => (multi ? `${groupName} - ${catName}` : catName);

    // Each group's category weights are relative to THAT group, so they can't
    // just be copied side by side into one flat map — a 40/40/20 term split
    // would come out as though every term were equally weighted. Rescale them
    // so a category's flat weight is `groupWeight * (catWeight / groupTotal)`.
    const groupWeight = parseFloat(group.weight);
    const groupCats =
      group.categories && typeof group.categories === "object"
        ? Object.entries<any>(group.categories)
        : [];
    const groupCatTotal = groupCats.reduce(
      (sum, [, c]) => sum + (parseFloat(c?.categoryWeight) || 0),
      0
    );
    const rescale = (catWeight: number) =>
      Number.isFinite(groupWeight) && groupWeight > 0 && groupCatTotal > 0
        ? (groupWeight * catWeight) / groupCatTotal
        : catWeight;

    for (const [catName, catData] of groupCats) {
      const catWeight = parseFloat(catData?.categoryWeight) || 0;
      categories[catKey(catName)] = {
        ...(catData as any),
        categoryWeight: rescale(catWeight).toFixed(4),
      };
    }

    const groupScores = Array.isArray(group.scores) ? group.scores : [];
    for (const sc of groupScores) {
      const cat = catKey(sc.category || "Other");
      if (!categories[cat]) {
        // An assignment in a category the group never declared: it has no
        // weight of its own, so it carries the group's.
        categories[cat] = {
          categoryWeight: (Number.isFinite(groupWeight) ? groupWeight : 0).toFixed(4),
          percent: "0.000",
          studentsPoints: "0",
          maximumPoints: "0",
        };
      }
      scores.push({ ...sc, category: cat });
    }
  }

  return {
    ...classData,
    categories,
    scores: scores.length > 0 ? scores : classData.scores || [],
  };
}