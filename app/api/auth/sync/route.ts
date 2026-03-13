import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function POST(req: Request) {
    try {
        const { token, user } = await req.json();
        
        // 1. Store the token in a secure HTTP-only cookie
        const cookieStore = await cookies();
        cookieStore.set('allknower_token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            path: '/',
        });

        return NextResponse.json({ success: true });
    } catch (err) {
        return NextResponse.json({ error: 'Failed to sync sigil' }, { status: 500 });
    }
}
