# Digital Evidence Management System

This project is a simple digital evidence management system that automatically processes files from a designated "hot folder" (simulating an SD card), extracts metadata, backs them up, and provides a web interface to search for them by date.

## Project Structure

- `backend/`: The Node.js server that handles file watching, metadata extraction, database operations, and the API.
- `frontend/front/`: The React web application for searching and viewing file information.
- `sd_virtual/`: The "hot folder". Any supported files (`.jpeg`, `.jpg`, `.avi`, `.wav`) you place here will be automatically processed.
- `backup/`: This folder will be created automatically and will contain the backed-up files, organized by date (`YYYY/MM/DD`).
- `metadata.db`: The SQLite database file, which will be created automatically in the `backend` directory.

## How to Run the Application

You will need to open two separate terminal windows to run both the backend and the frontend simultaneously.

### 1. Run the Backend

The backend server is responsible for processing files and serving the API.

```bash
# Navigate to the backend directory
cd backend

# Install dependencies (only needs to be done once)
npm install

# Start the server
npm start
```
The backend server will start on `http://localhost:3001`. It will immediately begin watching the `sd_virtual` folder for new files.

### 2. Run the Frontend

The frontend provides the user interface for searching.

```bash
# Navigate to the frontend directory
cd frontend/front

# Install dependencies (only needs to be done once)
npm install

# Start the React development server
npm run dev
```
The frontend application will open in your browser, usually at `http://localhost:5173`.

## How to Use

1.  Start both the backend and frontend as described above.
2.  Open the `sd_virtual` folder on your computer.
3.  Copy and paste some sample `.jpeg`, `.avi`, or `.wav` files into the `sd_virtual` folder.
4.  Watch the terminal running your backend. You will see log messages indicating that the files have been detected, processed, and saved.
5.  Open the frontend application in your browser (`http://localhost:5173`).
6.  Use the date pickers to select the date or date range corresponding to the files you added.
7.  Click "Search" to see the results.
