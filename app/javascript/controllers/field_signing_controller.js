import { Controller } from "@hotwired/stimulus"

// Connects to data-controller="field-signing"
export default class extends Controller {
  static targets = ["field", "container", "modal", "pageContainer", "signatureCanvas", "saveButton"]
  static values = {
    documentId: Number,
    signerId: Number,
    token: String,
    page: { type: Number, default: 1 },
    currentField: { type: String, default: "" },
    completeRedirectUrl: String
  }
  
  connect() {
    console.log("%c██████████████████████████████████████████████████", "color: purple; font-size: 20px;");
    console.log("%cFIELD SIGNING CONTROLLER CONNECTED!!!", "color: purple; font-weight: bold; font-size: 24px;");
    console.log("%c██████████████████████████████████████████████████", "color: purple; font-size: 20px;");

    console.log("Field signing controller connected");
    
    // Install event listeners
    this.handlePageChangeEvent = this.handlePageChangeEvent.bind(this);
    document.addEventListener('pdf-viewer:pageChanged', this.handlePageChangeEvent);
    
    // Explicitly bind updateFieldPositions
    this.boundUpdateFieldPositions = this.updateFieldPositions.bind(this);
    
    // Listen for PDF viewer scale changes and loaded events
    document.addEventListener('pdf-viewer:scaleChanged', this.boundUpdateFieldPositions);
    document.addEventListener('pdf-viewer:loaded', this.boundUpdateFieldPositions);
    
    // Check if container target exists and log result
    if (this.hasContainerTarget) {
      console.log("Container target found:", this.containerTarget);
    } else {
      console.warn("Container target is missing! Field positioning will not work properly.");
    }
    
    // Set up CSS for field positioning
    this.setupFieldPositionStyles();
    
    // Initialize field visibility based on the current page
    this.initialize();
    
    // If this is already a signed field (signature/initials with an image)
    // Mark the field as completed
    this.fieldTargets.forEach(field => {
      const img = field.querySelector('img');
      if (img) {
        field.dataset.completed = 'true';
      }
    });
    
    // Check if all signatures are complete
    this.checkCompletionStatus();
    
    // Add a failsafe for field positioning
    setTimeout(() => {
      console.log("Running field positioning failsafe");
      this.updateFieldPositions();
    }, 2000);
    
    // Add submit button if not already present
    this.addSubmitButton();

    // Add console log to check how many fields we have
    console.log(`Found ${this.fieldTargets.length} field targets`);
    
    // Make sure every field has the right click action
    this.setupFieldClickHandlers();

    // Check if modal target exists and log result
    if (this.hasModalTarget) {
      console.log("Modal target found on connect:", this.modalTarget);
    } else {
      console.error("Modal target is MISSING on connect! Field interactions won't work properly.");
    }
  }
  
  disconnect() {
    // Clean up event listener when controller is disconnected
    document.removeEventListener('pdf-viewer:pageChanged', this.handlePageChangeEvent);
    document.removeEventListener('pdf-viewer:scaleChanged', this.boundUpdateFieldPositions);
    document.removeEventListener('pdf-viewer:loaded', this.boundUpdateFieldPositions);
  }
  
  // Event handler for the PDF viewer's page change event
  handlePageChangeEvent(event) {
    console.log("Page change event received:", event);
    // In the new layout with all pages displayed, we just need to ensure
    // fields are positioned correctly
    this.updateFieldPositions();
  }
  
  initialize() {
    const currentPage = this.pageValue || 1;
    console.log(`Initializing with current page: ${currentPage}`);

    // In the new layout, all fields should be visible
    this.fieldTargets.forEach(field => {
      field.classList.remove('hidden-field');
      
      // Make fields pointer-events-auto so they can be clicked
      field.classList.remove('pointer-events-none');
      field.classList.add('pointer-events-auto');
      
      // Add hover effect
      field.classList.add('hover:bg-blue-50');
      
      // For date fields, pre-populate with today's date
      if (field.dataset.fieldType === 'date' && !field.dataset.completed) {
        const todayDate = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
        this.updateField(field.dataset.fieldId.replace('field-', ''), todayDate);
      }
    });
  }
  
