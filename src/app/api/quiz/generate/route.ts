import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { connectDB } from '@/lib/mongoose'
import { Course } from '@/models/Course'
import { clampQuestionCount } from '@/lib/quiz-config'
import { Quiz } from '@/models/Quiz'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { storeSession } from '@/lib/ai-quiz-store'
import { randomUUID } from 'crypto'

export const maxDuration = 60

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

interface ValidQuestion { question: string; options: string[]; answer: string; explanation: string }

const norm = (s: string) => s.trim().replace(/\s+/g, ' ').toLowerCase()

// Returns null unless the question is answerable: 4 distinct options and an answer that is one of them
function validateQuestion(item: unknown): ValidQuestion | null {
  if (!item || typeof item !== 'object') return null
  const { question, options, answer, explanation } = item as Record<string, unknown>
  if (typeof question !== 'string' || !question.trim()) return null
  if (!Array.isArray(options) || options.length !== 4) return null
  if (!options.every(o => typeof o === 'string' && o.trim())) return null
  const opts = (options as string[]).map(o => o.trim())
  if (new Set(opts.map(norm)).size !== 4) return null
  if (typeof answer !== 'string') return null
  // Snap near-miss answers (case/whitespace) to the exact option text so grading matches
  const exact = opts.find(o => norm(o) === norm(answer))
  if (!exact) return null
  return {
    question: question.trim(),
    options: opts,
    answer: exact,
    explanation: typeof explanation === 'string' ? explanation.trim() : '',
  }
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { courseId } = await req.json()

  await connectDB()

  const course = await Course.findById(courseId).lean()
  if (!course) return NextResponse.json({ error: 'Course not found' }, { status: 404 })

  const manualQuestions = await Quiz.find({ courseId }).sort({ order: 1 }).lean()
  const needed = Math.max(0, clampQuestionCount(course.questionCount) - manualQuestions.length)

  // Build answers + explanations map starting with manual questions
  const answersMap: Record<string, string> = {}
  const explanationsMap: Record<string, string> = {}
  for (const q of manualQuestions) {
    answersMap[String(q._id)] = q.answer
    explanationsMap[String(q._id)] = ''
  }

  // Formatted manual questions for response
  const manualForResponse = manualQuestions.map((q, i) => ({
    id: String(q._id),
    question: q.question,
    options: q.options,
    order_index: i,
  }))

  // If we don't need AI questions, just shuffle and return
  if (needed === 0) {
    const sessionId = randomUUID()
    await storeSession(sessionId, {
      courseId,
      userId: session.user.id,
      answers: answersMap,
      explanations: explanationsMap,
      expiresAt: Date.now() + 2 * 60 * 60 * 1000,
    })
    return NextResponse.json({ sessionId, questions: shuffle(manualForResponse) })
  }

  // Need AI questions
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'AI not configured' }, { status: 500 })

  const genAI = new GoogleGenerativeAI(apiKey)
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    generationConfig: { responseMimeType: 'application/json' },
  })

  // Extract plain text — handles both flat [{title,html}] and hierarchical [{title,modules:[...]}]
  let plainContent = ''
  if (course.content) {
    try {
      const parsed = JSON.parse(course.content)
      if (Array.isArray(parsed) && parsed.length > 0) {
        if ('modules' in parsed[0] && Array.isArray(parsed[0].modules)) {
          // New hierarchical format: topics with sub-modules
          plainContent = (parsed as { title: string; modules: { title: string; html: string }[] }[])
            .flatMap(topic => [
              topic.title,
              ...topic.modules.map(m => `${m.title}\n${m.html.replace(/<[^>]+>/g, ' ')}`)
            ])
            .join('\n\n').replace(/\s+/g, ' ').trim()
        } else if ('html' in parsed[0]) {
          // Old flat format
          plainContent = (parsed as { title: string; html: string }[])
            .map(m => `${m.title}\n${m.html.replace(/<[^>]+>/g, ' ')}`)
            .join('\n\n').replace(/\s+/g, ' ').trim()
        }
      } else {
        plainContent = course.content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
      }
    } catch {
      plainContent = course.content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
    }
  }
  const lessonContent = plainContent ? `\n\nLESSON CONTENT:\n${plainContent}` : ''

  const alreadyHave = manualQuestions.length
  const buildPrompt = (count: number, avoid: string[]) => `You are a sales training expert creating a quiz for a sales team.

Topic: "${course.title}"${course.description ? `\nDescription: ${course.description}` : ''}${lessonContent}

${alreadyHave > 0 ? `The quiz already has ${alreadyHave} manual question${alreadyHave > 1 ? 's' : ''}. Generate ${count} MORE questions that complement them — do not repeat any topics already covered.` : `Generate ${count} multiple-choice questions.`}
${avoid.length ? `\nDo NOT repeat these questions:\n${avoid.map(q => `- ${q}`).join('\n')}\n` : ''}
Questions must be:
- Based STRICTLY on the lesson content provided (not generic sales knowledge)
- Practical — test real-world application, not just definitions
- Scenario-based where possible (e.g. "A customer says X, what should you do?")
- Clear and simple language

Return ONLY valid JSON, no markdown:
{"questions":[{"question":"...?","options":["Option A","Option B","Option C","Option D"],"answer":"Option A","explanation":"..."}]}

Strict rules:
- Exactly ${count} questions
- Exactly 4 distinct options per question
- "answer" must match one option EXACTLY word-for-word
- "explanation" must explain WHY the answer is correct in 1-2 sentences`

  try {
    const valid: ValidQuestion[] = []
    for (let attempt = 0; attempt < 2 && valid.length < needed; attempt++) {
      const result = await model.generateContent(buildPrompt(needed - valid.length, valid.map(q => q.question)))
      const text = result.response.text().trim().replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
      let raw: unknown
      try { raw = JSON.parse(text).questions } catch { continue }
      if (!Array.isArray(raw)) continue
      for (const item of raw) {
        const q = validateQuestion(item)
        if (q && !valid.some(v => v.question === q.question)) valid.push(q)
        if (valid.length === needed) break
      }
    }
    if (valid.length === 0) throw new Error('No valid AI questions')

    const aiQuestions = valid.map((q, i) => ({ ...q, id: `ai-${i + 1}` }))

    // Store AI answers
    for (const q of aiQuestions) {
      answersMap[q.id] = q.answer
      explanationsMap[q.id] = q.explanation ?? ''
    }

    const aiForResponse = aiQuestions.map((q, i) => ({
      id: q.id,
      question: q.question,
      options: q.options,
      order_index: manualQuestions.length + i,
    }))

    const sessionId = randomUUID()
    await storeSession(sessionId, {
      courseId,
      userId: session.user.id,
      answers: answersMap,
      explanations: explanationsMap,
      expiresAt: Date.now() + 2 * 60 * 60 * 1000,
    })

    // Shuffle all questions together
    return NextResponse.json({
      sessionId,
      questions: shuffle([...manualForResponse, ...aiForResponse]),
    })
  } catch (err) {
    console.error('Gemini error:', err)
    return NextResponse.json({ error: 'Failed to generate quiz. Please try again.' }, { status: 500 })
  }
}
