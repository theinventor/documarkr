import { Controller } from "@hotwired/stimulus"

// Connects to data-controller="field-signing"
export default class extends Controller {
  static targets = ["field", "container", "modal", "pageContainer", "signatureCanvas", 
                    "fieldsList", "progressBar", "completedCount", "totalCount"]
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
    
    // Add listeners for PDF pause/resume
    this.pdfPaused = false;
    document.addEventListener('pdf-viewer:pause', () => {
      console.log("PDF viewer paused");
      this.pdfPaused = true;
    });
    
    document.addEventListener('pdf-viewer:resume', () => {
      console.log("PDF viewer resumed");
      this.pdfPaused = false;
    });
    
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
    
    // Check if all signatures are complete and update progress
    this.updateFieldStatuses();
    
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

    // Initialize progress bar and field list
    this.updateProgressBar();

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
    console.log("Setting up text field:", field.dataset.fieldId);
    
    // Remove existing content
    field.innerHTML = '';
    
    // Create container
    const container = document.createElement('div');
    container.className = 'text-input-container';
    
    // Create input
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'text-input';
    input.placeholder = field.dataset.fieldLabel || 'Enter text';
    input.setAttribute('data-action', 'input->field-signing#handleInputChange');
    
    // Create save button
    const saveButton = document.createElement('button');
    saveButton.textContent = 'Save';
    saveButton.className = 'save-button opacity-50 cursor-not-allowed';
    saveButton.disabled = true;
    saveButton.setAttribute('data-action', 'click->field-signing#saveTextField');
    
    // Add to container
    container.appendChild(input);
    container.appendChild(saveButton);
    
    // Add to field
    field.appendChild(container);
    
