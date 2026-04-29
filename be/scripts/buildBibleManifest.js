const fs = require('fs/promises');
const path = require('path');
const https = require('https');
const { BOOKS } = require('../services/bible/bookMetadata');

const projectRoot = path.resolve(__dirname, '..', '..');
const dataRoot = path.join(projectRoot, 'be', 'data', 'bible', 'en');
const waggonerRoot = path.join(projectRoot, 'Waggoner_verses');
const sourcePath = path.join(dataRoot, 'source-kjv.json');
const indexPath = path.join(dataRoot, 'index.json');
const audioIndexPath = path.join(dataRoot, 'audio-index.json');
const validationPath = path.join(dataRoot, 'validation-report.json');
const sourceUrl = process.env.BIBLE_SOURCE_URL || 'https://raw.githubusercontent.com/Amosamevor/Bible-json/main/versions/en/KING%20JAMES%20BIBLE.json';

function fetchJson(url) {
    return new Promise((resolve, reject) => {
        https.get(url, (response) => {
            if (response.statusCode !== 200) {
                reject(new Error(`Failed to download Bible JSON: HTTP ${response.statusCode}`));
                response.resume();
                return;
            }

            let data = '';
            response.setEncoding('utf8');
            response.on('data', (chunk) => {
                data += chunk;
            });
            response.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (error) {
                    reject(error);
                }
            });
        }).on('error', reject);
    });
}

async function ensureDir(dirPath) {
    await fs.mkdir(dirPath, { recursive: true });
}

async function getSourceText() {
    const refresh = process.argv.includes('--refresh-source');
    if (!refresh) {
        try {
            const existing = await fs.readFile(sourcePath, 'utf8');
            return JSON.parse(existing);
        } catch {
            // fall through to download
        }
    }

    const source = await fetchJson(sourceUrl);
    await ensureDir(dataRoot);
    await fs.writeFile(sourcePath, JSON.stringify(source, null, 2));
    return source;
}

async function listAudioFiles(rootDir) {
    const entries = await fs.readdir(rootDir, { withFileTypes: true });
    const files = [];

    for (const entry of entries) {
        const fullPath = path.join(rootDir, entry.name);
        if (entry.isDirectory()) {
            files.push(...await listAudioFiles(fullPath));
        } else if (entry.isFile() && entry.name.endsWith('.mp3')) {
            files.push(fullPath);
        }
    }

    return files;
}

function parseAudioFile(filePath) {
    const basename = path.basename(filePath);
    const match = /^(\d+)_([A-Z0-9]+)_(\d+)_(\d+)([A-Z]?)\.mp3$/i.exec(basename);
    if (!match) {
        return null;
    }

    return {
        bookIndex: parseInt(match[1], 10),
        bookCode: match[2].toUpperCase(),
        chapter: parseInt(match[3], 10),
        verse: parseInt(match[4], 10),
        variant: match[5] ? match[5].toUpperCase() : '',
        relativePath: path.relative(projectRoot, filePath).split(path.sep).join('/'),
    };
}

function findSourceBook(sourceText, book) {
    const names = book.sourceNames || [book.name];
    for (const candidate of names) {
        if (sourceText[candidate]) {
            return sourceText[candidate];
        }
    }
    return null;
}

function createEmptyAudioEntry() {
    return {
        bookIntro: null,
        chapters: {},
    };
}

function getChapterAudioEntry(audioEntry, chapterNumber) {
    if (!audioEntry.chapters[chapterNumber]) {
        audioEntry.chapters[chapterNumber] = {
            chapterIntro: null,
            verses: {},
        };
    }
    return audioEntry.chapters[chapterNumber];
}

function buildNavigation(book, chapterNumber, chapterCount) {
    if (chapterNumber > 1) {
        return {
            previousChapter: { bookId: book.bookId, chapter: chapterNumber - 1 },
            nextChapter: chapterNumber < chapterCount ? { bookId: book.bookId, chapter: chapterNumber + 1 } : null,
        };
    }

    const previousBook = BOOKS[book.bookIndex - 2] || null;
    const nextBook = BOOKS[book.bookIndex] || null;
    return {
        previousChapter: previousBook ? { bookId: previousBook.bookId, chapter: previousBook.chapterCount } : null,
        nextChapter: chapterNumber < chapterCount
            ? { bookId: book.bookId, chapter: chapterNumber + 1 }
            : nextBook
                ? { bookId: nextBook.bookId, chapter: 1 }
                : null,
    };
}

