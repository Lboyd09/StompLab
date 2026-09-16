/** Full-bleed top wash — ice + cobalt, edge to edge of the viewport. */
export function PageWash() {
  return (
    <div
      className="pointer-events-none absolute inset-x-0 top-0 z-[1] h-[36rem] w-full sl-hero-wash"
      aria-hidden
    />
  );
}
