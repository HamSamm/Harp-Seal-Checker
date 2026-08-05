// --- Globals ---
let allFilesList = [];
let selectedFiles = [];
let currentEditingFile = null;
let editingRows = [];
let editingColumns = [];

function renderInterface(filteredList) {
    const listContainer = document.getElementById('index-list-container');
    const resultsCountEl = document.getElementById('search-results-count');
    
    if (resultsCountEl) {
        resultsCountEl.innerText = `${filteredList.length} seals match your filters`; // Display # of seals in the list (Write)
    }
    
    if (listContainer && typeof sealsData !== 'undefined') { // Seal Index Info Page Obj
        listContainer.innerHTML = '';
        filteredList.forEach(seal => {
            const item = document.createElement('div'); 
            item.className = 'index-list-item';
            item.innerHTML = `<strong>${seal.id}</strong> — Age: ${seal.age}, Area: ${seal.nafo_zone}`; // Display Info
            item.addEventListener('click', () => selectSeal(seal)); 
            listContainer.appendChild(item);
        });
    }
}

// Populate search filters dynamically based on sealsData so it doesn't show redundant options
function populateFilters() {
    const filterGrid = document.querySelector('.filter-grid'); 
    if (!filterGrid) return; // Make sure that filterGrid exists 

    const selects = filterGrid.querySelectorAll('select');
    if (selects.length < 4) return;  // Make sure it has 4 filters (<select>)

    const locationSelect = selects[0];
    const genderSelect = selects[1];
    const stomachSelect = selects[2]; 
    const ageSelect = selects[3];

    // Default Selected
    locationSelect.innerHTML = '<option value="">All NAFO Zones</option>';
    genderSelect.innerHTML = '<option value="">All Genders</option>';
    stomachSelect.innerHTML = '<option value="">All Last Meals</option>';
    ageSelect.innerHTML = '<option value="">All Ages</option>';

    const locations = new Set();
    const genders = new Set();
    const stomachs = new Set();
    const ages = ['Pups (0-2)', 'Young (3-10)', 'Adults (11+)', 'Unknown Age']; // Better to group ages like this 

    sealsData.forEach(seal => { //Sort into sub arrays
        if (seal.nafo_zone) locations.add(seal.nafo_zone);
        if (seal.gender) genders.add(seal.gender);
        if (seal.meal) stomachs.add(seal.meal);
    });

    Array.from(locations).sort().forEach(loc => { // Sort then make an option for each group
        locationSelect.innerHTML += `<option value="${loc}">${loc}</option>`;
    });

    Array.from(genders).sort().forEach(gen => {
        const display = gen === 'M' ? 'Male' : gen === 'F' ? 'Female' : 'Unknown';
        genderSelect.innerHTML += `<option value="${gen}">${display}</option>`;
    });

    Array.from(stomachs).sort().forEach(st => {
        stomachSelect.innerHTML += `<option value="${st}">${st}</option>`;
    });

    ages.forEach(ag => {
        ageSelect.innerHTML += `<option value="${ag}">${ag}</option>`;
    });

    const searchInput = filterGrid.querySelector('input[type="text"]'); // Id Search box 
    if (searchInput) {
        searchInput.addEventListener('input', applyFilters); // Input Box
    }
    selects.forEach(select => {
        select.addEventListener('change', applyFilters); // Detect change in input box
    });
}

