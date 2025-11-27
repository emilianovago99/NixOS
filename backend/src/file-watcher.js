
const chokidar = require('chokidar');
const path = require('path');
const fs = require('fs-extra');
const db = require('./database');
const { extractMetadata } = require('./metadata-extractor');

const supportedExtensions = ['.jpeg', '.jpg', '.avi', '.wav'];

/**
 * Processes a newly detected file: extracts metadata, backs it up, and saves to DB.
 * @param {string} filePath - The path to the new file.
 * @param {string} backupDir - The base directory where backups should be stored.
 */
async function processFile(filePath, backupDir) {
    try {
        console.log(`Processing: ${filePath}`);
        // 1. Extract metadata
        const { metadata, creationDate } = await extractMetadata(filePath);
        
        // 2. Create backup and get relative path
        const relativeBackupPath = await backupFile(filePath, creationDate, backupDir);
        console.log(`File backed up to: ${relativeBackupPath}`);

        // 3. Save to database
        const fileData = {
            original_name: path.basename(filePath),
            file_type: path.extname(filePath).toLowerCase().replace('.', ''),
            backup_path: relativeBackupPath, // Store the relative path
            metadata: metadata,
            created_at: creationDate.toISOString().split('T')[0] // 'YYYY-MM-DD'
        };

        const newId = await db.insertFile(fileData);
        if (newId) {
            console.log(`File metadata saved to database with ID: ${newId}`);
        }

    } catch (error) {
        // Log error but don't crash the watcher
        console.error(`Failed to process file ${path.basename(filePath)}:`, error);
    }
}

/**
 * Creates a backup of the file in a structured directory and returns the relative path.
 * @param {string} sourcePath - The path of the file to back up.
 * @param {Date} creationDate - The creation date of the file.
 * @param {string} backupDir - The base directory for backups.
 * @returns {Promise<string>} The path to the backed-up file, relative to backupDir.
 */
async function backupFile(sourcePath, creationDate, backupDir) {
    const year = creationDate.getFullYear();
    const month = String(creationDate.getMonth() + 1).padStart(2, '0');
    const day = String(creationDate.getDate()).padStart(2, '0');

    const relativePath = path.join(String(year), month, day, path.basename(sourcePath));
    const absoluteDestPath = path.join(backupDir, relativePath);
    
    await fs.ensureDir(path.dirname(absoluteDestPath));

    if (await fs.exists(absoluteDestPath)) {
        console.warn(`Backup file already exists: ${absoluteDestPath}. Skipping copy.`);
        return relativePath;
    }

    await fs.copy(sourcePath, absoluteDestPath);
    return relativePath;
}


/**
 * Starts watching a directory for new files.
 * @param {string} watchDir - The absolute path to the directory to watch.
 * @param {string} backupDir - The absolute path to the backup directory.
 */
function startWatching(watchDir, backupDir) {
    console.log(`Backup directory is set to: ${backupDir}`);
    if (!fs.existsSync(watchDir)) {
        console.error(`Error: Watch directory not found at '${watchDir}'`);
        try {
            console.log(`Attempting to create watch directory...`);
            fs.ensureDirSync(watchDir);
            console.log(`Successfully created watch directory: ${watchDir}`);
        } catch (error) {
            console.error(`Failed to create watch directory:`, error);
            process.exit(1);
        }
    }

    const watcher = chokidar.watch(watchDir, {
        ignored: /(^|[\][/])\..*/, // ignore dotfiles
        persistent: true,
        ignoreInitial: true, // Don't fire 'add' events on existing files
        awaitWriteFinish: {
            stabilityThreshold: 2000,
            pollInterval: 100
        }
    });

    watcher.on('add', (filePath) => {
        const ext = path.extname(filePath).toLowerCase();
        if (supportedExtensions.includes(ext)) {
            processFile(filePath, backupDir);
        }
    });

    watcher.on('error', (error) => console.error(`Watcher error: ${error}`));
     console.log(`Watching for new files in: ${watchDir}`);
}


module.exports = {
    startWatching
};
