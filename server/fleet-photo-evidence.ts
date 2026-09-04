export const FLEET_PHOTO_MAX_BYTES = 2_000_000;
export const FLEET_PHOTO_ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

const DATA_IMAGE = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/;

function hasMatchingSignature(mime: string, bytes: Buffer): boolean {
  if (mime === "image/jpeg") return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (mime === "image/png") return bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  return bytes.length >= 12 && bytes.subarray(0, 4).toString("ascii") === "RIFF" && bytes.subarray(8, 12).toString("ascii") === "WEBP";
}

/**
 * Validates new inline Fleet evidence without re-validating legacy stored rows.
 * FileReader produces this exact data-URL form for the mobile capture controls.
 */
export function fleetPhotoEvidence(
  value: unknown,
  options: { required: boolean; label: string },
): string | null {
  if (value === undefined || value === null || value === "") {
    if (options.required) throw new Error(`${options.label} is required.`);
    return null;
  }
  if (typeof value !== "string") throw new Error(`Use a valid ${options.label.toLowerCase()}.`);
  const match = DATA_IMAGE.exec(value);
  if (!match) throw new Error(`Use a JPG, PNG, or WebP ${options.label.toLowerCase()} smaller than 2 MB.`);
  const bytes = Buffer.from(match[2], "base64");
  if (!bytes.length || bytes.length > FLEET_PHOTO_MAX_BYTES || !hasMatchingSignature(match[1], bytes)) {
    throw new Error(`Use a JPG, PNG, or WebP ${options.label.toLowerCase()} smaller than 2 MB.`);
  }
  return value;
}