// Apply selected filters
function applyFilters() {
    const filterGrid = document.querySelector('.filter-grid'); 
    const searchInput = filterGrid.querySelector('input[type="text"]');
    const selects = filterGrid.querySelectorAll('select');

    const searchVal = searchInput ? searchInput.value.toLowerCase().trim() : ''; // Formatting 
    const locVal = selects[0].value; 
    const genderVal = selects[1].value;
    const stomachVal = selects[2].value;
    const ageVal = selects[3].value;

    const filtered = sealsData.filter(seal => { 
        if (searchVal && !seal.id.toLowerCase().includes(searchVal)) {
            return false;
        }
        if (locVal && seal.nafo_zone !== locVal) {
            return false;
        }
        if (genderVal && seal.gender !== genderVal) {
            return false;
        }
        if (stomachVal && seal.meal !== stomachVal) {
            return false;
        }
        if (ageVal) {
            const ageNum = seal.age_num;
            if (ageVal === 'Pups (0-2)') {
                if (ageNum === null || ageNum > 2) return false;
            } else if (ageVal === 'Young (3-10)') {
                if (ageNum === null || ageNum < 3 || ageNum > 10) return false;
            } else if (ageVal === 'Adults (11+)') {
                if (ageNum === null || ageNum < 11) return false;
            } else if (ageVal === 'Unknown Age') {
                if (ageNum !== null) return false;
            }
        }
        return true;
    });

    renderInterface(filtered);
}

// Loading Animation
function showLoading(text = "Loading...") { 
    const overlay = document.getElementById ('loading-overlay');
    const textEl = document.getElementById('loading-text');
    if (overlay) {
        textEl.innerText = text;
        overlay.style.display = 'flex';
    }
}
function hideLoading() {
    const overlay = document.getElementById('loading-overlay');
    if (overlay) overlay.style.display = 'none';
}

// Lifecycle & Quality of Life Local Cache Validation
document.addEventListener("DOMContentLoaded", () => { // Wait for everything to be loaded
    const urlParams = new URLSearchParams(window.location.search); // 
    const urlFiles = urlParams.get('files');
    const cachedFiles = localStorage.getItem('selected_seal_files');
    
    // Redirect automatically if user has cached selections
    if (!urlFiles && cachedFiles && cachedFiles !== "seals.csv") {
        window.location.search = `?files=${encodeURIComponent(cachedFiles)}`;
        return;
    }
    
    // Parse currently active visualizers
    if (urlFiles) {
        selectedFiles = urlFiles.split(',').map(f => f.trim()); // Split by , or %2C
    } else {
        selectedFiles = ["seals.csv"]; // default 
    }
    
    initEditorUI();
});

// Initialize event controllers for buttons (Register Click then run that function)
function initEditorUI() {
    showLoading("Querying Azure Directories...");
    
    // Load Files Index on side
    fetchFilesIndex();

    // Index Actions Buttons -> Run associated method when button is clicked
    document.getElementById('btn-add-file').addEventListener('click', createNewFile);
    document.getElementById('btn-delete-file').addEventListener('click', deleteActiveFile);
    document.getElementById('btn-export-file').addEventListener('click', exportActiveFile);
    document.getElementById('btn-import-file').addEventListener('click', () => {
        document.getElementById('file-import-input').click();
    });
    
    document.getElementById('file-import-input').addEventListener('change', importLocalCSV);
    document.getElementById('btn-apply-selection').addEventListener('click', applySelection);

    // Row Spreadsheet Editor Buttons
    document.getElementById('btn-add-row').addEventListener('click', addNewRow);
    document.getElementById('btn-delete-row').addEventListener('click', deleteLastRow);
    document.getElementById('btn-save-file').addEventListener('click', saveFileToAzure);
}

// API: Load Index List
function fetchFilesIndex() {
    fetch('/api/files')  // Call the function in python 
        .then(res => res.json())
        .then(data => {
            hideLoading();
            if (data.success) {
                allFilesList = data.files || [];
                renderFilesIndexUI();

                // Auto-load the file specified in the URL on initial page load
                if (selectedFiles && selectedFiles.length > 0) {
                    const firstSelectedFile = selectedFiles[0];
                    // Verify the file exists in the directory index
                    const fileExists = allFilesList.some(f => f.name === firstSelectedFile);
                    if (fileExists) {
                        loadFileIntoEditor(firstSelectedFile);
                    }
                }
            } else {
                alert("Failed listing cloud blobs: " + data.error);
            }
        })
        .catch(err => {
            hideLoading();
            console.error("Fetch error:", err);
        });
}

