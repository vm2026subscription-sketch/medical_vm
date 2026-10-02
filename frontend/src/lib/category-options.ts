import { useEffect, useState } from "react";
import { apiRequest } from "./api-client";
import { CATALOG_CATEGORIES, STATE_CATEGORIES } from "./catalog";

export function useCategoryOptions(
  scope: "admin" | "colleges" | "cutoffs",
  selected?: string,
  revision = 0,
  state?: string,
) {
  const [published, setPublished] = useState<string[]>([]);
  useEffect(() => {
    let current = true;
    const path = scope === "admin" ? "/admin/imports/categories" : `/${scope}/categories`;
    apiRequest<{ data: string[] }>(path)
      .then((result) => {
        if (current && Array.isArray(result.data))
          setPublished(
            result.data.filter((value) => typeof value === "string" && value.length > 0),
          );
      })
      .catch(() => {
        /* Suggestions remain usable; admin can type any source code. */
      });
    return () => {
      current = false;
    };
  }, [scope, revision]);
  if (state && STATE_CATEGORIES[state]) return STATE_CATEGORIES[state];
  return [...new Set([...CATALOG_CATEGORIES, ...published, ...(selected ? [selected] : [])])];
}
