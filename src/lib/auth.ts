import type { NextAuthOptions } from 'next-auth';
import AzureADProvider from 'next-auth/providers/azure-ad';
import { getUserRole, type UserRole } from '@/lib/config/roles';

declare module 'next-auth' {
  interface Session {
    user: {
      name?: string | null;
      email?: string | null;
      image?: string | null;
      role: UserRole;
    };
    /** User's Azure AD access token for Microsoft Graph API calls */
    accessToken?: string;
    /** Token expiry timestamp */
    accessTokenExpires?: number;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    role?: UserRole;
    accessToken?: string;
    refreshToken?: string;
    accessTokenExpires?: number;
  }
}

export const authOptions: NextAuthOptions = {
  providers: [
    AzureADProvider({
      clientId: process.env.AZURE_AD_CLIENT_ID ?? '',
      clientSecret: process.env.AZURE_AD_CLIENT_SECRET ?? '',
      tenantId: process.env.AZURE_AD_TENANT_ID ?? '',
      authorization: {
        params: {
          // Request scopes for all the APIs we need per-user access to
          scope: [
            'openid',
            'profile',
            'email',
            'offline_access',
            'User.Read',
            'Mail.Read',
            'Mail.Send',
            'Mail.ReadWrite',
            'Calendars.ReadWrite',
            'Contacts.Read',
            'Files.Read.All',
            'Sites.Read.All',
          ].join(' '),
        },
      },
    }),
  ],

  pages: {
    signIn: '/login',
  },

  callbacks: {
    async jwt({ token, account, profile }) {
      // On initial sign-in, capture the OAuth tokens
      if (account && profile) {
        const email = (profile as { email?: string }).email
          ?? (token.email as string | undefined)
          ?? '';
        token.email = email;
        token.role = getUserRole(email);

        // Store the user's Azure AD tokens for per-user API access
        token.accessToken = account.access_token ?? undefined;
        token.refreshToken = account.refresh_token ?? undefined;
        token.accessTokenExpires = account.expires_at
          ? account.expires_at * 1000 // Convert to ms
          : Date.now() + 3600 * 1000;
      }

      // Auto-refresh expired tokens
      if (token.accessTokenExpires && Date.now() < token.accessTokenExpires) {
        return token; // Token still valid
      }

      // Token expired — try refresh
      if (token.refreshToken) {
        try {
          const tenantId = process.env.AZURE_AD_TENANT_ID ?? '';
          const params = new URLSearchParams({
            grant_type: 'refresh_token',
            client_id: process.env.AZURE_AD_CLIENT_ID ?? '',
            client_secret: process.env.AZURE_AD_CLIENT_SECRET ?? '',
            refresh_token: token.refreshToken,
            scope: 'openid profile email offline_access User.Read Mail.Read Mail.Send Calendars.ReadWrite',
          });
          const res = await fetch(
            `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
            { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: params }
          );
          const data = await res.json();
          if (data.access_token) {
            token.accessToken = data.access_token;
            token.refreshToken = data.refresh_token ?? token.refreshToken;
            token.accessTokenExpires = Date.now() + (data.expires_in ?? 3600) * 1000;
          }
        } catch {
          // Refresh failed — user will need to re-auth
        }
      }

      return token;
    },

    async session({ session, token }) {
      if (session.user) {
        session.user.role = token.role ?? 'readonly';
        session.user.email = token.email as string | undefined ?? null;
      }
      // Pass the user's token to the session so API routes can use it
      session.accessToken = token.accessToken;
      session.accessTokenExpires = token.accessTokenExpires;
      return session;
    },
  },

  session: {
    strategy: 'jwt',
  },
};
