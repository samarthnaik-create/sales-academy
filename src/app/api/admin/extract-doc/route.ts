import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { GoogleGenerativeAI } from '@google/generative-ai'
import mammoth from 'mammoth'

export const maxDuration = 60

export async function POST(req: NextRequest) {
  try { await requireAdmin() } catch { return NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }

  const formData = await req.formData()
  const file = formData.get('file') as File | null

  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

  const ext = file.name.split('.').pop()?.toLowerCase()
  if (!['docx', 'doc'].includes(ext ?? '')) {
    return NextResponse.json({ error: 'Only .docx and .doc files are supported' }, { status: 400 })
  }

  const arrayBuffer = await file.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)

  const plainResult = await mammoth.extractRawText({ buffer })
  const plainText = plainResult.value.trim()
  if (!plainText) return NextResponse.json({ error: 'Could not extract content from this file' }, { status: 400 })

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'AI not configured' }, { status: 500 })

  const genAI = new GoogleGenerativeAI(apiKey)
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })

  const prompt = `You are a training content designer. Take the raw sales training document below and restructure it into clear learning modules (pages) that a sales employee reads one at a time.

RAW DOCUMENT:
${plainText}

Split the content into 3–6 logical modules based on the natural topics in the document. Each module should be a focused, digestible page — not too long.

For each module:
- Give it a clear, descriptive title
- Format the content as clean HTML using: <h3>, <p>, <ul>, <ol>, <li>, <strong>, <em>
- Break content into short paragraphs (2-3 sentences max)
- Use bullet points for lists of items
- Bold key terms with <strong>
- Keep all original information — do not remove or invent anything

Return ONLY this JSON (no markdown, no code blocks):
{
  "modules": [
    {
      "title": "Module title here",
      "html": "<p>Content here...</p>"
    }
  ]
}`

  try {
    const result = await model.generateContent(prompt)
    const raw = result.response.text().trim().replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    const parsed = JSON.parse(raw)
    const modules = parsed.modules as Array<{ title: string; html: string }>
    if (!Array.isArray(modules) || !modules.length) throw new Error('Invalid response')

    return NextResponse.json({ modules, plainText })
  } catch (err) {
    console.error('Gemini error:', err)
    // Fallback: single module from mammoth HTML conversion
    const htmlResult = await mammoth.convertToHtml({ buffer })
    const fallback = htmlResult.value
      .replace(/\sstyle="[^"]*"/g, '')
      .replace(/<a\b[^>]*>([\s\S]*?)<\/a>/g, '$1')
      .trim()
    return NextResponse.json({ modules: [{ title: 'Lesson Content', html: fallback }], plainText })
  }
}
