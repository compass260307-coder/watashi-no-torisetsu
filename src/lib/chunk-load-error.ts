/** A retry in the same JS runtime cannot restore a chunk removed by a deploy. */
export function isChunkLoadError(error: Error): boolean {
  return error.name === "ChunkLoadError" ||
    /Loading (?:CSS )?chunk [\s\S]+ failed|Failed to load chunk|Failed to fetch dynamically imported module/i.test(error.message);
}
