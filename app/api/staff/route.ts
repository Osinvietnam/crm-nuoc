import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET /api/staff?role=tech  — trả về danh sách nhân viên (id, full_name) theo role
// Accessible bởi mọi authenticated user

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const role = req.nextUrl.searchParams.get('role')

    let query = supabase
      .from('profiles')
      .select('id, full_name, role')
      .eq('is_active', true)
      .order('full_name', { ascending: true })

    if (role) query = query.eq('role', role)

    const { data, error } = await query
    if (error) throw error

    return NextResponse.json({ data: data ?? [] })
  } catch (err) {
    console.error('GET /api/staff:', err)
    return NextResponse.json({ error: 'Lỗi server' }, { status: 500 })
  }
}
