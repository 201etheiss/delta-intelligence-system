import { withAuth } from 'next-auth/middleware';

export default withAuth({
  pages: {
    signIn: '/login',
  },
});

export const config = {
  // Protect all dashboard routes; allow login, API auth, and static assets
  matcher: [
    '/((?!login|api/|_next/static|_next/image|favicon.ico|brand/|exports/).*)',
  ],
};
