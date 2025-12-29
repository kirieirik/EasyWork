import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface EmailRequest {
  to: string
  bcc?: string
  replyTo?: string
  subject: string
  message: string
  pdfBase64: string
  quoteNumber: number
  quoteTitle?: string
  organizationName?: string
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { 
      to, 
      bcc,
      replyTo,
      subject, 
      message, 
      pdfBase64, 
      quoteNumber,
      quoteTitle,
      organizationName 
    }: EmailRequest = await req.json()

    // Validate required fields
    if (!to || !subject || !pdfBase64) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: to, subject, pdfBase64' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    if (!RESEND_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'RESEND_API_KEY not configured' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Build email HTML
    const htmlContent = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="white-space: pre-line; font-size: 15px; line-height: 1.6; color: #374151;">
          ${message.replace(/\n/g, '<br>')}
        </div>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
        <p style="font-size: 12px; color: #9ca3af;">
          Denne e-posten ble sendt fra ${organizationName || 'EasyWork'}. 
          Vedlagt finner du tilbudet som PDF.
        </p>
      </div>
    `

    const textContent = message

    // Create filename for PDF
    const pdfFilename = `Tilbud-${quoteNumber}${quoteTitle ? `-${quoteTitle.replace(/[^a-zA-Z0-9æøåÆØÅ ]/g, '').replace(/\s+/g, '_')}` : ''}.pdf`

    // Build recipients array
    const toArray = [to]
    
    // Build email request to Resend
    const emailData: Record<string, unknown> = {
      from: `${organizationName || 'EasyWork'} <noreply@brynex.no>`,
      to: toArray,
      subject: subject,
      html: htmlContent,
      text: textContent,
      attachments: [
        {
          filename: pdfFilename,
          content: pdfBase64,
        }
      ]
    }

    // Add Reply-To so responses go to the user
    if (replyTo) {
      emailData.reply_to = [replyTo]
    }

    // Add BCC if provided
    if (bcc) {
      emailData.bcc = [bcc]
    }

    // Send email via Resend API
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify(emailData),
    })

    const data = await res.json()

    if (!res.ok) {
      console.error('Resend API error:', data)
      return new Response(
        JSON.stringify({ error: data.message || 'Failed to send email' }),
        { 
          status: res.status, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    return new Response(
      JSON.stringify({ success: true, messageId: data.id }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Error sending email:', error)
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})
