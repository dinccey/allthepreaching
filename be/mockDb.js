/**
 * Mock Database for Testing
 * Returns hardcoded sample data when real database is unavailable
 */

const mockVideos = [
    {
        id: 1558915102,
        vid_category: 'fs_AnchorBaptistChurch',
        search_category: 'Anchor Baptist Church',
        vid_preacher: 'Anchor Baptist Church',
        name: 'Men\'s Preaching Night | Anchor Baptist Church',
        vid_title: 'Men\'s Preaching Night | Anchor Baptist Church',
        vid_code: '<li><a target="_blank" href="https://kjv1611only.com/video/02preaching/Anchor_Baptist_Church/Men_s_Preaching_Night_Anchor_Baptist_Church_12_31_2025.mp4">Men&#x27;s Preaching Night | Anchor Baptist Church<br><b>12/31/2025</b></a></li>',
        date: '2025-12-31 00:00:00',
        vid_url: 'https://kjv1611only.com/video/02preaching/Anchor_Baptist_Church/Men_s_Preaching_Night_Anchor_Baptist_Church_12_31_2025.mp4',
        video_id: 'v71iv1w',
        main_category: 'Anchor Baptist Church',
        profile_id: 'Anchor_Baptist_Church',
        created_at: '2026-02-02 14:45:52',
        clicks: 0,
        shorts: 0,
        language: 'en',
        runtime_minutes: 82.28556666666667,
        thumb_url: 'https://kjv1611only.com/video/02preaching/Anchor_Baptist_Church/Men_s_Preaching_Night_Anchor_Baptist_Church_12_31_2025.jpg'
    },
    {
        id: 1666433241,
        vid_category: 'fsmejia',
        search_category: 'Sermons Pastor Mejia',
        vid_preacher: 'Pastor Bruce Mejia',
        name: 'The Last Charge',
        vid_title: 'The Last Charge',
        vid_code: '<li><a target="_blank" href="https://kjv1611only.com/video/02preaching/Sermons_Pastor_Mejia/The_Last_Charge_2_2_2026.mp4">The Last Charge<br><b>2/2/2026</b></a></li>',
        date: '2026-02-02 00:00:00',
        vid_url: 'https://kjv1611only.com/video/02preaching/Sermons_Pastor_Mejia/The_Last_Charge_2_2_2026.mp4',
        video_id: 'v72zhh4',
        main_category: 'Sermons Pastor Bruce Mejia',
        profile_id: 'Bruce_Mejia',
        created_at: '2026-02-02 14:48:37',
        clicks: 0,
        shorts: 0,
        language: 'en',
        runtime_minutes: 67.76611666666666,
        thumb_url: 'https://kjv1611only.com/video/02preaching/Sermons_Pastor_Mejia/The_Last_Charge_2_2_2026.jpg'
    },
    {
        id: 78340468,
        vid_category: 'fsmejia',
        search_category: 'Sermons Pastor Mejia',
        vid_preacher: 'Pastor Bruce Mejia',
        name: 'Aaron: Called by God, Corrupted by Men',
        vid_title: 'Aaron: Called by God, Corrupted by Men',
        vid_code: '<li><a target="_blank" href="https://kjv1611only.com/video/02preaching/Sermons_Pastor_Mejia/Aaron_Called_by_God_Corrupted_by_Men_2_1_2026.mp4">Aaron: Called by God, Corrupted by Men<br><b>2/1/2026</b></a></li>',
        date: '2026-02-01 00:00:00',
        vid_url: 'https://kjv1611only.com/video/02preaching/Sermons_Pastor_Mejia/Aaron_Called_by_God_Corrupted_by_Men_2_1_2026.mp4',
        video_id: 'v72yy20',
        main_category: 'Sermons Pastor Bruce Mejia',
        profile_id: 'Bruce_Mejia',
        created_at: '2026-02-02 14:51:22',
        clicks: 0,
        shorts: 0,
        language: 'en',
        runtime_minutes: 84.3928,
        thumb_url: 'https://kjv1611only.com/video/02preaching/Sermons_Pastor_Mejia/Aaron_Called_by_God_Corrupted_by_Men_2_1_2026.jpg'
    },
    {
        id: 127186663,
        vid_category: 'fsthompson',
        search_category: 'Sermons Pastor Thompson',
        vid_preacher: 'Pastor Aaron Thompson',
        name: 'Who can stand before Envy',
        vid_title: 'Who can stand before Envy',
        vid_code: '<li><a target="_blank" href="https://kjv1611only.com/video/02preaching/Sermons_Pastor_Thompson/Who_can_stand_before_Envy_2_1_2026.mp4">Who can stand before Envy<br><b>2/1/2026</b></a></li>',
        date: '2026-02-01 00:00:00',
        vid_url: 'https://kjv1611only.com/video/02preaching/Sermons_Pastor_Thompson/Who_can_stand_before_Envy_2_1_2026.mp4',
        video_id: 'v72yx9o',
        main_category: 'Sermons Pastor Aaron Thompson',
        profile_id: 'Pastor_(Aaron)_Thompson',
        created_at: '2026-02-02 14:54:01',
        clicks: 0,
        shorts: 0,
        language: 'en',
        runtime_minutes: 76.89945,
        thumb_url: 'https://kjv1611only.com/video/02preaching/Sermons_Pastor_Thompson/Who_can_stand_before_Envy_2_1_2026.jpg'
    },
    {
        id: 1930764920,
        vid_category: 'fsthompson',
        search_category: 'Sermons Pastor Thompson',
        vid_preacher: 'Pastor Aaron Thompson',
        name: 'Revelation 2b | The Synagogue of Satan',
        vid_title: 'Revelation 2b | The Synagogue of Satan',
        vid_code: '<li><a target="_blank" href="https://kjv1611only.com/video/02preaching/Sermons_Pastor_Thompson/Revelation_2b_The_Synagogue_of_Satan_2_2_2026.mp4">Revelation 2b | The Synagogue of Satan<br><b>2/2/2026</b></a></li>',
        date: '2026-02-02 00:00:00',
        vid_url: 'https://kjv1611only.com/video/02preaching/Sermons_Pastor_Thompson/Revelation_2b_The_Synagogue_of_Satan_2_2_2026.mp4',
        video_id: 'v72z6ow',
        main_category: 'Sermons Pastor Aaron Thompson',
        profile_id: 'Pastor_(Aaron)_Thompson',
        created_at: '2026-02-02 14:56:55',
        clicks: 0,
        shorts: 0,
        language: 'en',
        runtime_minutes: 79.98,
        thumb_url: 'https://kjv1611only.com/video/02preaching/Sermons_Pastor_Thompson/Revelation_2b_The_Synagogue_of_Satan_2_2_2026.jpg'
    },
    {
        id: 1136218378,
        vid_category: 'fsjarededge',
        search_category: 'Sermons Jared Edge',
        vid_preacher: 'Jared Edge',
        name: 'Separation | Brother Jared Edge',
        vid_title: 'Separation | Brother Jared Edge',
        vid_code: '<li><a target="_blank" href="https://kjv1611only.com/video/02preaching/Jared_Edge/Separation_Brother_Jared_Edge_2_1_2026.mp4">Separation | Brother Jared Edge<br><b>2/1/2026</b></a></li>',
        date: '2026-02-01 00:00:00',
        vid_url: 'https://kjv1611only.com/video/02preaching/Jared_Edge/Separation_Brother_Jared_Edge_2_1_2026.mp4',
        video_id: 'v72z4bk',
        main_category: 'Jared Edge',
        profile_id: '(Bro)_Jared_Edge',
        created_at: '2026-02-02 14:59:51',
        clicks: 0,
        shorts: 0,
        language: 'en',
        runtime_minutes: 88.70585,
        thumb_url: 'https://kjv1611only.com/video/02preaching/Jared_Edge/Separation_Brother_Jared_Edge_2_1_2026.jpg'
    },
    {
        id: 56008868,
        vid_category: 'fsawes',
        search_category: 'Sermons Pastor Awes',
        vid_preacher: 'Pastor Dillon Awes',
        name: 'Bible Corrupters: Wescott & Hort',
        vid_title: 'Bible Corrupters: Wescott & Hort',
        vid_code: '<li><a target="_blank" href="https://kjv1611only.com/video/02preaching/Sermons_Pastor_Awes/Bible_Corrupters_Wescott_Hort_2_1_2026.mp4">Bible Corrupters: Wescott &amp; Hort<br><b>2/1/2026</b></a></li>',
        date: '2026-02-01 00:00:00',
        vid_url: 'https://kjv1611only.com/video/02preaching/Sermons_Pastor_Awes/Bible_Corrupters_Wescott_Hort_2_1_2026.mp4',
        video_id: 'v72y08i',
        main_category: 'Sermons Pastor Dillon Awes',
        profile_id: 'Pastor_(Dillon)_Awes',
        created_at: '2026-02-02 15:02:30',
        clicks: 0,
        shorts: 0,
        language: 'en',
        runtime_minutes: 96.12111666666667,
        thumb_url: 'https://kjv1611only.com/video/02preaching/Sermons_Pastor_Awes/Bible_Corrupters_Wescott_Hort_2_1_2026.jpg'
    },
    {
        id: 1905096192,
        vid_category: 'fszhong',
        search_category: 'Sermons Justin Zhong',
        vid_preacher: 'Justin Zhong',
        name: 'The Four Laws of Combat',
        vid_title: 'The Four Laws of Combat',
        vid_code: '<li><a target="_blank" href="https://kjv1611only.com/video/02preaching/Sermons_Justin_Zhong/The_Four_Laws_of_Combat_2_1_2026.mp4">The Four Laws of Combat<br><b>2/1/2026</b></a></li>',
        date: '2026-02-01 00:00:00',
        vid_url: 'https://kjv1611only.com/video/02preaching/Sermons_Justin_Zhong/The_Four_Laws_of_Combat_2_1_2026.mp4',
        video_id: 'v72yooq',
        main_category: 'Sermons Justin Zhong',
        profile_id: 'Justin_Zhong',
        created_at: '2026-02-02 15:05:01',
        clicks: 0,
        shorts: 0,
        language: 'en',
        runtime_minutes: 76.54536666666667,
        thumb_url: 'https://kjv1611only.com/video/02preaching/Sermons_Justin_Zhong/The_Four_Laws_of_Combat_2_1_2026.jpg'
    },
    {
        id: 1043028575,
        vid_category: 'fsreyes',
        search_category: 'Sermons Pastor Reyes',
        vid_preacher: 'Pastor Enrique Reyes',
        name: 'Railing: A Poisoned Tongue',
        vid_title: 'Railing: A Poisoned Tongue',
        vid_code: '<li><a target="_blank" href="https://kjv1611only.com/video/02preaching/Sermons_Pastor_Reyes/Railing_A_Poisoned_Tongue_2_1_2026.mp4">Railing: A Poisoned Tongue<br><b>2/1/2026</b></a></li>',
        date: '2026-02-01 00:00:00',
        vid_url: 'https://kjv1611only.com/video/02preaching/Sermons_Pastor_Reyes/Railing_A_Poisoned_Tongue_2_1_2026.mp4',
        video_id: 'v72ys88',
        main_category: 'Sermons Pastor Enrique Reyes',
        profile_id: 'Pastor_(Enrique)_Reyes',
        created_at: '2026-02-02 15:07:46',
        clicks: 0,
        shorts: 0,
        language: 'en',
        runtime_minutes: 87.72583333333334,
        thumb_url: 'https://kjv1611only.com/video/02preaching/Sermons_Pastor_Reyes/Railing_A_Poisoned_Tongue_2_1_2026.jpg'
    },
    {
        id: 41490980,
        vid_category: 'fsbrojason_sfbcspokane',
        search_category: 'Bro Jason | SFBC Spokane',
        vid_preacher: 'Bro Jason | SFBC Spokane',
        name: 'Biblical Prophecies',
        vid_title: 'Biblical Prophecies',
        vid_code: '<li><a target="_blank" href="https://kjv1611only.com/video/02preaching/SFBC_Spokane/Biblical_Prophecies_2_1_2026.mp4">Biblical Prophecies<br><b>2/1/2026</b></a></li>',
        date: '2026-02-01 00:00:00',
        vid_url: 'https://kjv1611only.com/video/02preaching/SFBC_Spokane/Biblical_Prophecies_2_1_2026.mp4',
        video_id: 'v72zcqi',
        main_category: 'Bro Jason | SFBC Spokane',
        profile_id: 'Bro_Jason_SFBCSpokane',
        created_at: '2026-02-02 15:10:17',
        clicks: 0,
        shorts: 0,
        language: 'en',
        runtime_minutes: 84.6963,
        thumb_url: 'https://kjv1611only.com/video/02preaching/SFBC_Spokane/Biblical_Prophecies_2_1_2026.jpg'
    },
    {
        id: 586570355,
        vid_category: 'fsremythompson',
        search_category: 'Sermons Remy Thompson',
        vid_preacher: 'Remy Thompson',
        name: 'Some Things I Have Been Thinking About',
        vid_title: 'Some Things I Have Been Thinking About',
        vid_code: '<li><a target="_blank" href="https://kjv1611only.com/video/02preaching/Sermons_Remy_Thompson/Some_Things_I_Have_Been_Thinking_About_2_1_2026.mp4">Some Things I Have Been Thinking About<br><b>2/1/2026</b></a></li>',
        date: '2026-02-01 00:00:00',
        vid_url: 'https://kjv1611only.com/video/02preaching/Sermons_Remy_Thompson/Some_Things_I_Have_Been_Thinking_About_2_1_2026.mp4',
        video_id: 'v72yyoi',
        main_category: 'Sermons Remy Thompson',
        profile_id: 'Bro_Remy_(Thompson)',
        created_at: '2026-02-02 15:12:44',
        clicks: 0,
        shorts: 0,
        language: 'en',
        runtime_minutes: 83.21066666666667,
        thumb_url: 'https://kjv1611only.com/video/02preaching/Sermons_Remy_Thompson/Some_Things_I_Have_Been_Thinking_About_2_1_2026.jpg'
    },
    {
        id: 1588897670,
        vid_category: 'fsshelley',
        search_category: 'Sermons Pastor Shelley',
        vid_preacher: 'Pastor Jonathan Shelley',
        name: 'Church Discipline',
        vid_title: 'Church Discipline',
        vid_code: '<li><a target="_blank" href="https://kjv1611only.com/video/02preaching/Sermons_Pastor_Shelley/Church_Discipline_2_1_2026.mp4">Church Discipline<br><b>2/1/2026</b></a></li>',
        date: '2026-02-01 00:00:00',
        vid_url: 'https://kjv1611only.com/video/02preaching/Sermons_Pastor_Shelley/Church_Discipline_2_1_2026.mp4',
        video_id: 'v72z9l0',
        main_category: 'Sermons Pastor Jonathan Shelley',
        profile_id: 'Pastor_(Jonathan)_Shelley',
        created_at: '2026-02-02 15:15:22',
        clicks: 0,
        shorts: 0,
        language: 'en',
        runtime_minutes: 126.13991666666668,
        thumb_url: 'https://kjv1611only.com/video/02preaching/Sermons_Pastor_Shelley/Church_Discipline_2_1_2026.jpg'
    },
    {
        id: 549885494,
        vid_category: 'fsshelley',
        search_category: 'Sermons Pastor Shelley',
        vid_preacher: 'Pastor Jonathan Shelley',
        name: 'Worse Than You Think',
        vid_title: 'Worse Than You Think',
        vid_code: '<li><a target="_blank" href="https://kjv1611only.com/video/02preaching/Sermons_Pastor_Shelley/Worse_Than_You_Think_2_1_2026.mp4">Worse Than You Think<br><b>2/1/2026</b></a></li>',
        date: '2026-02-01 00:00:00',
        vid_url: 'https://kjv1611only.com/video/02preaching/Sermons_Pastor_Shelley/Worse_Than_You_Think_2_1_2026.mp4',
        video_id: 'v72yrwe',
        main_category: 'Sermons Pastor Jonathan Shelley',
        profile_id: 'Pastor_(Jonathan)_Shelley',
        created_at: '2026-02-02 15:17:51',
        clicks: 0,
        shorts: 0,
        language: 'en',
        runtime_minutes: 109.88811666666668,
        thumb_url: 'https://kjv1611only.com/video/02preaching/Sermons_Pastor_Shelley/Worse_Than_You_Think_2_1_2026.jpg'
    },
    {
        id: 906308766,
        vid_category: 'fsreyes',
        search_category: 'Sermons Pastor Reyes',
        vid_preacher: 'Pastor Enrique Reyes',
        name: 'Meet Your Enemy: The Devil Unmasked',
        vid_title: 'Meet Your Enemy: The Devil Unmasked',
        vid_code: '<li><a target="_blank" href="https://kjv1611only.com/video/02preaching/Sermons_Pastor_Reyes/Meet_Your_Enemy_The_Devil_Unmasked_2_1_2026.mp4">Meet Your Enemy: The Devil Unmasked<br><b>2/1/2026</b></a></li>',
        date: '2026-02-01 00:00:00',
        vid_url: 'https://kjv1611only.com/video/02preaching/Sermons_Pastor_Reyes/Meet_Your_Enemy_The_Devil_Unmasked_2_1_2026.mp4',
        video_id: 'v72zace',
        main_category: 'Sermons Pastor Enrique Reyes',
        profile_id: 'Pastor_(Enrique)_Reyes',
        created_at: '2026-02-02 15:20:49',
        clicks: 0,
        shorts: 0,
        language: 'en',
        runtime_minutes: 88.77473333333334,
        thumb_url: 'https://kjv1611only.com/video/02preaching/Sermons_Pastor_Reyes/Meet_Your_Enemy_The_Devil_Unmasked_2_1_2026.jpg'
    },
    {
        id: 1296881223,
        vid_category: 'fsorozco',
        search_category: 'Sermons Bro Orozco',
        vid_preacher: 'Bro Diego Orozco',
        name: 'Por Que Usamos La Reina Valera Gómez',
        vid_title: 'Por Que Usamos La Reina Valera Gómez',
        vid_code: '<li><a target="_blank" href="https://kjv1611only.com/video/02preaching/Sermons_Diego_Orozco/Por_Que_Usamos_La_Reina_Valera_Gómez_2_1_2026.mp4">Por Que Usamos La Reina Valera Gómez<br><b>2/1/2026</b></a></li>',
        date: '2026-02-01 00:00:00',
        vid_url: 'https://kjv1611only.com/video/02preaching/Sermons_Diego_Orozco/Por_Que_Usamos_La_Reina_Valera_Gómez_2_1_2026.mp4',
        video_id: 'v72yn1u',
        main_category: 'Sermons Bro Diego Orozco',
        profile_id: 'Diego_Orozco',
        created_at: '2026-02-02 15:23:46',
        clicks: 0,
        shorts: 0,
        language: 'es',
        runtime_minutes: 92.73265,
        thumb_url: 'https://kjv1611only.com/video/02preaching/Sermons_Diego_Orozco/Por_Que_Usamos_La_Reina_Valera_Gómez_2_1_2026.jpg'
    },
    {
        id: 1454933893,
        vid_category: 'fsanderson',
        search_category: 'Sermons Pastor Anderson',
        vid_preacher: 'Pastor Steven Anderson',
        name: 'We Believe in Science',
        vid_title: 'We Believe in Science',
        vid_code: '<li><a target="_blank" href="https://kjv1611only.com/video/02preaching/Sermons_Pastor_Anderson/We_Believe_in_Science_2_1_2026.mp4">We Believe in Science<br><b>2/1/2026</b></a></li>',
        date: '2026-02-01 00:00:00',
        vid_url: 'https://kjv1611only.com/video/02preaching/Sermons_Pastor_Anderson/We_Believe_in_Science_2_1_2026.mp4',
        video_id: 'v72z51m',
        main_category: 'Sermons Pastor Steven Anderson',
        profile_id: 'Pastor_(Steven)_(L.)_Anderson',
        created_at: '2026-02-02 15:26:29',
        clicks: 0,
        shorts: 0,
        language: 'en',
        runtime_minutes: 59.46703333333333,
        thumb_url: 'https://kjv1611only.com/video/02preaching/Sermons_Pastor_Anderson/We_Believe_in_Science_2_1_2026.jpg'
    }
];

