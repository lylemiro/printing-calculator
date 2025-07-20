let inventory = {};
let priceBW = 1;
let priceColor = 5;
let history = [];
let usageChart;
let initialEstimatedProfitBW = 0;
let initialEstimatedProfitColor = 0;

let isEditingInventory = false;

let printJobTypes = {};

// --- Setup Modal Functions ---
function showSetupModal() {
  document.getElementById('setupModalOverlay').classList.add('show');
  document.getElementById('setupA4Count').value = inventory['A4'] !== undefined ? inventory['A4'] : 500;
  document.getElementById('setupLetterCount').value = inventory['Letter'] !== undefined ? inventory['Letter'] : 500;
  document.getElementById('setupLegalCount').value = inventory['Legal'] !== undefined ? inventory['Legal'] : 500;
  document.getElementById('setupPriceBW').value = priceBW;
  document.getElementById('setupPriceColor').value = priceColor;
}

function hideSetupModal() {
  document.getElementById('setupModalOverlay').classList.remove('show');
}

function saveInitialSetup() {
  inventory = {};
  inventory['A4'] = Math.max(0, parseInt(document.getElementById('setupA4Count').value) || 0);
  inventory['Letter'] = Math.max(0, parseInt(document.getElementById('setupLetterCount').value) || 0);
  inventory['Legal'] = Math.max(0, parseInt(document.getElementById('setupLegalCount').value) || 0);
  priceBW = Math.max(0, parseFloat(document.getElementById('setupPriceBW').value) || 0);
  priceColor = Math.max(0, parseFloat(document.getElementById('setupPriceColor').value) || 0);

  localStorage.setItem('isSetupComplete', 'true');
  calculateInitialEstimatedProfit();
  saveData();
  updateDisplay();
  renderChart();
  displayHistory();
  hideSetupModal();
}

// --- Add Paper Type Modal Functions ---
function showAddPaperModal() {
  document.getElementById('addPaperModalOverlay').classList.add('show');
  document.getElementById('newPaperTypeName').value = '';
  document.getElementById('newPaperTypeCount').value = 0;
}

function hideAddPaperModal() {
  document.getElementById('addPaperModalOverlay').classList.remove('show');
}

function addNewPaperType() {
  const newTypeName = document.getElementById('newPaperTypeName').value.trim();
  const newTypeCount = Math.max(0, parseInt(document.getElementById('newPaperTypeCount').value) || 0);

  if (!newTypeName) {
    alert('Please enter a name for the new paper type.');
    return;
  }
  if (inventory.hasOwnProperty(newTypeName)) {
    alert(`Paper type "${newTypeName}" already exists. Please choose a different name or update its count in the inventory.`);
    return;
  }

  inventory[newTypeName] = newTypeCount;
  calculateInitialEstimatedProfit();
  saveData();
  updateDisplay();
  hideAddPaperModal();
}

// --- Delete Paper Type Function ---
function deletePaperType(paperType) {
  if (confirm(`Are you sure you want to delete "${paperType}" from inventory? This cannot be undone.`)) {
    const hasHistoricalJobs = history.some(job => job.paperType === paperType);
    if (hasHistoricalJobs) {
      if (!confirm(`"${paperType}" has associated job history. Deleting it will keep historical records but future calculations might be affected if you re-add it with different properties. Continue?`)) {
        return;
      }
    }

    delete inventory[paperType];
    calculateInitialEstimatedProfit();
    saveData();
    updateDisplay();
  }
}

// --- Print Type Management Modal Functions ---
function showManagePrintTypesModal() {
    document.getElementById('managePrintTypesModalOverlay').classList.add('show');
    renderPrintTypeManagementList();
}

function hideManagePrintTypesModal() {
    document.getElementById('managePrintTypesModalOverlay').classList.remove('show');
}

function renderPrintTypeManagementList() {
    const listElement = document.getElementById('printTypeManagementList');
    listElement.innerHTML = '';

    for (const type in printJobTypes) {
        const li = document.createElement('li');
        li.dataset.originalName = type;
        li.innerHTML = `
            <input type="text" class="print-type-name-input" value="${type}">
            <label>Multiplier: <input type="number" step="0.01" class="print-type-multiplier-input" value="${printJobTypes[type].multiplier}"></label>
            <div class="item-actions">
                <button class="delete-btn" onclick="deletePrintTypeFromModal('${type}')">Delete</button>
            </div>
        `;
        listElement.appendChild(li);
    }
}

