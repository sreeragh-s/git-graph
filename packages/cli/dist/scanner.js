import { readdirSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, relative, extname } from 'node:path';
export function hashRepoPath(repoPath) {
    return createHash('sha256').update(repoPath).digest('hex').slice(0, 16);
}
const SKIP_DIRS = new Set([
    'node_modules', '.git', 'dist', 'build', '.cache', '.next',
    '__pycache__', 'coverage', '.nyc_output', 'tmp', 'temp',
]);
const SKIP_EXTENSIONS = new Set([
    '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.webp',
    '.mp4', '.mp3', '.wav', '.ogg', '.webm', '.pdf', '.doc',
    '.docx', '.xls', '.xlsx', '.zip', '.tar', '.gz', '.rar',
    '.7z', '.lock', '.log', '.env', '.env.local', '.css', '.scss',
    '.sass', '.less', '.woff', '.woff2', '.ttf', '.eot',
]);
const CODE_EXTENSIONS = {
    '.ts': 'typescript', '.tsx': 'typescript', '.js': 'javascript',
    '.jsx': 'javascript', '.mjs': 'javascript', '.cjs': 'javascript',
    '.json': 'json',
};
function getLanguage(filename) {
    const ext = extname(filename).toLowerCase();
    return CODE_EXTENSIONS[ext] ?? 'unknown';
}
function shouldSkipFile(filePath) {
    return SKIP_EXTENSIONS.has(extname(filePath).toLowerCase());
}
function shouldSkipDir(dirName) {
    return dirName.startsWith('.') || SKIP_DIRS.has(dirName);
}
export function scanDirectory(dirPath, basePath) {
    const files = [];
    const base = basePath ?? dirPath;
    function walk(currentDir) {
        let entries;
        try {
            entries = readdirSync(currentDir);
        }
        catch {
            return;
        }
        for (const entry of entries) {
            const fullPath = join(currentDir, entry);
            let stat;
            try {
                stat = statSync(fullPath);
            }
            catch {
                continue;
            }
            if (stat.isDirectory()) {
                if (!shouldSkipDir(entry)) {
                    walk(fullPath);
                }
            }
            else if (stat.isFile()) {
                if (!shouldSkipFile(fullPath) && !entry.startsWith('.')) {
                    const lang = getLanguage(fullPath);
                    if (lang !== 'unknown') {
                        files.push({
                            path: fullPath,
                            relativePath: relative(base, fullPath),
                            size: stat.size,
                            language: lang,
                        });
                    }
                }
            }
        }
    }
    walk(dirPath);
    return files;
}
