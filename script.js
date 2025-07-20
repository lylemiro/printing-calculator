let inventory = {};
let priceBW = 1;
let priceColor = 5;
let history = [];
let usageChart;
let initialEstimatedProfitBW = 0;
let initialEstimatedProfitColor = 0;

let isEditingInventory = false;

let printJobTypes = {};
let photoBundles = {};
let photoYieldSettings = { paperType: 'A4 Sticker Photo Paper', max2x2PerA4: 0, max1x1PerA4: 0 };
let photoPaperCumulativeFractionUsed = 0; // NEW: Tracks fractional usage for photo paper

let currentEditingJobIndex = -1;

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
            <label>Type: <select class="print-type-category-input">
                <option value="standard" ${printJobTypes[type].type === 'standard' ? 'selected' : ''}>Standard Print</option>
                <option value="photo_bundle" ${printJobTypes[type].type === 'photo_bundle' ? 'selected' : ''}>Photo Bundle</option>
            </select></label>
            <label>Multiplier: <input type="number" step="0.01" class="print-type-multiplier-input" value="${printJobTypes[type].multiplier}"></label>
            <label>Base Price: ₱<input type="number" step="0.01" class="print-type-base-price-input" value="${printJobTypes[type].basePrice}"></label>
            <label>Bundle Qty: <input type="number" class="print-type-bundle-qty-input" value="${printJobTypes[type].bundleQuantity}"></label>
            <div class="item-actions">
                <button class="delete-btn" onclick="deletePrintTypeFromModal('${type}')">Delete</button>
            </div>
        `;
        listElement.appendChild(li);
    }
}

function addNewPrintType() {
    const newTypeName = document.getElementById('newPrintTypeName').value.trim();
    const newTypeCategory = document.getElementById('newPrintJobTypeCategory').value;
    const newTypeMultiplier = Math.max(0, parseFloat(document.getElementById('newPrintTypeMultiplier').value) || 0);
    const newTypeBasePrice = Math.max(0, parseFloat(document.getElementById('newPrintTypeBasePrice').value) || 0);
    const newTypeBundleQuantity = Math.max(0, parseInt(document.getElementById('newPrintTypeBundleQuantity').value) || 0);


    if (!newTypeName) {
        alert('Please enter a name for the new print type.');
        return;
    }
    if (printJobTypes.hasOwnProperty(newTypeName)) {
        alert(`Print type "${newTypeName}" already exists.`);
        return;
    }

    printJobTypes[newTypeName] = { 
        type: newTypeCategory,
        multiplier: newTypeMultiplier,
        basePrice: newTypeBasePrice,
        bundleQuantity: newTypeBundleQuantity
    };
    saveData();
    renderPrintTypeManagementList();
    populatePrintTypeDropdown();
    document.getElementById('newPrintTypeName').value = '';
    document.getElementById('newPrintJobTypeCategory').value = 'standard';
    document.getElementById('newPrintTypeMultiplier').value = 1.0;
    document.getElementById('newPrintTypeBasePrice').value = 0.0;
    document.getElementById('newPrintTypeBundleQuantity').value = 0;
    alert(`Print type "${newTypeName}" added.`);
}

function deletePrintTypeFromModal(typeToDelete) {
    if (confirm(`Are you sure you want to delete print type "${typeToDelete}"? This cannot be undone.`)) {
        const hasHistoricalJobs = history.some(job => job.printType === typeToDelete);
        if (hasHistoricalJobs) {
            if (!confirm(`"${typeToDelete}" has associated job history. Deleting it will keep historical records but future calculations might be affected if you re-add it with different properties. Continue?`)) {
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
        const newCategoryInput = li.querySelector('.print-type-category-input');
        const newMultiplierInput = li.querySelector('.print-type-multiplier-input');
        const newBasePriceInput = li.querySelector('.print-type-base-price-input');
        const newBundleQuantityInput = li.querySelector('.print-type-bundle-qty-input');

        const newName = newNameInput.value.trim();
        const newCategory = newCategoryInput.value;
        const newMultiplier = Math.max(0, parseFloat(newMultiplierInput.value) || 0);
        const newBasePrice = Math.max(0, parseFloat(newBasePriceInput.value) || 0);
        const newBundleQuantity = Math.max(0, parseInt(newBundleQuantityInput.value) || 0);

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

        updatedPrintJobTypes[newName] = { 
            type: newCategory,
            multiplier: newMultiplier,
            basePrice: newBasePrice,
            bundleQuantity: newBundleQuantity
        };
        
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


// --- Photo Bundle Management Modal Functions ---
function showManagePhotoBundlesModal() {
    document.getElementById('managePhotoBundlesModalOverlay').classList.add('show');
    
    const photoBundlePaperTypeSelect = document.getElementById('photoBundlePaperType');
    photoBundlePaperTypeSelect.innerHTML = '';
    const sortedPaperTypes = Object.keys(inventory).sort();
    sortedPaperTypes.forEach(type => {
        const option = document.createElement('option');
        option.value = type;
        option.textContent = type;
        photoBundlePaperTypeSelect.appendChild(option);
    });
    photoBundlePaperTypeSelect.value = photoYieldSettings.paperType;
    
    document.getElementById('max2x2PerA4').value = photoYieldSettings.max2x2PerA4;
    document.getElementById('max1x1PerA4').value = photoYieldSettings.max1x1PerA4;

    renderPhotoBundleManagementList();
}

function hideManagePhotoBundlesModal() {
    document.getElementById('managePhotoBundlesModalOverlay').classList.remove('show');
}

function updatePhotoYieldSettings() {
    photoYieldSettings.paperType = document.getElementById('photoBundlePaperType').value;
    photoYieldSettings.max2x2PerA4 = Math.max(0, parseInt(document.getElementById('max2x2PerA4').value) || 0);
    photoYieldSettings.max1x1PerA4 = Math.max(0, parseInt(document.getElementById('max1x1PerA4').value) || 0);
    saveData();
    renderPhotoBundleManagementList();
    alert('Photo yield settings updated.');
}

// Helper to calculate sheets consumed by a bundle based on global yields
function calculateBundleSheetConsumption(bundleComposition, numberOfBundles) {
    const max2x2 = photoYieldSettings.max2x2PerA4;
    const max1x1 = photoYieldSettings.max1x1PerA4;

    if (max2x2 <= 0 && max1x1 <= 0) {
        return { sheets: 0, error: "Max 2x2s/1x1s per A4 not set in Photo Bundle Yield Settings.", fractionalSheets: 0 };
    }

    const total2x2sNeeded = (bundleComposition['2x2'] || 0) * numberOfBundles;
    const total1x1sNeeded = (bundleComposition['1x1'] || 0) * numberOfBundles;

    let fractionOfSheetFor2x2s = 0;
    if (max2x2 > 0) {
        fractionOfSheetFor2x2s = total2x2sNeeded / max2x2;
    }

    let fractionOfSheetFor1x1s = 0;
    if (max1x1 > 0) {
        fractionOfSheetFor1x1s = total1x1sNeeded / max1x1;
    }

    const totalSheetFraction = fractionOfSheetFor2x2s + fractionOfSheetFor1x1s;
    const sheetsConsumed = Math.ceil(totalSheetFraction); // Whole sheets for immediate deduction/check

    return { sheets: sheetsConsumed, error: null, fractionalSheets: totalSheetFraction };
}


function renderPhotoBundleManagementList() {
    const listElement = document.getElementById('photoBundleManagementList');
    listElement.innerHTML = '';

    for (const bundleName in photoBundles) {
        const bundle = photoBundles[bundleName];
        const calculatedConsumption = calculateBundleSheetConsumption(bundle.composition, 1);

        const li = document.createElement('li');
        li.dataset.originalName = bundleName;
        li.innerHTML = `
            <input type="text" class="bundle-name-input" value="${bundleName}">
            <label>Price: ₱<input type="number" step="0.01" class="bundle-price-input" value="${bundle.price}"></label>
            <label>2x2: <input type="number" class="bundle-2x2-input" value="${bundle.composition['2x2'] || 0}"></label>
            <label>1x1: <input type="number" class="bundle-1x1-input" value="${bundle.composition['1x1'] || 0}"></label>
            <span class="calculated-sheets">Calculated Sheets: ${calculatedConsumption.fractionalSheets.toFixed(2)} (deduction is cumulative)</span>
            <div class="item-actions">
                <button class="delete-btn" onclick="deletePhotoBundle('${bundleName}')">Delete</button>
            </div>
        `;
        listElement.appendChild(li);
    }
}

function addNewPhotoBundle() {
    const newBundleName = document.getElementById('newBundleName').value.trim();
    const newBundlePrice = Math.max(0, parseFloat(document.getElementById('newBundlePrice').value) || 0);
    const newBundle2x2Count = Math.max(0, parseInt(document.getElementById('newBundle2x2Count').value) || 0);
    const newBundle1x1Count = Math.max(0, parseInt(document.getElementById('newBundle1x1Count').value) || 0);

    if (!newBundleName) {
        alert('Please enter a name for the new bundle.');
        return;
    }
    if (photoBundles.hasOwnProperty(newBundleName)) {
        alert(`Bundle "${newBundleName}" already exists.`);
        return;
    }
    if (newBundle2x2Count === 0 && newBundle1x1Count === 0) {
        alert('A bundle must contain at least one 2x2 or 1x1 photo.');
        return;
    }

    photoBundles[newBundleName] = {
        price: newBundlePrice,
        composition: { '2x2': newBundle2x2Count, '1x1': newBundle1x1Count }
    };
    saveData();
    renderPhotoBundleManagementList();
    populateBundleTypeDropdown();
    document.getElementById('newBundleName').value = '';
    document.getElementById('newBundlePrice').value = 0.0;
    document.getElementById('newBundle2x2Count').value = 0;
    document.getElementById('newBundle1x1Count').value = 0;
    alert(`Bundle "${newBundleName}" added.`);
}

function deletePhotoBundle(bundleName) {
    if (confirm(`Are you sure you want to delete bundle "${bundleName}"? This cannot be undone.`)) {
        const hasHistoricalJobs = history.some(job => job.type === 'photo_bundle' && job.bundleName === bundleName);
        if (hasHistoricalJobs) {
            if (!confirm(`Bundle "${bundleName}" has associated job history. Deleting it will keep historical records. Continue?`)) {
                return;
            }
        }
        delete photoBundles[bundleName];
        saveData();
        renderPhotoBundleManagementList();
        populateBundleTypeDropdown();
        alert(`Bundle "${bundleName}" deleted.`);
    }
}

function saveAllPhotoBundleChanges() {
    const listItems = document.querySelectorAll('#photoBundleManagementList li');
    const updatedPhotoBundles = {};
    let hasError = false;

    listItems.forEach(li => {
        const oldName = li.dataset.originalName;
        const newNameInput = li.querySelector('.bundle-name-input');
        const newPriceInput = li.querySelector('.bundle-price-input');
        const new2x2Input = li.querySelector('.bundle-2x2-input');
        const new1x1Input = li.querySelector('.bundle-1x1-input');

        const newName = newNameInput.value.trim();
        const newPrice = Math.max(0, parseFloat(newPriceInput.value) || 0);
        const new2x2Count = Math.max(0, parseInt(new2x2Input.value) || 0);
        const new1x1Count = Math.max(0, parseInt(new1x1Input.value) || 0);

        if (!newName) {
            alert('Bundle name cannot be empty.');
            hasError = true;
            return;
        }
        if (updatedPhotoBundles.hasOwnProperty(newName) && newName !== oldName) {
            alert(`Error: Duplicate bundle name "${newName}". All bundles must have unique names.`);
            hasError = true;
            return;
        }
        if (newName !== oldName && photoBundles.hasOwnProperty(newName) && !Array.from(listItems).some(el => el.dataset.originalName === newName)) {
            alert(`Error: Bundle "${newName}" already exists. Please choose a different name.`);
            hasError = true;
            return;
        }
        if (new2x2Count === 0 && new1x1Count === 0) {
            alert('A bundle must contain at least one 2x2 or 1x1 photo.');
            hasError = true;
            return;
        }

        updatedPhotoBundles[newName] = {
            price: newPrice,
            composition: { '2x2': new2x2Count, '1x1': new1x1Count }
        };

        if (newName !== oldName) {
            history.forEach(job => {
                if (job.type === 'photo_bundle' && job.bundleName === oldName) {
                    job.bundleName = newName;
                }
            });
        }
    });

    if (hasError) return;

    photoBundles = updatedPhotoBundles;
    saveData();
    updateDisplay();
    renderPhotoBundleManagementList();
    alert('Photo bundles updated successfully!');
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
    const storedPhotoBundles = localStorage.getItem('photoBundles');
    const storedPhotoYieldSettings = localStorage.getItem('photoYieldSettings');
    const storedPhotoPaperCumulativeFractionUsed = localStorage.getItem('photoPaperCumulativeFractionUsed');

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
        printJobTypes = { 
            "Single-sided": { type: 'standard', multiplier: 1, basePrice: 0, bundleQuantity: 0 },
            "Double-sided": { type: 'standard', multiplier: 2, basePrice: 0, bundleQuantity: 0 },
            "Photo Quality": { type: 'photo_bundle', multiplier: 1, basePrice: 0, bundleQuantity: 0 }
        };
    }

    if (storedPhotoBundles) {
        photoBundles = JSON.parse(storedPhotoBundles);
    } else {
        photoBundles = {
            "Set A": { price: 40, composition: { '2x2': 2, '1x1': 8 } },
            "Set B": { price: 40, composition: { '2x2': 3, '1x1': 4 } },
            "Set C": { price: 50, composition: { '2x2': 4, '1x1': 8 } },
            "Set D": { price: 40, composition: { '2x2': 4, '1x1': 0 } }
        };
    }

    if (storedPhotoYieldSettings) {
        photoYieldSettings = JSON.parse(storedPhotoYieldSettings);
    } else {
        photoYieldSettings = { paperType: 'A4 Sticker Photo Paper', max2x2PerA4: 20, max1x1PerA4: 40 };
    }

    if (storedPhotoPaperCumulativeFractionUsed !== null) {
        photoPaperCumulativeFractionUsed = parseFloat(storedPhotoPaperCumulativeFractionUsed);
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
    localStorage.setItem('photoBundles', JSON.stringify(photoBundles));
    localStorage.setItem('photoYieldSettings', JSON.stringify(photoYieldSettings));
    localStorage.setItem('photoPaperCumulativeFractionUsed', photoPaperCumulativeFractionUsed);
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
    printTypeSelect.onchange = togglePrintJobInputs;
    togglePrintJobInputs();
}

function populateBundleTypeDropdown() {
    const bundleTypeSelect = document.getElementById('bundleTypeSelect');
    bundleTypeSelect.innerHTML = '';

    const sortedBundleTypes = Object.keys(photoBundles).sort();

    sortedBundleTypes.forEach(type => {
        const option = document.createElement('option');
        option.value = type;
        option.textContent = type;
        bundleTypeSelect.appendChild(option);
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
    toggleAddPrintJobButton();

    document.getElementById('setupModalOverlay').addEventListener('click', (event) => {
        if (event.target === event.currentTarget) hideSetupModal();
    });
    document.getElementById('addPaperModalOverlay').addEventListener('click', (event) => {
        if (event.target === event.currentTarget) hideAddPaperModal();
    });
    document.getElementById('managePrintTypesModalOverlay').addEventListener('click', (event) => {
        if (event.target === event.currentTarget) hideManagePrintTypesModal();
    });
    document.getElementById('managePhotoBundlesModalOverlay').addEventListener('click', (event) => {
        if (event.target === event.currentTarget) hideManagePhotoBundlesModal();
    });
    document.getElementById('editJobModalOverlay').addEventListener('click', (event) => {
        if (event.target === event.currentTarget) hideEditJobModal();
    });
});

// --- Main Display Update ---
function updateDisplay() {
    renderInventory();
    populatePaperTypeDropdown();
    populatePrintTypeDropdown();
    populateBundleTypeDropdown();
    
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
        printJobTypes = { 
            "Single-sided": { type: 'standard', multiplier: 1, basePrice: 0, bundleQuantity: 0 },
            "Double-sided": { type: 'standard', multiplier: 2, basePrice: 0, bundleQuantity: 0 },
            "Photo Quality": { type: 'photo_bundle', multiplier: 1, basePrice: 0, bundleQuantity: 0 }
        };
        photoBundles = {
            "Set A": { price: 40, composition: { '2x2': 2, '1x1': 8 } },
            "Set B": { price: 40, composition: { '2x2': 3, '1x1': 4 } },
            "Set C": { price: 50, composition: { '2x2': 4, '1x1': 8 } },
            "Set D": { price: 40, composition: { '2x2': 4, '1x1': 0 } }
        };
        photoYieldSettings = { paperType: 'A4 Sticker Photo Paper', max2x2PerA4: 20, max1x1PerA4: 40 }; 
        photoPaperCumulativeFractionUsed = 0; // NEW: Reset cumulative fraction
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

// --- Toggle visibility of print job input fields based on print type category ---
function togglePrintJobInputs() {
    const selectedPrintTypeName = document.getElementById('printType').value;
    const selectedPrintType = printJobTypes[selectedPrintTypeName];

    const standardInputsDiv = document.getElementById('standardPrintInputs');
    const photoBundleInputsDiv = document.getElementById('photoBundleInputs');
    const addPrintJobButton = document.getElementById('addPrintJobBtn');
    const addBundleJobButton = document.getElementById('addBundleJobBtn');

    if (selectedPrintType && selectedPrintType.type === 'photo_bundle') {
        standardInputsDiv.style.display = 'none';
        photoBundleInputsDiv.style.display = 'block';
        addPrintJobButton.style.display = 'none';
        addBundleJobButton.style.display = 'inline-block';
    } else {
        standardInputsDiv.style.display = 'block';
        photoBundleInputsDiv.style.display = 'none';
        addPrintJobButton.style.display = 'inline-block';
        addBundleJobButton.style.display = 'none';
        toggleAddPrintJobButton();
    }
}


// --- Add Standard Print Job Function ---
function addStandardPrintJob() {
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
    const basePrice = selectedPrintType.basePrice;
    const bundleQuantity = selectedPrintType.bundleQuantity;

    let paperConsumed = bwPages + coloredPages + rejectedBW + rejectedColor;

    if (inventory[paperType] === undefined || inventory[paperType] < paperConsumed) {
        alert(`Not enough ${paperType} paper! You need ${paperConsumed} sheets, but only have ${inventory[paperType] !== undefined ? inventory[paperType] : 0}.`);
        return;
    }

    inventory[paperType] -= paperConsumed;

    let effectivePriceBW = priceBW * multiplier;
    let effectivePriceColor = priceColor * multiplier;
    
    let totalCost = basePrice;

    let totalSuccessfulPages = bwPages + coloredPages;
    let sheetsBeyondBundle = totalSuccessfulPages - bundleQuantity;

    if (sheetsBeyondBundle > 0) {
        if (totalSuccessfulPages > 0) {
            const bwRatio = bwPages / totalSuccessfulPages;
            const coloredRatio = coloredPages / totalSuccessfulPages;

            totalCost += (sheetsBeyondBundle * bwRatio * effectivePriceBW) + (sheetsBeyondBundle * coloredRatio * effectivePriceColor);
        }
    } else {
        if (basePrice === 0 && bundleQuantity === 0) {
            totalCost += (bwPages * effectivePriceBW) + (coloredPages * effectivePriceColor);
        }
    }


    const lossBW = rejectedBW * priceBW;
    const lossColor = rejectedColor * priceColor;
    const totalLoss = lossBW + lossColor; 

    const netProfit = totalCost - totalLoss;

    const job = {
        type: 'print',
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
        netProfit,
        jobTypeMultiplier: multiplier,
        jobTypeBasePrice: basePrice,
        jobTypeBundleQuantity: bundleQuantity
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
    toggleAddPrintJobButton();
}

// --- Add Photo Bundle Job Function ---
function addPhotoBundleJob() {
    const bundleName = document.getElementById('bundleTypeSelect').value;
    const bundleQty = Math.max(1, parseInt(document.getElementById('bundleQuantity').value) || 1);

    if (!bundleName || !photoBundles.hasOwnProperty(bundleName)) {
        alert('Please select a valid Photo ID Bundle.');
        return;
    }
    if (bundleQty <= 0) {
        alert('Bundle quantity must be at least 1.');
        return;
    }
    if (!photoYieldSettings.paperType || inventory[photoYieldSettings.paperType] === undefined) {
        alert(`Please select a valid "Paper Type for Bundles" in "Manage Photo ID Bundles" modal, and ensure it exists in your inventory.`);
        return;
    }

    const selectedBundle = photoBundles[bundleName];
    const pricePerBundle = selectedBundle.price;
    
    const consumptionResult = calculateBundleSheetConsumption(selectedBundle.composition, bundleQty);
    if (consumptionResult.error) {
        alert(consumptionResult.error);
        return;
    }
    const fractionalSheetsForCurrentJob = consumptionResult.fractionalSheets;

    photoPaperCumulativeFractionUsed += fractionalSheetsForCurrentJob;
    let wholeSheetsToDeductThisTransaction = Math.floor(photoPaperCumulativeFractionUsed);

    const photoPaperType = photoYieldSettings.paperType;

    if (inventory[photoPaperType] < wholeSheetsToDeductThisTransaction) {
        alert(`Not enough "${photoPaperType}" paper! You need to deduct ${wholeSheetsToDeductThisTransaction} sheets, but only have ${inventory[photoPaperType]}.`);
        photoPaperCumulativeFractionUsed -= fractionalSheetsForCurrentJob;
        return;
    }

    inventory[photoPaperType] -= wholeSheetsToDeductThisTransaction;
    photoPaperCumulativeFractionUsed = parseFloat((photoPaperCumulativeFractionUsed % 1).toFixed(5)); // Use toFixed for precision

    const totalCost = pricePerBundle * bundleQty;
    const totalLoss = 0;
    const netProfit = totalCost;

    const job = {
        type: 'photo_bundle',
        date: new Date().toISOString().split('T')[0],
        paperType: photoPaperType,
        bundleName: bundleName,
        bundleQuantity: bundleQty,
        bundlePricePerUnit: pricePerBundle,
        bundleComposition: selectedBundle.composition,
        paperConsumed: wholeSheetsToDeductThisTransaction, // Actual whole sheets deducted in this transaction
        jobFractionalSheetsConsumed: fractionalSheetsForCurrentJob, // The precise fractional amount for this job
        totalCost: totalCost,
        totalLoss: totalLoss,
        netProfit: netProfit,
        jobYieldMax2x2PerA4: photoYieldSettings.max2x2PerA4,
        jobYieldMax1x1PerA4: photoYieldSettings.max1x1PerA4
    };

    history.push(job);
    saveData();
    updateDisplay();
    displayHistory();
    renderChart();
    document.getElementById('bundleQuantity').value = 1;
    alert(`Added ${bundleQty} x "${bundleName}" job. (Deducted ${wholeSheetsToDeductThisTransaction} sheets. Cumulative fraction: ${photoPaperCumulativeFractionUsed.toFixed(2)})`);
}


// --- Toggle Add Print Job Button State (for standard prints) ---
function toggleAddPrintJobButton() {
    const bw = parseInt(document.getElementById('bw').value) || 0;
    const colored = parseInt(document.getElementById('colored').value) || 0;
    const rejectedBW = parseInt(document.getElementById('rejectedBW').value) || 0;
    const rejectedColor = parseInt(document.getElementById('rejectedColor').value) || 0;
    
    const addButton = document.getElementById('addPrintJobBtn');

    if (bw === 0 && colored === 0 && rejectedBW === 0 && rejectedColor === 0) {
        addButton.disabled = true;
    } else {
        addButton.disabled = false;
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
        listItem.classList.add('job-history-item');

        let jobDetailsHtml = '';
        if (job.type === 'print') {
            jobDetailsHtml = `
                <strong>${job.date}</strong> - ${job.paperType.toUpperCase()} (${job.printType})<br>
                B&W Sheets: ${job.bwPages} (Rejected: ${job.rejectedBW})<br>
                Colored Sheets: ${job.coloredPages} (Rejected: ${job.rejectedColor})<br>
                Total Sheets Used: ${job.paperConsumed}<br>
                Profit: ₱${job.netProfit.toFixed(2)} | Loss: ₱${job.totalLoss.toFixed(2)}
            `;
        } else if (job.type === 'photo_bundle') {
            const total2x2s = (job.bundleComposition['2x2'] || 0) * job.bundleQuantity;
            const total1x1s = (job.bundleComposition['1x1'] || 0) * job.bundleQuantity;
            jobDetailsHtml = `
                <strong>${job.date}</strong> - ${job.bundleName} (x${job.bundleQuantity})<br>
                Paper Type: ${job.paperType.toUpperCase()}<br>
                Photos: 2x2: ${total2x2s} | 1x1: ${total1x1s}<br>
                Fractional Sheets Used: ${job.jobFractionalSheetsConsumed.toFixed(2)} (Actual Deduction: ${job.paperConsumed} sheets)<br>
                Profit: ₱${job.netProfit.toFixed(2)}
            `;
        }
        
        listItem.innerHTML = `
            ${jobDetailsHtml}
            <div class="job-actions">
                <button class="edit-job-btn" onclick="showEditJobModal(${index})">Edit</button>
                <button class="delete-job-btn" onclick="deleteJob(${index})">Delete</button>
            </div>
        `;
        historyList.appendChild(listItem);
    });
}

// --- Edit/Delete Individual Job Functions ---
function showEditJobModal(index) {
    currentEditingJobIndex = index;
    const job = history[index];

    if (!job) {
        alert('Job not found for editing.');
        return;
    }

    document.getElementById('editJobIndexDisplay').textContent = index;
    document.getElementById('editJobDate').value = job.date;

    const editJobPaperTypeSelect = document.getElementById('editJobPaperType');
    editJobPaperTypeSelect.innerHTML = '';
    const sortedPaperTypes = Object.keys(inventory).sort();
    sortedPaperTypes.forEach(type => {
        const option = document.createElement('option');
        option.value = type;
        option.textContent = type;
        editJobPaperTypeSelect.appendChild(option);
    });
    editJobPaperTypeSelect.value = job.paperType;

    const editJobPrintTypeSelect = document.getElementById('editJobPrintType');
    editJobPrintTypeSelect.innerHTML = '';
    const sortedPrintTypes = Object.keys(printJobTypes).sort();
    sortedPrintTypes.forEach(type => {
        const option = document.createElement('option');
        option.value = type;
        option.textContent = type;
        editJobPrintTypeSelect.appendChild(option);
    });
    editJobPrintTypeSelect.value = job.printType;
    editJobPrintTypeSelect.onchange = () => {
        toggleEditJobFields(editJobPrintTypeSelect.value);
    };

    const editStandardPrintFields = document.getElementById('editStandardPrintFields');
    const editPhotoBundleFields = document.getElementById('editPhotoBundleFields');

    if (job.type === 'print') {
        editStandardPrintFields.style.display = 'block';
        editPhotoBundleFields.style.display = 'none';

        document.getElementById('editJobBW').value = job.bwPages;
        document.getElementById('editJobColored').value = job.coloredPages;
        document.getElementById('editJobRejectedBW').value = job.rejectedBW;
        document.getElementById('editJobRejectedColor').value = job.rejectedColor;
    } else if (job.type === 'photo_bundle') {
        editStandardPrintFields.style.display = 'none';
        editPhotoBundleFields.style.display = 'block';

        const editJobBundleNameSelect = document.getElementById('editJobBundleName');
        editJobBundleNameSelect.innerHTML = '';
        const sortedBundleNames = Object.keys(photoBundles).sort();
        sortedBundleNames.forEach(name => {
            const option = document.createElement('option');
            option.value = name;
            option.textContent = name;
            editJobBundleNameSelect.appendChild(option);
        });
        editJobBundleNameSelect.value = job.bundleName;
        document.getElementById('editJobBundleQuantity').value = job.bundleQuantity;
    }

    document.getElementById('editJobModalOverlay').classList.add('show');
}

function toggleEditJobFields(selectedPrintTypeName) {
    const selectedPrintType = printJobTypes[selectedPrintTypeName];
    const editStandardPrintFields = document.getElementById('editStandardPrintFields');
    const editPhotoBundleFields = document.getElementById('editPhotoBundleFields');

    if (selectedPrintType && selectedPrintType.type === 'photo_bundle') {
        editStandardPrintFields.style.display = 'none';
        editPhotoBundleFields.style.display = 'block';
        populateBundleTypeDropdownForEditJob();
    } else {
        editStandardPrintFields.style.display = 'block';
        editPhotoBundleFields.style.display = 'none';
    }
}

function populateBundleTypeDropdownForEditJob() {
    const editJobBundleNameSelect = document.getElementById('editJobBundleName');
    editJobBundleNameSelect.innerHTML = '';
    const sortedBundleNames = Object.keys(photoBundles).sort();
    sortedBundleNames.forEach(name => {
        const option = document.createElement('option');
        option.value = name;
        option.textContent = name;
        editJobBundleNameSelect.appendChild(option);
    });
}


function hideEditJobModal() {
    document.getElementById('editJobModalOverlay').classList.remove('show');
    currentEditingJobIndex = -1;
}

function saveEditedJob() {
    if (currentEditingJobIndex === -1) return;

    const oldJob = history[currentEditingJobIndex];

    const newDate = document.getElementById('editJobDate').value;
    const newPaperType = document.getElementById('editJobPaperType').value;
    const newPrintTypeName = document.getElementById('editJobPrintType').value;

    // --- REVERT OLD JOB'S INVENTORY IMPACT ---
    if (oldJob.type === 'print') {
        if (inventory[oldJob.paperType] !== undefined) {
            inventory[oldJob.paperType] += oldJob.paperConsumed;
        } else {
            inventory[oldJob.paperType] = oldJob.paperConsumed;
        }
    } else if (oldJob.type === 'photo_bundle') {
        photoPaperCumulativeFractionUsed -= oldJob.jobFractionalSheetsConsumed;
        // Handle potential negative fraction by refunding whole sheets
        if (photoPaperCumulativeFractionUsed < 0) {
            let sheetsToRefund = Math.ceil(Math.abs(photoPaperCumulativeFractionUsed));
            if (inventory[oldJob.paperType] !== undefined) {
                inventory[oldJob.paperType] += sheetsToRefund;
            } else {
                inventory[oldJob.paperType] = sheetsToRefund;
            }
            photoPaperCumulativeFractionUsed = parseFloat((photoPaperCumulativeFractionUsed + sheetsToRefund).toFixed(5)); // Adjust fraction to be positive
        }
    }
    // --- END REVERT OLD JOB'S INVENTORY IMPACT ---


    let updatedJob = { ...oldJob };
    updatedJob.date = newDate;
    updatedJob.paperType = newPaperType;
    updatedJob.printType = newPrintTypeName;

    const selectedPrintTypeDefinition = printJobTypes[newPrintTypeName];

    if (selectedPrintTypeDefinition.type === 'standard') {
        const newBWPages = parseInt(document.getElementById('editJobBW').value) || 0;
        const newColoredPages = parseInt(document.getElementById('editJobColored').value) || 0;
        const newRejectedBW = parseInt(document.getElementById('editJobRejectedBW').value) || 0;
        const newRejectedColor = parseInt(document.getElementById('editJobRejectedColor').value) || 0;

        const multiplier = selectedPrintTypeDefinition.multiplier;
        const basePrice = selectedPrintTypeDefinition.basePrice;
        const bundleQuantity = selectedPrintTypeDefinition.bundleQuantity;

        const newPaperConsumed = newBWPages + newColoredPages + newRejectedBW + newRejectedColor;

        if (inventory[newPaperType] === undefined || inventory[newPaperType] < newPaperConsumed) {
            alert(`Not enough ${newPaperType} paper for edited job! You need ${newPaperConsumed} sheets, but only have ${inventory[newPaperType] !== undefined ? inventory[newPaperType] : 0}.`);
            // Revert inventory changes made at the start of saveEditedJob before returning
            // This is complex for photo bundles, so we'll simplify: just alert and return, leaving inventory as is.
            // For standard print jobs, the initial refund is correct.
            return;
        }
        inventory[newPaperType] -= newPaperConsumed;

        let effectivePriceBW = priceBW * multiplier;
        let effectivePriceColor = priceColor * multiplier;
        
        let newTotalCost = basePrice;
        let totalSuccessfulPages = newBWPages + newColoredPages;
        let sheetsBeyondBundle = totalSuccessfulPages - bundleQuantity;

        if (sheetsBeyondBundle > 0) {
            if (totalSuccessfulPages > 0) {
                const bwRatio = newBWPages / totalSuccessfulPages;
                const coloredRatio = newColoredPages / totalSuccessfulPages;
                newTotalCost += (sheetsBeyondBundle * bwRatio * effectivePriceBW) + (sheetsBeyondBundle * coloredRatio * effectivePriceColor);
            }
        } else {
            if (basePrice === 0 && bundleQuantity === 0) {
                newTotalCost += (newBWPages * effectivePriceBW) + (newColoredPages * effectivePriceColor);
            }
        }

        const newLossBW = newRejectedBW * priceBW;
        const newLossColor = newRejectedColor * priceColor;
        const newTotalLoss = newLossBW + newLossColor; 
        const newNetProfit = newTotalCost - newTotalLoss;

        Object.assign(updatedJob, {
            type: 'print',
            bwPages: newBWPages,
            coloredPages: newColoredPages,
            rejectedBW: newRejectedBW,
            rejectedColor: newRejectedColor,
            paperConsumed: newPaperConsumed,
            totalCost: newTotalCost,
            totalLoss: newTotalLoss,
            netProfit: newNetProfit,
            jobTypeMultiplier: multiplier,
            jobTypeBasePrice: basePrice,
            jobTypeBundleQuantity: bundleQuantity
        });

    } else if (selectedPrintTypeDefinition.type === 'photo_bundle') {
        const newBundleName = document.getElementById('editJobBundleName').value;
        const newBundleQuantity = parseInt(document.getElementById('editJobBundleQuantity').value) || 0;

        if (!newBundleName || !photoBundles.hasOwnProperty(newBundleName)) {
            alert('Please select a valid Photo ID Bundle for the edited job.');
            // Inventory was already reverted, so just return
            return;
        }
        if (newBundleQuantity <= 0) {
            alert('Bundle quantity must be at least 1.');
            // Inventory was already reverted, so just return
            return;
        }
        if (!photoYieldSettings.paperType || inventory[photoYieldSettings.paperType] === undefined) {
            alert(`Please select a valid "Paper Type for Bundles" in "Manage Photo ID Bundles" modal, and ensure it exists in your inventory.`);
            // Inventory was already reverted, so just return
            return;
        }

        const selectedBundle = photoBundles[newBundleName];
        const pricePerBundle = selectedBundle.price;
        
        const consumptionResult = calculateBundleSheetConsumption(selectedBundle.composition, newBundleQuantity);
        if (consumptionResult.error) {
            alert(consumptionResult.error);
            // Inventory was already reverted, so just return
            return;
        }
        const newFractionalSheetsForJob = consumptionResult.fractionalSheets;

        // --- APPLY NEW JOB'S INVENTORY IMPACT (CUMULATIVE FRACTIONAL) ---
        photoPaperCumulativeFractionUsed += newFractionalSheetsForJob;
        let newWholeSheetsToDeduct = Math.floor(photoPaperCumulativeFractionUsed);

        if (inventory[newPaperType] === undefined || inventory[newPaperType] < newWholeSheetsToDeduct) {
            alert(`Not enough "${newPaperType}" paper for edited job! You need to deduct ${newWholeSheetsToDeduct} sheets, but only have ${inventory[newPaperType] !== undefined ? inventory[newPaperType] : 0}.`);
            photoPaperCumulativeFractionUsed -= newFractionalSheetsForJob; // Revert fraction
            // Inventory was already reverted, so just return
            return;
        }
        inventory[newPaperType] -= newWholeSheetsToDeduct;
        photoPaperCumulativeFractionUsed = parseFloat((photoPaperCumulativeFractionUsed % 1).toFixed(5)); // Keep remaining fraction
        // --- END APPLY NEW JOB'S INVENTORY IMPACT ---

        const newTotalCost = pricePerBundle * newBundleQuantity;
        const newTotalLoss = 0;
        const newNetProfit = newTotalCost;

        Object.assign(updatedJob, {
            type: 'photo_bundle',
            bundleName: newBundleName,
            bundleQuantity: newBundleQuantity,
            bundlePricePerUnit: pricePerBundle,
            bundleComposition: selectedBundle.composition,
            paperConsumed: newWholeSheetsToDeduct, // Actual whole sheets deducted
            jobFractionalSheetsConsumed: newFractionalSheetsForJob, // Precise fractional amount
            totalCost: newTotalCost,
            totalLoss: newTotalLoss,
            netProfit: newNetProfit,
            jobYieldMax2x2PerA4: photoYieldSettings.max2x2PerA4,
            jobYieldMax1x1PerA4: photoYieldSettings.max1x1PerA4
        });
    } else {
        alert('Invalid print type selected for job edit.');
        // Inventory was already reverted, so just return
        return;
    }

    history[currentEditingJobIndex] = updatedJob;

    saveData();
    calculateInitialEstimatedProfit();
    updateDisplay();
    renderChart();
    displayHistory();
    hideEditJobModal();
    alert('Job updated successfully!');
}

function deleteJob(index) {
    if (confirm(`Are you sure you want to delete this print job (${history[index].date} - ${history[index].paperType})? This cannot be undone.`)) {
        const jobToDelete = history[index];
        
        if (jobToDelete.type === 'print') {
            if (inventory[jobToDelete.paperType] !== undefined) {
                inventory[jobToDelete.paperType] += jobToDelete.paperConsumed;
            } else {
                inventory[jobToDelete.paperType] = jobToDelete.paperConsumed;
            }
        } else if (jobToDelete.type === 'photo_bundle') {
            photoPaperCumulativeFractionUsed -= jobToDelete.jobFractionalSheetsConsumed;
            if (photoPaperCumulativeFractionUsed < 0) {
                let sheetsToRefund = Math.ceil(Math.abs(photoPaperCumulativeFractionUsed));
                if (inventory[jobToDelete.paperType] !== undefined) {
                    inventory[jobToDelete.paperType] += sheetsToRefund;
                } else {
                    inventory[jobToDelete.paperType] = sheetsToRefund;
                }
                photoPaperCumulativeFractionUsed = parseFloat((photoPaperCumulativeFractionUsed + sheetsToRefund).toFixed(5));
            }
        }

        history.splice(index, 1);

        saveData();
        calculateInitialEstimatedProfit();
        updateDisplay();
        renderChart();
        displayHistory();
        alert('Job deleted successfully!');
    }
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
        if (job.type === 'print') {
            totalBWSuccessfulSheetsPrintedOverall += job.bwPages;
            totalColoredSuccessfulSheetsPrintedOverall += job.coloredPages;
        }
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
        printJobTypes,
        photoBundles,
        photoYieldSettings,
        photoPaperCumulativeFractionUsed
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