  // Create a style element with positioning for each field
  setupFieldPositionStyles() {
    console.log("Setting up field position styles");
    
    this.fieldTargets.forEach((field, index) => {
      const xPos = field.dataset.xPosition;
      const yPos = field.dataset.yPosition;
      const width = field.dataset.width;
      const height = field.dataset.height;
      const fieldType = field.dataset.fieldType;
      const isCompleted = field.dataset.completed === "true";
      const pageNumber = parseInt(field.dataset.page, 10);
      
      // Store the page number for later use
      field.setAttribute('data-page-number', pageNumber);
      
      // Apply initial positioning directly to elements
      field.style.position = 'absolute';
      field.style.left = `${xPos}%`;
      field.style.top = `${yPos}%`;
      
      // Make fields larger for better visibility - increase size by 20%
      const scaleFactor = 1.5; // Increase size by 50%
      field.style.width = `${width * scaleFactor}px`;
      field.style.height = `${height * scaleFactor}px`;
      field.style.transform = 'translate(-50%, -50%)';
      field.style.cursor = 'pointer';
      field.style.border = isCompleted ? '2px solid #4CAF50' : '2px dashed #2563EB';
      field.style.borderRadius = '4px';
      
      // Make field backgrounds more visible
      field.style.backgroundColor = isCompleted ? 'rgba(220, 252, 231, 0.7)' : 'rgba(239, 246, 255, 0.7)';
      
      // Ensure minimum sizes for better interaction
      const minWidth = 100; // Minimum width in pixels
      const minHeight = 40; // Minimum height in pixels
      
      if (parseFloat(width) * scaleFactor < minWidth) {
        field.style.width = `${minWidth}px`;
      }
      
      if (parseFloat(height) * scaleFactor < minHeight) {
        field.style.height = `${minHeight}px`;
      }
      
      // Add a class to identify the page this field belongs to
      field.classList.add(`page-${pageNumber}-field`);
      
      // If fieldType is text and not completed, allow direct typing
      if (fieldType === 'text' && !isCompleted) {
        this.setupTextField(field);
      }
      
      // If fieldType is date and not completed, setup date field
      if (fieldType === 'date' && !isCompleted) {
        this.setupDateField(field);
      }
    });
  }
  
  setupTextField(field) {
    // Replace with an actual text input that activates on click
    field.innerHTML = '';
    
    // Create and add input
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'w-full h-full p-2 text-base border-none focus:ring-2 focus:ring-blue-500 bg-transparent';
    input.placeholder = 'Click to type';
    input.required = true;
    input.style.fontSize = '16px'; // Ensure readable font size
    input.dataset.fieldId = field.dataset.fieldId.replace('field-', '');
    
    // Update field when input changes
    input.addEventListener('change', (e) => {
      this.updateField(input.dataset.fieldId, e.target.value);
    });
    
    // Stop propagation to prevent modal from opening
    input.addEventListener('click', (e) => {
      e.stopPropagation();
    });
    
    field.appendChild(input);
    
    // Modify the action to prevent modal opening
    field.dataset.action = 'click->field-signing#handleFieldClick';
  }
  
  setupDateField(field) {
    field.innerHTML = '';
    
    // Create and add date input
    const input = document.createElement('input');
    input.type = 'date';
    input.className = 'w-full h-full p-2 text-base border-none focus:ring-2 focus:ring-blue-500 bg-transparent';
    input.required = true;
    input.style.fontSize = '16px'; // Ensure readable font size
    input.dataset.fieldId = field.dataset.fieldId.replace('field-', '');
    
    // Set today's date as default
    const today = new Date().toISOString().split('T')[0];
    input.value = today;
    
    // Update field when date changes
    input.addEventListener('change', (e) => {
      this.updateField(input.dataset.fieldId, e.target.value);
    });
    
    // Stop propagation to prevent modal from opening
    input.addEventListener('click', (e) => {
      e.stopPropagation();
    });
    
    field.appendChild(input);
    
    // Modify the action to prevent modal opening
    field.dataset.action = 'click->field-signing#handleFieldClick';
  }
  
