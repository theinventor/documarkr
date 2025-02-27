import { Controller } from "@hotwired/stimulus"

// Connects to data-controller="finalize"
export default class extends Controller {
  static targets = ["field", "container", "modal", "pageContainer", "signatureCanvas", 
                    "fieldsList", "progressBar", "completedCount", "totalCount", "savePdfButton"]
  static values = {
    documentId: Number,
    signerId: Number,
    token: String,
    page: { type: Number, default: 1 },
    currentField: { type: String, default: "" },
    completeRedirectUrl: String
  }
  
  // Event handler for the PDF viewer's page change event
  handlePageChangeEvent(event) {
    console.log("Page change event received:", event);
    // In the new layout with all pages displayed, we just need to ensure
    // fields are positioned correctly
    this.updateFieldPositions();
  }
  
  // Updates the positions of fields based on current PDF viewer scale
  updateFieldPositions() {
    console.log("Updating field positions");
    
    // Find the PDF viewer element
    const pdfViewerElement = document.querySelector('[data-controller~="pdf-viewer"]');
    if (!pdfViewerElement) {
      console.warn("PDF viewer element not found - cannot position fields correctly");
      return;
    }
    
    // Get the container elements for each page
    const pageContainers = document.querySelectorAll('.pdf-page');
    if (pageContainers.length === 0) {
      console.warn("No page containers found - cannot position fields");
      return;
    }
    
    console.log(`Found ${pageContainers.length} page containers`);
    
    // Loop through each field
    this.fieldTargets.forEach(field => {
      // Get the page number for this field
      const pageNumber = parseInt(field.dataset.page, 10);
      
      // Find the corresponding page container
      const pageContainer = document.querySelector(`.pdf-page[data-page-number="${pageNumber}"]`);
      if (!pageContainer) {
        console.warn(`No container found for page ${pageNumber}`);
        return;
      }
      
      // Position the field based on the page container position
      this.positionFieldOnPage(field, pageContainer);
    });
  }
  
  // Helper method to position a field on a page
  positionFieldOnPage(field, pageContainer) {
    // Get field position data
    const xPos = parseFloat(field.dataset.xPosition);
    const yPos = parseFloat(field.dataset.yPosition);
    
    // Get the page container's dimensions
    const pageRect = pageContainer.getBoundingClientRect();
    
    // Calculate absolute position
    const absoluteX = pageRect.left + (xPos / 100) * pageRect.width;
    const absoluteY = pageRect.top + (yPos / 100) * pageRect.height;
    
    // Apply position (add to any transform for scaling)
    field.style.left = `${absoluteX}px`;
    field.style.top = `${absoluteY}px`;
  }
  
  // Setup click handlers for all fields
  setupFieldClickHandlers() {
    console.log("Setting up field click handlers for all fields");
    
    // Add click handlers to all fields
    this.fieldTargets.forEach(field => {
      const fieldType = field.dataset.fieldType;
      const fieldId = field.dataset.fieldId;
      
      console.log(`Setting up click handler for field ${fieldId} of type ${fieldType}`);
      
      // Set the data-action attribute based on field type
      field.setAttribute('data-action', 'click->finalize#handleFieldClick');
      
      // For any field that's already completed, we still want to allow clicks
      // to potentially edit/update the field
      if (field.dataset.completed === "true") {
        console.log(`Field ${fieldId} is already completed, but still allowing clicks`);
      }
    });
  }
  
  connect() {
    console.log("%c██████████████████████████████████████████████████", "color: purple; font-size: 20px;");
    console.log("%cFNALIZING CONTROLLER CONNECTED!!!", "color: purple; font-weight: bold; font-size: 24px;");
    console.log("%c██████████████████████████████████████████████████", "color: purple; font-size: 20px;");

    console.log("Finalize controller connected");
    
    console.log("DEBUG: Checking for savePdfButton target...");
    if (this.hasSavePdfButtonTarget) {
      console.log("DEBUG: savePdfButton target found:", this.savePdfButtonTarget);
    } else {
      console.warn("DEBUG: savePdfButton target is missing! Please check your HTML markup.");
    }
    
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
    
    // Manually check for Save PDF button
    console.log("DEBUG: Checking for Save PDF button by query selector...");
    const savePdfButton = document.querySelector('[data-action="click->finalize#savePdf"]');
    if (savePdfButton) {
      console.log("DEBUG: Found Save PDF button via querySelector:", savePdfButton);
      // Add additional click handler for debugging
      savePdfButton.addEventListener('click', (e) => {
        console.log("DEBUG: Save PDF button clicked via direct event listener!");
        // Call our savePdf method directly
        this.savePdf(e);
      });
    } else {
      console.error("DEBUG: Save PDF button not found via querySelector! Check HTML markup.");
    }
  }
  
