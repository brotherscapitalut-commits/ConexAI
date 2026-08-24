/**
 * UUID v4 validation utility
 */

const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Returns true if the given string resembles a valid UUID v4.
 * Used to distinguish real DB ids from mock/demo ids.
 */
export function isUuidV4Like(id: string): boolean {
  return UUID_V4_REGEX.test(id);
}
