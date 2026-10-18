import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";
import { currentClientIp, rateLimited } from "./rate-limit";
import type { Preset } from "@/data/types";
import { isStompModelId } from "@/data/types";

const MAX_PRESET_BYTES = 200_000;
const SHARE_ID_RE = /^[0-9A-Za-z]{10}$/;
const BASE62 = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

/** 10 base62 characters from the crypto RNG (rejection sampling, no modulo bias). */
export function newShareId(): string {
  let out = "";
  while (out.length < 10) {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    for (const b of bytes) {
      if (b < 248 && out.length < 10) out += BASE62[b % 62];
    }
  }
  return out;
}

/**
 * What goes on a public link: the preset minus anything personal. Gear the
 * player owns is added to `recommendedGear` with `fromLocker`; those lines name
 * their own guitars, so they never leave the account.
 */
export function publicPreset(preset: Preset): Preset {
  const { userEdited: _userEdited, ...rest } = preset;
  return {
    ...rest,
    recommendedGear: (preset.recommendedGear ?? []).filter((g) => !g.fromLocker),
  };
}

const presetShape = z
  .object({
    id: z.string().min(1).max(200),
    source: z.enum(["song", "custom", "featured"]),
    stompModel: z.string().refine(isStompModelId),
    blocks: z.array(z.unknown()).max(40),
    snapshots: z.array(z.unknown()).max(20),
  })
  .passthrough();

export const sharePresetFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    const { preset } = z.object({ preset: z.unknown() }).parse(input);
    const parsed = presetShape.parse(preset);
    if (JSON.stringify(parsed).length > MAX_PRESET_BYTES) throw new Error("Preset is too large to share.");
    return { preset: parsed as unknown as Preset };
  })
  .handler(async ({ context, data }): Promise<{ ok: true; shareId: string } | { ok: false; error: string }> => {
    if (data.preset.source === "featured") {
      return { ok: false, error: "Open this preset's own link instead." };
    }
    if (await rateLimited(getSql, `share:${context.userId}`, 20, 3600)) {
      return { ok: false, error: "Too many links just now. Try again in a bit." };
    }
    try {
      const sql = await getSql();
      const preset = publicPreset(data.preset);
      const json = JSON.stringify(preset);
      const existing = await sql.query<{ share_id: string }>(
        `select share_id from shared_presets where user_id = $1 and preset->>'id' = $2 order by created_at limit 1`,
        [context.userId, preset.id],
      );
      if (existing[0]) {
        await sql.query(
          `update shared_presets set preset = $1::jsonb, song = $2, artist = $3, stomp_model = $4 where share_id = $5 and user_id = $6`,
          [json, preset.song ?? null, preset.artist ?? null, preset.stompModel, existing[0].share_id, context.userId],
        );
        return { ok: true, shareId: existing[0].share_id };
      }
      const shareId = newShareId();
      await sql.query(
        `insert into shared_presets (share_id, user_id, preset, song, artist, stomp_model) values ($1, $2, $3::jsonb, $4, $5, $6)`,
        [shareId, context.userId, json, preset.song ?? null, preset.artist ?? null, preset.stompModel],
      );
      return { ok: true, shareId };
    } catch {
      return { ok: false, error: "Could not make a link. Try again." };
    }
  });

export const getSharedPresetFn = createServerFn({ method: "GET" })
  .validator((input: unknown) => z.object({ shareId: z.string().regex(SHARE_ID_RE) }).parse(input))
  .handler(async ({ data }): Promise<{ preset: Preset | null }> => {
    const ip = await currentClientIp();
    if (await rateLimited(getSql, `shared-view:${ip}`, 120, 600)) return { preset: null };
    try {
      const sql = await getSql();
      const rows = await sql.query<{ preset: Preset | string }>(
        `select preset from shared_presets where share_id = $1 limit 1`,
        [data.shareId],
      );
      const raw = rows[0]?.preset;
      if (!raw) return { preset: null };
      const preset = (typeof raw === "string" ? JSON.parse(raw) : raw) as Preset;
      return { preset: publicPreset(preset) };
    } catch {
      return { preset: null };
    }
  });