function addNewPrintType() {
    const newTypeName = document.getElementById('newPrintTypeName').value.trim();
    const newTypeMultiplier = Math.max(0, parseFloat(document.getElementById('newPrintTypeMultiplier').value) || 0);

    if (!newTypeName) {
        alert('Please enter a name for the new print type.');
        return;
    }
    if (printJobTypes.hasOwnProperty(newTypeName)) {
        alert(`Print type "${newTypeName}" already exists.`);
        return;
    }

    printJobTypes[newTypeName] = { multiplier: newTypeMultiplier };
    saveData();
    renderPrintTypeManagementList();
    populatePrintTypeDropdown();
    document.getElementById('newPrintTypeName').value = '';
    document.getElementById('newPrintTypeMultiplier').value = 1.0;
    alert(`Print type "${newTypeName}" added.`);
}

function deletePrintTypeFromModal(typeToDelete) {
    if (confirm(`Are you sure you want to delete print type "${typeToDelete}"? This cannot be undone.`)) {
        const hasHistoricalJobs = history.some(job => job.printType === typeToDelete);
        if (hasHistoricalJobs) {
            if (!confirm(`Print type "${typeToDelete}" has associated job history. Deleting it will keep historical records but future calculations might be affected if you re-add it with different properties. Continue?`)) {
                return;
            }
        }
        delete printJobTypes[typeToDelete];
        saveData();
        renderPrintTypeManagementList();
        populatePrintTypeDropdown();
        alert(`Print type "${typeToDelete}" deleted.`);
    }
}

function saveAllPrintTypeChanges() {
    const listItems = document.querySelectorAll('#printTypeManagementList li');
    const updatedPrintJobTypes = {};
    let hasError = false;

    listItems.forEach(li => {
        const oldName = li.dataset.originalName;
        const newNameInput = li.querySelector('.print-type-name-input');
        const newMultiplierInput = li.querySelector('.print-type-multiplier-input');

        const newName = newNameInput.value.trim();
        const newMultiplier = Math.max(0, parseFloat(newMultiplierInput.value) || 0);

        if (!newName) {
            alert('Print type name cannot be empty.');
            hasError = true;
            return;
        }
        if (updatedPrintJobTypes.hasOwnProperty(newName) && newName !== oldName) {
            alert(`Error: Duplicate print type name "${newName}". All print types must have unique names.`);
            hasError = true;
            return;
        }
         if (newName !== oldName && printJobTypes.hasOwnProperty(newName) && !Array.from(listItems).some(el => el.dataset.originalName === newName)) {
             alert(`Error: Print type "${newName}" already exists. Please choose a different name.`);
             hasError = true;
             return;
        }

        updatedPrintJobTypes[newName] = { multiplier: newMultiplier };
        
        if (newName !== oldName) {
            history.forEach(job => {
                if (job.printType === oldName) {
                    job.printType = newName;
                }
            });
        }
    });

    if (hasError) return;

    printJobTypes = updatedPrintJobTypes;
    saveData();
    updateDisplay();
    renderPrintTypeManagementList();
    alert('Print types updated successfully!');
}


// --- Data Loading & Saving ---
function loadData() {
    const storedInventory = localStorage.getItem('inventory');
    const storedPriceBW = localStorage.getItem('priceBW');
    const storedPriceColor = localStorage.getItem('priceColor');
    const storedHistory = localStorage.getItem('history');
    const storedInitialEstProfitBW = localStorage.getItem('initialEstimatedProfitBW');
    const storedInitialEstProfitColor = localStorage.getItem('initialEstimatedProfitColor');
    const storedPrintJobTypes = localStorage.getItem('printJobTypes');

    if (storedInventory) {
        inventory = JSON.parse(storedInventory);
    } else {
        inventory = { "A4": 500, "Letter": 500, "Legal": 500 };
    }

    if (storedPriceBW) priceBW = parseFloat(storedPriceBW);
    if (storedPriceColor) priceColor = parseFloat(storedPriceColor);
    if (storedHistory) history = JSON.parse(storedHistory);
    if (storedInitialEstProfitBW !== null) initialEstimatedProfitBW = parseFloat(storedInitialEstProfitBW);
    if (storedInitialEstProfitColor !== null) initialEstimatedProfitColor = parseFloat(storedInitialEstProfitColor);
    
    if (storedPrintJobTypes) {
        printJobTypes = JSON.parse(storedPrintJobTypes);
    } else {
        printJobTypes = { "Single-sided": { multiplier: 1 }, "Double-sided": { multiplier: 2 } };
    }
}

