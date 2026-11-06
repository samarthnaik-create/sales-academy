import nodemailer from 'nodemailer'
import { formatDuration, WINDOW_HOURS } from '@/lib/quiz-window'

// Sent through Google Workspace SMTP.
// SMTP_USER: the Workspace account that signs in. SMTP_PASS: its 16-character app password.
// EMAIL_FROM (optional): e.g. "Mohidin Sales Academy <training@mohidins.com>"; an alias must be set up
// as "Send mail as" on that account, or Gmail rewrites it. Defaults to SMTP_USER.
export function emailConfigured() {
  return Boolean(process.env.SMTP_USER && process.env.SMTP_PASS)
}

export async function sendEmail(to: string, subject: string, html: string) {
  const transport = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS?.replace(/\s/g, '') },
  })
  await transport.sendMail({ from: process.env.EMAIL_FROM || process.env.SMTP_USER, to, subject, html })
}

const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))

const formatIST = (d: Date) =>
  d.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) + ' IST'

function layout(heading: string, color: string, body: string, link: string, button: string) {
  return `<div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;color:#18181b">
  <div style="background:${color};color:#fff;padding:20px 24px;border-radius:12px 12px 0 0">
    <p style="margin:0;font-size:12px;opacity:.85">Mohidin Sales Academy</p>
    <h1 style="margin:6px 0 0;font-size:20px">${heading}</h1>
  </div>
  <div style="border:1px solid #e4e4e7;border-top:0;padding:24px;border-radius:0 0 12px 12px;font-size:14px;line-height:1.6">
    ${body}
    <p style="margin:24px 0 8px"><a href="${link}" style="background:#dc2626;color:#fff;text-decoration:none;padding:10px 20px;border-radius:8px;font-weight:bold;display:inline-block">${button}</a></p>
    <p style="margin:16px 0 0;font-size:12px;color:#71717a">You have ${WINDOW_HOURS} hours after each quiz attempt to attempt the next one. Passing or not, any attempt resets the clock.</p>
  </div>
</div>`
}

export function quizWarningEmail(name: string, day: number, deadline: Date, link: string) {
  return {
    subject: `Reminder: attempt your Day ${day} quiz by ${formatIST(deadline)}`,
    html: layout(
      `Day ${day} quiz due in ${formatDuration(deadline.getTime() - Date.now())}`, '#d97706',
      `<p>Hi ${esc(name)},</p><p>Your <strong>Day ${day}</strong> quiz is due by <strong>${formatIST(deadline)}</strong>. Attempt it before then to stay on track.</p>`,
      link, `Go to Day ${day}`),
  }
}

export function quizOverdueEmail(name: string, day: number, deadline: Date, link: string) {
  return {
    subject: `Overdue: your Day ${day} quiz`,
    html: layout(
      `Day ${day} quiz is overdue`, '#dc2626',
      `<p>Hi ${esc(name)},</p><p>Your <strong>Day ${day}</strong> quiz was due by <strong>${formatIST(deadline)}</strong> and hasn't been attempted yet. Please attempt it as soon as possible. Your admin can see missed deadlines.</p>`,
      link, `Attempt Day ${day} now`),
  }
}
