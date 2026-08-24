import { NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import crypto from 'crypto'

const prisma = new PrismaClient()

export async function POST(request: Request) {
  try {
    const cookieHeader = request.headers.get('cookie') || ''
    const tokenMatch = cookieHeader.match(new RegExp('sh_session=([^;]+)'))
    const token = tokenMatch ? tokenMatch[1] : null

    if (token) {
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex')
      await prisma.session.delete({ where: { tokenHash } })
    }

    const response = NextResponse.json({ success: true })
    response.cookies.set('sh_session', '', {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 0,
    })
    return response
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}