export const MAX_ANNOTATION_CODE_POINTS = 280;

function countCodePoints(value: string): number {
  return Array.from(value).length;
}

/** A bounded, plain-text annotation codec for static game permalinks. */
export function decodeAnnotation(params: URLSearchParams): string | null {
  const value = params.get("a");
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed && countCodePoints(trimmed) <= MAX_ANNOTATION_CODE_POINTS
    ? trimmed
    : null;
}

export function setAnnotation(
  params: URLSearchParams,
  annotation: string,
): URLSearchParams {
  const next = new URLSearchParams(params);
  const trimmed = annotation.trim();
  if (trimmed === "") {
    next.delete("a");
  } else if (countCodePoints(trimmed) <= MAX_ANNOTATION_CODE_POINTS) {
    next.set("a", trimmed);
  } else {
    throw new RangeError(
      `Annotations are limited to ${MAX_ANNOTATION_CODE_POINTS} characters.`,
    );
  }
  return next;
}
