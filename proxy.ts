import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// ── Security headers: applied to every response ──────────────────────────────
function applySecurityHeaders(res: NextResponse): void {
  res.headers.set('X-Frame-Options', 'DENY')
  res.headers.set('X-Content-Type-Options', 'nosniff')
  res.headers.set('X-XSS-Protection', '1; mode=block')
  res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  res.headers.set(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), payment=()',
  )
  res.headers.set(
    'Strict-Transport-Security',
    'max-age=63072000; includeSubDomains; preload',
  )
}

// ── Auth + security proxy ─────────────────────────────────────────────────────
export async function proxy(request: NextRequest) {
  // supabaseResponse holds refreshed cookies; MUST be returned or cookies won't propagate
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          // Write back to request so upstream code sees refreshed cookies
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          // Re-create response to carry Set-Cookie headers to the browser
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          )
        },
      },
    },
  )

  // getUser() validates the JWT server-side and may call setAll() above
  const { data: { user } } = await supabase.auth.getUser()
  const path = request.nextUrl.pathname

  // ── 1. Unauthenticated → /login ─────────────────────────────────────────────
  const publicPaths = ['/login', '/forgot-password', '/reset-password']
  if (!user && !publicPaths.some(p => path.startsWith(p))) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    const redirect = NextResponse.redirect(url)
    applySecurityHeaders(redirect)
    return redirect
  }

  // ── 2. Authenticated at root → /dashboard ──────────────────────────────────
  if (user && path === '/') {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    const redirect = NextResponse.redirect(url)
    applySecurityHeaders(redirect)
    return redirect
  }

  // ── 3. /dashboard/admin → admin only ───────────────────────────────────────
  if (user && path.startsWith('/dashboard/admin')) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'admin') {
      const url = request.nextUrl.clone()
      url.pathname = '/dashboard'
      const redirect = NextResponse.redirect(url)
      applySecurityHeaders(redirect)
      return redirect
    }
  }

  // ── 4. Pass through — add security headers to every non-redirect response ──
  applySecurityHeaders(supabaseResponse)
  return supabaseResponse
}

// Note: export name stays "config" in v16 — only the file name and function changed.
export const config = {
  // Exclude static assets and API routes (API routes protect themselves via getUser())
  matcher: ['/((?!_next/static|_next/image|favicon\\.ico|api).*)'],
}
