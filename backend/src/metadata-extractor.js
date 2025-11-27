
const fs = require('fs');
const exifParser = require('exif-parser');
const ffmpeg = require('fluent-ffmpeg');
const ffprobeStatic = require('ffprobe-static');

ffmpeg.setFfprobePath(ffprobeStatic.path);

/**
 * Extracts metadata and creation date from a given file.
 * @param {string} filePath - The path to the file.
 * @returns {Promise<{metadata: object, creationDate: Date}>}
 */
async function extractMetadata(filePath) {
    const ext = require('path').extname(filePath).toLowerCase();

    if (ext === '.jpeg' || ext === '.jpg') {
        return extractImageMetadata(filePath);
    } else if (ext === '.avi' || ext === '.wav') {
        return extractVideoAudioMetadata(filePath);
    } else {
        throw new Error(`Unsupported file type: ${ext}`);
    }
}

/**
 * Extracts metadata from image files.
 * @param {string} filePath - The path to the image file.
 * @returns {Promise<{metadata: object, creationDate: Date}>}
 */
function extractImageMetadata(filePath) {
    return new Promise((resolve, reject) => {
        try {
            const buffer = fs.readFileSync(filePath);
            const parser = exifParser.create(buffer);
            const result = parser.parse();
            
            // EXIF stores several possible date fields
            const creationDateTimestamp = result.tags.DateTimeOriginal || result.tags.CreateDate || result.tags.ModifyDate;
            
            let creationDate;
            if (creationDateTimestamp) {
                // EXIF date format is 'YYYY:MM:DD HH:MM:SS' but unix timestamp is in seconds
                creationDate = new Date(creationDateTimestamp * 1000);
            } else {
                // Fallback to file system date
                creationDate = fs.statSync(filePath).birthtime;
            }

            resolve({ metadata: result.tags, creationDate });
        } catch (error) {
            reject(error);
        }
    });
}

/**
 * Extracts metadata from video or audio files using ffprobe.
 * @param {string} filePath - The path to the media file.
 * @returns {Promise<{metadata: object, creationDate: Date}>}
 */
function extractVideoAudioMetadata(filePath) {
    return new Promise((resolve, reject) => {
        ffmpeg.ffprobe(filePath, (err, data) => {
            if (err) {
                return reject(err);
            }

            let creationDate;
            // 'creation_time' is a standard tag in the format stream
            const creationTimeString = data.format.tags ? data.format.tags.creation_time : null;

            if (creationTimeString) {
                creationDate = new Date(creationTimeString);
            } else {
                // Fallback to file system date
                creationDate = fs.statSync(filePath).birthtime;
            }
            
            resolve({ metadata: data.format, creationDate });
        });
    });
}

module.exports = {
    extractMetadata
};