// Render Left Side Index UI
function renderFilesIndexUI() {
    const container = document.getElementById('csv-list-container');
    if (!container) return;
    
    container.innerHTML = '';
    
    allFilesList.forEach(file => {
        const item = document.createElement('div');
        item.className = 'csv-list-item';
        item.dataset.filename = file.name; // Keep tracking of selection cleanly
        
        // Check if item is already loaded in the editor
        if (currentEditingFile === file.name) {
            item.classList.add('active-editing');
        }

        // Active visual compilation checkbox
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'file-select-checkbox';
        checkbox.value = file.name;
        checkbox.checked = selectedFiles.includes(file.name);
        
        // Safe isolation for click event
        checkbox.addEventListener('click', (e) => {
            e.stopPropagation();
        });
        
        const label = document.createElement('span');
        label.className = 'file-name';
        
        const isMaster = file.name === "seals.csv" || file.is_master;
        label.innerText = file.name + (isMaster ? ' (Read Only)' : '');
        
        item.appendChild(checkbox);
        item.appendChild(label);
        
        // Text click action to load file contents into the grid editor
        item.addEventListener('click', () => {
            loadFileIntoEditor(file.name);
        });
        
        container.appendChild(item);
    });
}

// API: Load File Into Editor Grid
function loadFileIntoEditor(filename) {
    showLoading(`Loading ${filename} from Azure...`);
    
    const singleEncoded = encodeURIComponent(filename);
    
    // Fetch with single encoding first, catch 404 and retry with double encoding if filename has slashes
    fetch(`/api/files/read/${singleEncoded}`)
        .then(res => {
            if (!res.ok && res.status === 404 && filename.includes('/')) {
                const doubleEncoded = encodeURIComponent(encodeURIComponent(filename));
                return fetch(`/api/files/read/${doubleEncoded}`);
            }
            return res;
        })
        .then(res => {
            if (!res.ok) {
                throw new Error(`Server returned status ${res.status}: ${res.statusText}`);
            }
            return res.text(); // Read raw text to intercept and clean any non-JSON compliant floats
        })
        .then(text => {
            // Clean up unquoted NaN, Infinity, and -Infinity values generated by Pandas/Python
            const formText = text
                .replace(/:\s*NaN\b/g, ': null')
                .replace(/:\s*Infinity\b/g, ': null')
                .replace(/:\s*-Infinity\b/g, ': null');
            try {
                return JSON.parse(formText);
            } catch (err) {
                throw new Error(`Failed to parse file data. ${err.message}. Raw preview: ${text.substring(0, 150)}`);
            }
        })
        .then(data => {
            hideLoading();
            if (data.success) {
                currentEditingFile = filename;
                editingRows = data.rows || [];
                editingColumns = data.columns || [];
                
                document.getElementById('editing-filename-label').innerText = `(${filename})`;
                document.getElementById('editor-instructions-pane').style.display = 'none';
                document.getElementById('editor-grid-container').style.display = 'block';
                
                // Determine if master using standard filename or is_master metadata flag
                const isMaster = filename === "seals.csv" || (allFilesList.find(f => f.name === filename) || {}).is_master;
                document.getElementById('editor-actions-panel').style.display = 'flex';
                
                const saveBtn = document.getElementById('btn-save-file');
                const addRowBtn = document.getElementById('btn-add-row');
                const delRowBtn = document.getElementById('btn-delete-row');
                
                if (isMaster) {
                    saveBtn.style.display = 'none';
                    addRowBtn.style.display = 'none';
                    delRowBtn.style.display = 'none';
                } else {
                    saveBtn.style.display = 'inline-block';
                    addRowBtn.style.display = 'inline-block';
                    delRowBtn.style.display = 'inline-block';
                }
                
                // Highlight active list item in UI selection list
                document.querySelectorAll('.csv-list-item').forEach(el => {
                    if (el.dataset.filename === filename) {
                        el.classList.add('active-editing');
                    } else {
                        el.classList.remove('active-editing');
                    }
                });
                
                renderEditorGrid();
            } else {
                alert("Could not load selected file: " + data.error);
            }
        })
        .catch(err => {
            hideLoading();
            alert("Error loading file: " + err.message);
            console.error("Error reading file:", err);
        });
}

