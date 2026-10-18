import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

// VAPID Schlüssel konfigurieren
const VAPID_PUBLIC_KEY = "BMjkI8pXxSXNvFp1OzEZIuDWpz-PMhSIKx5cKzRPop8pPjTjSMls7DalaZo-FPA0THR3ZOWHES5hGkoegsnvj1A";
const VAPID_PRIVATE_KEY = "qePUfC-Ra2VrPfW6iF60Awow7pjyiPcgggcAMasr4sY";

webpush.setVapidDetails(
  "mailto:support@437studio.com",
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY
);

Deno.serve(async (req: Request): Promise<Response> => {
  try {
    const payload = await req.json();
    const record = payload.record;

    if (!record || !record.recipient) {
      return new Response(JSON.stringify({ error: "Kein Empfänger angegeben" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Supabase Admin Client mit Service Role Key initialisieren
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Push-Subscription für den Empfänger abrufen
    const { data: subData, error: subError } = await supabaseAdmin
      .from("push_subscriptions")
      .select("subscription")
      .eq("username", record.recipient)
      .maybeSingle();

    if (subError || !subData || !subData.subscription) {
      return new Response(JSON.stringify({ message: "Keine Push-Subscription für diesen Nutzer gefunden" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Payload für die Browser-Benachrichtigung zusammenstellen
    const notificationPayload = JSON.stringify({
      title: `Neue Nachricht von ${record.sender || "Unbekannt"}`,
      body: record.message || "Du hast eine neue Nachricht erhalten.",
      url: `/messages.html?to=${encodeURIComponent(record.sender || "")}`
    });

    // Push-Benachrichtigung absenden
    await webpush.sendNotification(subData.subscription, notificationPayload);

    return new Response(JSON.stringify({ success: true }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Fehler beim Senden des Push:", error);

    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { "Content-Type": "application/json" },
      status: 500,
    });
  }
});