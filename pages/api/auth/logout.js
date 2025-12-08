import { serialize } from 'cookie';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method not allowed' });
    }

    // Clear the token cookie by setting it to expire immediately
    res.setHeader('Set-Cookie', serialize('token', '', {
        path: '/',
        expires: new Date(0),
    }));

    res.status(200).json({ message: 'Logged out successfully' });
}