  // Handle direct field click
  handleFieldClick(event) {
    console.log("Field clicked:", event.currentTarget.dataset.fieldId, "Type:", event.currentTarget.dataset.fieldType);
    
    const field = event.currentTarget;
    const fieldType = field.dataset.fieldType;
    
    // For text fields, don't open modal, just focus the input
    if (fieldType === 'text') {
      const input = field.querySelector('input');
      if (input) {
        input.focus();
        event.stopPropagation();
        return;
      }
    }
    
    // For date fields, open date picker directly in the field
    if (fieldType === 'date') {
      const input = field.querySelector('input');
      if (input) {
        input.focus();
        input.click(); // Trigger the date picker
        event.stopPropagation();
        return;
      } else {
        // If no input exists, create one
        this.setupDateField(field);
        const input = field.querySelector('input');
        if (input) {
          input.focus();
          input.click();
          event.stopPropagation();
          return;
        }
      }
    }
    
    // For signature and initials, open the modal
    this.openSignatureModal(event);
  }
  
  openSignatureModal(event) {
    console.log("Opening signature modal for field:", event.currentTarget.dataset.fieldId);
    event.preventDefault();
    
    // Double-check modal target on click
    console.log("Modal target check at click time:", this.hasModalTarget ? "Found" : "MISSING");
    if (!this.hasModalTarget) {
      console.error("⚠️ Modal target is missing! Checking DOM directly...");
      const directModalCheck = document.querySelector('[data-field-signing-target="modal"]');
      console.log("Direct DOM check for modal:", directModalCheck ? "Found in DOM" : "Not found in DOM");
      
      if (directModalCheck) {
        console.log("Modal found in DOM but not connected to controller. Attempting to reconnect...");
        // This is a workaround - ideally we would fix the root cause
        setTimeout(() => {
          console.log("Retrying click after timeout");
          this.openSignatureModal(event);
        }, 500);
        return;
      }
    }
    
    // Only respond to empty fields
    const field = event.currentTarget;
    if (field.dataset.completed === "true") {
      console.log("Field is already completed, ignoring click");
      return;
    }
    
    const fieldType = field.dataset.fieldType;
    const fieldId = field.dataset.fieldId;
    
    console.log(`Opening modal for ${fieldType} field: ${fieldId}`);
    
    this.currentFieldValue = fieldId;
    
    // Show the appropriate modal
    if (this.hasModalTarget) {
      console.log("Modal target found, opening...");
      
      // Determine which part of the modal to show
      const modalContent = this.modalTarget.querySelector(`.modal-content[data-field-type="${fieldType}"]`);
      if (modalContent) {
        // Hide all content sections, show the current one
        this.modalTarget.querySelectorAll('.modal-content').forEach(content => {
          content.classList.add('hidden');
        });
        modalContent.classList.remove('hidden');
        
        // Show the modal
        this.modalTarget.classList.remove('hidden');
        
        // Add modal backdrop
        const backdrop = document.createElement('div');
        backdrop.className = 'modal-backdrop fixed inset-0 bg-black bg-opacity-50 z-40';
        document.body.appendChild(backdrop);
        this.backdrop = backdrop;
        
        // If this is a signature field, initialize the signature pad
        if (fieldType === 'signature' || fieldType === 'initials') {
          this.initializeSignaturePad();
        }
        
        // If text field, focus on the input
        if (fieldType === 'text') {
          setTimeout(() => {
            const input = modalContent.querySelector('input[type="text"]');
            if (input) input.focus();
          }, 100);
        }
        
        // If date field, initialize with current date
        if (fieldType === 'date') {
          const input = modalContent.querySelector('input[type="date"]');
          if (input && !input.value) {
            const today = new Date().toISOString().split('T')[0];
            input.value = today;
          }
        }
      } else {
        console.warn(`Modal content for field type ${fieldType} not found`);
      }
    } else {
      console.error("Modal target is missing! Cannot open modal.");
    }
  }
  
