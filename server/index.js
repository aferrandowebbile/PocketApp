const express = require("express");
const cors = require("cors");
const { randomUUID } = require("node:crypto");

const app = express();
const port = process.env.PORT || 8787;

app.use(cors());
app.use(express.json());

const sampleTickets = [
  {
    id: "ZD-1001",
    company_id: "demo-company",
    subject: "Unable to access pass after purchase",
    status: "open",
    priority: "high",
    updated_at: new Date().toISOString(),
    created_at: new Date(Date.now() - 1000 * 60 * 60).toISOString()
  },
  {
    id: "ZD-1002",
    company_id: "demo-company",
    subject: "Request invoice copy",
    status: "pending",
    priority: "normal",
    updated_at: new Date().toISOString(),
    created_at: new Date(Date.now() - 1000 * 60 * 90).toISOString()
  }
];

const sampleMessages = {
  "ZD-1001": [
    {
      id: "11111111-1111-1111-1111-111111111111",
      ticket_id: "ZD-1001",
      direction: "customer",
      type: "text",
      body_text: "I bought my pass but still cannot access the app.",
      audio_storage_path: null,
      audio_duration_ms: null,
      created_at: new Date(Date.now() - 1000 * 60 * 50).toISOString()
    },
    {
      id: "22222222-2222-2222-2222-222222222222",
      ticket_id: "ZD-1001",
      direction: "spotlio",
      type: "text",
      body_text: "Spotlio Team is checking your account and will update shortly.",
      audio_storage_path: null,
      audio_duration_ms: null,
      created_at: new Date(Date.now() - 1000 * 60 * 45).toISOString()
    }
  ],
  "ZD-1002": [
    {
      id: "33333333-3333-3333-3333-333333333333",
      ticket_id: "ZD-1002",
      direction: "customer",
      type: "text",
      body_text: "Can you send me the invoice for booking #A21?",
      audio_storage_path: null,
      audio_duration_ms: null,
      created_at: new Date(Date.now() - 1000 * 60 * 30).toISOString()
    }
  ]
};

const sampleOrders = Array.from({ length: 12 }).map((_, index) => ({
  id: `ORD-${1000 + index}`,
  customer_name: [`Alex`, `Sam`, `Taylor`, `Jordan`][index % 4] + ` Guest`,
  product_name: ["Day Pass", "Ski Lift", "Spa Entry"][index % 3],
  quantity: (index % 3) + 1,
  status: index % 5 === 0 ? "canceled" : "completed",
  completed_at_day: new Date(Date.now() - index * 60 * 60 * 1000).toISOString()
}));

app.get("/health", (_, res) => {
  res.json({ ok: true });
});

app.get("/tickets", (req, res) => {
  const { companyId, status } = req.query;
  const filtered = sampleTickets.filter((ticket) => {
    const companyMatch = companyId ? ticket.company_id === companyId : true;
    const statusMatch = status ? ticket.status === status : true;
    return companyMatch && statusMatch;
  });
  res.json(filtered);
});

app.get("/tickets/:id", (req, res) => {
  const { id } = req.params;
  const ticket = sampleTickets.find((item) => item.id === id);
  if (!ticket) {
    res.status(404).json({ error: "Ticket not found" });
    return;
  }
  res.json({
    ticket,
    messages: sampleMessages[id] || []
  });
});

app.post("/tickets/:id/reply", (req, res) => {
  const { id } = req.params;
  const { type, text, audioUrl, durationMs } = req.body;

  if (!sampleMessages[id]) {
    sampleMessages[id] = [];
  }

  sampleMessages[id].push({
    id: randomUUID(),
    ticket_id: id,
    direction: "spotlio",
    type,
    body_text: type === "text" ? text || "" : null,
    audio_storage_path: type === "audio" ? audioUrl || null : null,
    audio_duration_ms: type === "audio" ? durationMs || 0 : null,
    created_at: new Date().toISOString()
  });

  const ticket = sampleTickets.find((item) => item.id === id);
  if (ticket) {
    ticket.updated_at = new Date().toISOString();
  }

  res.json({ success: true });
});

app.get("/orders", async (req, res) => {
  const baseUrl = process.env.ORDERS_API_BASE_URL || "https://connect.spotlio.com";
  const client = process.env.ORDERS_API_CLIENT || "tlml";
  const limit = String(req.query.limit || "10");
  const offset = String(req.query.offset || "0");
  const sort = String(req.query.sort || process.env.ORDERS_API_SORT || "completed_at_day:desc");
  const mode = String(req.query.mode || process.env.ORDERS_API_MODE || "partial");
  const statusesRaw = req.query.status || req.query.statuses || process.env.ORDERS_API_STATUS || "completed,canceled";
  const statuses = Array.isArray(statusesRaw)
    ? statusesRaw.map(String)
    : String(statusesRaw)
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean);

  if (process.env.ORDERS_PROXY_FORCE_MOCK === "true") {
    const start = Number(offset);
    const end = start + Number(limit);
    res.json({ orders: sampleOrders.slice(start, end), total: sampleOrders.length, source: "mock" });
    return;
  }

  const query = new URLSearchParams();
  query.set("client", client);
  query.set("limit", limit);
  query.set("offset", offset);
  query.set("sort", sort);
  query.set("mode", mode);
  statuses.forEach((status) => query.append("status[]", status));

  const headers = {
    Accept: "application/json, text/plain, */*"
  };

  if (process.env.ORDERS_PROXY_AUTH_HEADER) {
    headers.Authorization = process.env.ORDERS_PROXY_AUTH_HEADER;
  }
  if (process.env.ORDERS_PROXY_COOKIE) {
    headers.Cookie = process.env.ORDERS_PROXY_COOKIE;
  }
  if (process.env.ORDERS_PROXY_X_API_KEY) {
    headers["x-api-key"] = process.env.ORDERS_PROXY_X_API_KEY;
  }

  try {
    const upstream = await fetch(`${baseUrl}/console/orders?${query.toString()}`, {
      method: "GET",
      headers
    });

    const contentType = upstream.headers.get("content-type") || "";
    const body = contentType.includes("application/json") ? await upstream.json() : await upstream.text();

    if (!upstream.ok) {
      res.status(upstream.status).json({
        error: "Orders upstream error",
        status: upstream.status,
        body: typeof body === "string" ? body.slice(0, 300) : body
      });
      return;
    }

    res.json(body);
  } catch (error) {
    const start = Number(offset);
    const end = start + Number(limit);
    res.status(502).json({
      error: "Orders proxy unavailable",
      details: error instanceof Error ? error.message : "Unknown error",
      fallback: { orders: sampleOrders.slice(start, end), total: sampleOrders.length, source: "mock" }
    });
  }
});

app.listen(port, () => {
  console.log(`Mock Zendesk service listening on http://localhost:${port}`);
});