function saveData() {
    localStorage.setItem('inventory', JSON.stringify(inventory));
    localStorage.setItem('priceBW', priceBW);
    localStorage.setItem('priceColor', priceColor);
    localStorage.setItem('history', JSON.stringify(history));
    localStorage.setItem('initialEstimatedProfitBW', initialEstimatedProfitBW);
    localStorage.setItem('initialEstimatedProfitColor', initialEstimatedProfitColor);
    localStorage.setItem('printJobTypes', JSON.stringify(printJobTypes));
}

function calculateInitialEstimatedProfit() {
    let totalCurrentInventorySheets = 0;
    for (const type in inventory) {
        totalCurrentInventorySheets += inventory[type];
    }
    initialEstimatedProfitBW = totalCurrentInventorySheets * priceBW;
    initialEstimatedProfitColor = totalCurrentInventorySheets * priceColor;
    saveData();
}

// --- Inventory Edit Mode Functions ---
function toggleEditMode() {
    isEditingInventory = !isEditingInventory;
    updateDisplay();
}

function saveInventoryChanges() {
    const dynamicInventoryItemsDiv = document.getElementById('dynamicInventoryItems');
    const itemElements = dynamicInventoryItemsDiv.querySelectorAll('.inventory-item');
    const newInventory = {};
    const renamedItems = {};
    let hasError = false;

    itemElements.forEach(itemDiv => {
        const oldName = itemDiv.dataset.originalName;
        const newNameInput = itemDiv.querySelector('.item-name-input');
        const newCountInput = itemDiv.querySelector('.item-count-input');

        const newName = newNameInput.value.trim();
        const newCount = Math.max(0, parseInt(newCountInput.value) || 0);

        if (!newName) {
            alert('Paper type name cannot be empty for all items.');
            hasError = true;
            return;
        }

        if (newInventory.hasOwnProperty(newName) && newName !== oldName) {
            alert(`Error: Duplicate paper type name "${newName}". All paper types must have unique names.`);
            hasError = true;
            return;
        }
        if (newName !== oldName && inventory.hasOwnProperty(newName) && !Array.from(itemElements).some(el => el.dataset.originalName === newName)) {
             alert(`Error: Paper type "${newName}" already exists. Please choose a different name.`);
             hasError = true;
             return;
        }

        newInventory[newName] = newCount;
        if (newName !== oldName) {
            renamedItems[oldName] = newName;
        }
    });

    if (hasError) {
        return;
    }

    for (const oldName in renamedItems) {
        const newName = renamedItems[oldName];
        history.forEach(job => {
            if (job.paperType === oldName) {
                job.paperType = newName;
            }
        });
    }

    inventory = newInventory;

    priceBW = Math.max(0, parseFloat(document.getElementById('priceBW').value) || 0);
    priceColor = Math.max(0, parseFloat(document.getElementById('priceColor').value) || 0);

    isEditingInventory = false;
    calculateInitialEstimatedProfit();
    saveData();
    updateDisplay();
    alert('Inventory and prices updated successfully!');
}

function cancelEditMode() {
    isEditingInventory = false;
    loadData();
    updateDisplay();
    alert('Changes discarded.');
}

function renderInventory() {
  const dynamicInventoryItemsDiv = document.getElementById('dynamicInventoryItems');
  dynamicInventoryItemsDiv.innerHTML = '';

  for (const type in inventory) {
    const itemDiv = document.createElement('div');
    itemDiv.classList.add('inventory-item');
    itemDiv.dataset.originalName = type;

    if (isEditingInventory) {
        itemDiv.innerHTML = `
            <input type="text" class="item-name-input" value="${type}">
            <input type="number" class="item-count-input" value="${inventory[type]}">
            <div class="item-actions">
                <button class="delete-btn" onclick="deletePaperType('${type}')">Delete</button>
            </div>
        `;
    } else {
        itemDiv.innerHTML = `
            <span class="item-name-display">${type}:</span>
            <input type="number" class="item-count-input" value="${inventory[type]}" disabled>
        `;
    }
    dynamicInventoryItemsDiv.appendChild(itemDiv);
  }

  const editBtn = document.getElementById('editInventoryBtn');
  const addBtn = document.getElementById('addPaperTypeBtn');
  const resetBtn = document.getElementById('resetInventoryBtn');
  const cancelBtn = document.getElementById('cancelEditBtn');
  const priceBWInput = document.getElementById('priceBW');
  const priceColorInput = document.getElementById('priceColor');

  if (isEditingInventory) {
      editBtn.textContent = 'Save Changes';
      editBtn.onclick = saveInventoryChanges;
      cancelBtn.style.display = 'inline-block';
      addBtn.style.display = 'inline-block';
      resetBtn.style.display = 'none';
      priceBWInput.disabled = false;
      priceColorInput.disabled = false;
  } else {
      editBtn.textContent = 'Edit Inventory';
      editBtn.onclick = toggleEditMode;
      cancelBtn.style.display = 'none';
      addBtn.style.display = 'inline-block';
      resetBtn.style.display = 'inline-block';
      priceBWInput.disabled = true;
      priceColorInput.disabled = true;
  }
}