  closeModal() {
    if (this.hasModalTarget) {
      this.modalTarget.classList.add('hidden')
    }
    
    if (this.backdrop) {
      this.backdrop.remove()
      this.backdrop = null
    }
  }
  
  initializeSignaturePad() {
    // The signature pad controller should handle initialization
    // We just wait for it to be ready
    if (this.hasSignatureCanvasTarget) {
      // Focus on drawing area
      this.signatureCanvasTarget.focus()
    }
  }
  
  signatureComplete(event) {
    const signatureData = event.detail.signatureData
    
    if (!signatureData || !this.currentFieldValue) return
    
    // Find the corresponding field
    const field = this.fieldTargets.find(f => f.dataset.fieldId === this.currentFieldValue)
    if (!field) return
    
    // Update the field with the signature
    this.updateField(this.currentFieldValue, signatureData)
    
    // Close the modal
    this.closeModal()
  }
  
  textComplete(event) {
    event.preventDefault()
    const form = event.currentTarget
    const input = form.querySelector('input[type="text"]')
    if (!input || !this.currentFieldValue) return
    
    // Update the field with the text value
    this.updateField(this.currentFieldValue, input.value)
    
    // Close the modal
    this.closeModal()
  }
  
  dateComplete(event) {
    event.preventDefault()
    const form = event.currentTarget
    const input = form.querySelector('input[type="date"]')
    if (!input || !this.currentFieldValue) return
    
    // Format the date for display (e.g., Jan 15, 2023)
    const date = new Date(input.value)
    const formattedDate = date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    })
    
    // Update the field with the formatted date
    this.updateField(this.currentFieldValue, formattedDate)
    
    // Close the modal
    this.closeModal()
  }
  
  updateField(fieldId, value) {
    // Find the field element
    const field = this.fieldTargets.find(f => f.dataset.fieldId === fieldId)
    if (!field) return
    
    // Update the server
    this.saveFieldValue(fieldId, value)
    
    // Update the UI
    const fieldType = field.dataset.fieldType
    
    if (fieldType === 'signature' || fieldType === 'initials') {
      // Clear the field first
      field.innerHTML = '';
      
      // Create an image element to show the signature
      const img = document.createElement('img');
      img.src = value;
      img.className = 'w-full h-full object-contain p-1';
      
      // Add the image
      field.appendChild(img);
    } else if (fieldType === 'text' || fieldType === 'date') {
      // Create a div to show the text value
      const div = document.createElement('div');
      div.className = 'w-full h-full flex items-center justify-center text-center p-2';
      div.style.fontSize = '16px'; // Make text readable
      div.style.fontWeight = 'normal';
      div.textContent = value;
      
      // Clear the field and add the div
      field.innerHTML = '';
      field.appendChild(div);
    }
    
    // Mark as completed
    field.dataset.completed = "true";
    field.classList.remove('border-dashed');
    field.classList.add('border-solid');
    field.style.border = '2px solid #4CAF50';
    field.style.backgroundColor = 'rgba(220, 252, 231, 0.7)';
    
    // Check if all fields are completed
    this.checkCompletionStatus();
  }
  
  async saveFieldValue(fieldId, value) {
    const dbId = fieldId.replace('field-', '')
    
    try {
      // Include token in the URL
      const response = await fetch(`/sign/${this.documentIdValue}/form_fields/${dbId}/complete?token=${this.tokenValue}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': document.querySelector('meta[name="csrf-token"]').content
        },
        body: JSON.stringify({ value })
      })
      
      if (!response.ok) {
        console.error('Error saving field value:', response.statusText)
        alert('Failed to save your input. Please try again.')
        return false
      }
      
      const data = await response.json()
      return data.success
    } catch (error) {
      console.error('Error saving field value:', error)
      alert('Failed to save your input. Please try again.')
      return false
    }
  }
  
  checkCompletionStatus() {
    // Check if all required fields are completed
    const allRequiredFields = this.fieldTargets.filter(field => field.dataset.required === "true")
    const allCompleted = allRequiredFields.every(field => field.dataset.completed === "true")
    
    // If all completed, show completion UI
    if (allCompleted && allRequiredFields.length > 0) {
      this.showCompletionMessage()
    }
  }
  
  showCompletionMessage() {
    // Create or reveal completion message
    const completionDiv = document.createElement('div')
    completionDiv.className = 'fixed inset-x-0 bottom-0 bg-green-50 border-t border-green-200 p-4 flex justify-between items-center z-30'
    completionDiv.innerHTML = `
      <div class="flex items-center">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-green-500 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
        </svg>
        <span class="text-green-800 font-medium">All required fields completed!</span>
      </div>
      <button type="button" class="px-4 py-2 bg-green-600 text-white font-medium rounded-md shadow-sm hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500" data-action="field-signing#completeDocument">
        Complete Signing
      </button>
    `
    
    // Add to page
    document.body.appendChild(completionDiv)
    this.completionBar = completionDiv
  }
  
  completeDocument() {
    // Submit all signatures
    fetch(`/sign/${this.documentIdValue}?token=${this.tokenValue}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': document.querySelector('meta[name="csrf-token"]').content
      },
      body: JSON.stringify({})
    })
    .then(response => {
      if (!response.ok) {
        return response.json().then(data => {
          console.error('Error completing document:', data.error);
          alert('Error completing document: ' + (data.error || 'Unknown error'));
          throw new Error(data.error || 'Unknown error');
        });
      }
      return response.json();
    })
    .then(data => {
      console.log('Document completed successfully:', data);
      
      // Check if we have a redirect URL
      if (data.redirect_url) {
        window.location.href = data.redirect_url;
      } else if (this.hasCompleteRedirectUrlValue) {
        window.location.href = this.completeRedirectUrlValue;
      }
    })
    .catch(error => {
      console.error('Error completing document:', error);
    });
  }
  
  // Handle changes to direct inputs (text, date)
  handleInputChange(event) {
    const input = event.target;
    const field = input.closest('[data-field-signing-target="field"]');
    if (!field) return;
    
    const fieldId = field.dataset.fieldId;
    const fieldType = field.dataset.fieldType;
    
    let value = input.value;
    
    // Format the date for display if it's a date field
    if (fieldType === 'date') {
      const date = new Date(value);
      value = date.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric', 
        year: 'numeric' 
      });
    }
    
    // Save the value to the server
    this.saveFieldValue(fieldId, value);
    
    // Mark as completed
    field.dataset.completed = "true";
    
    // Check if all fields are completed
    this.checkCompletionStatus();
  }
  
  // Add submit button to the page
  addSubmitButton() {
    // Check if button already exists
    if (document.getElementById('document-submit-button')) {
      return;
    }
    
    // Create button
    const buttonHTML = `
      <div class="fixed bottom-4 left-1/2 transform -translate-x-1/2 z-50">
        <button id="document-submit-button" 
                class="px-6 py-3 bg-green-600 text-white font-medium rounded-lg shadow-lg opacity-50 cursor-not-allowed"
                disabled
                data-action="click->field-signing#completeDocument">
          Submit Document
        </button>
      </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', buttonHTML);
  }

  // New method to ensure all fields have click handlers
  setupFieldClickHandlers() {
    console.log("Setting up field click handlers");
    
    this.fieldTargets.forEach(field => {
      const fieldType = field.dataset.fieldType;
      
      // Remove any existing click handlers to avoid duplication
      field.removeAttribute('data-action');
      
      // Add the appropriate click handler based on field type
      if (fieldType === 'text') {
        field.setAttribute('data-action', 'click->field-signing#handleFieldClick');
        // Setup text field input
        this.setupTextField(field);
      } else if (fieldType === 'date') {
        field.setAttribute('data-action', 'click->field-signing#handleFieldClick');
        // Setup date field input
        this.setupDateField(field);
      } else if (fieldType === 'signature' || fieldType === 'initials') {
        field.setAttribute('data-action', 'click->field-signing#openSignatureModal');
      }
      
      console.log(`Set up ${fieldType} field: ${field.dataset.fieldId} with action: ${field.getAttribute('data-action')}`);
    });
  }

  updateButtonState() {
    // Enable/disable the save button based on whether the signature pad is empty
    if (this.signaturePad && !this.signaturePad.isEmpty()) {
      this.saveButtonTarget.disabled = false;
      this.saveButtonTarget.classList.remove('opacity-50', 'cursor-not-allowed');
      this.saveButtonTarget.classList.add('hover:bg-blue-700');
    } else {
      this.saveButtonTarget.disabled = true;
      this.saveButtonTarget.classList.add('opacity-50', 'cursor-not-allowed');
      this.saveButtonTarget.classList.remove('hover:bg-blue-700');
    }
  }
  
  // Update field positions based on the current PDF pages in the DOM
  updateFieldPositions() {
    console.log("Updating field positions");
    
    // Check if we have a container target
    if (!this.hasContainerTarget || !this.hasPageContainerTarget) {
      console.error("Missing container target or page container! Cannot position fields.");
      return;
    }
    
    try {
      // Get the container rect to calculate relative positions
      const containerRect = this.containerTarget.getBoundingClientRect();
      const pageContainer = this.pageContainerTarget;
      const pageRect = pageContainer.getBoundingClientRect();
      
      console.log(`Page container positioned at: top=${pageRect.top}, left=${pageRect.left}, width=${pageRect.width}, height=${pageRect.height}`);
      
      // Find all PDF page canvases
      const canvases = document.querySelectorAll('.pdf-page');
      
      if (!canvases.length) {
        console.log("No PDF pages found yet, will try again later");
        setTimeout(() => this.updateFieldPositions(), 500);
        return;
      }
      
      console.log(`Found ${canvases.length} PDF page canvases`);
      
      // For each page, position fields
      canvases.forEach((canvas, index) => {
        const pageNumber = index + 1;
        const canvasRect = canvas.getBoundingClientRect();
        
        // Calculate page offset relative to container
        const pageOffsetTop = canvasRect.top - containerRect.top;
        const pageOffsetLeft = canvasRect.left - containerRect.left;
        
        console.log(`Page ${pageNumber} positioned at: left=${pageOffsetLeft}, top=${pageOffsetTop}, width=${canvasRect.width}, height=${canvasRect.height}`);
        
        // Find all fields for this page
        const fields = this.fieldTargets.filter(field => 
          parseInt(field.dataset.page, 10) === pageNumber
        );
        
        console.log(`Found ${fields.length} fields for page ${pageNumber}`);
        
        fields.forEach(field => {
          // Get the position as percentage of the page
          const xPosPercent = parseFloat(field.dataset.xPosition);
          const yPosPercent = parseFloat(field.dataset.yPosition);
          
          // Calculate absolute position within the page
          const xPosAbsolute = (xPosPercent / 100) * canvasRect.width;
          const yPosAbsolute = (yPosPercent / 100) * canvasRect.height;
          
          // Set absolute position relative to the container
          field.style.position = 'absolute';
          field.style.left = `${pageOffsetLeft + xPosAbsolute}px`;
          field.style.top = `${pageOffsetTop + yPosAbsolute}px`;
          
          // Apply minimum sizes for better visibility
          const fieldWidth = Math.max(parseFloat(field.dataset.width) * 1.5, 100);
          const fieldHeight = Math.max(parseFloat(field.dataset.height) * 1.5, 40);
          
          field.style.width = `${fieldWidth}px`;
          field.style.height = `${fieldHeight}px`;
          
          // Use transform for centering
          field.style.transform = 'translate(-50%, -50%)';
          
          // Make field visible
          field.classList.remove('hidden');
          field.classList.add('positioned');
          
          console.log(`Positioned field ${field.dataset.fieldId} at: left=${field.style.left}, top=${field.style.top}, width=${field.style.width}, height=${field.style.height}`);
        });
      });
    } catch (error) {
      console.error("Error positioning fields:", error);
    }
  }
} 