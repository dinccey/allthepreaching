/**
 * Mock Database for Testing
 * Returns hardcoded sample data when real database is unavailable
 */

const mockVideos = [
    {
        id: 1,
        vid_category: 'Anderson',
        search_category: 'hard-preaching',
        vid_preacher: 'Anderson',
        name: 'The Bible Way to Heaven',
        vid_title: 'The Bible Way to Heaven',
        vid_code: '<iframe>...</iframe>',
        date: '2024-01-15',
        vid_url: '/videos/anderson/bible-way-to-heaven.mp4',
        video_id: 'v1',
        main_category: 'salvation',
        profile_id: 1,
        created_at: '2024-01-15',
        clicks: 15420,
        shorts: 0,
        language: 'en',
        runtime_minutes: 45,
        thumb_url: null
    },
    {
        id: 2,
        vid_category: 'Anderson',
        search_category: 'doctrine',
        vid_preacher: 'Anderson',
        name: 'Why I Use the King James Bible',
        vid_title: 'Why I Use the King James Bible',
        vid_code: '<iframe>...</iframe>',
        date: '2024-02-10',
        vid_url: '/videos/anderson/kjv-bible.mp4',
        video_id: 'v2',
        main_category: 'doctrine',
        profile_id: 1,
        created_at: '2024-02-10',
        clicks: 8932,
        shorts: 0,
        language: 'en',
        runtime_minutes: 38,
        thumb_url: null
    },
    {
        id: 3,
        vid_category: 'Mejia',
        search_category: 'salvation',
        vid_preacher: 'Mejia',
        name: 'Faith Plus Nothing',
        vid_title: 'Faith Plus Nothing',
        vid_code: '<iframe>...</iframe>',
        date: '2024-01-20',
        vid_url: '/videos/mejia/faith-plus-nothing.mp4',
        video_id: 'v3',
        main_category: 'salvation',
        profile_id: 2,
        created_at: '2024-01-20',
        clicks: 12543,
        shorts: 0,
        language: 'en',
        runtime_minutes: 52,
        thumb_url: null
    },
    {
        id: 4,
        vid_category: 'Anderson',
        search_category: 'hard-preaching',
        vid_preacher: 'Anderson',
        name: 'Reprobate Doctrine',
        vid_title: 'Reprobate Doctrine',
        vid_code: '<iframe>...</iframe>',
        date: '2024-03-05',
        vid_url: '/videos/anderson/reprobate-doctrine.mp4',
        video_id: 'v4',
        main_category: 'doctrine',
        profile_id: 1,
        created_at: '2024-03-05',
        clicks: 6721,
        shorts: 0,
        language: 'en',
        runtime_minutes: 67,
        thumb_url: null
    },
    {
        id: 5,
        vid_category: 'Jimenez',
        search_category: 'salvation',
        vid_preacher: 'Jimenez',
        name: 'Once Saved Always Saved',
        vid_title: 'Once Saved Always Saved',
        vid_code: '<iframe>...</iframe>',
        date: '2024-02-14',
        vid_url: '/videos/jimenez/once-saved-always-saved.mp4',
        video_id: 'v5',
        main_category: 'salvation',
        profile_id: 3,
        created_at: '2024-02-14',
        clicks: 9876,
        shorts: 0,
        language: 'en',
        runtime_minutes: 41,
        thumb_url: null
    },
    {
        id: 6,
        vid_category: 'Anderson',
        search_category: 'documentaries',
        vid_preacher: 'Anderson',
        name: 'New World Order Bible Versions',
        vid_title: 'New World Order Bible Versions',
        vid_code: '<iframe>...</iframe>',
        date: '2023-11-20',
        vid_url: '/videos/anderson/nwo-bible-versions.mp4',
        video_id: 'v6',
        main_category: 'documentaries',
        profile_id: 1,
        created_at: '2023-11-20',
        clicks: 23451,
        shorts: 0,
        language: 'en',
        runtime_minutes: 96,
        thumb_url: null
    },
    {
        id: 7,
        vid_category: 'Mejia',
        search_category: 'hard-preaching',
        vid_preacher: 'Mejia',
        name: 'The Sodomite Deception',
        vid_title: 'The Sodomite Deception',
        vid_code: '<iframe>...</iframe>',
        date: '2024-01-08',
        vid_url: '/videos/mejia/sodomite-deception.mp4',
        video_id: 'v7',
        main_category: 'hard-preaching',
        profile_id: 2,
        created_at: '2024-01-08',
        clicks: 7654,
        shorts: 0,
        language: 'en',
        runtime_minutes: 58,
        thumb_url: null
    },
    {
        id: 8,
        vid_category: 'Jimenez',
        search_category: 'doctrine',
        vid_preacher: 'Jimenez',
        name: 'The Pre-Tribulation Rapture',
        vid_title: 'The Pre-Tribulation Rapture',
        vid_code: '<iframe>...</iframe>',
        date: '2024-02-28',
        vid_url: '/videos/jimenez/pre-trib-rapture.mp4',
        video_id: 'v8',
        main_category: 'doctrine',
        profile_id: 3,
        created_at: '2024-02-28',
        clicks: 5432,
        shorts: 0,
        language: 'en',
        runtime_minutes: 72,
        thumb_url: null
    },
    {
        id: 9,
        vid_category: 'Anderson',
        search_category: 'salvation',
        vid_preacher: 'Anderson',
        name: 'After the Tribulation',
        vid_title: 'After the Tribulation',
        vid_code: '<iframe>...</iframe>',
        date: '2023-10-15',
        vid_url: '/videos/anderson/after-tribulation.mp4',
        video_id: 'v9',
        main_category: 'documentaries',
        profile_id: 1,
        created_at: '2023-10-15',
        clicks: 31245,
        shorts: 0,
        language: 'en',
        runtime_minutes: 108,
        thumb_url: null
    },
    {
        id: 10,
        vid_category: 'Mejia',
        search_category: 'doctrine',
        vid_preacher: 'Mejia',
        name: 'Biblical Separation',
        vid_title: 'Biblical Separation',
        vid_code: '<iframe>...</iframe>',
        date: '2024-03-12',
        vid_url: '/videos/mejia/biblical-separation.mp4',
        video_id: 'v10',
        main_category: 'doctrine',
        profile_id: 2,
        created_at: '2024-03-12',
        clicks: 4321,
        shorts: 0,
        language: 'en',
        runtime_minutes: 44,
        thumb_url: null
    },
    {
        id: 11,
        vid_category: 'Jimenez',
        search_category: 'hard-preaching',
        vid_preacher: 'Jimenez',
        name: 'The Dangers of False Prophets',
        vid_title: 'The Dangers of False Prophets',
        vid_code: '<iframe>...</iframe>',
        date: '2024-01-25',
        vid_url: '/videos/jimenez/false-prophets.mp4',
        video_id: 'v11',
        main_category: 'hard-preaching',
        profile_id: 3,
        created_at: '2024-01-25',
        clicks: 6789,
        shorts: 0,
        language: 'en',
        runtime_minutes: 49,
        thumb_url: null
    },
    {
        id: 12,
        vid_category: 'Anderson',
        search_category: 'doctrine',
        vid_preacher: 'Anderson',
        name: 'Marching to Zion',
        vid_title: 'Marching to Zion',
        vid_code: '<iframe>...</iframe>',
        date: '2023-09-10',
        vid_url: '/videos/anderson/marching-to-zion.mp4',
        video_id: 'v12',
        main_category: 'documentaries',
        profile_id: 1,
        created_at: '2023-09-10',
        clicks: 28976,
        shorts: 0,
        language: 'en',
        runtime_minutes: 102,
        thumb_url: null
    },
    {
        id: 13,
        vid_category: 'Mejia',
        search_category: 'salvation',
        vid_preacher: 'Mejia',
        name: 'The Gospel of Jesus Christ',
        vid_title: 'The Gospel of Jesus Christ',
        vid_code: '<iframe>...</iframe>',
        date: '2024-02-05',
        vid_url: '/videos/mejia/gospel-of-christ.mp4',
        video_id: 'v13',
        main_category: 'salvation',
        profile_id: 2,
        created_at: '2024-02-05',
        clicks: 11234,
        shorts: 0,
        language: 'en',
        runtime_minutes: 37,
        thumb_url: null
    },
    {
        id: 14,
        vid_category: 'Jimenez',
        search_category: 'doctrine',
        vid_preacher: 'Jimenez',
        name: 'Soul Winning Basics',
        vid_title: 'Soul Winning Basics',
        vid_code: '<iframe>...</iframe>',
        date: '2024-03-18',
        vid_url: '/videos/jimenez/soul-winning-basics.mp4',
        video_id: 'v14',
        main_category: 'doctrine',
        profile_id: 3,
        created_at: '2024-03-18',
        clicks: 7890,
        shorts: 0,
        language: 'en',
        runtime_minutes: 56,
        thumb_url: null
    },
    {
        id: 15,
        vid_category: 'Anderson',
        search_category: 'hard-preaching',
        vid_preacher: 'Anderson',
        name: 'The Truth About Christmas',
        vid_title: 'The Truth About Christmas',
        vid_code: '<iframe>...</iframe>',
        date: '2023-12-20',
        vid_url: '/videos/anderson/truth-about-christmas.mp4',
        video_id: 'v15',
        main_category: 'hard-preaching',
        profile_id: 1,
        created_at: '2023-12-20',
        clicks: 14567,
        shorts: 0,
        language: 'en',
        runtime_minutes: 61,
        thumb_url: null
    },
    {
        id: 16,
        vid_category: 'Mejia',
        search_category: 'doctrine',
        vid_preacher: 'Mejia',
        name: 'Biblical Church Membership',
        vid_title: 'Biblical Church Membership',
        vid_code: '<iframe>...</iframe>',
        date: '2024-01-30',
        vid_url: '/videos/mejia/church-membership.mp4',
        video_id: 'v16',
        main_category: 'doctrine',
        profile_id: 2,
        created_at: '2024-01-30',
        clicks: 5678,
        shorts: 0,
        language: 'en',
        runtime_minutes: 42,
        thumb_url: null
    },
    {
        id: 17,
        vid_category: 'Jimenez',
        search_category: 'salvation',
        vid_preacher: 'Jimenez',
        name: 'Eternal Security',
        vid_title: 'Eternal Security',
        vid_code: '<iframe>...</iframe>',
        date: '2024-02-22',
        vid_url: '/videos/jimenez/eternal-security.mp4',
        video_id: 'v17',
        main_category: 'salvation',
        profile_id: 3,
        created_at: '2024-02-22',
        clicks: 9012,
        shorts: 0,
        language: 'en',
        runtime_minutes: 48,
        thumb_url: null
    },
    {
        id: 18,
        vid_category: 'Anderson',
        search_category: 'documentaries',
        vid_preacher: 'Anderson',
        name: 'The Book of Revelation',
        vid_title: 'The Book of Revelation',
        vid_code: '<iframe>...</iframe>',
        date: '2023-11-05',
        vid_url: '/videos/anderson/book-of-revelation.mp4',
        video_id: 'v18',
        main_category: 'documentaries',
        profile_id: 1,
        created_at: '2023-11-05',
        clicks: 19876,
        shorts: 0,
        language: 'en',
        runtime_minutes: 124,
        thumb_url: null
    },
    {
        id: 19,
        vid_category: 'Mejia',
        search_category: 'hard-preaching',
        vid_preacher: 'Mejia',
        name: 'Rightly Dividing the Word',
        vid_title: 'Rightly Dividing the Word',
        vid_code: '<iframe>...</iframe>',
        date: '2024-03-08',
        vid_url: '/videos/mejia/rightly-dividing.mp4',
        video_id: 'v19',
        main_category: 'doctrine',
        profile_id: 2,
        created_at: '2024-03-08',
        clicks: 6543,
        shorts: 0,
        language: 'en',
        runtime_minutes: 54,
        thumb_url: null
    },
    {
        id: 20,
        vid_category: 'Jimenez',
        search_category: 'doctrine',
        vid_preacher: 'Jimenez',
        name: 'The Local Church',
        vid_title: 'The Local Church',
        vid_code: '<iframe>...</iframe>',
        date: '2024-03-25',
        vid_url: '/videos/jimenez/local-church.mp4',
        video_id: 'v20',
        main_category: 'doctrine',
        profile_id: 3,
        created_at: '2024-03-25',
        clicks: 4987,
        shorts: 0,
        language: 'en',
        runtime_minutes: 39,
        thumb_url: null
    }
];