// --- Dropdown Population Functions ---
function populatePaperTypeDropdown() {
  const paperTypeSelect = document.getElementById('paperType');
  paperTypeSelect.innerHTML = '';

  const sortedPaperTypes = Object.keys(inventory).sort();

  sortedPaperTypes.forEach(type => {
    const option = document.createElement('option');
    option.value = type;
    option.textContent = type;
    paperTypeSelect.appendChild(option);
  });
}

function populatePrintTypeDropdown() {
    const printTypeSelect = document.getElementById('printType');
    printTypeSelect.innerHTML = '';

    const sortedPrintTypes = Object.keys(printJobTypes).sort();

    sortedPrintTypes.forEach(type => {
        const option = document.createElement('option');
        option.value = type;
        option.textContent = type;
        printTypeSelect.appendChild(option);
    });
}

// --- Initialization on DOM Load ---
document.addEventListener('DOMContentLoaded', () => {
    loadData();
    const isSetupComplete = localStorage.getItem('isSetupComplete');
    if (isSetupComplete !== 'true') {
        showSetupModal();
    } else {
        document.getElementById('priceBW').value = priceBW;
        document.getElementById('priceColor').value = priceColor;

        calculateInitialEstimatedProfit();

        updateDisplay();
        renderChart();
        displayHistory();
    }

    document.getElementById('bw').addEventListener('input', toggleAddPrintJobButton);
    document.getElementById('colored').addEventListener('input', toggleAddPrintJobButton);
    document.getElementById('rejectedBW').addEventListener('input', toggleAddPrintJobButton);
    document.getElementById('rejectedColor').addEventListener('input', toggleAddPrintJobButton);
    toggleAddPrintJobButton(); // Initial call to set button state on load
});

// --- Main Display Update ---
function updateDisplay() {
    renderInventory();
    populatePaperTypeDropdown();
    populatePrintTypeDropdown();
    
    document.getElementById('priceBW').value = priceBW;
    document.getElementById('priceColor').value = priceColor;

    document.getElementById('estProfitBW').textContent = initialEstimatedProfitBW.toFixed(2);
    document.getElementById('estProfitColor').textContent = initialEstimatedProfitColor.toFixed(2);

    updateTotals(history);
}

// --- Reset Inventory Function ---
function resetInventory() {
    if (confirm("Are you sure you want to reset all inventory counts? This will clear all job history and reset initial profit estimations.")) {
        inventory = { "A4": 500, "Letter": 500, "Legal": 500 };
        printJobTypes = { "Single-sided": { multiplier: 1 }, "Double-sided": { multiplier: 2 } };
        history = [];
        
        localStorage.setItem('isSetupComplete', 'false');
        isEditingInventory = false;

        saveData();
        
        showSetupModal();

        updateDisplay(); 
        renderChart();
        displayHistory();
        document.getElementById('filterDisplay').textContent = "Showing all data.";
    }
}

