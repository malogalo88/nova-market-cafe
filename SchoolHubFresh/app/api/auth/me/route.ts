import { NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import crypto from 'crypto'

const prisma = new PrismaClient()

export async function GET(request: Request) {
  try {
    const cookieHeader = request.headers.get('cookie') || ''
    const tokenMatch = cookieHeader.match(new RegExp('sh_session=([^;]+)'))
    const token = tokenMatch ? tokenMatch[1] : null

    if (!token) {
      return NextResponse.json({ user: null, role: null }, { status: 401 })
    }

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex')
    const payload = await prisma.session.findUnique({
      where: { tokenHash },
      include: { user: true },
    })

    if (!payload || payload.expiresAt < new Date()) {
      return NextResponse.json({ user: null, role: null }, { status: 401 })
    }

    if (!payload.user.isActive) {
      return NextResponse.json({ user: null, role: null }, { status: 403 })
    }

    return NextResponse.json({
      user: {
        id: payload.user.id,
        email: payload.user.email,
        name: payload.user.name,
        role: payload.user.role,
      },
    })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}