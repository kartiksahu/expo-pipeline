/**
 * Expo Pipeline Frontend Application
 */

let currentSessionId = null;
let statusCheckInterval = null;
let selectedFile = null;

// DOM Elements
const uploadSection = document.getElementById('uploadSection');
const processingSection = document.getElementById('processingSection');
const resultsSection = document.getElementById('resultsSection');
const errorSection = document.getElementById('errorSection');

const uploadArea = document.getElementById('uploadArea');
const fileInput = document.getElementById('fileInput');
const fileInfo = document.getElementById('fileInfo');
const processBtn = document.getElementById('processBtn');

const progressFill = document.getElementById('progressFill');
const progressText = document.getElementById('progressText');
const totalCompanies = document.getElementById('totalCompanies');
const processingTime = document.getElementById('processingTime');
const currentStage = document.getElementById('currentStage');

const downloadBtn = document.getElementById('downloadBtn');
const newProcessBtn = document.getElementById('newProcessBtn');
const retryBtn = document.getElementById('retryBtn');
const errorMessage = document.getElementById('errorMessage');

// File Upload Handling
uploadArea.addEventListener('click', () => fileInput.click());

uploadArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadArea.classList.add('drag-over');
});

uploadArea.addEventListener('dragleave', () => {
    uploadArea.classList.remove('drag-over');
});

uploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadArea.classList.remove('drag-over');
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
        handleFileSelect(files[0]);
    }
});

fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
        handleFileSelect(e.target.files[0]);
    }
});

function handleFileSelect(file) {
    if (!file.name.endsWith('.csv')) {
        alert('Please select a CSV file');
        return;
    }
    
    selectedFile = file;
    uploadArea.classList.add('has-file');
    
    fileInfo.innerHTML = `
        <strong>${file.name}</strong><br>
        Size: ${formatFileSize(file.size)}<br>
        Last modified: ${new Date(file.lastModified).toLocaleDateString()}
    `;
    fileInfo.classList.add('show');
    
    processBtn.disabled = false;
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

// Process Button
processBtn.addEventListener('click', startProcessing);

async function startProcessing() {
    if (!selectedFile) return;
    
    const formData = new FormData();
    formData.append('csvFile', selectedFile);
    
    try {
        const response = await fetch('/api/process', {
            method: 'POST',
            body: formData
        });
        
        if (!response.ok) {
            throw new Error('Failed to start processing');
        }
        
        const data = await response.json();
        currentSessionId = data.sessionId;
        
        // Switch to processing view
        showSection('processing');
        
        // Start status polling
        startStatusPolling();
        
    } catch (error) {
        showError(error.message);
    }
}

// Status Polling
function startStatusPolling() {
    const startTime = Date.now();
    
    statusCheckInterval = setInterval(async () => {
        try {
            const response = await fetch(`/api/status/${currentSessionId}`);
            
            if (!response.ok) {
                throw new Error('Failed to get status');
            }
            
            const status = await response.json();
            updateProcessingUI(status, startTime);
            
            if (status.status === 'complete') {
                clearInterval(statusCheckInterval);
                showResults(status);
            } else if (status.status === 'error') {
                clearInterval(statusCheckInterval);
                showError(status.error);
            }
            
        } catch (error) {
            clearInterval(statusCheckInterval);
            showError(error.message);
        }
    }, 1000); // Check every second
}

// Update UI during processing
function updateProcessingUI(status, startTime) {
    // Update progress
    const progress = status.progress || 0;
    progressFill.style.width = `${progress}%`;
    progressText.textContent = `${Math.round(progress)}%`;
    
    // Update stats
    totalCompanies.textContent = status.totalCompanies || '0';
    currentStage.textContent = formatStageName(status.currentStage);
    
    const elapsed = Math.round((Date.now() - startTime) / 1000);
    processingTime.textContent = `${elapsed}s`;
    
    // Update stages
    Object.keys(status.stages || {}).forEach(stageName => {
        const stageData = status.stages[stageName];
        const stageElement = document.getElementById(`stage-${stageName}`);
        
        if (stageElement) {
            // Update status
            stageElement.classList.remove('active', 'complete');
            if (stageData.status === 'in_progress') {
                stageElement.classList.add('active');
            } else if (stageData.status === 'complete') {
                stageElement.classList.add('complete');
            }
            
            // Update message
            const messageElement = stageElement.querySelector('.stage-message');
            if (messageElement && stageData.message) {
                messageElement.textContent = stageData.message;
            }
        }
    });
}

function formatStageName(stage) {
    const names = {
        loading: 'Loading CSV',
        linkedin: 'LinkedIn Enhancement',
        employee: 'Employee Analysis',
        funding: 'Funding Analysis',
        jobs: 'Job Analysis',
        consolidation: 'Generating CSV'
    };
    return names[stage] || stage;
}

// Show Results
function showResults(status) {
    // Generate summary
    const summaryHTML = `
        <div class="stats">
            <div class="stat">
                <span class="stat-label">Total Companies</span>
                <span class="stat-value">${status.totalCompanies || 0}</span>
            </div>
            <div class="stat">
                <span class="stat-label">Processing Time</span>
                <span class="stat-value">${status.processingTime}s</span>
            </div>
            <div class="stat">
                <span class="stat-label">File Size</span>
                <span class="stat-value">~${Math.round(status.totalCompanies * 0.5)}KB</span>
            </div>
        </div>
        
        <div style="margin-top: 20px;">
            <h4>✅ Processing Complete</h4>
            <p style="color: #666; margin-top: 10px;">
                All ${status.totalCompanies} companies have been enriched with LinkedIn URLs, 
                employee data, funding information, and job postings analysis.
            </p>
        </div>
    `;
    
    document.getElementById('resultsSummary').innerHTML = summaryHTML;
    
    showSection('results');
}

// Download Button
downloadBtn.addEventListener('click', async () => {
    if (!currentSessionId) return;
    
    window.location.href = `/api/download/${currentSessionId}`;
});

// New Process Button
newProcessBtn.addEventListener('click', () => {
    resetUI();
    showSection('upload');
});

// Retry Button
retryBtn.addEventListener('click', () => {
    resetUI();
    showSection('upload');
});

// Show Error
function showError(message) {
    errorMessage.textContent = message || 'An unexpected error occurred';
    showSection('error');
}

// Section Management
function showSection(section) {
    // Hide all sections
    uploadSection.style.display = 'none';
    processingSection.style.display = 'none';
    resultsSection.style.display = 'none';
    errorSection.style.display = 'none';
    
    // Show requested section
    switch(section) {
        case 'upload':
            uploadSection.style.display = 'block';
            break;
        case 'processing':
            processingSection.style.display = 'block';
            break;
        case 'results':
            resultsSection.style.display = 'block';
            break;
        case 'error':
            errorSection.style.display = 'block';
            break;
    }
}

// Reset UI
function resetUI() {
    currentSessionId = null;
    selectedFile = null;
    
    if (statusCheckInterval) {
        clearInterval(statusCheckInterval);
        statusCheckInterval = null;
    }
    
    // Reset upload area
    uploadArea.classList.remove('has-file');
    fileInfo.classList.remove('show');
    fileInfo.innerHTML = '';
    processBtn.disabled = true;
    fileInput.value = '';
    
    // Reset progress
    progressFill.style.width = '0%';
    progressText.textContent = '0%';
    
    // Reset stages
    document.querySelectorAll('.stage').forEach(stage => {
        stage.classList.remove('active', 'complete');
        const message = stage.querySelector('.stage-message');
        if (message) {
            message.textContent = 'Waiting...';
        }
    });
}

// Initialize
showSection('upload');