// --- Add Print Job Function ---
function addPrintJob() {
    const paperType = document.getElementById('paperType').value;
    const printTypeName = document.getElementById('printType').value;
    const bwPages = parseInt(document.getElementById('bw').value) || 0;
    const coloredPages = parseInt(document.getElementById('colored').value) || 0;
    const rejectedBW = parseInt(document.getElementById('rejectedBW').value) || 0;
    const rejectedColor = parseInt(document.getElementById('rejectedColor').value) || 0;

    if (!printTypeName || !printJobTypes.hasOwnProperty(printTypeName)) {
        alert('Please select a valid Print Type.');
        return;
    }

    const selectedPrintType = printJobTypes[printTypeName];
    const multiplier = selectedPrintType.multiplier;

    let paperConsumed = bwPages + coloredPages + rejectedBW + rejectedColor;

    if (inventory[paperType] === undefined || inventory[paperType] < paperConsumed) {
        alert(`Not enough ${paperType} paper! You need ${paperConsumed} sheets, but only have ${inventory[paperType] !== undefined ? inventory[paperType] : 0}.`);
        return;
    }

    inventory[paperType] -= paperConsumed;

    let effectivePriceBW = priceBW * multiplier;
    let effectivePriceColor = priceColor * multiplier;
    
    const totalCost = (bwPages * effectivePriceBW) + (coloredPages * effectivePriceColor);

    const lossBW = rejectedBW * priceBW;
    const lossColor = rejectedColor * priceColor;
    const totalLoss = lossBW + lossColor; 

    const netProfit = totalCost - totalLoss;

    const job = {
        date: new Date().toISOString().split('T')[0],
        paperType,
        printType: printTypeName,
        bwPages,
        coloredPages,
        rejectedBW,
        rejectedColor,
        paperConsumed,
        totalCost,
        totalLoss,
        netProfit
    };

    history.push(job);
    saveData();
    updateDisplay();
    displayHistory();
    renderChart();

    document.getElementById('bw').value = 0;
    document.getElementById('colored').value = 0;
    document.getElementById('rejectedBW').value = 0;
    document.getElementById('rejectedColor').value = 0;
    toggleAddPrintJobButton(); // Disable button after adding job
}

// --- Toggle Add Print Job Button State ---
function toggleAddPrintJobButton() {
    const bw = parseInt(document.getElementById('bw').value) || 0;
    const colored = parseInt(document.getElementById('colored').value) || 0;
    const rejectedBW = parseInt(document.getElementById('rejectedBW').value) || 0;
    const rejectedColor = parseInt(document.getElementById('rejectedColor').value) || 0;
    
    const addButton = document.getElementById('addPrintJobBtn');

    // Debugging: Log values to console
    console.log(`BW: ${bw}, Colored: ${colored}, RejectedBW: ${rejectedBW}, RejectedColor: ${rejectedColor}`);

    if (bw === 0 && colored === 0 && rejectedBW === 0 && rejectedColor === 0) {
        addButton.disabled = true;
        console.log("Add Print Job button disabled.");
    } else {
        addButton.disabled = false;
        console.log("Add Print Job button enabled.");
    }
}

// --- Display History Function ---
function displayHistory(filteredHistory = history) {
    const historyList = document.getElementById('history');
    historyList.innerHTML = '';

    const sortedHistory = [...filteredHistory].sort((a, b) => new Date(b.date) - new Date(a.date));

    if (sortedHistory.length === 0 && filteredHistory.length > 0) {
         historyList.innerHTML = '<li>No jobs found for the selected date range.</li>';
    } else if (sortedHistory.length === 0) {
         historyList.innerHTML = '<li>No jobs have been added yet.</li>';
    }

    sortedHistory.forEach((job, index) => {
        const listItem = document.createElement('li');
        listItem.innerHTML = `
            <strong>${job.date}</strong> - ${job.paperType.toUpperCase()} (${job.printType})<br>
            B&W Sheets: ${job.bwPages} (Rejected: ${job.rejectedBW})<br>
            Colored Sheets: ${job.coloredPages} (Rejected: ${job.rejectedColor})<br>
            Total Sheets Used: ${job.paperConsumed}<br>
            Profit: ₱${job.netProfit.toFixed(2)} | Loss: ₱${job.totalLoss.toFixed(2)}
        `;
        historyList.appendChild(listItem); // Corrected this line
    });
}

// --- Update Totals Function ---
function updateTotals(dataForPeriod = history) {
    let totalProfitForPeriod = 0;
    let totalLossForPeriod = 0;
    let totalBWSuccessfulSheetsPrintedOverall = 0;
    let totalColoredSuccessfulSheetsPrintedOverall = 0;

    dataForPeriod.forEach(job => {
        totalProfitForPeriod += job.netProfit;
        totalLossForPeriod += job.totalLoss;
    });

    history.forEach(job => {
        totalBWSuccessfulSheetsPrintedOverall += job.bwPages;
        totalColoredSuccessfulSheetsPrintedOverall += job.coloredPages;
    });

    const currentPriceBW = priceBW; 
    const currentPriceColor = priceColor;

    let profitLeftBW = initialEstimatedProfitBW - (totalBWSuccessfulSheetsPrintedOverall * currentPriceBW);
    let profitLeftColor = initialEstimatedProfitColor - (totalColoredSuccessfulSheetsPrintedOverall * currentPriceColor);

    profitLeftBW = Math.max(0, profitLeftBW);
    profitLeftColor = Math.max(0, profitLeftColor);

    document.getElementById('totalProfit').textContent = totalProfitForPeriod.toFixed(2);
    document.getElementById('totalLoss').textContent = totalLossForPeriod.toFixed(2);
    document.getElementById('profitLeftBW').textContent = profitLeftBW.toFixed(2);
    document.getElementById('profitLeftColor').textContent = profitLeftColor.toFixed(2);
}