    // Focus the input
    setTimeout(() => {
      input.focus();
    }, 100);
  }
  
  setupDateField(field) {
    console.log("Setting up date field:", field.dataset.fieldId);
    
    // Remove existing content
    field.innerHTML = '';
    
    // Create container
    const container = document.createElement('div');
    container.className = 'text-input-container';
    
    // Create input
    const input = document.createElement('input');
    input.type = 'date';
    input.className = 'date-input';
    input.setAttribute('data-action', 'input->field-signing#handleInputChange');
    
    // Create save button
    const saveButton = document.createElement('button');
    saveButton.textContent = 'Save';
    saveButton.className = 'save-button opacity-50 cursor-not-allowed';
    saveButton.disabled = true;
    saveButton.setAttribute('data-action', 'click->field-signing#saveDateField');
    
    // Add to container
    container.appendChild(input);
    container.appendChild(saveButton);
    
    // Add to field
    field.appendChild(container);
    
    // Focus the input
    setTimeout(() => {
      input.focus();
    }, 100);
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
    
    // For signature and initials, open the modal with our updated method
    if (fieldType === 'signature' || fieldType === 'initials') {
      this.openSignatureModal(event);
      event.stopPropagation();
      return;
    }
  }
  
  openSignatureModal(event) {
    console.log("Opening signature modal for field:", event.currentTarget.dataset.fieldId);
    
    // Store the current field for later use
    this.currentFieldValue = event.currentTarget.dataset.fieldId;
    
    // Also set a global variable as a fallback
    window.currentFieldId = event.currentTarget.dataset.fieldId;
    
    // First try to use the signature-modal controller
    const signatureModalElement = document.querySelector('[data-controller="signature-modal"]');
    const modalController = signatureModalElement?.__stimulusController;
    
    if (modalController && typeof modalController.open === 'function') {
      // Determine the field type
      const fieldType = event.currentTarget.dataset.fieldType;
      console.log(`Using signature-modal controller to open modal for ${fieldType}`);
      
      // Open the modal with the correct field type
      modalController.open({
        currentTarget: {
          dataset: {
            fieldType: fieldType
          }
        },
        preventDefault: () => {},
        stopPropagation: () => {}
      });
      
      return;
    }
    
    // Fallback to manual modal handling if the controller isn't available
    console.log("Signature modal controller not found, using fallback approach");
    
    // Try to find the modal element directly instead of using modalTarget
    const modal = document.querySelector('[data-controller="signature-modal"]');
    
    if (!modal) {
      console.error("No modal element found with data-controller='signature-modal'! Check your HTML structure.");
      return;
    }
    
    const fieldType = event.currentTarget.dataset.fieldType;
    
    // Show the modal
    modal.classList.remove('hidden');
    modal.style.display = 'flex';
    
    // Find and show the correct content type (signature or initials)
    const modalContents = modal.querySelectorAll('.modal-content');
    modalContents.forEach(content => {
      content.classList.add('hidden');
      content.style.display = 'none';
    });
    
    // Show the right content
    const targetContent = modal.querySelector(`.modal-content[data-field-type="${fieldType}"]`);
    if (targetContent) {
      targetContent.classList.remove('hidden');
      targetContent.style.display = 'block';
    } else {
      console.error(`No modal content found for field type: ${fieldType}`);
    }
    
    // Show backdrop (if available)
    const backdrop = document.querySelector('#modalBackdrop');
    if (backdrop) {
      backdrop.classList.remove('hidden');
      backdrop.style.display = 'block';
      backdrop.style.zIndex = '999';
      backdrop.style.opacity = '0.75';
      backdrop.style.backgroundColor = '#000000';
    }
    
    // Try to initialize signature pad through the controller or fallback
    setTimeout(() => {
      const canvasId = fieldType === 'signature' ? 'signatureCanvas' : 'initialsCanvas';
      const canvas = document.getElementById(canvasId);
      
      if (canvas) {
        // Force controller initialization through test draw
        if (modal.__stimulusController && typeof modal.__stimulusController.testDraw === 'function') {
          modal.__stimulusController.testDraw(canvasId);
        }
      }
    }, 100);
  }
  
  closeModal() {
    console.log("Closing modal using controller method");
    
    // Find the modal controller instead of directly manipulating DOM
    const signatureModalElement = document.querySelector('[data-controller="signature-modal"]');
    const modalController = signatureModalElement?.__stimulusController;
    
    if (modalController && typeof modalController.close === 'function') {
      // Use the controller's close method
      console.log("Using signature-modal controller to close modal");
      modalController.close();
    } else {
      // Fallback to direct modal manipulation if controller not initialized
      console.log("Falling back to direct modal manipulation");
      
      // Try to find the modal element directly
      const modal = document.querySelector('[data-controller="signature-modal"]');
      if (modal) {
        modal.classList.add('hidden');
        modal.style.display = 'none';
        
        // Hide the backdrop
        const backdrop = document.getElementById('modalBackdrop');
        if (backdrop) {
          backdrop.classList.add('hidden');
          backdrop.style.display = 'none';
        }
      } else {
        console.error("No modal element found for closing!");
      }
    }
    
    // Reset current field value
    this.currentFieldValue = '';
  }
  
  initializeSignaturePad() {
    console.log("Initialize signature pad called - delegating to signature modal controller");
    
    // Find the signature modal controller
    const signatureModalElement = document.querySelector('[data-controller="signature-modal"]');
    
    if (signatureModalElement) {
      // If we have a controller instance, use it to initialize the canvas
      const controller = signatureModalElement.__stimulusController;
      if (controller && typeof controller.testDraw === 'function') {
        // Get the current field type to determine which canvas to use
        const field = this.fieldTargets.find(f => f.dataset.fieldId === this.currentFieldValue || f.dataset.fieldId === `field-${this.currentFieldValue}`);
        if (field) {
          const fieldType = field.dataset.fieldType;
          const canvasId = fieldType === 'signature' ? 'signatureCanvas' : 'initialsCanvas';
          controller.testDraw(canvasId);
        }
      }
    } else {
      console.warn("No signature modal controller found for canvas initialization");
    }
  }
  
  signatureComplete(event) {
    console.log("Signature complete event received", event);
    
    // Try to get signature data from event or session storage
    let signatureData = event.detail?.signatureData;
    const fieldId = this.currentFieldValue || window.currentFieldId;
    
    // Check if we need to use session storage as fallback
    if (!signatureData && sessionStorage.getItem('last_signature_data')) {
      console.log("Using signature data from session storage");
      signatureData = sessionStorage.getItem('last_signature_data');
      
      // Clear session storage to prevent reuse
      sessionStorage.removeItem('last_signature_data');
      sessionStorage.removeItem('last_signature_field_id');
    }
    
    if (!signatureData || !fieldId) {
      console.error("Missing signature data or field ID", { signatureData: !!signatureData, fieldId });
      return;
    }
    
    console.log(`Saving signature for field: ${fieldId}`);
    
    // Find the corresponding field - note we need to handle both with/without the "field-" prefix
    let field = this.fieldTargets.find(f => f.dataset.fieldId === fieldId);
    if (!field) {
      field = this.fieldTargets.find(f => f.dataset.fieldId === `field-${fieldId}`);
    }
    
    if (!field) {
      console.error(`Field not found with ID: ${fieldId}`);
      return;
    }
    
    // Update the field with the signature
    const processedFieldId = fieldId.replace(/^field-/, '');
    this.updateField(processedFieldId, signatureData);
    
    // Close the modal
    this.closeModal();
    
    // Update progress bar and field statuses
    this.updateFieldStatuses();
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
    const field = this.fieldTargets.find(f => f.dataset.fieldId === `field-${fieldId}`)
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
    field.classList.add('border-solid', 'completed');
    field.style.border = '2px solid #4CAF50';
    field.style.backgroundColor = 'rgba(220, 252, 231, 0.7)';
    
    // Check if all fields are completed
    this.updateFieldStatuses();
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
    const completionMessage = document.getElementById('completion-message');
    const submitButton = document.getElementById('document-submit-button');
    
    if (completionMessage) {
      completionMessage.classList.remove('hidden');
    }
    
    if (submitButton) {
      submitButton.disabled = false;
      submitButton.classList.remove('opacity-50', 'cursor-not-allowed');
      submitButton.classList.add('hover:bg-green-700');
      
      // Add a visual highlight to the button
      submitButton.classList.add('animate-pulse');
      setTimeout(() => {
        submitButton.classList.remove('animate-pulse');
      }, 2000);
    }
    
    console.log("Document ready for submission - all fields completed!");
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
    const existingButton = document.getElementById('document-submit-button');
    if (existingButton) return;
    
    // Create a submit button in case the template doesn't have one
    const submitButton = document.createElement('button');
    submitButton.id = 'document-submit-button';
    submitButton.textContent = 'Sign Document';
    submitButton.className = 'w-full px-4 py-3 bg-green-600 text-white font-semibold rounded-lg shadow opacity-50 cursor-not-allowed';
    submitButton.disabled = true;
    submitButton.setAttribute('form', 'sign-form');
    submitButton.setAttribute('type', 'submit');
    
    // Find a place to add the button
    const sidebar = document.querySelector('[data-field-signing-target="fieldsList"]');
    if (sidebar && sidebar.parentElement) {
      const buttonContainer = document.createElement('div');
      buttonContainer.className = 'p-4 border-t border-gray-200';
      buttonContainer.appendChild(submitButton);
      sidebar.parentElement.appendChild(buttonContainer);
    }
  }

  // New method to ensure all fields have click handlers
  setupFieldClickHandlers() {
    console.log("Setting up field click handlers");
    
    this.fieldTargets.forEach(field => {
      const fieldType = field.dataset.fieldType;
      
      // Remove any existing click handlers to avoid duplication
      field.removeAttribute('data-action');
      
      // Add the appropriate click handler based on field type
      if (fieldType === 'text' || fieldType === 'date') {
        field.setAttribute('data-action', 'click->field-signing#handleFieldClick');
        
        // Setup text field input if needed
        if (fieldType === 'text') {
          this.setupTextField(field);
        } else if (fieldType === 'date') {
          this.setupDateField(field);
        }
      } else if (fieldType === 'signature' || fieldType === 'initials') {
        // Use the handleFieldClick method for all fields for consistent handling
        field.setAttribute('data-action', 'click->field-signing#handleFieldClick');
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

  // For direct saving of text fields
  saveTextField(event) {
    event.preventDefault();
    event.stopPropagation();
    
    const button = event.currentTarget;
    const field = button.closest('[data-field-signing-target="field"]');
    const input = field.querySelector('input[type="text"]');
    
    if (!field || !input) return;
    
    const fieldId = field.dataset.fieldId.replace('field-', '');
    const value = input.value.trim();
    
    if (value) {
      this.updateField(fieldId, value);
      this.updateFieldStatuses();
    } else {
      alert('Please enter a value');
    }
  }
  
  // For direct saving of date fields
  saveDateField(event) {
    event.preventDefault();
    event.stopPropagation();
    
    const button = event.currentTarget;
    const field = button.closest('[data-field-signing-target="field"]');
    const input = field.querySelector('input[type="date"]');
    
    if (!field || !input) return;
    
    const fieldId = field.dataset.fieldId.replace('field-', '');
    const value = input.value;
    
    if (value) {
      // Format the date for display
      const date = new Date(value);
      const formattedDate = date.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric', 
        year: 'numeric' 
      });
      
      this.updateField(fieldId, formattedDate);
      this.updateFieldStatuses();
    } else {
      alert('Please select a date');
    }
  }
  
  // Handle input changes (not submitting yet)
  handleInputChange(event) {
    // Enable save button when typing starts
    const field = event.currentTarget.closest('[data-field-signing-target="field"]');
    const saveButton = field.querySelector('button');
    if (saveButton) {
      saveButton.classList.remove('opacity-50', 'cursor-not-allowed');
      saveButton.disabled = false;
    }
  }
  
  // Handle input blur (focus lost)
  handleInputBlur(event) {
    const input = event.currentTarget;
    const field = input.closest('[data-field-signing-target="field"]');
    if (!field) return;
    
    // Don't auto-save as we want explicit save button clicks
  }
  
  // Update the status of all fields and check completion
  updateFieldStatuses() {
    // Check if all required fields are completed
    const allRequiredFields = this.fieldTargets.filter(field => field.dataset.required === "true");
    const completedFields = allRequiredFields.filter(field => field.dataset.completed === "true");
    const allCompleted = allRequiredFields.length > 0 && completedFields.length === allRequiredFields.length;
    
    console.log(`Field completion: ${completedFields.length}/${allRequiredFields.length} fields completed`);
    
    // Update field statuses in the sidebar
    if (this.hasFieldsListTarget) {
      const statusItems = this.fieldsListTarget.querySelectorAll('.field-status-item');
      statusItems.forEach(item => {
        const fieldId = item.dataset.fieldId;
        const field = this.fieldTargets.find(f => f.dataset.fieldId === fieldId);
        
        if (field && field.dataset.completed === "true") {
          item.dataset.fieldStatus = "completed";
          item.querySelector('.field-status').classList.remove('bg-gray-300');
          item.querySelector('.field-status').classList.add('bg-green-500');
        }
      });
    }
    
    // Update progress bar
    this.updateProgressBar(completedFields.length, allRequiredFields.length);
    
    // Enable/disable submit button
    const submitButton = document.getElementById('document-submit-button');
    if (submitButton) {
      if (allCompleted) {
        submitButton.disabled = false;
        submitButton.classList.remove('opacity-50', 'cursor-not-allowed');
        submitButton.classList.add('hover:bg-green-700');
      } else {
        submitButton.disabled = true;
        submitButton.classList.add('opacity-50', 'cursor-not-allowed');
        submitButton.classList.remove('hover:bg-green-700');
      }
    }
    
    // If all completed, show completion UI
    if (allCompleted) {
      this.showCompletionMessage();
    }
  }
  
  // Update progress bar in the sidebar
  updateProgressBar(completed = null, total = null) {
    if (!this.hasProgressBarTarget || !this.hasCompletedCountTarget || !this.hasTotalCountTarget) return;
    
    if (completed === null || total === null) {
      const allRequiredFields = this.fieldTargets.filter(field => field.dataset.required === "true");
      const completedFields = allRequiredFields.filter(field => field.dataset.completed === "true");
      
      completed = completedFields.length;
      total = allRequiredFields.length;
    }
    
    // Update count text
    this.completedCountTarget.textContent = completed;
    this.totalCountTarget.textContent = total;
    
    // Update progress bar width
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
    this.progressBarTarget.style.width = `${percentage}%`;
    
    // Change color based on progress
    if (percentage === 100) {
      this.progressBarTarget.classList.remove('bg-blue-500');
      this.progressBarTarget.classList.add('bg-green-500');
    } else {
      this.progressBarTarget.classList.add('bg-blue-500');
      this.progressBarTarget.classList.remove('bg-green-500');
    }
  }
  
  // Scroll to a field when clicked in the sidebar
  scrollToField(event) {
    const item = event.currentTarget;
    const fieldId = item.dataset.fieldId;
    const field = this.fieldTargets.find(f => f.dataset.fieldId === fieldId);
    
    if (field) {
      // Highlight the field briefly
      field.classList.add('highlight-field');
      setTimeout(() => {
        field.classList.remove('highlight-field');
      }, 2000);
      
      // Scroll the field into view
      field.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }
} 