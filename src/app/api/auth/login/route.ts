import { NextRequest, NextResponse } from 'next/server';
import { signToken } from '@/lib/auth';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Known authorized users as fallback
const AUTHORIZED_USERS: Record<string, { name: string; role: string }> = {
  'etheiss@delta360.energy': {
    name: 'Evan Theiss',
    role: 'admin',
  },
  'tveazey@delta360.energy': {
    name: 'Taylor Veazey',
    role: 'controller',
  },
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: 'Email and password are required' },
        { status: 400 }
      );
    }

    // Validate password first
    const emailPrefix = email.split('@')[0];
    const isValidPassword =
      password === 'Delta360!' || password === emailPrefix;

    if (!isValidPassword) {
      return NextResponse.json(
        { success: false, error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    // Try to fetch user from Supabase
    let userName = '';
    let userRole = 'user';
    let userId = '';

    try {
      const supabase = createClient(supabaseUrl, supabaseAnonKey);
      const { data: user, error } = await supabase
        .from('users')
        .select('*')
        .eq('email', email.toLowerCase())
        .single();

      if (user && !error) {
        userName = user.full_name || user.name || email.split('@')[0];
        userRole = user.role || 'user';
        userId = user.id;

        if (user.is_active === false) {
          return NextResponse.json(
            { success: false, error: 'User account is inactive' },
            { status: 401 }
          );
        }
      }
    } catch (dbError) {
      console.warn('Supabase user lookup failed, using fallback:', dbError);
    }

    // Fallback to known users if Supabase lookup failed
    if (!userId) {
      const knownUser = AUTHORIZED_USERS[email.toLowerCase()];
      if (knownUser) {
        userName = knownUser.name;
        userRole = knownUser.role;
        userId = email.toLowerCase();
      } else {
        return NextResponse.json(
          { success: false, error: 'Invalid email or password' },
          { status: 401 }
        );
      }
    }

    // Create JWT token
    const token = await signToken({
      id: userId,
      email: email.toLowerCase(),
      name: userName,
      role: userRole,
    });

    // Build response and set cookie on it directly
    const response = NextResponse.json(
      {
        success: true,
        token,
        user: {
          id: userId,
          email: email.toLowerCase(),
          name: userName,
          role: userRole,
        },
      },
      { status: 200 }
    );

    response.cookies.set('delta_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60,
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
