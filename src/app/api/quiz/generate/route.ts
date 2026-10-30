import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { connectDB } from '@/lib/mongoose'
import { Course } from '@/models/Course'
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

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { courseId } = await req.json()

  await connectDB()

  const course = await Course.findById(courseId).lean()
  if (!course) return NextResponse.json({ error: 'Course not found' }, { status: 404 })

  const manualQuestions = await Quiz.find({ courseId }).sort({ order: 1 }).lean()
  const needed = Math.max(0, 10 - manualQuestions.length)

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
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })

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
  const prompt = `You are a sales training expert creating a quiz for a sales team.

Topic: "${course.title}"${course.description ? `\nDescription: ${course.description}` : ''}${lessonContent}

${alreadyHave > 0 ? `The quiz already has ${alreadyHave} manual question${alreadyHave > 1 ? 's' : ''}. Generate ${needed} MORE questions that complement them — do not repeat any topics already covered.` : `Generate ${needed} multiple-choice questions.`}

Questions must be:
- Based STRICTLY on the lesson content provided (not generic sales knowledge)
- Practical — test real-world application, not just definitions
- Scenario-based where possible (e.g. "A customer says X, what should you do?")
- Clear and simple language

Return ONLY valid JSON, no markdown:
{"questions":[{"id":"q1","question":"...?","options":["Option A","Option B","Option C","Option D"],"answer":"Option A","explanation":"..."}]}

Strict rules:
- Exactly ${needed} questions, ids q1 to q${needed}
- Exactly 4 options per question
- "answer" must match one option EXACTLY word-for-word
- "explanation" must explain WHY the answer is correct in 1-2 sentences`

  try {
    const result = await model.generateContent(prompt)
    const text = result.response.text().trim().replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    const parsed = JSON.parse(text)
    const aiQuestions = parsed.questions as Array<{
      id: string; question: string; options: string[]; answer: string; explanation: string
    }>
    if (!Array.isArray(aiQuestions) || !aiQuestions.length) throw new Error('Invalid AI response')

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
