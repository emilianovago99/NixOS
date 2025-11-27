
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const archiver = require('archiver');

// Import other modules
const db = require('./database');
const watcher = require('./file-watcher');

const app = express();

// --- Configuration ---
// Use environment variables for configuration, with sensible defaults for local development
const PORT = process.env.PORT || 3001;
const WATCH_DIR = process.env.WATCH_DIR || path.join(__dirname, '..', '..', 'sd_virtual');
const BACKUP_DIR = process.env.BACKUP_DIR || path.join(__dirname, '..', '..', 'backup');
const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'metadata.db');

// Middleware
app.use(cors());
app.use(express.json());

// Serve the static frontend if in production
if (process.env.NODE_ENV === 'production') {
    const frontendDist = path.join(__dirname, '..', 'public');
    if(fs.existsSync(frontendDist)) {
        console.log(`Serving static files from: ${frontendDist}`);
        app.use(express.static(frontendDist));
    } else {
        console.warn(`Warning: Frontend build directory not found at ${frontendDist}`);
    }
}


// Basic route
app.get('/', (req, res) => {
  res.send('Backend server is running.');
});

// API route to get files metadata by date
app.get('/api/files', async (req, res) => {
    const { date, startDate, endDate } = req.query;

    if (!date && (!startDate || !endDate)) {
        return res.status(400).json({ error: 'Please provide a date or a date range.' });
    }

    try {
        let files;
        if (date) {
            // Get files for a single date
            files = await db.getFilesByDate(date);
        } else {
            // Get files for a date range
            files = await db.getFilesByDateRange(startDate, endDate);
        }
        res.json(files);
    } catch (error) {
        console.error('Error fetching files:', error);
        res.status(500).json({ error: 'Failed to fetch files from database.' });
    }
});

// API route for single file download
app.get('/api/download/:id', async (req, res) => {
    try {
        const fileRecord = await db.getFileById(req.params.id);
        if (!fileRecord) {
            return res.status(404).send('File not found.');
        }

        // In production, the path stored might be relative to the configured backup dir
        const filePath = path.resolve(BACKUP_DIR, fileRecord.backup_path);

        if (fs.existsSync(filePath)) {
            res.download(filePath, fileRecord.original_name); // Sets headers to trigger download
        } else {
            res.status(404).send(`File not found on disk at: ${filePath}`);
        }
    } catch (error) {
        console.error('Download error:', error);
        res.status(500).send('Error downloading file.');
    }
});

// API route for bulk ZIP download
app.post('/api/bulk-download', async (req, res) => {
    const { startDate, endDate, types } = req.body;

    if (!startDate || !endDate || !types || types.length === 0) {
        return res.status(400).json({ error: 'Missing required parameters for bulk download.' });
    }
    
    try {
        const files = await db.getFilesByDateRangeAndTypes(startDate, endDate, types);

        if (files.length === 0) {
            return res.status(404).json({ error: 'No files found matching the criteria.' });
        }

        const archive = archiver('zip', {
            zlib: { level: 9 } // Sets the compression level.
        });
        
        const zipFileName = `backup-${startDate}-to-${endDate}.zip`;
        res.attachment(zipFileName);
        archive.pipe(res);

        files.forEach(file => {
             const filePath = path.resolve(BACKUP_DIR, file.backup_path);
             if (fs.existsSync(filePath)) {
                archive.file(filePath, { name: file.original_name });
            } else {
                console.warn(`File not found for zipping: ${filePath}`);
            }
        });

        await archive.finalize();

    } catch (error) {
        console.error('Bulk download error:', error);
        res.status(500).send('Error creating ZIP file.');
    }
});


// Start the server
app.listen(PORT, () => {
  console.log(`Server listening at http://localhost:${PORT}`);
  
  // Initialize the database
  db.initDb(DB_PATH);

  // Start the file watcher
  watcher.startWatching(WATCH_DIR, BACKUP_DIR);
});