class MockDatabase {
    async query(sql, params = []) {
        await new Promise(resolve => setTimeout(resolve, 10));
        const sqlLower = sql.toLowerCase();

        if (sqlLower.includes('select')) {
            let filtered = [...mockVideos];

            if (params.length > 0) {
                if (sqlLower.includes('vid_preacher')) {
                    filtered = filtered.filter(v => v.vid_preacher === params[0]);
                } else if (sqlLower.includes('vid_category')) {
                    filtered = filtered.filter(v => v.vid_category === params[0]);
                } else if (sqlLower.includes('where id')) {
                    filtered = filtered.filter(v => v.id === parseInt(params[0], 10));
                }
            }

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
                    if (new Date(v.date) > new Date(preachers[v.vid_preacher].latestVideo)) {
                        preachers[v.vid_preacher].latestVideo = v.date;
                    }
                });
                return [Object.values(preachers)];
            }

            if (sqlLower.includes('group by vid_category')) {
                const categories = {};
                mockVideos.forEach(v => {
                    if (!categories[v.vid_category]) {
                        categories[v.vid_category] = {
                            slug: v.vid_category,
                            name: v.search_category || v.vid_category,
                            videoCount: 0
                        };
                    }
                    categories[v.vid_category].videoCount++;
                });
                return [Object.values(categories)];
            }

            if (sqlLower.includes('count(*)')) {
                return [[{ total: filtered.length }]];
            }

            if (sqlLower.includes('order by clicks desc')) {
                filtered.sort((a, b) => b.clicks - a.clicks);
            } else {
                filtered.sort((a, b) => new Date(b.date) - new Date(a.date));
            }

            let limit;
            let offset;

            if (sqlLower.includes('limit ?') && sqlLower.includes('offset ?') && params.length >= 2) {
                limit = parseInt(params[params.length - 2], 10);
                offset = parseInt(params[params.length - 1], 10);
            } else {
                const limitMatch = sql.match(/LIMIT (\d+)/i);
                if (limitMatch) {
                    limit = parseInt(limitMatch[1], 10);
                }

                const offsetMatch = sql.match(/OFFSET (\d+)/i);
                if (offsetMatch) {
                    offset = parseInt(offsetMatch[1], 10);
                }
            }

            if (!Number.isNaN(offset) && offset !== undefined) {
                filtered = filtered.slice(offset);
            }

            if (!Number.isNaN(limit) && limit !== undefined) {
                filtered = filtered.slice(0, limit);
            }

            return [filtered];
        }

        if (sqlLower.includes('update') && sqlLower.includes('clicks')) {
            const id = parseInt(params[0], 10);
            const video = mockVideos.find(v => v.id === id);
            if (video) {
                video.clicks++;
                return [{ affectedRows: 1 }];
            }
            return [{ affectedRows: 0 }];
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

console.log('[mock-db] Using MOCK DATABASE with', mockVideos.length, 'sample videos');

module.exports = mockDb;
