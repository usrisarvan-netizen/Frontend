import nodemailer from 'nodemailer'

const DEFAULT_GROUP_LINK =
  process.env.GROUP_LINK || 'https://chat.whatsapp.com/E5M5aok7zrEGppgG9O8sD6'

function normalizePhone(rawPhone) {
  const cleaned = String(rawPhone || '').replace(/[^\d+]/g, '')
  if (!cleaned) return ''
  if (cleaned.startsWith('+')) return cleaned
  if (cleaned.length === 10) return `+91${cleaned}`
  return `+${cleaned}`
}

function toDigits(phone) {
  return String(phone || '').replace(/\D/g, '')
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  }

  const { name, email, phone, bloodGroup } = req.body || {}
  const trimmedName = String(name || '').trim()
  const trimmedEmail = String(email || '').trim()
  const normalizedPhone = normalizePhone(phone)

  if (!trimmedName || !normalizedPhone) {
    return res.status(400).json({
      success: false,
      error: 'Name and a valid mobile number are required.',
    })
  }

  const bloodInfo = bloodGroup ? ` (Blood Group: ${bloodGroup})` : ''
  const messageBody =
    `Welcome to PulseLink Blood Bank, ${trimmedName}!${bloodInfo}\n` +
    `Thank you for registering as a life saver.\n` +
    `Join our WhatsApp donor group here: ${DEFAULT_GROUP_LINK}`

  const results = {}

  if (trimmedEmail) {
    const smtpUser = process.env.SMTP_USER?.trim()
    const smtpPass = process.env.SMTP_PASS?.trim()
    const smtpFrom = process.env.SMTP_FROM?.trim() || smtpUser
    const smtpHost = process.env.SMTP_HOST?.trim() || 'smtp-relay.brevo.com'
    const smtpPort = Number(process.env.SMTP_PORT || 587)

    if (!smtpUser || !smtpPass) {
      results.email = {
        success: true,
        simulated: true,
        channel: 'email',
        to: trimmedEmail,
        notice: 'Add SMTP_USER & SMTP_PASS in Vercel Environment Variables to send real emails.',
      }
    } else {
      try {
        const transporter = nodemailer.createTransport({
          host: smtpHost,
          port: smtpPort,
          secure: smtpPort === 465,
          auth: { user: smtpUser, pass: smtpPass },
        })

        const bloodLine = bloodGroup ? `<p><strong>Blood Group:</strong> ${bloodGroup}</p>` : ''
        const info = await transporter.sendMail({
          from: `"PulseLink Blood Bank" <${smtpFrom}>`,
          to: trimmedEmail,
          subject: 'Welcome to PulseLink Blood Bank — Join Our Donor Group',
          text: messageBody,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 10px;">
              <h2 style="color: #dc2626; margin-top: 0;">Welcome to PulseLink Blood Bank, ${trimmedName}!</h2>
              <p>Thank you for registering as a life saver.</p>
              ${bloodLine}
              <p>Join our official WhatsApp donor community group using the button below:</p>
              <p style="margin: 20px 0;">
                <a href="${DEFAULT_GROUP_LINK}" style="background: #dc2626; color: #ffffff; padding: 12px 20px; border-radius: 8px; text-decoration: none; font-weight: bold; display: inline-block;">
                  Join WhatsApp Donor Group
                </a>
              </p>
              <p style="font-size: 13px; color: #6b7280;">Or copy this link: <a href="${DEFAULT_GROUP_LINK}">${DEFAULT_GROUP_LINK}</a></p>
            </div>
          `,
        })

        results.email = {
          success: true,
          simulated: false,
          channel: 'email',
          to: trimmedEmail,
          messageId: info.messageId,
        }
      } catch (error) {
        results.email = {
          success: false,
          simulated: false,
          channel: 'email',
          to: trimmedEmail,
          error: error?.message || 'Failed to send welcome email.',
        }
      }
    }
  }

  return res.status(200).json({
    success: Boolean(results.email?.success),
    channels: Object.keys(results),
    results,
    to: normalizedPhone,
    groupLink: DEFAULT_GROUP_LINK,
    preview: messageBody,
    whatsappDirectUrl: `https://wa.me/${toDigits(normalizedPhone)}?text=${encodeURIComponent(messageBody)}`,
  })
}
