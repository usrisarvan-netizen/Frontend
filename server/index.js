import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import nodemailer from 'nodemailer'
import qrcode from 'qrcode-terminal'
import pkg from 'whatsapp-web.js'

const { Client, LocalAuth } = pkg

dotenv.config()

const app = express()
app.use(cors())
app.use(express.json())

const PORT = process.env.PORT || 4000
const DEFAULT_GROUP_LINK =
  process.env.GROUP_LINK || 'https://chat.whatsapp.com/E5M5aok7zrEGppgG9O8sD6'

let waReady = false
let waStatus = 'initializing'

const waClient = new Client({
  authStrategy: new LocalAuth({ dataPath: './server/.wwebjs_auth' }),
  puppeteer: {
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  },
})

waClient.on('qr', (qr) => {
  waReady = false
  waStatus = 'waiting_for_qr_scan'
  console.log('\n[PulseLink] Scan this WhatsApp QR code once (Linked Devices in WhatsApp):')
  qrcode.generate(qr, { small: true })
})

waClient.on('authenticated', () => {
  waStatus = 'authenticated'
  console.log('[PulseLink] WhatsApp authenticated!')
})

waClient.on('ready', () => {
  waReady = true
  waStatus = 'ready'
  console.log('[PulseLink] WhatsApp Web is READY! Automatic welcome messages are active.')
})

waClient.on('auth_failure', (msg) => {
  waReady = false
  waStatus = 'auth_failure'
  console.error('[PulseLink] WhatsApp auth failure:', msg)
})

waClient.on('disconnected', (reason) => {
  waReady = false
  waStatus = `disconnected: ${reason}`
  console.warn('[PulseLink] WhatsApp disconnected:', reason)
})

waClient.initialize().catch((err) => {
  waStatus = 'init_error'
  console.error('[PulseLink] WhatsApp initialization error:', err?.message || err)
})

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

async function sendFreeSms(toNumber, messageBody) {
  const key = process.env.TEXTBELT_KEY?.trim() || 'textbelt'
  try {
    const response = await fetch('https://textbelt.com/text', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phone: toNumber,
        message: messageBody,
        key,
      }),
    })
    const data = await response.json().catch(() => ({}))
    if (response.ok && data.success) {
      return {
        success: true,
        simulated: false,
        provider: 'textbelt',
        channel: 'sms',
        to: toNumber,
        textId: data.textId,
        quotaRemaining: data.quotaRemaining,
      }
    }
    return {
      success: false,
      simulated: false,
      provider: 'textbelt',
      channel: 'sms',
      to: toNumber,
      error: data.error || 'Textbelt free SMS limit reached or carrier unsupported.',
    }
  } catch (error) {
    return {
      success: false,
      simulated: false,
      provider: 'textbelt',
      channel: 'sms',
      to: toNumber,
      error: error?.message || 'Could not reach Textbelt SMS service.',
    }
  }
}

async function sendWhatsAppWeb(toNumber, messageBody) {
  if (!waReady) {
    return {
      success: false,
      simulated: false,
      provider: 'whatsapp-web.js',
      channel: 'whatsapp',
      to: toNumber,
      error: `WhatsApp not connected yet (${waStatus}). Scan the QR code in the backend terminal.`,
    }
  }

  try {
    const digits = toDigits(toNumber)
    const numberDetails = await waClient.getNumberId(digits)
    const chatId = numberDetails?._serialized || `${digits}@c.us`
    const sent = await waClient.sendMessage(chatId, messageBody)

    return {
      success: true,
      simulated: false,
      provider: 'whatsapp-web.js',
      channel: 'whatsapp',
      to: toNumber,
      messageId: sent?.id?._serialized,
    }
  } catch (error) {
    console.error('[PulseLink][WhatsApp Send Error]', error)
    return {
      success: false,
      simulated: false,
      provider: 'whatsapp-web.js',
      channel: 'whatsapp',
      to: toNumber,
      error: error?.message || 'Failed to send WhatsApp message.',
    }
  }
}

async function sendWelcomeEmail(toEmail, name, bloodGroup, messageBody) {
  const smtpUser = process.env.SMTP_USER?.trim()
  const smtpPass = process.env.SMTP_PASS?.trim()
  const smtpFrom = process.env.SMTP_FROM?.trim() || smtpUser
  const smtpHost = process.env.SMTP_HOST?.trim() || 'smtp.gmail.com'
  const smtpPort = Number(process.env.SMTP_PORT || 587)

  if (!smtpUser || !smtpPass) {
    console.log('[PulseLink][Simulated EMAIL]', {
      to: toEmail,
      subject: 'Welcome to PulseLink Blood Bank — Join Our Donor Group',
      body: messageBody,
    })
    return {
      success: true,
      simulated: true,
      provider: 'nodemailer',
      channel: 'email',
      to: toEmail,
      notice: 'Add SMTP_USER & SMTP_PASS in server/.env to send real emails.',
    }
  }

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
      to: toEmail,
      subject: 'Welcome to PulseLink Blood Bank — Join Our Donor Group',
      text: messageBody,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 10px;">
          <h2 style="color: #dc2626; margin-top: 0;">Welcome to PulseLink Blood Bank, ${name}!</h2>
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

    return {
      success: true,
      simulated: false,
      provider: 'nodemailer',
      channel: 'email',
      to: toEmail,
      messageId: info.messageId,
    }
  } catch (error) {
    console.error('[PulseLink][Email Send Error]', error)
    return {
      success: false,
      simulated: false,
      provider: 'nodemailer',
      channel: 'email',
      to: toEmail,
      error: error?.message || 'Failed to send welcome email.',
    }
  }
}

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    whatsappReady: waReady,
    whatsappStatus: waStatus,
    smsProvider: 'textbelt (free)',
    emailConfigured: Boolean(process.env.SMTP_USER?.trim() && process.env.SMTP_PASS?.trim()),
    groupLink: DEFAULT_GROUP_LINK,
  })
})

app.post('/api/welcome-message', async (req, res) => {
  const { name, email, phone, bloodGroup, channel = 'both' } = req.body || {}
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

  const targetChannels =
    channel === 'sms'
      ? ['sms']
      : channel === 'whatsapp'
        ? ['whatsapp']
        : ['whatsapp', 'sms']

  if (trimmedEmail) {
    targetChannels.push('email')
  }

  const deliveries = await Promise.all(
    targetChannels.map((ch) => {
      if (ch === 'whatsapp') return sendWhatsAppWeb(normalizedPhone, messageBody)
      if (ch === 'email') return sendWelcomeEmail(trimmedEmail, trimmedName, bloodGroup, messageBody)
      return sendFreeSms(normalizedPhone, messageBody)
    })
  )

  const results = Object.fromEntries(deliveries.map((d) => [d.channel, d]))
  const anySuccess = deliveries.some((d) => d.success)

  return res.status(200).json({
    success: anySuccess,
    whatsappReady: waReady,
    channels: targetChannels,
    results,
    to: normalizedPhone,
    groupLink: DEFAULT_GROUP_LINK,
    preview: messageBody,
    whatsappDirectUrl: `https://wa.me/${toDigits(normalizedPhone)}?text=${encodeURIComponent(messageBody)}`,
    smsDirectUrl: `sms:${normalizedPhone}?body=${encodeURIComponent(messageBody)}`,
  })
})

app.listen(PORT, () => {
  console.log(`PulseLink server listening on http://localhost:${PORT}`)
})
