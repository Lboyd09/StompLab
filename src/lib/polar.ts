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
  const status = polarCheckoutStatus(data);
  return status === "succeeded" || status === "paid";
}

export function polarCheckoutStatus(payload: Record<string, unknown> | null | undefined): string {
  if (!payload) return "";
  const data = payloadData(payload);
  return String(data.status ?? data.payment_status ?? "")
    .trim()
    .toLowerCase();
}

/** Polar: payment hits "confirmed" first, then checkout.updated → "succeeded". */
export function polarCheckoutNeedsPoll(payload: Record<string, unknown> | null | undefined): boolean {
  const status = polarCheckoutStatus(payload);
  return status === "confirmed" || status === "processing" || status === "open" || status === "pending";
}

/**
 * Ready to grant after a return-from-Polar: succeeded/paid, or confirmed
 * with a real order/subscription id (Polar sometimes lags the status field).
 */
export function polarCheckoutIsReady(payload: Record<string, unknown> | null | undefined): boolean {
  if (!payload) return false;
  if (polarStatusIsPaid(payload)) return true;
  if (polarCheckoutStatus(payload) !== "confirmed") return false;
  const order = extractOrder(payload);
  return isRealPolarOrderId(order.orderId) || isRealPolarSubscriptionId(order.subscriptionId);
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
  returnUrl?: string;
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
  const metadata = { user_id: opts.userId, email: opts.email, interval: opts.interval };
  const bodies: Record<string, unknown>[] = [
    {
      products: [productId],
      success_url: opts.successUrl,
      return_url: opts.returnUrl || opts.successUrl.replace(/\?.*$/, ""),
      customer_email: opts.email,
      external_customer_id: opts.userId,
      metadata,
      customer_metadata: metadata,
    },
    {
      products: [productId],
      success_url: opts.successUrl,
      customer_email: opts.email,
      external_customer_id: opts.userId,
      metadata,
    },
    {
      products: [productId],
      success_url: opts.successUrl,
      customer_email: opts.email,
      metadata,
    },
    {
      product_id: productId,
      success_url: opts.successUrl,
      customer_email: opts.email,
      metadata,
    },
  ];
  const discount = (process.env.POLAR_DISCOUNT_ID ?? "").trim();
  if (discount) {
    for (const body of bodies) body.discount_id = discount;
  }

  const urls = [`${polarBase()}/v1/checkouts/`, `${polarBase()}/v1/checkouts/custom/`];
  let last = "Polar checkout failed";
  for (const body of bodies) {
    for (const url of urls) {
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify(body),
        });
        const raw = await res.text();
        let json: {
          url?: string;
          id?: string;
          detail?: unknown;
          error?: string;
        } = {};
        try {
          json = JSON.parse(raw) as typeof json;
        } catch {
          json = {};
        }
        if (res.ok && json.url) return { ok: true, url: json.url };
        last = polarFriendlyError(res.status, json.detail || json.error || raw.slice(0, 240));
        if (res.status === 401 || res.status === 403) return { ok: false, error: last };
      } catch (err) {
        last = err instanceof Error ? err.message : "Polar network error";
      }
    }
  }
  return { ok: false, error: last };
}

export async function fetchPolarCheckout(id: string): Promise<Record<string, unknown> | null> {
  const token = polarToken();
  if (!token || !id) return null;
  const res = await fetch(`${polarBase()}/v1/checkouts/${encodeURIComponent(id)}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
  });
  if (!res.ok) return null;
  return (await res.json()) as Record<string, unknown>;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/** Poll Polar until succeeded/failed, or the confirmed checkout already has an order. */
export async function waitForPolarCheckout(
  id: string,
  tries = 10,
): Promise<Record<string, unknown> | null> {
  let last: Record<string, unknown> | null = null;
  for (let i = 0; i < tries; i++) {
    const checkout = await fetchPolarCheckout(id);
    if (checkout) last = checkout;
    if (polarStatusIsPaid(checkout) || polarCheckoutIsReady(checkout)) return checkout;
    const status = polarCheckoutStatus(checkout);
    if (status === "failed" || status === "expired") return checkout;
    if (status && !polarCheckoutNeedsPoll(checkout)) return checkout;
    await sleep(400 + i * 180);
  }
  return last;
}

export async function lookupPolarCustomer(opts: {
  email?: string | null;
  externalId?: string | null;
}): Promise<string> {
  const token = polarToken();
  if (!token) return "";
  const queries: string[] = [];
  const em = (opts.email ?? "").trim().toLowerCase();
  const ext = (opts.externalId ?? "").trim();
  if (em) queries.push(`${polarBase()}/v1/customers/?email=${encodeURIComponent(em)}&limit=1`);
  if (ext) queries.push(`${polarBase()}/v1/customers/?external_id=${encodeURIComponent(ext)}&limit=1`);
  for (const url of queries) {
    try {
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      });
      if (!res.ok) continue;
      const json = (await res.json()) as Record<string, unknown>;
      const items = Array.isArray(json.items)
        ? json.items
        : Array.isArray((json.result as { items?: unknown[] } | undefined)?.items)
          ? ((json.result as { items: unknown[] }).items)
          : [];
      const first = items[0];
      if (first && typeof first === "object") {
        const id = String((first as { id?: string }).id ?? "").trim();
        if (id) return id;
      }
    } catch {
      /* try next */
    }
  }
  return "";
}

export async function createCustomerPortalSession(opts: {
  customerId?: string;
  externalCustomerId?: string;
  returnUrl?: string;
}): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const token = polarToken();
  if (!token) {
    return { ok: false, error: "Polar is not connected on this host." };
  }
  const bodies: Record<string, unknown>[] = [];
  if (opts.customerId) {
    bodies.push({
      customer_id: opts.customerId,
      ...(opts.returnUrl ? { return_url: opts.returnUrl } : {}),
    });
    bodies.push({ customer_id: opts.customerId });
  }
  if (opts.externalCustomerId) {
    bodies.push({
      customer_external_id: opts.externalCustomerId,
      ...(opts.returnUrl ? { return_url: opts.returnUrl } : {}),
    });
    bodies.push({ customer_external_id: opts.externalCustomerId });
  }
  if (!bodies.length) {
    return { ok: false, error: "No Polar customer on this account yet. Subscribe once, then manage it here." };
  }
  const urls = [`${polarBase()}/v1/customer-sessions/`, `${polarBase()}/v1/customer-sessions`];
  let last = "Could not open Polar's customer portal.";
  for (const body of bodies) {
    for (const url of urls) {
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify(body),
        });
        const raw = await res.text();
        let json: Record<string, unknown> = {};
        try {
          json = JSON.parse(raw) as Record<string, unknown>;
        } catch {
          json = {};
        }
        const portal =
          String(json.customer_portal_url ?? json.customerPortalUrl ?? json.url ?? "").trim();
        if (res.ok && portal.startsWith("http")) return { ok: true, url: portal };
        last = polarFriendlyError(res.status, json.detail || json.error || raw.slice(0, 240));
        if (res.status === 401 || res.status === 403) return { ok: false, error: last };
      } catch (err) {
        last = err instanceof Error ? err.message : "Polar network error";
      }
    }
  }
  return { ok: false, error: last };
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