// --- Filter Functions ---
function filterByDate() {
    const startDate = document.getElementById('startDate').value;
    const endDate = document.getElementById('endDate').value;
    const filterDisplay = document.getElementById('filterDisplay');

    let filtered = history;
    let displayMessage = "Showing all data.";

    if (startDate && endDate) {
        filtered = history.filter(job => {
            const jobDate = new Date(job.date);
            const start = new Date(startDate);
            const end = new Date(endDate);
            end.setDate(end.getDate() + 1);
            return jobDate >= start && jobDate < end;
        });
        displayMessage = `Showing data from <strong>${startDate}</strong> to <strong>${endDate}</strong>.`;
    } else if (startDate) {
        filtered = history.filter(job => new Date(job.date) >= new Date(startDate));
        displayMessage = `Showing data from <strong>${startDate}</strong> onwards.`;
    } else if (endDate) {
        const end = new Date(endDate);
        end.setDate(end.getDate() + 1);
        filtered = history.filter(job => new Date(job.date) < end);
        displayMessage = `Showing data up to <strong>${endDate}</strong>.`;
    }

    displayHistory(filtered);
    updateTotals(filtered);
    renderChart(filtered);
    filterDisplay.innerHTML = displayMessage;
}

function clearDateFilter() {
    document.getElementById('startDate').value = '';
    document.getElementById('endDate').value = '';
    document.getElementById('filterDisplay').textContent = "Showing all data.";
    displayHistory();
    updateTotals(history);
    renderChart();
}

// --- Export & Print Functions ---
function exportToFile() {
    const data = JSON.stringify({
        inventory,
        priceBW,
        priceColor,
        history,
        initialEstimatedProfitBW,
        initialEstimatedProfitColor,
        printJobTypes
    }, null, 2);

    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const today = new Date().toISOString().split('T')[0];
    a.download = `printing_calculator_data_${today}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function renderChart(dataToChart = history) {
    const ctx = document.getElementById('usageChart').getContext('2d');

    if (!ctx) {
        return;
    }

    const dailyData = {};
    dataToChart.forEach(job => {
        if (!dailyData[job.date]) {
            dailyData[job.date] = { profit: 0, loss: 0 };
        }
        dailyData[job.date].profit += job.netProfit;
        dailyData[job.date].loss += job.totalLoss;
    });

    const dates = Object.keys(dailyData).sort();
    const profits = dates.map(date => dailyData[date].profit);
    const losses = dates.map(date => dailyData[date].loss);

    if (usageChart) {
        usageChart.destroy();
    }

    try {
        usageChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: dates,
                datasets: [{
                    label: 'Total Profit',
                    data: profits,
                    borderColor: '#4CAF50',
                    backgroundColor: 'rgba(76, 175, 80, 0.2)',
                    tension: 0.3,
                    fill: true
                }, {
                    label: 'Total Loss',
                    data: losses,
                    borderColor: '#F44336',
                    backgroundColor: 'rgba(244, 67, 54, 0.2)',
                    tension: 0.3,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Date',
                            color: '#2c3e50'
                        },
                        ticks: {
                            color: '#555'
                        },
                        grid: {
                            color: 'rgba(0, 0, 0, 0.05)'
                        }
                    },
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Amount (₱)',
                            color: '#2c3e50'
                        },
                        ticks: {
                            color: '#555'
                        },
                        grid: {
                            color: 'rgba(0, 0, 0, 0.05)'
                        }
                    }
                },
                plugins: {
                    legend: {
                        labels: {
                            color: '#2c3e50'
                        }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(0,0,0,0.8)',
                        titleColor: '#fff',
                        bodyColor: '#fff'
                    }
                }
            }
        });
    } catch (error) {
        console.error("Error rendering chart:", error);
    }
}

function printSummaryReport() {
    document.body.classList.add('print-summary-only');

    setTimeout(() => {
        window.print();
    }, 100);

    window.onafterprint = () => {
        document.body.classList.remove('print-summary-only');
    };
    setTimeout(() => {
        document.body.classList.remove('print-summary-only');
    }, 1000);
}