
const sqlite3 = require('sqlite3').verbose();

let db = null;

/**
 * Initializes the database connection and creates the table if it doesn't exist.
 * @param {string} dbPath - The path to the SQLite database file.
 */
function initDb(dbPath) {
    db = new sqlite3.Database(dbPath, (err) => {
        if (err) {
            console.error('Error opening database:', err.message);
        } else {
            console.log(`Connected to the SQLite database at ${dbPath}`);
            db.run(`CREATE TABLE IF NOT EXISTS files (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                original_name TEXT NOT NULL,
                file_type TEXT NOT NULL,
                backup_path TEXT NOT NULL UNIQUE,
                metadata TEXT,
                created_at TEXT NOT NULL
            )`, (err) => {
                if (err) {
                    console.error('Error creating table:', err.message);
                }
            });
        }
    });
}

/**
 * Inserts a file record into the database.
 * @param {object} fileData - The data of the file to insert.
 * @returns {Promise<number>} The ID of the newly inserted row.
 */
function insertFile(fileData) {
    return new Promise((resolve, reject) => {
        const { original_name, file_type, backup_path, metadata, created_at } = fileData;
        const sql = `INSERT INTO files (original_name, file_type, backup_path, metadata, created_at) VALUES (?, ?, ?, ?, ?)`;
        db.run(sql, [original_name, file_type, backup_path, JSON.stringify(metadata), created_at], function(err) {
            if (err) {
                // Ignore unique constraint errors for idempotency
                if (err.code === 'SQLITE_CONSTRAINT') {
                    console.warn(`File already in DB: ${backup_path}. Skipping.`);
                    resolve(null);
                } else {
                    reject(err);
                }
            } else {
                resolve(this.lastID);
            }
        });
    });
}

/**
 * Gets all files from the database for a specific date.
 * @param {string} date - The date in 'YYYY-MM-DD' format.
 * @returns {Promise<any[]>} A list of files.
 */
function getFilesByDate(date) {
    return new Promise((resolve, reject) => {
        const sql = `SELECT * FROM files WHERE date(created_at) = ? ORDER BY created_at`;
        db.all(sql, [date], (err, rows) => {
            if (err) {
                reject(err);
            } else {
                resolve(rows);
            }
        });
    });
}

/**
 * Gets all files from the database within a specific date range.
 * @param {string} startDate - The start date in 'YYYY-MM-DD' format.
 * @param {string} endDate - The end date in 'YYYY-MM-DD' format.
 * @returns {Promise<any[]>} A list of files.
 */
function getFilesByDateRange(startDate, endDate) {
    return new Promise((resolve, reject) => {
        const sql = `SELECT * FROM files WHERE date(created_at) BETWEEN ? AND ? ORDER BY created_at`;
        db.all(sql, [startDate, endDate], (err, rows) => {
            if (err) {
                reject(err);
            } else {
                resolve(rows);
            }
        });
    });
}

/**
 * Gets all files from the database within a specific date range and matching specific types.
 * @param {string} startDate - The start date in 'YYYY-MM-DD' format.
 * @param {string} endDate - The end date in 'YYYY-MM-DD' format.
 * @param {string[]} types - An array of file types to include (e.g., ['jpeg', 'avi']).
 * @returns {Promise<any[]>} A list of files.
 */
function getFilesByDateRangeAndTypes(startDate, endDate, types) {
    return new Promise((resolve, reject) => {
        if (!types || types.length === 0) {
            return resolve([]);
        }
        // Creating placeholders for the IN clause
        const placeholders = types.map(() => '?').join(',');
        const sql = `SELECT * FROM files WHERE date(created_at) BETWEEN ? AND ? AND file_type IN (${placeholders}) ORDER BY created_at`;
        
        db.all(sql, [startDate, endDate, ...types], (err, rows) => {
            if (err) {
                reject(err);
            } else {
                resolve(rows);
            }
        });
    });
}

/**
 * Gets a single file record by its ID.
 * @param {number} id The ID of the file.
 * @returns {Promise<any>} The file record.
 */
function getFileById(id) {
    return new Promise((resolve, reject) => {
        const sql = `SELECT * FROM files WHERE id = ?`;
        db.get(sql, [id], (err, row) => {
            if (err) {
                reject(err);
            } else {
                resolve(row);
            }
        });
    });
}


module.exports = {
    initDb,
    insertFile,
    getFilesByDate,
    getFilesByDateRange,
    getFilesByDateRangeAndTypes,
    getFileById
};
