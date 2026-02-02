import type { NextApiRequest, NextApiResponse } from 'next';

interface HealthResponse {
    status: 'ok';
    timestamp: string;
    uptimeSeconds: number;
}

export default function handler(
    _req: NextApiRequest,
    res: NextApiResponse<HealthResponse>
) {
    res.status(200).json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptimeSeconds: process.uptime()
    });
}