async function main() {
    await ensureDir(dataRoot);

    const sourceText = await getSourceText();
    const audioFiles = (await listAudioFiles(waggonerRoot)).sort();
    const parsedFiles = [];
    const audioByBook = new Map();
    const validation = {
        sourceUrl,
        generatedAt: new Date().toISOString(),
        warnings: [],
        stats: {
            audioFilesDiscovered: audioFiles.length,
            parsedAudioFiles: 0,
            chapterFilesGenerated: 0,
        },
    };

    for (const filePath of audioFiles) {
        const parsed = parseAudioFile(filePath);
        if (!parsed) {
            validation.warnings.push({ type: 'invalid-audio-file', path: filePath });
            continue;
        }
        parsedFiles.push(parsed);
        validation.stats.parsedAudioFiles += 1;

        const book = BOOKS.find((entry) => entry.bookIndex === parsed.bookIndex);
        if (!book || book.audioCode !== parsed.bookCode) {
            validation.warnings.push({ type: 'unknown-audio-code', path: parsed.relativePath, parsed });
            continue;
        }

        const audioEntry = audioByBook.get(book.bookId) || createEmptyAudioEntry();
        if (parsed.chapter === 0 && parsed.verse === 0) {
            audioEntry.bookIntro = parsed.relativePath;
        } else if (parsed.verse === 0) {
            const chapterEntry = getChapterAudioEntry(audioEntry, parsed.chapter);
            chapterEntry.chapterIntro = parsed.relativePath;
        } else {
            const chapterEntry = getChapterAudioEntry(audioEntry, parsed.chapter);
            if (!chapterEntry.verses[parsed.verse]) {
                chapterEntry.verses[parsed.verse] = parsed.relativePath;
            }
        }
        audioByBook.set(book.bookId, audioEntry);
    }

    const index = {
        language: 'en',
        label: 'English',
        translationLabel: 'KJV',
        generatedAt: validation.generatedAt,
        books: [],
    };
    const audioIndex = {};

    for (const book of BOOKS) {
        const sourceBook = findSourceBook(sourceText, book);
        if (!sourceBook) {
            throw new Error(`Missing source text for ${book.name}`);
        }

        const chapterNumbers = Object.keys(sourceBook)
            .map((value) => parseInt(value, 10))
            .filter((value) => !Number.isNaN(value))
            .sort((left, right) => left - right);

        book.chapterCount = chapterNumbers.length;
        const bookAudio = audioByBook.get(book.bookId) || createEmptyAudioEntry();
        const bookDir = path.join(dataRoot, 'books', book.bookId);
        const chapterDir = path.join(bookDir, 'chapters');

        await ensureDir(chapterDir);

        const bookMeta = {
            bookId: book.bookId,
            name: book.name,
            bookIndex: book.bookIndex,
            chapterCount: book.chapterCount,
            hasAudio: Boolean(bookAudio.bookIntro || Object.keys(bookAudio.chapters).length),
            testament: book.testament,
        };
        await fs.writeFile(path.join(bookDir, 'meta.json'), JSON.stringify(bookMeta, null, 2));

        index.books.push(bookMeta);
        audioIndex[book.bookId] = {
            bookIntro: bookAudio.bookIntro,
            chapters: {},
        };

        for (const chapterNumber of chapterNumbers) {
            const chapterText = sourceBook[String(chapterNumber)] || {};
            const verseNumbers = Object.keys(chapterText)
                .map((value) => parseInt(value, 10))
                .filter((value) => !Number.isNaN(value))
                .sort((left, right) => left - right);
            const chapterAudio = bookAudio.chapters[chapterNumber] || { chapterIntro: null, verses: {} };
            const navigation = buildNavigation(book, chapterNumber, book.chapterCount);
            const verses = verseNumbers.map((verseNumber) => {
                const audioPath = chapterAudio.verses[verseNumber] || null;
                return {
                    verse: verseNumber,
                    text: chapterText[String(verseNumber)],
                    hasAudio: Boolean(audioPath),
                    audioPath,
                };
            });

            const chapterPayload = {
                language: 'en',
                translationLabel: 'KJV',
                book: {
                    id: book.bookId,
                    name: book.name,
                    bookIndex: book.bookIndex,
                },
                chapter: chapterNumber,
                chapterCount: book.chapterCount,
                hasAudio: verses.some((verse) => verse.hasAudio),
                audio: {
                    bookIntro: {
                        available: Boolean(bookAudio.bookIntro),
                        path: bookAudio.bookIntro,
                    },
                    chapterIntro: {
                        available: Boolean(chapterAudio.chapterIntro),
                        path: chapterAudio.chapterIntro,
                    },
                },
                verses,
                navigation,
                prefetchHints: {
                    previousChapterKey: navigation.previousChapter
                        ? `en:${navigation.previousChapter.bookId}:${navigation.previousChapter.chapter}`
                        : null,
                    nextChapterKey: navigation.nextChapter
                        ? `en:${navigation.nextChapter.bookId}:${navigation.nextChapter.chapter}`
                        : null,
                },
            };

            audioIndex[book.bookId].chapters[chapterNumber] = {
                chapterIntro: chapterAudio.chapterIntro,
                verses: chapterAudio.verses,
            };
            await fs.writeFile(path.join(chapterDir, `${chapterNumber}.json`), JSON.stringify(chapterPayload, null, 2));
            validation.stats.chapterFilesGenerated += 1;

            const missingAudioVerses = verses.filter((verse) => !verse.hasAudio).map((verse) => verse.verse);
            if (missingAudioVerses.length) {
                validation.warnings.push({
                    type: 'missing-verse-audio',
                    bookId: book.bookId,
                    chapter: chapterNumber,
                    verses: missingAudioVerses,
                });
            }
        }
    }

    await fs.writeFile(indexPath, JSON.stringify(index, null, 2));
    await fs.writeFile(audioIndexPath, JSON.stringify(audioIndex, null, 2));
    await fs.writeFile(validationPath, JSON.stringify(validation, null, 2));

    console.log(`Generated Bible data for ${index.books.length} books and ${validation.stats.chapterFilesGenerated} chapters.`);
    console.log(`Warnings: ${validation.warnings.length}`);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});