  disconnect() {
    // Clean up event listener when controller is disconnected
    document.removeEventListener('pdf-viewer:pageChanged', this.handlePageChangeEvent);
    document.removeEventListener('pdf-viewer:scaleChanged', this.boundUpdateFieldPositions);
    document.removeEventListener('pdf-viewer:loaded', this.boundUpdateFieldPositions);
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
    input.setAttribute('data-action', 'input->finalize#handleInputChangeUI');
    
    // Create save button
    const saveButton = document.createElement('button');
    saveButton.textContent = 'Save';
    saveButton.className = 'save-button opacity-50 cursor-not-allowed';
    saveButton.disabled = true;
    saveButton.setAttribute('data-action', 'click->finalize#saveTextField');
    
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
    input.setAttribute('data-action', 'input->finalize#handleInputChangeUI');
    
    // Create save button
    const saveButton = document.createElement('button');
    saveButton.textContent = 'Save';
    saveButton.className = 'save-button opacity-50 cursor-not-allowed';
    saveButton.disabled = true;
    saveButton.setAttribute('data-action', 'click->finalize#saveDateField');
    
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
    event.preventDefault();
    
    console.log("Opening signature modal from field_signing_controller");
    
    // Get the field element
    const field = event.currentTarget;
    const fieldType = field.dataset.fieldType;
    const fieldId = field.dataset.fieldId;
    
    // Store current field ID
    this.currentFieldValue = fieldId;
    window.currentFieldId = fieldId; // Also store in global var for fallback methods
    
    // Try multiple approaches to open the modal
    
    // Approach 1: Use the global function if available
    if (typeof window.openSigningModal === 'function') {
      console.log("Using global openSigningModal function");
      window.openSigningModal(fieldType, fieldId);
      
      // Use setTimeout to ensure the modal is fully open before trying to activate drawing
      setTimeout(() => {
        if (typeof window.activateDrawingOnCurrentCanvas === 'function') {
          console.log("Activating drawing using global helper");
          window.activateDrawingOnCurrentCanvas();
        }
      }, 500);
      
      return;
    }
    
    // Approach 2: Try to use the controller directly
    const modalController = document.querySelector('[data-controller="signature-modal"]')?.__stimulusController;
    if (modalController && typeof modalController.open === 'function') {
      console.log("Using signature-modal controller to open modal");
      modalController.open(event);
      
      // Use setTimeout to ensure the modal is fully open before trying to activate drawing
      setTimeout(() => {
        console.log("Trying to activate drawing after modal open");
        if (modalController && typeof modalController.testDraw === 'function') {
          modalController.testDraw(event);
        }
      }, 500);
      
      return;
    }
    
    // Approach 3: Fall back to direct DOM manipulation
    console.log("Using direct DOM manipulation to open modal");
    
    const modal = document.querySelector('[data-controller="signature-modal"]');
    if (!modal) {
      console.error("Could not find signature modal");
      return;
    }
    
    // Show the modal
    modal.classList.remove('hidden');
    modal.style.display = 'flex';
    
    // Show the appropriate content
    const containers = modal.querySelectorAll('.modal-content');
    containers.forEach(container => {
      container.classList.add('hidden');
      container.style.display = 'none';
    });
    
    const targetContent = modal.querySelector(`.modal-content[data-field-type="${fieldType}"]`);
    if (targetContent) {
      targetContent.classList.remove('hidden');
      targetContent.style.display = 'block';
    }
    
    // Show backdrop
    const backdrop = document.querySelector('[data-signature-modal-target="backdrop"]');
    if (backdrop) {
      backdrop.classList.remove('hidden');
      backdrop.style.display = 'block';
    }
    
    // Make sure button containers are visible
    const buttonContainers = modal.querySelectorAll('[data-signature-modal-target="buttonContainer"]');
    buttonContainers.forEach(container => {
      container.style.display = 'flex';
    });
    
    // Try to trigger the test draw function after a delay
    setTimeout(() => {
      console.log("Attempting to trigger test draw after manual modal open");
      
      // Find the canvas
      const canvasId = fieldType === 'signature' ? 'signatureCanvas' : 'initialsCanvas';
      const canvas = document.getElementById(canvasId);
      
      if (canvas) {
        console.log("Found canvas, triggering test draw");
        
        // SIMPLIFIED FIX: Just click the test button directly
        const testButton = document.querySelector(`button[data-action="click->signature-modal#testDraw"][data-field-id="${canvasId}"]`);
        if (testButton) {
          console.log("Found test button, clicking it directly");
          testButton.click();
        } else {
          console.log("Could not find test button");
        }
      }
    }, 500);
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
    const field = input.closest('[data-finalize-target="field"]');
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
  
  // Handle input blur (focus lost)
  handleInputBlur(event) {
    const input = event.currentTarget;
    const field = input.closest('[data-finalize-target="field"]');
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

  // Method to handle saving the PDF with fields
  savePdf(event) {
    console.log("%c██████████████████████████████████████████████████", "color: red; font-size: 20px;");
    console.log("%cSAVE PDF METHOD CALLED!!!", "color: red; font-weight: bold; font-size: 24px;");
    console.log("%c██████████████████████████████████████████████████", "color: red; font-size: 20px;");
    console.log("DEBUG: Save PDF method called with event:", event);
    
    if (event) {
      event.preventDefault();
      console.log("DEBUG: Event prevented default");
    } else {
      console.warn("DEBUG: No event object provided to savePdf method!");
    }
    
    console.log("DEBUG: Saving PDF with fields using PDF.js...");
    
    // Show loading state
    const button = event ? event.currentTarget : document.querySelector('[data-finalize-target="savePdfButton"]');
    console.log("DEBUG: Button found:", button);
    
    if (!button) {
      console.error("DEBUG: Save PDF button not found!");
      return;
    }
    
    const originalText = button.innerHTML;
    console.log("DEBUG: Original button text:", originalText);
    
    button.innerHTML = `
      <svg class="animate-spin h-4 w-4 mr-1 inline" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
      </svg>
      Generating PDF...
    `;
    button.disabled = true;
    console.log("DEBUG: Button updated to loading state");
    
    try {
      console.log("DEBUG: Looking for PDF viewer element");
      // Get the PDF viewer controller to access the PDF.js document instance
      const pdfViewerElement = document.querySelector('[data-controller~="pdf-viewer"]');
      if (!pdfViewerElement) {
        console.error("DEBUG: PDF viewer element not found");
        throw new Error("PDF viewer element not found");
      }
      console.log("DEBUG: PDF viewer element found:", pdfViewerElement);
      
      console.log("DEBUG: Getting stimulus controller from element");
      const pdfViewerController = pdfViewerElement.__stimulusController;
      console.log("DEBUG: PDF viewer controller:", pdfViewerController);
      
      if (!pdfViewerController) {
        console.error("DEBUG: PDF viewer controller not accessible via __stimulusController");
        console.log("DEBUG: Trying alternative methods to get controller...");
        
        // Try alternative methods to get the controller
        if (window.Stimulus) {
          console.log("DEBUG: Attempting to get controller via Stimulus application");
          const controller = window.Stimulus.getControllerForElementAndIdentifier(pdfViewerElement, "pdf-viewer");
          if (controller) {
            console.log("DEBUG: Found controller via Stimulus application:", controller);
            if (controller.pdfInstance) {
              console.log("DEBUG: PDF instance found in controller:", controller.pdfInstance);
              this.processPdfDownload(controller.pdfInstance, button, originalText);
              return;
            }
          }
        }
        
        throw new Error("PDF viewer controller not available");
      }
      
      if (!pdfViewerController.pdfInstance) {
        console.error("DEBUG: PDF instance not found in controller");
        throw new Error("PDF viewer not properly initialized");
      }
      
      console.log("DEBUG: PDF instance found:", pdfViewerController.pdfInstance);
      
      // Get PDF.js document instance
      const pdfDoc = pdfViewerController.pdfInstance;
      
      // Process the PDF
      this.processPdfDownload(pdfDoc, button, originalText);
      
    } catch (error) {
      console.error("DEBUG: Error in savePdf method:", error);
      button.innerHTML = originalText;
      button.disabled = false;
      alert(`Failed to access PDF viewer: ${error.message}`);
    }
  }
  
  // Helper method to process the PDF download
  processPdfDownload(pdfDoc, button, originalText) {
    console.log("DEBUG: Processing PDF download with pdfDoc:", pdfDoc);
    
    // Import and use html2canvas for rendering fields
    console.log("DEBUG: Attempting to import html2canvas...");
    import('html2canvas').then(async ({ default: html2canvas }) => {
      console.log("DEBUG: html2canvas imported successfully");
      
      // Collect data for the Node.js PDF.js service
      const documentData = {
        documentId: this.documentIdValue,
        fields: []
      };
      console.log("DEBUG: Initialized documentData:", documentData);
      
      console.log("DEBUG: Processing fields, count:", this.fieldTargets.length);
      // Collect field data for each field on the document
      for (const field of this.fieldTargets) {
        console.log("DEBUG: Processing field:", field);
        const fieldId = field.dataset.fieldId;
        const pageNumber = parseInt(field.dataset.page, 10);
        const fieldType = field.dataset.fieldType;
        const xPosition = parseFloat(field.dataset.xPosition);
        const yPosition = parseFloat(field.dataset.yPosition);
        const width = parseFloat(field.dataset.width);
        const height = parseFloat(field.dataset.height);
        
        console.log(`DEBUG: Field data - ID: ${fieldId}, Type: ${fieldType}, Page: ${pageNumber}, Position: (${xPosition}, ${yPosition}), Size: ${width}x${height}`);
        
        // Get field content
        let fieldValue = null;
        
        if (fieldType === 'signature' || fieldType === 'initials') {
          // For signature/initials, capture the rendered image
          const img = field.querySelector('img');
          if (img) {
            fieldValue = img.src;
            console.log("DEBUG: Signature/initials image found:", fieldValue.substring(0, 50) + "...");
          } else {
            console.log("DEBUG: No signature/initials image found");
          }
        } else if (fieldType === 'text' || fieldType === 'date') {
          // For text/date, get the text content
          const textDiv = field.querySelector('div');
          if (textDiv) {
            fieldValue = textDiv.textContent;
            console.log("DEBUG: Text/date content found:", fieldValue);
          } else {
            console.log("DEBUG: No text/date content found");
          }
        }
        
        // Add field data to the collection
        if (fieldValue) {
          documentData.fields.push({
            id: fieldId,
            pageNumber,
            fieldType,
            xPosition,
            yPosition, 
            width,
            height,
            value: fieldValue
          });
          console.log("DEBUG: Field added to documentData");
        } else {
          console.log("DEBUG: Field skipped (no value)");
        }
      }
      
      console.log("DEBUG: All fields processed, sending to Node service");
      // For now, we'll just download a JSON file with the field data
      // In the future, this will be sent to the Node.js PDF.js service
      this.sendToNodeService(documentData, button, originalText);
    }).catch(error => {
      console.error("DEBUG: Error importing or using html2canvas:", error);
      button.innerHTML = originalText;
      button.disabled = false;
      alert(`Failed to generate PDF: ${error.message}`);
    });
  }
  
  // Helper method to send data to the Node.js PDF.js service
  // This will be implemented in the future
  async sendToNodeService(documentData, button, originalText) {
    console.log("%c██████████████████████████████████████████████████", "color: green; font-size: 20px;");
    console.log("%cSENDING DATA TO NODE SERVICE", "color: green; font-weight: bold; font-size: 24px;");
    console.log("%c██████████████████████████████████████████████████", "color: green; font-size: 20px;");
    
    try {
      console.log("DEBUG: Data to be sent to Node.js PDF.js service:", documentData);
      console.log("DEBUG: Document ID:", documentData.documentId);
      console.log("DEBUG: Number of fields:", documentData.fields.length);
      
      // For now, we'll simulate a successful response
      // In the future, this will be an actual API call to the Node.js service
      
      console.log("DEBUG: Creating JSON blob for download");
      // Option 1: For temporary demo, download the JSON data
      const jsonString = JSON.stringify(documentData, null, 2);
      console.log("DEBUG: JSON string created, length:", jsonString.length);
      
      const jsonBlob = new Blob([jsonString], { type: 'application/json' });
      console.log("DEBUG: JSON blob created, size:", jsonBlob.size);
      
      const filename = `document-${documentData.documentId}-fields.json`;
      console.log("DEBUG: Downloading file with name:", filename);
      
      this.downloadFile(jsonBlob, filename);
      
      // Option 2: When the server endpoint is ready, send the data
      /* 
      const response = await fetch('/api/pdf-generation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': document.querySelector('meta[name="csrf-token"]').content
        },
        body: JSON.stringify(documentData)
      });
      
      if (!response.ok) {
        throw new Error(`Server responded with ${response.status}: ${response.statusText}`);
      }
      
      const result = await response.json();
      
      if (result.pdfUrl) {
        // If the server returns a URL to the generated PDF, redirect to it
        window.open(result.pdfUrl, '_blank');
      } else if (result.pdfData) {
        // If the server returns the PDF data directly, download it
        const pdfBlob = this.base64ToBlob(result.pdfData, 'application/pdf');
        this.downloadFile(pdfBlob, `document-${documentData.documentId}.pdf`);
      }
      */
      
      // Show success message
      console.log("DEBUG: All operations completed, showing success message");
      alert('PDF data prepared successfully. In the future, this will generate a PDF using a Node.js service with PDF.js.');
    } catch (error) {
      console.error("DEBUG: Error in sendToNodeService:", error);
      alert(`Failed to generate PDF: ${error.message}`);
    } finally {
      // Reset button state
      console.log("DEBUG: Resetting button state");
      button.innerHTML = originalText;
      button.disabled = false;
      console.log("DEBUG: Button reset complete");
    }
  }
  
  // Helper method to download a file
  downloadFile(blob, filename) {
    console.log("DEBUG: downloadFile called with blob size:", blob.size, "and filename:", filename);
    const url = window.URL.createObjectURL(blob);
    console.log("DEBUG: Blob URL created:", url);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    console.log("DEBUG: Download link created");
    
    document.body.appendChild(a);
    console.log("DEBUG: Link appended to document");
    
    console.log("DEBUG: Triggering click on download link");
    a.click();
    
    console.log("DEBUG: Removing link from document");
    document.body.removeChild(a);
    
    console.log("DEBUG: Revoking blob URL");
    window.URL.revokeObjectURL(url);
    
    console.log("DEBUG: Download process complete");
  }
  
  // Helper method to convert base64 to Blob
  base64ToBlob(base64, mimeType) {
    const byteCharacters = atob(base64.split(',')[1] || base64);
    const byteArrays = [];
    
    for (let offset = 0; offset < byteCharacters.length; offset += 512) {
      const slice = byteCharacters.slice(offset, offset + 512);
      const byteNumbers = new Array(slice.length);
      
      for (let i = 0; i < slice.length; i++) {
        byteNumbers[i] = slice.charCodeAt(i);
      }
      
      byteArrays.push(new Uint8Array(byteNumbers));
    }
    
    return new Blob(byteArrays, { type: mimeType });
  }

  // For direct saving of text fields
  saveTextField(event) {
    event.preventDefault();
    event.stopPropagation();
    
    const button = event.currentTarget;
    const field = button.closest('[data-finalize-target="field"]');
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
    const field = button.closest('[data-finalize-target="field"]');
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
    const sidebar = document.querySelector('[data-finalize-target="fieldsList"]');
    if (sidebar && sidebar.parentElement) {
      const buttonContainer = document.createElement('div');
      buttonContainer.className = 'p-4 border-t border-gray-200';
      buttonContainer.appendChild(submitButton);
      sidebar.parentElement.appendChild(buttonContainer);
    }
  }

  // Handle input changes (just UI updates, not submitting)
  handleInputChangeUI(event) {
    // Enable save button when typing starts
    const field = event.currentTarget.closest('[data-finalize-target="field"]');
    const saveButton = field.querySelector('button');
    if (saveButton) {
      saveButton.classList.remove('opacity-50', 'cursor-not-allowed');
      saveButton.disabled = false;
    }
  }
} 