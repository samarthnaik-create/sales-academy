import { withAuth } from 'next-auth/middleware'

export const proxy = withAuth({
  pages: { signIn: '/login' },
})

export const config = {
  matcher: ['/dashboard/:path*', '/day/:path*', '/quiz/:path*', '/certificate/:path*', '/admin/:path*'],
}
