import { useState } from 'react';
import axios from 'axios';
import { saveAs } from 'file-saver';
import './App.css';

const API_URL = 'http://localhost:3001/api';

function App() {
  const [searchType, setSearchType] = useState('range'); // 'single' or 'range'
  const [singleDate, setSingleDate] = useState('');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // State for bulk download
  const [bulkDownloadTypes, setBulkDownloadTypes] = useState({
    'jpeg': true,
    'jpg': true,
    'avi': true,
    'wav': true,
  });
  const [bulkLoading, setBulkLoading] = useState(false);

  const handleSearch = async () => {
    setLoading(true);
    setError(null);
    setFiles([]);

    let queryParams = {};
    if (searchType === 'single' && singleDate) {
      queryParams = { date: singleDate };
    } else if (searchType === 'range' && startDate && endDate) {
      queryParams = { startDate, endDate };
    } else {
      setError('Please select a valid date or date range.');
      setLoading(false);
      return;
    }

    try {
      const response = await axios.get(`${API_URL}/files`, { params: queryParams });
      setFiles(response.data);
    } catch (err) {
      setError(`Failed to fetch files: ${err.response?.data?.error || err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleBulkTypeChange = (event) => {
    const { name, checked } = event.target;
    setBulkDownloadTypes(prev => ({ ...prev, [name]: checked }));
  };

  const handleBulkDownload = async () => {
    setBulkLoading(true);
    setError(null);

    const selectedTypes = Object.entries(bulkDownloadTypes)
      .filter(([, isSelected]) => isSelected)
      .map(([type]) => type);

    if (selectedTypes.length === 0) {
      setError("Please select at least one file type to download.");
      setBulkLoading(false);
      return;
    }
    
    if (!startDate || !endDate) {
        setError("Please select a valid date range for the bulk download.");
        setBulkLoading(false);
        return;
    }

    try {
      const response = await axios.post(`${API_URL}/bulk-download`, {
        startDate,
        endDate,
        types: selectedTypes,
      }, {
        responseType: 'blob', // Important to handle binary data
      });
      
      const zipFileName = `backup-${startDate}-to-${endDate}.zip`;
      saveAs(response.data, zipFileName); // Use file-saver to trigger download

    } catch (err) {
      setError(`Failed to download ZIP: ${err.response?.data?.error || err.message}`);
    } finally {
      setBulkLoading(false);
    }
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>File Search and Download</h1>
        <p>Search for processed files and download them individually or in bulk.</p>
      </header>
      <main>
        <div className="search-controls">
          <div className="search-type">
            <label>
              <input
                type="radio"
                name="searchType"
                value="single"
                checked={searchType === 'single'}
                onChange={() => setSearchType('single')}
              />
              Single Date
            </label>
            <label>
              <input
                type="radio"
                name="searchType"
                value="range"
                checked={searchType === 'range'}
                onChange={() => setSearchType('range')}
              />
              Date Range
            </label>
          </div>

          {searchType === 'single' ? (
            <div className="date-picker">
              <label htmlFor="singleDate">Date:</label>
              <input
                type="date"
                id="singleDate"
                value={singleDate}
                onChange={(e) => setSingleDate(e.target.value)}
              />
            </div>
          ) : (
            <div className="date-picker">
              <label htmlFor="startDate">Start Date:</label>
              <input
                type="date"
                id="startDate"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
              <label htmlFor="endDate">End Date:</label>
              <input
                type="date"
                id="endDate"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          )}

          <button onClick={handleSearch} disabled={loading}>
            {loading ? 'Searching...' : 'Search'}
          </button>
        </div>

        {error && <p className="error">{error}</p>}

        <div className="results">
          <h2>Results ({files.length})</h2>
          {files.length > 0 && (
            <div className="bulk-download-section">
              <h3>Download Results as .ZIP</h3>
              <div className="checkbox-group">
                <label><input type="checkbox" name="jpeg" checked={bulkDownloadTypes['jpeg']} onChange={handleBulkTypeChange} /> Images (.jpeg)</label>
                <label><input type="checkbox" name="avi" checked={bulkDownloadTypes['avi']} onChange={handleBulkTypeChange} /> Videos (.avi)</label>
                <label><input type="checkbox" name="wav" checked={bulkDownloadTypes['wav']} onChange={handleBulkTypeChange} /> Audio (.wav)</label>
              </div>
              <button onClick={handleBulkDownload} disabled={bulkLoading}>
                {bulkLoading ? 'Zipping...' : 'Download Selected Types as .ZIP'}
              </button>
            </div>
          )}
          {files.length > 0 ? (
            <ul>
              {files.map((file) => (
                <li key={file.id}>
                  <div className="file-info">
                    <strong>{file.original_name}</strong> ({file.file_type})
                    <br />
                    <span>Created on: {new Date(file.created_at).toLocaleDateString()}</span>
                  </div>
                  <a href={`${API_URL}/download/${file.id}`} className="download-btn" download>Download</a>
                </li>
              ))}
            </ul>
          ) : (
            <p>{!loading && 'No files found for the selected criteria.'}</p>
          )}
        </div>
      </main>
    </div>
  );
}

export default App;