// @ts-nocheck
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const pathname = url.pathname;

  // TODO: Wire real Zendesk credentials from Supabase secrets and call Zendesk API.
  // This stub mirrors the local mock endpoints for early integration.
  if (pathname.endsWith("/tickets") && req.method === "GET") {
    return new Response(JSON.stringify([]), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  if (pathname.includes("/tickets/") && req.method === "GET") {
    return new Response(
      JSON.stringify({
        ticket: null,
        messages: []
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  }

  if (pathname.includes("/reply") && req.method === "POST") {
    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  return new Response(JSON.stringify({ error: "Not found" }), {
    status: 404,
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
});
