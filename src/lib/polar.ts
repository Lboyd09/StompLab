function polarBase() {
  const explicit = process.env.POLAR_API_URL?.replace(/\/$/, "");
  if (explicit) return explicit;
  if (process.env.POLAR_SERVER === "sandbox") return "https://sandbox-api.polar.sh";
  return "https://api.polar.sh";
}

function polarToken() {
  return (process.env.POLAR_ACCESS_TOKEN ?? process.env.POLAR_OAT ?? "").trim();
}

export function polarConfigured() {
  return Boolean(polarToken() && (process.env.POLAR_PRODUCT_ID ?? "").trim());
}

export async function createPolarCheckout(opts: {
  email: string;
  userId: string;
  successUrl: string;
}): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const token = polarToken();
  const productId = (process.env.POLAR_PRODUCT_ID ?? "").trim();
  if (!token || !productId) {
    return {
      ok: false,
      error:
        "Checkout isn't connected yet. Add POLAR_ACCESS_TOKEN and POLAR_PRODUCT_ID on Vercel, then try Unlock again.",
    };
  }
  const body: Record<string, unknown> = {
    products: [productId],
    success_url: opts.successUrl,
    customer_email: opts.email,
    metadata: { user_id: opts.userId, email: opts.email },
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
      last = json.detail || json.error || `Polar error ${res.status}`;
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

export function extractOrder(payload: Record<string, unknown>) {
  const data = (payload.data ?? payload) as Record<string, unknown>;
  const customer = (data.customer ?? {}) as Record<string, unknown>;
  const metadata = (data.metadata ?? payload.metadata ?? {}) as Record<string, unknown>;
  const email = String(
    data.customer_email ?? customer.email ?? metadata.email ?? "",
  ).trim().toLowerCase();
  const userId = String(metadata.user_id ?? "").trim();
  const orderId = String(data.id ?? data.order_id ?? "").trim();
  const checkoutId = String(data.checkout_id ?? data.id ?? "").trim();
  const amount =
    Number(data.amount ?? data.total_amount ?? data.net_amount ?? 0) || 0;
  const customerId = String(data.customer_id ?? customer.id ?? "").trim();
  return { email, userId, orderId, checkoutId, amount, customerId, data };
}
