import type { PlanInterval } from "./plan";

function polarBase() {
  const explicit = process.env.POLAR_API_URL?.replace(/\/$/, "");
  if (explicit) return explicit;
  if (process.env.POLAR_SERVER === "sandbox") return "https://sandbox-api.polar.sh";
  return "https://api.polar.sh";
}

function polarToken() {
  return (process.env.POLAR_ACCESS_TOKEN ?? process.env.POLAR_OAT ?? "").trim();
}

export function polarProductId(interval: PlanInterval): string {
  if (interval === "year") {
    return (process.env.POLAR_PRODUCT_ID_YEARLY ?? "").trim();
  }
  return (process.env.POLAR_PRODUCT_ID_MONTHLY ?? process.env.POLAR_PRODUCT_ID ?? "").trim();
}

export function polarConfigured() {
  return Boolean(polarToken() && (polarProductId("month") || polarProductId("year")));
}

export function polarFriendlyError(status: number, detail: unknown): string {
  const d =
    typeof detail === "string"
      ? detail.trim()
      : Array.isArray(detail)
        ? detail.map((x) => (typeof x === "string" ? x : JSON.stringify(x))).join(" ")
        : detail && typeof detail === "object"
          ? JSON.stringify(detail)
          : "";
  const lower = d.toLowerCase();
  if (status === 401 || status === 403 || lower === "unauthorized" || /invalid token|unauthenticated/.test(lower)) {
    return "Polar rejected the checkout key. On the host, set POLAR_ACCESS_TOKEN from the same Polar org as the products (live vs sandbox must match).";
  }
  if (/success_url|return url|invalid url/.test(lower)) {
    return "Polar rejected the return URL. In Polar, allow this site's real domain (the one you just bought) plus stomplab.vercel.app. Set APP_ORIGIN to that https URL on the host.";
  }
  if (status === 404 || status === 422 || /product|not found|unprocessable|unknown product/.test(lower)) {
    return "Polar does not recognize this product. Create a $6.99/month and a $75/year product, then set POLAR_PRODUCT_ID_MONTHLY and POLAR_PRODUCT_ID_YEARLY.";
  }
  return d || `Polar checkout failed (${status || "network"}). Try again in a minute.`;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function payloadData(payload: Record<string, unknown>): Record<string, unknown> {
  const nested = asRecord(payload.data);
  return Object.keys(nested).length ? nested : payload;
}

export function polarEventType(payload: Record<string, unknown>): string {
  return String(payload.type ?? payload.event ?? "")
    .trim()
    .toLowerCase();
}

/** Only these Polar statuses mean money actually moved. Never "confirmed" / "complete". */
export function polarStatusIsPaid(payload: Record<string, unknown> | null | undefined): boolean {
  if (!payload) return false;
  const data = payloadData(payload);
  const status = String(data.status ?? data.payment_status ?? "")
    .trim()
    .toLowerCase();
  return status === "succeeded" || status === "paid";
}

/**
 * Checkout.created fires the moment Unlock is clicked — before anyone pays.
 * order.created is pending. Only order.paid, or a checkout whose status is
 * succeeded/paid, counts.
 */
export function polarEventIsPaid(payload: Record<string, unknown> | null | undefined): boolean {
  if (!payload) return false;
  const type = polarEventType(payload);
  if (
    type.includes("refund") ||
    type.includes("fail") ||
    type.includes("expir") ||
    type.includes("cancel")
  ) {
    return false;
  }
  if (type === "checkout.created" || type.endsWith("checkout.created")) return false;
  if (type === "order.created" || type.endsWith("order.created")) return false;
  if (type === "order.paid" || type.endsWith("order.paid")) return true;
  if (type.startsWith("checkout.") || type === "") return polarStatusIsPaid(payload);
  return false;
}

export function polarEventIsSubscriptionGrant(payload: Record<string, unknown> | null | undefined): boolean {
  if (!payload) return false;
  const type = polarEventType(payload);
  const status = String(payloadData(payload).status ?? "")
    .trim()
    .toLowerCase();
  if (type === "subscription.active" || type.endsWith("subscription.active")) return true;
  if (type === "subscription.uncanceled" || type.endsWith("subscription.uncanceled")) return true;
  if (type === "subscription.created" || type.endsWith("subscription.created")) {
    return status === "active" || status === "trialing";
  }
  if (type === "subscription.updated" || type.endsWith("subscription.updated")) {
    return status === "active" || status === "trialing";
  }
  return false;
}

export function polarEventIsSubscriptionRevoke(payload: Record<string, unknown> | null | undefined): boolean {
  if (!payload) return false;
  const type = polarEventType(payload);
  return type === "subscription.revoked" || type.endsWith("subscription.revoked");
}

export function isRealPolarOrderId(id: string | null | undefined): boolean {
  const v = String(id ?? "").trim();
  if (v.length < 8) return false;
  if (/^checkout[_-]/i.test(v)) return false;
  return true;
}

export function isRealPolarSubscriptionId(id: string | null | undefined): boolean {
  const v = String(id ?? "").trim();
  return v.length >= 8;
}

export function purchaseLooksPaid(raw: unknown): boolean {
  if (!raw || typeof raw !== "object") return false;
  const rec = raw as Record<string, unknown>;
  return polarEventIsPaid(rec) || polarEventIsSubscriptionGrant(rec);
}

export function subscriptionStatusIsActive(status: string | null | undefined): boolean {
  const s = String(status ?? "").trim().toLowerCase();
  // canceled = still in the paid period until Polar sends subscription.revoked
  return s === "active" || s === "trialing" || s === "canceled";
}

export async function createPolarCheckout(opts: {
  email: string;
  userId: string;
  successUrl: string;
  interval: PlanInterval;
}): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const token = polarToken();
  const productId = polarProductId(opts.interval);
  if (!token || !productId) {
    const needed =
      opts.interval === "year" ? "POLAR_PRODUCT_ID_YEARLY" : "POLAR_PRODUCT_ID_MONTHLY";
    return {
      ok: false,
      error: `Checkout isn't connected yet. Add POLAR_ACCESS_TOKEN and ${needed} on Vercel, then try Subscribe again.`,
    };
  }
  const body: Record<string, unknown> = {
    products: [productId],
    success_url: opts.successUrl,
    customer_email: opts.email,
    metadata: { user_id: opts.userId, email: opts.email, interval: opts.interval },
  };
  const discount = (process.env.POLAR_DISCOUNT_ID ?? "").trim();
  if (discount) body.discount_id = discount;

  const urls = [`${polarBase()}/v1/checkouts/`, `${polarBase()}/v1/checkouts/custom/`];
  let last = "Polar checkout failed";
  for (const url of urls) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
      const raw = await res.text();
      let json: { url?: string; id?: string; detail?: string; error?: string } = {};
      try {
        json = JSON.parse(raw) as typeof json;
      } catch {
        json = {};
      }
      if (res.ok && json.url) return { ok: true, url: json.url };
      last = polarFriendlyError(res.status, json.detail || json.error || "");
      if (res.status !== 404) break;
    } catch (err) {
      last = err instanceof Error ? err.message : "Polar network error";
    }
  }
  return { ok: false, error: last };
}

