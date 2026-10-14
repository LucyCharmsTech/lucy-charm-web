/** `datetime-local` is browser-local; serialize its instant for the UTC API. */
export function localDateTimeToUtc(value: string): string | undefined {
  return value ? new Date(value).toISOString() : undefined;
}