/**
 * Mock database query methods
 */
class MockDatabase {
    async query(sql, params = []) {
        // Simulate query delay
        await new Promise(resolve => setTimeout(resolve, 10));

        const sqlLower = sql.toLowerCase();

        // SELECT queries
        if (sqlLower.includes('select')) {
            // Filter videos based on WHERE conditions
            let filtered = [...mockVideos];

            // Handle basic filtering (simplified)
            if (params.length > 0) {
                // Check for preacher filter
                if (sqlLower.includes('vid_preacher')) {
                    filtered = filtered.filter(v => v.vid_preacher === params[0]);
                }
                // Check for category filter
                else if (sqlLower.includes('vid_category')) {
                    filtered = filtered.filter(v => v.vid_category === params[0]);
                }
                // Check for ID filter
                else if (sqlLower.includes('where id')) {
                    filtered = filtered.filter(v => v.id === parseInt(params[0]));
                }
            }

            // Handle COUNT queries
            if (sqlLower.includes('count(*)')) {
                return [[{ total: filtered.length }]];
            }

            // Handle GROUP BY (preachers list)
            if (sqlLower.includes('group by vid_preacher')) {
                const preachers = {};
                mockVideos.forEach(v => {
                    if (!preachers[v.vid_preacher]) {
                        preachers[v.vid_preacher] = {
                            name: v.vid_preacher,
                            videoCount: 0,
                            latestVideo: v.date
                        };
                    }
                    preachers[v.vid_preacher].videoCount++;
                });
                return [Object.values(preachers)];
            }

            // Handle aggregations (preacher stats)
            if (sqlLower.includes('sum(clicks)')) {
                const stats = filtered.reduce((acc, v) => ({
                    name: v.vid_preacher,
                    videoCount: acc.videoCount + 1,
                    latestVideo: v.date > acc.latestVideo ? v.date : acc.latestVideo,
                    firstVideo: v.date < acc.firstVideo ? v.date : acc.firstVideo,
                    totalViews: acc.totalViews + v.clicks
                }), { videoCount: 0, latestVideo: '', firstVideo: '9999-12-31', totalViews: 0 });
                return [[stats]];
            }

            // Handle ORDER BY and LIMIT
            if (sqlLower.includes('order by date desc')) {
                filtered.sort((a, b) => new Date(b.date) - new Date(a.date));
            } else if (sqlLower.includes('order by clicks desc')) {
                filtered.sort((a, b) => b.clicks - a.clicks);
            }

            // Handle LIMIT
            const limitMatch = sql.match(/LIMIT (\d+)/i);
            if (limitMatch) {
                const limit = parseInt(limitMatch[1]);
                filtered = filtered.slice(0, limit);
            }

            // Handle OFFSET
            const offsetMatch = sql.match(/OFFSET (\d+)/i);
            if (offsetMatch) {
                const offset = parseInt(offsetMatch[1]);
                filtered = filtered.slice(offset);
            }

            return [filtered];
        }

        // UPDATE queries (increment views)
        if (sqlLower.includes('update') && sqlLower.includes('clicks')) {
            const id = parseInt(params[0]);
            const video = mockVideos.find(v => v.id === id);
            if (video) {
                video.clicks++;
            }
            return [{ affectedRows: 1 }];
        }

        return [[]];
    }

    async getConnection() {
        return {
            query: this.query.bind(this),
            release: () => { }
        };
    }
}

const mockDb = new MockDatabase();

console.log('📦 Using MOCK DATABASE with', mockVideos.length, 'sample videos');

module.exports = mockDb;