// Render Editor Cells spreadsheet grid
function renderEditorGrid() {
    const listContainer = document.getElementById('editor-rows-list');
    listContainer.innerHTML = '';
    
    // 1. Force safety array casting on rows
    if (!editingRows || !Array.isArray(editingRows)) {
        editingRows = [];
    }
    
    // 2. Fallback: Automatically extract column keys from the first row if columns is null/empty
    if (!editingColumns || !Array.isArray(editingColumns)) {
        if (editingRows.length > 0) {
            editingColumns = Object.keys(editingRows[0]);
        } else {
            editingColumns = [];
        }
    }
    
    if (editingRows.length === 0) {
        listContainer.innerHTML = `<div style="padding: 20px; text-align: center; color: #777;">Empty File. Click 'Add Row' to fill structure rows.</div>`;
        return;
    }
    
    const isMaster = currentEditingFile === "seals.csv" || (allFilesList.find(f => f.name === currentEditingFile) || {}).is_master;
    
    // 3. Performance Limit: Only render up to 100 rows to prevent browser exhaustion on massive files (18000 rows)
    const maxRowsToRender = 100;
    const rowsToRender = editingRows.slice(0, maxRowsToRender);
    
    rowsToRender.forEach((row, i) => {
        const rowDiv = document.createElement('div');
        rowDiv.className = 'editor-row';
        
        const numLabel = document.createElement('div');
        numLabel.className = 'editor-row-num';
        numLabel.innerText = i + 1;
        rowDiv.appendChild(numLabel);
        
        const inputsContainer = document.createElement('div');
        inputsContainer.className = 'editor-row-inputs';
        
        editingColumns.forEach(col => {
            const inputGroup = document.createElement('div');
            inputGroup.className = 'editor-input-group';
            
            const label = document.createElement('label');
            label.innerText = col;
            
            const input = document.createElement('input');
            input.type = 'text';
            input.value = row[col] !== null && row[col] !== undefined ? row[col] : '';
            if (isMaster) input.disabled = true;
            
            // Dynamic data binding updates array values on change
            input.addEventListener('input', (e) => {
                editingRows[i][col] = e.target.value;
            });
            
            inputGroup.appendChild(label);
            inputGroup.appendChild(input);
            inputsContainer.appendChild(inputGroup);
        });
        
        rowDiv.appendChild(inputsContainer);
        listContainer.appendChild(rowDiv);
    });
    
    // 4. Render a warning banner if we hit the performance threshold limit
    if (editingRows.length > maxRowsToRender) {
        const warning = document.createElement('div');
        warning.style.padding = '15px';
        warning.style.textAlign = 'center';
        warning.style.color = '#b78103';
        warning.style.background = '#fffbeb';
        warning.style.border = '1px solid #ffe082';
        warning.style.borderRadius = '4px';
        warning.style.marginTop = '15px';
        warning.style.fontSize = '13px';
        warning.style.fontWeight = '500';
        warning.innerText = `Rendering first ${maxRowsToRender} of ${editingRows.length} total rows to save memory. Export the file using the index export button for further editing.`;
        listContainer.appendChild(warning);
    }
}

// Action: Add Row
function addNewRow() {
    if (!currentEditingFile) return;
    const newRow = {};
    editingColumns.forEach(col => {
        newRow[col] = ""; // Initialize empty cells
    });
    editingRows.push(newRow);
    renderEditorGrid();
    
    // Auto scroll down to newly added cells
    setTimeout(() => {
        const container = document.getElementById('editor-grid-container');
        container.scrollTop = container.scrollHeight;
    }, 50);
}

// Action: Delete Last Row 
function deleteLastRow() {
    if (!currentEditingFile || editingRows.length === 0) return;
    editingRows.pop();
    renderEditorGrid();
}