export async function fetchPolarCheckout(id: string): Promise<Record<string, unknown> | null> {
  const token = polarToken();
  if (!token || !id) return null;
  const res = await fetch(`${polarBase()}/v1/checkouts/${encodeURIComponent(id)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null;
  return (await res.json()) as Record<string, unknown>;
}

export function extractInterval(payload: Record<string, unknown>): PlanInterval | "" {
  const data = payloadData(payload);
  const metadata = {
    ...asRecord(payload.metadata),
    ...asRecord(data.metadata),
    ...asRecord(asRecord(data.order).metadata),
  };
  const fromMeta = String(metadata.interval ?? "").trim().toLowerCase();
  if (fromMeta === "year" || fromMeta === "yearly") return "year";
  if (fromMeta === "month" || fromMeta === "monthly") return "month";
  const rec = String(
    data.recurring_interval ?? data.recurringInterval ?? asRecord(data.product).recurring_interval ?? "",
  )
    .trim()
    .toLowerCase();
  if (rec === "year" || rec === "yearly") return "year";
  if (rec === "month" || rec === "monthly") return "month";
  return "";
}

export function extractOrder(payload: Record<string, unknown>) {
  const type = polarEventType(payload);
  const data = payloadData(payload);
  const nestedOrder = asRecord(data.order);
  const nestedSub = asRecord(data.subscription);
  const customer = asRecord(data.customer);
  const metadata = {
    ...asRecord(payload.metadata),
    ...asRecord(nestedOrder.metadata),
    ...asRecord(nestedSub.metadata),
    ...asRecord(data.metadata),
  };
  const email = String(
    data.customer_email ?? customer.email ?? metadata.email ?? nestedOrder.customer_email ?? "",
  )
    .trim()
    .toLowerCase();
  const userId = String(metadata.user_id ?? "").trim();

  const dataOrderId = String(data.order_id ?? nestedOrder.id ?? "").trim();
  const dataId = String(data.id ?? "").trim();
  const fromOrder = type.startsWith("order.");
  const fromCheckout = type.startsWith("checkout.");
  const fromSub = type.startsWith("subscription.");

  let orderId = dataOrderId;
  if (!orderId && fromOrder) orderId = dataId;
  if (!isRealPolarOrderId(orderId) || (fromCheckout && orderId === dataId)) {
    orderId = isRealPolarOrderId(dataOrderId) ? dataOrderId : "";
  }

  let checkoutId = String(data.checkout_id ?? nestedOrder.checkout_id ?? "").trim();
  if (!checkoutId && fromCheckout) checkoutId = dataId;
  if (!checkoutId && !fromOrder && !fromCheckout && !fromSub) {
    checkoutId = dataId;
  }

  let subscriptionId = String(
    data.subscription_id ?? nestedSub.id ?? nestedOrder.subscription_id ?? "",
  ).trim();
  if (!subscriptionId && fromSub) subscriptionId = dataId;
  if (!isRealPolarSubscriptionId(subscriptionId)) subscriptionId = "";

  const amount = Number(data.amount ?? data.total_amount ?? data.net_amount ?? nestedOrder.amount ?? 0) || 0;
  const customerId = String(data.customer_id ?? customer.id ?? nestedOrder.customer_id ?? "").trim();
  const interval = extractInterval(payload);
  const subStatus = String(data.status ?? nestedSub.status ?? "")
    .trim()
    .toLowerCase();
  return {
    email,
    userId,
    orderId,
    checkoutId,
    subscriptionId,
    amount,
    customerId,
    interval,
    subStatus,
    data,
    metadata,
  };
}
