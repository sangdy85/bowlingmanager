import { createWorker, PSM } from 'tesseract.js';

interface ParsedScoreRow {
    name: string;
    scores: number[];
}

async function preprocessImage(imageFile: File): Promise<string> {
    return new Promise((resolve) => {
        const img = new Image();
        img.src = URL.createObjectURL(imageFile);
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d')!;

            const MAX_WIDTH = 2500;
            let width = img.width;
            let height = img.height;
            if (width > MAX_WIDTH) {
                height = Math.round(height * (MAX_WIDTH / width));
                width = MAX_WIDTH;
            }
            canvas.width = width;
            canvas.height = height;

            ctx.fillStyle = "#FFFFFF";
            ctx.fillRect(0, 0, width, height);
            ctx.drawImage(img, 0, 0, width, height);

            const imageData = ctx.getImageData(0, 0, width, height);
            const data = imageData.data;

            for (let i = 0; i < data.length; i += 4) {
                const r = data[i];
                const g = data[i + 1];
                const b = data[i + 2];
                // Grayscale
                const avg = 0.2126 * r + 0.7152 * g + 0.0722 * b;

                // Contrast boost
                const val = avg < 200 ? avg * 0.8 : 255;

                data[i] = val;
                data[i + 1] = val;
                data[i + 2] = val;
            }

            ctx.putImageData(imageData, 0, 0);
            resolve(canvas.toDataURL('image/png'));
        };
    });
}

function extractScoresFromText(text: string): number[] {
    // Treat any non-digit as space (including slash)
    const clean = text.replace(/[^0-9]/g, ' ');
    const matches = clean.match(/\b(5\d|[6-9]\d|[12]\d{2}|300)\b/g);
    const scores: number[] = [];
    if (matches) {
        matches.forEach(m => scores.push(parseInt(m, 10)));
    }
    return scores;
}

export async function parseScoreboardImage(
    imageFile: File,
    knownMemberNames: string[]
): Promise<ParsedScoreRow[]> {

    console.log("Preprocessing...");
    const processedImageUrl = await preprocessImage(imageFile);

    console.log("Initializing Worker...");
    const worker = await createWorker('kor+eng');

    await worker.setParameters({
        tessedit_pageseg_mode: PSM.AUTO,
    });

    console.log("Recognizing...");
    const result = await worker.recognize(processedImageUrl);
    await worker.terminate();

    const parsedRows: ParsedScoreRow[] = [];

    interface WordObj {
        text: string;
        bbox: { x0: number; y0: number; x1: number; y1: number };
        centerY: number;
        height: number;
    }
    const allWords: WordObj[] = [];

    // Robust Gathering
    const dataAny = result.data as any;

    const collectWord = (word: any) => {
        if (word.text && word.text.trim().length > 0) {
            allWords.push({
                text: word.text.trim(),
                bbox: word.bbox,
                centerY: (word.bbox.y0 + word.bbox.y1) / 2,
                height: word.bbox.y1 - word.bbox.y0
            });
        }
    };

    if (dataAny.blocks) {
        dataAny.blocks.forEach((block: any) => {
            if (block.paragraphs) {
                block.paragraphs.forEach((para: any) => {
                    if (para.lines) {
                        para.lines.forEach((line: any) => {
                            if (line.words) line.words.forEach(collectWord);
                        });
                    }
                });
            }
        });
    }

    if (allWords.length === 0 && dataAny.lines) {
        dataAny.lines.forEach((line: any) => {
            if (line.words) line.words.forEach(collectWord);
        });
    }

    if (allWords.length > 0) {
        // Sort by Y-center
        allWords.sort((a, b) => a.centerY - b.centerY);

        const rows: WordObj[][] = [];
        let currentRow: WordObj[] = [];

        // Dynamic "Row Properties"
        let currentRowCenterY = 0;
        let currentRowHeight = 0;

        for (const word of allWords) {
            if (currentRow.length === 0) {
                currentRow.push(word);
                currentRowCenterY = word.centerY;
                currentRowHeight = word.height;
                continue;
            }

            // --- Aggressive Grouping ---
            // Check if word's center is close to the running row's center
            // Tolerance: 120% of the row's height. (Very permissive)

            const diff = Math.abs(word.centerY - currentRowCenterY);
            const tolerance = currentRowHeight * 1.2;

            if (diff < tolerance) {
                currentRow.push(word);
                // Update running averages (stabilizes the row center)
                // weighted average? or just simple average of bounds?
                // Simple re-calc:
                let sumY = 0, sumH = 0;
                currentRow.forEach(w => { sumY += w.centerY; sumH += w.height; });
                currentRowCenterY = sumY / currentRow.length;
                currentRowHeight = sumH / currentRow.length; // Average height
            } else {
                // Too far away, start new row
                rows.push(currentRow);
                currentRow = [word];
                currentRowCenterY = word.centerY;
                currentRowHeight = word.height;
            }
        }
        if (currentRow.length > 0) {
            rows.push(currentRow);
        }

        // Process Rows
        for (const rowWords of rows) {
            rowWords.sort((a, b) => a.bbox.x0 - b.bbox.x0);
            const lineText = rowWords.map(w => w.text).join(' ');

            const scores = extractScoresFromText(lineText);
            if (scores.length > 0) {
                parsedRows.push({ name: "", scores });
            }
        }
    }

    // Fallback
    if (parsedRows.length === 0) {
        const rawLines = result.data.text.split('\n');
        for (const line of rawLines) {
            const trimmed = line.trim();
            if (trimmed.length < 2) continue;
            const scores = extractScoresFromText(trimmed);
            if (scores.length > 0) {
                parsedRows.push({ name: "", scores });
            }
        }
    }

    return parsedRows;
}