// API: Save File to Azure 
function saveFileToAzure() {
    if (!currentEditingFile) return;
    showLoading(`Saving ${currentEditingFile} to Cloud Storage...`);
    
    fetch(`/api/files/save/${encodeURIComponent(currentEditingFile)}`, { // Load JSON File
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows: editingRows }) // Send data
    })
    .then(res => res.json())
    .then(data => {
        hideLoading();
        if (data.success) {
            alert(`File saved to cloud directory successfully!`); // Notifications
        } else {
            alert("Error saving: " + data.error);
        }
    })
    .catch(err => {
        hideLoading();
        console.error("Save error:", err);
    });
}

// API: Create New Custom File
function createNewFile() {
    const filename = prompt("Enter a unique name for your custom dataset file:");
    if (!filename) return; // Pop up question for file name
    
    showLoading("Generating file structural frame..."); // Loading Page
    
    fetch('/api/files/create', { // Load Jason File
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: filename })
    })
    .then(res => res.json()) 
    .then(data => {
        if (data.success) {
            fetchFilesIndex(); // Refresh Index list
            loadFileIntoEditor(data.filename); // Instantly load into workspace
        } else {
            hideLoading(); 
            alert("Error: " + data.error);
        }
    })
    .catch(err => {
        hideLoading();
        console.error("Create file error:", err);
    });
}

// API: Delete Selected Custom File 
function deleteActiveFile() {
    if (!currentEditingFile) {
        alert("Select a file from the Index list first.");
        return;
    }
    const isMaster = currentEditingFile === "seals.csv" || (allFilesList.find(f => f.name === currentEditingFile) || {}).is_master;
    if (isMaster) {
        alert("Protected Master dataset files cannot be deleted.");
        return;
    }
    
    if (!confirm(`Are you sure you want to permanently delete '${currentEditingFile}' from cloud directories?`)) {
        return;
    }
    
    showLoading("Removing file from cloud storage...");
    
    fetch('/api/files/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: currentEditingFile })
    })
    .then(res => res.json())
    .then(data => {
        if (data.success) {
            currentEditingFile = null;
            document.getElementById('editing-filename-label').innerText = "(Select a file to edit)";
            document.getElementById('editor-grid-container').style.display = 'none';
            document.getElementById('editor-actions-panel').style.display = 'none';
            document.getElementById('editor-instructions-pane').style.display = 'block';
            fetchFilesIndex();
        } else {
            hideLoading();
            alert("Error deleting file: " + data.error);
        }
    })
    .catch(err => {
        hideLoading();
        console.error("Delete file error:", err);
    });
}

// Action: Download/Export CSV File
function exportActiveFile() {
    if (!currentEditingFile) {
        alert("Load a file in the workspace first to export.");
        return;
    }
    window.location.href = `/api/files/export/${encodeURIComponent(currentEditingFile)}`;
}

// API: Import Local CSV Upload
function importLocalCSV(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    showLoading("Importing and structural matching...");
    
    const formData = new FormData();
    formData.append('file', file);
    
    fetch('/api/files/import', {
        method: 'POST',
        body: formData
    })
    .then(res => res.json())
    .then(data => {
        // Reset file input
        e.target.value = '';
        if (data.success) {
            fetchFilesIndex();
            loadFileIntoEditor(data.filename);
        } else {
            hideLoading();
            alert("Import error: " + data.error);
        }
    })
    .catch(err => {
        hideLoading();
        e.target.value = '';
        console.error("Import error:", err);
    });
}

// Action: Merge Selected Datasets & Apply View Cache 
function applySelection() {
    const checkedCheckboxes = document.querySelectorAll('.file-select-checkbox:checked'); // Get all the files selected
    const selected = Array.from(checkedCheckboxes).map(cb => cb.value); // 
    
    if (selected.length === 0) {
        alert("Please select at least one dataset to compile.");
        return;
    }
    
    showLoading("Compiling selected datasets...");
    
    // Cache selections to LocalStorage for persistent sessions
    const selectionString = selected.join(',');
    localStorage.setItem('selected_seal_files', selectionString);
    
    // Refresh page with active parameters causing Folium & Pandas to merge arrays
    window.location.search = `?files=${encodeURIComponent(selectionString)}`;
}