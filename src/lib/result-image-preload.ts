import recipe from "@/generated/result-image-preload.json";
import type { BigFiveDimension } from "@/lib/types";

// Tiny synchronous import in the existing diagnosis chunk. Its URLs/srcSet are
// verified against getImageProps at build time; no preload-only request is needed.
export function preloadResultImage(scores: Record<BigFiveDimension, number>) {
  const dimensions: BigFiveDimension[] = ["O", "C", "E", "A", "N"];
  const key = dimensions.map(dimension => scores[dimension] >= 5 ? "+" : "-").join("");
  const source = (recipe.sources as Record<string, string>)[key];
  if (!source) return;
  const url = (width: number) => `${recipe.endpoint}?url=${encodeURIComponent(source)}&w=${width}&q=${recipe.quality}${recipe.deploymentId ? `&dpl=${recipe.deploymentId}` : ""}`;
  const image = new Image();
  image.sizes = recipe.sizes;
  image.srcset = recipe.widths.map(width => `${url(width)} ${width}w`).join(", ");
  image.src = url(recipe.widths[recipe.widths.length - 1]);
}
