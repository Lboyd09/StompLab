/**
 * Phone to computer: HX Edit and POD Go Edit are desktop apps, so a phone
 * download has to get to a computer (AirDrop, Files, Mail). The native share
 * sheet does that when the browser can share files.
 */

function makeFile(json: string, filename: string): File | null {
  if (typeof File === "undefined") return null;
  try {
    return new File([json], filename, { type: "application/octet-stream" });
  } catch {
    return null;
  }
}

/** True when this browser can hand a file to the share sheet. Safe on the server. */
export function canShareFile(json: string, filename: string): boolean {
  if (typeof navigator === "undefined" || typeof navigator.share !== "function") return false;
  if (typeof navigator.canShare !== "function") return false;
  const file = makeFile(json, filename);
  if (!file) return false;
  try {
    return navigator.canShare({ files: [file] });
  } catch {
    return false;
  }
}

export type ShareResult = "shared" | "cancelled" | "unsupported";

export async function shareFile(json: string, filename: string, title?: string): Promise<ShareResult> {
  if (!canShareFile(json, filename)) return "unsupported";
  const file = makeFile(json, filename);
  if (!file) return "unsupported";
  try {
    await navigator.share({ files: [file], title: title ?? filename });
    return "shared";
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") return "cancelled";
    return "unsupported";
  }
}
