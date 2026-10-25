// The .hlx / .pgp builder is big (it carries the POD Go catalog), so pages fetch it while idle and
// a Download tap can still save the file in the same tap, which iPhone Safari needs.
type ExportModule = typeof import("./hlx");

let loaded: ExportModule | null = null;
let pending: Promise<ExportModule> | null = null;

export function loadExport(): Promise<ExportModule> {
  pending ??= import("./hlx").then((m) => (loaded = m));
  return pending;
}

/** The builder if it has already arrived, else null (call loadExport first). */
export function getExport(): ExportModule | null {
  return loaded;
}
