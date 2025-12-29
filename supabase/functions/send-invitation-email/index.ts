import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { to, organizationName, inviterName, role, token, inviterEmail } = await req.json();

    if (!to || !organizationName || !token) {
      return new Response(
        JSON.stringify({ error: "Mangler påkrevde felt" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const inviteUrl = `${req.headers.get("origin") || "http://localhost:5176"}/invitasjon/${token}`;
    const roleLabel = role === "admin" ? "Administrator" : "Ansatt";

    const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Invitasjon til ${organizationName}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0f0f12; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #0f0f12; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 520px; background: linear-gradient(135deg, #1a1a24 0%, #14141c 100%); border-radius: 16px; border: 1px solid #2a2a3a;">
          
          <!-- Header -->
          <tr>
            <td style="padding: 32px 32px 24px; text-align: center; border-bottom: 1px solid #2a2a3a;">
              <div style="width: 48px; height: 48px; background: linear-gradient(135deg, #4f8cff 0%, #3b7aff 100%); border-radius: 12px; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 16px;">
                <span style="font-size: 24px;">👥</span>
              </div>
              <h1 style="margin: 0; color: #ffffff; font-size: 22px; font-weight: 700;">
                Du er invitert!
              </h1>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 32px;">
              <p style="color: #a0a0b0; font-size: 15px; line-height: 1.6; margin: 0 0 24px;">
                ${inviterName ? `<strong style="color: #ffffff;">${inviterName}</strong> har invitert deg` : 'Du har blitt invitert'} til å bli med i <strong style="color: #ffffff;">${organizationName}</strong> på EasyWork som <strong style="color: #4f8cff;">${roleLabel}</strong>.
              </p>

              <p style="color: #a0a0b0; font-size: 15px; line-height: 1.6; margin: 0 0 32px;">
                EasyWork er et verktøy for håndverkere og småbedrifter for å administrere kunder, jobber og tilbud.
              </p>

              <!-- CTA Button -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td align="center">
                    <a href="${inviteUrl}" style="display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #4f8cff 0%, #3b7aff 100%); color: #ffffff; text-decoration: none; font-weight: 600; font-size: 15px; border-radius: 10px;">
                      Godta invitasjon
                    </a>
                  </td>
                </tr>
              </table>

              <p style="color: #707080; font-size: 13px; line-height: 1.5; margin: 32px 0 0; text-align: center;">
                Eller kopier denne lenken:<br>
                <a href="${inviteUrl}" style="color: #4f8cff; word-break: break-all;">${inviteUrl}</a>
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px 32px; border-top: 1px solid #2a2a3a; text-align: center;">
              <p style="color: #606070; font-size: 12px; margin: 0;">
                Invitasjonen utløper om 7 dager.<br>
                Hvis du ikke forventet denne e-posten, kan du ignorere den.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "EasyWork <noreply@brynex.no>",
        to: [to],
        reply_to: inviterEmail || undefined,
        subject: `Invitasjon til ${organizationName} på EasyWork`,
        html: emailHtml,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      console.error("Resend API error:", data);
      return new Response(
        JSON.stringify({ error: data.message || "Kunne ikke sende e-post" }),
        {
          status: res.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(JSON.stringify({ success: true, id: data.id }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Edge function error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Intern serverfeil" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
