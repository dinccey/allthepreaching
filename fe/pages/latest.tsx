import { useEffect } from 'react';
import { useRouter } from 'next/router';

export default function LatestPage() {
    const router = useRouter();

    useEffect(() => {
        router.replace('/videos');
    }, [router]);

    return null;
}
