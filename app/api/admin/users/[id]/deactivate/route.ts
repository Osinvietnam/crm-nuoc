import { NextResponse } from 'next/server'

/**
 * DEPRECATED — use POST /api/admin/users/[id]/offboard instead.
 * This route previously called LarkBase APIs which are no longer active.
 */
export async function POST() {
  return NextResponse.json(
    {
      error: 'Endpoint này đã ngừng sử dụng. Dùng /api/admin/users/[id]/offboard thay thế.',
      redirect: '/api/admin/users/[id]/offboard',
    },
    { status: 410 }
  )
}
