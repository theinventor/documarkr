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
    
    if (event) {
      event.preventDefault();
      console.log("DEBUG: Event prevented default");
    }
    
    console.log("DEBUG: Starting PDF generation process...");
    
    // Get the button element
    const button = event?.currentTarget || document.querySelector('[data-finalize-target="savePdfButton"]') || 
                  document.querySelector('[data-action="click->finalize#savePdf"]');
    
    if (!button) {
      console.error("DEBUG: Save PDF button not found");
      alert("Error: Could not find the Save PDF button. Please refresh the page and try again.");
      return;
    }
    
    // Store original button text for restoration
    const originalText = button.innerHTML;
    console.log("DEBUG: Original button text stored");
    
    // Show loading state
    button.innerHTML = `
      <svg class="animate-spin h-4 w-4 mr-1 inline" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
      </svg>
      Generating PDF...
    `;
    button.disabled = true;
    console.log("DEBUG: Button updated to loading state");
    
    // Prepare document data object
    const documentData = {
      documentId: this.documentIdValue || 1,
      fields: []
    };
    
    // Collect field data
    console.log("DEBUG: Collecting field data from visible fields");
    this.fieldTargets.forEach(field => {
      // Modified: Include fields that are visible and either completed OR are text/date fields
      if (field.style.display !== 'none' && (field.dataset.completed === 'true' || field.classList.contains('text-field') || field.classList.contains('date-field'))) {
        try {
          // Get field information
          const fieldId = field.dataset.fieldId;
          const pageNumber = parseInt(field.dataset.page, 10) || 1;
          
          // Try to determine field type from multiple sources
          let fieldType = field.dataset.fieldType;
          
          // If field type is undefined, try to infer it from class
          if (!fieldType) {
            if (field.classList.contains('signature-field')) {
              fieldType = 'signature';
            } else if (field.classList.contains('text-field')) {
              fieldType = 'text';
            } else if (field.classList.contains('date-field')) {
              fieldType = 'date';
            } else if (field.classList.contains('initials-field')) {
              fieldType = 'initials';
            } else {
              // Default to text if we can't determine type
              fieldType = 'text';
            }
          }
          
          // Add debugging for field type detection
          console.log(`DEBUG: Field ${fieldId} identified as type: ${fieldType}, has class text-field: ${field.classList.contains('text-field')}`);
          
          // Get field position and size
          const xPosition = parseFloat(field.dataset.xPosition);
          const yPosition = parseFloat(field.dataset.yPosition);
          const width = parseFloat(field.dataset.width);
          const height = parseFloat(field.dataset.height);
          
          // Get field content
          let value = null;
          
          if (fieldType === 'signature' || fieldType === 'initials') {
            const img = field.querySelector('img');
            value = img ? img.src : null;
            console.log(`DEBUG: ${fieldType} field ${fieldId} image found: ${value ? 'Yes' : 'No'}`);
          } else if (fieldType === 'text' || fieldType === 'date') {
            const textDiv = field.querySelector('div');
            console.log(`DEBUG: ${fieldType} field ${fieldId} div found:`, textDiv);
            if (textDiv) {
              value = textDiv.textContent.trim();
              console.log(`DEBUG: ${fieldType} field ${fieldId} content: "${value}"`);
            }
            
            // If no content found in div or null/empty, try getting it from the dataset
            if (!value) {
              value = field.dataset.value;
              console.log(`DEBUG: Trying to get ${fieldType} field value from dataset: "${value}"`);
            }
            
            // For date fields, ensure proper date format
            if (fieldType === 'date' && value) {
              try {
                // Try to parse as date if it looks like a date string
                const parsedDate = new Date(value);
                if (!isNaN(parsedDate.getTime())) {
                  // Format consistently to ensure proper display
                  const formattedDate = parsedDate.toLocaleDateString('en-US', {
                    month: 'short', 
                    day: 'numeric',
                    year: 'numeric'
                  });
                  console.log(`DEBUG: Formatted date field ${fieldId} from "${value}" to "${formattedDate}"`);
                  value = formattedDate;
                }
              } catch (dateError) {
                console.log(`DEBUG: Could not parse date value "${value}" for field ${fieldId}`);
                // Keep original value if parsing fails
              }
            }
            
            // Ensure we don't have placeholder content
            const placeholders = ['[text]', '[date]', 'undefined', 'type here', 'mm/dd/yyyy'];
            if (value && placeholders.some(p => value.toLowerCase().includes(p.toLowerCase()))) {
              console.log(`DEBUG: Found placeholder content in ${fieldType} field ${fieldId}, treating as empty`);
              value = null;
            }
          }
          
          // Add field data if we have a value or force for certain field types
          if (value || fieldType === 'text' || fieldType === 'date') {
            // For text/date fields, provide a default value if none found
            if (!value && (fieldType === 'text' || fieldType === 'date')) {
              value = fieldType === 'text' ? 'Text Content' : '01/01/2023';
              console.log(`DEBUG: Using default value for ${fieldType} field ${fieldId}: "${value}"`);
            }
            
            documentData.fields.push({
              id: fieldId,
              page: pageNumber,
              type: fieldType,
              x: xPosition,
              y: yPosition,
              width,
              height,
              value,
              signerName: field.dataset.signerName || null,
              signerId: field.dataset.signerId || null
            });
            
            console.log(`DEBUG: Added ${fieldType} field ${fieldId} to document data with signer: ${field.dataset.signerName}`);
    } else {
            console.warn(`DEBUG: Field ${fieldId} has no value, skipping`);
          }
        } catch (fieldError) {
          console.error("DEBUG: Error processing field:", fieldError);
          // Continue with other fields
        }
      }
    });
    
    console.log(`DEBUG: Collected ${documentData.fields.length} fields`);
    
    // Process the PDF using the NodeService
    this.sendToNodeService(documentData, button, originalText)
      .then(success => {
        if (success) {
          console.log("DEBUG: PDF generation completed successfully");
        } else {
          console.warn("DEBUG: PDF generation failed");
          button.innerHTML = originalText;
          button.disabled = false;
        }
      })
      .catch(error => {
        console.error("DEBUG: Unexpected error during PDF generation:", error);
        button.innerHTML = originalText;
        button.disabled = false;
        alert(`Error generating PDF: ${error.message || 'Unknown error'}`);
      });
  }
  
  // Helper method to send data to the Node.js PDF.js service
  async sendToNodeService(documentData, button, originalText) {
    console.log("DEBUG: Starting client-side PDF generation...");

    try {
      // Improve PDF viewer element detection with multiple approaches
      console.log("DEBUG: Looking for PDF viewer element...");
      let pdfViewerElement = null;
      
      // Method 1: Try direct access from this.element
      const fromElement = this.element.querySelector('[data-controller~="pdf-viewer"]');
      if (fromElement) {
        console.log("DEBUG: Found PDF viewer element via this.element query");
        pdfViewerElement = fromElement;
      }
      
      // Method 2: Try document-wide search if not found
      if (!pdfViewerElement) {
        const allPdfViewers = document.querySelectorAll('[data-controller~="pdf-viewer"]');
        if (allPdfViewers.length > 0) {
          console.log(`DEBUG: Found ${allPdfViewers.length} PDF viewer elements via document-wide query`);
          pdfViewerElement = allPdfViewers[0];
        }
      }
      
      // Method 3: Try parent container
      if (!pdfViewerElement && this.hasContainerTarget) {
        const containerParent = this.containerTarget.closest('[data-controller~="pdf-viewer"]');
        if (containerParent) {
          console.log("DEBUG: Found PDF viewer element via container parent");
          pdfViewerElement = containerParent;
        }
      }
      
      if (!pdfViewerElement) {
        throw new Error("PDF viewer element not found");
      }
      
      console.log("DEBUG: Found PDF viewer element:", pdfViewerElement);
      
      // Dynamically import the pdf-lib library
      console.log("DEBUG: Importing PDF-lib library...");
      const { PDFDocument, rgb, StandardFonts } = await import('https://cdn.skypack.dev/pdf-lib');
      
      // Get PDF data
      const pdfData = await this.getPdfData(pdfViewerElement);
      if (!pdfData) {
        throw new Error("Could not retrieve PDF data");
      }
      console.log("DEBUG: Successfully retrieved PDF data");
      
      // Load the PDF document
      console.log("DEBUG: Loading PDF document from data...");
      const pdfDoc = await PDFDocument.load(pdfData);
      console.log("DEBUG: PDF document loaded successfully");
      
      // Check if documentData has fields to process
      if (!documentData || !documentData.fields || documentData.fields.length === 0) {
        console.warn("DEBUG: No fields to process in documentData");
      } else {
        console.log(`DEBUG: Processing ${documentData.fields.length} fields`);
        
        // Process each field and add it to the PDF
        for (const fieldData of documentData.fields) {
          try {
            const pageNumber = parseInt(fieldData.page);
            if (isNaN(pageNumber) || pageNumber < 1 || pageNumber > pdfDoc.getPageCount()) {
              console.warn(`DEBUG: Invalid page number ${pageNumber} for field ${fieldData.id}`);
              continue;
            }
            
            // Get the page
            const page = pdfDoc.getPage(pageNumber - 1); // PDF pages are 0-indexed
            
            // Convert percentage positions to PDF coordinates
            const { width, height } = page.getSize();
            const x = (fieldData.x / 100) * width;
            const y = height - ((fieldData.y / 100) * height); // Invert Y coordinate (PDF coordinates start from bottom-left)
            
            console.log(`DEBUG: Adding field ${fieldData.id} of type ${fieldData.type} to page ${pageNumber} at (${x}, ${y})`);
            
            // Create a mock field element with the necessary data attributes
            const mockFieldElement = document.createElement('div');
            mockFieldElement.dataset.fieldId = fieldData.id;
            mockFieldElement.dataset.width = fieldData.width;
            mockFieldElement.dataset.height = fieldData.height;
            mockFieldElement.className = `${fieldData.type}-field`;
            
            // Add signer name and ID from field data for ALL field types
            if (fieldData.signerName) {
              mockFieldElement.dataset.signerName = fieldData.signerName;
              console.log(`DEBUG: Using signer name "${fieldData.signerName}" from field data for ${fieldData.type} field ${fieldData.id}`);
            }
            
            if (fieldData.signerId) {
              mockFieldElement.dataset.signerId = fieldData.signerId;
            }
            
            // Additional fallback methods for signature fields only
            if (fieldData.type === 'signature' && !fieldData.signerName) {
              // Try multiple approaches to get signer name
              // This is important for the "Signed by: [name]" text next to signatures
              let signerName = null;
              
              // Method 1: Try to get from signer ID value
              if (this.hasSignerIdValue) {
                signerName = document.querySelector(`[data-signer-id="${this.signerIdValue}"]`)?.dataset?.signerName;
              }
              
              // Method 2: Try to get from any element with signer information
              if (!signerName) {
                const signerElement = document.querySelector('[data-signer-name]');
                if (signerElement) {
                  signerName = signerElement.dataset.signerName;
                }
              }
              
              // Method 3: Try to get from page metadata or profile information
              if (!signerName) {
                const profileElement = document.querySelector('.user-profile-name, .signer-name, [data-user-name]');
                if (profileElement) {
                  signerName = profileElement.textContent.trim() || profileElement.dataset.userName;
                }
              }
              
              // Method 4: Check if there's a text field with name information in the document data
              if (!signerName && documentData && documentData.fields) {
                // Look for text fields that might contain name information
                const nameField = documentData.fields.find(f => 
                  f.type === 'text' && 
                  (f.id.toLowerCase().includes('name') || 
                   (typeof f.value === 'string' && f.value.split(' ').length >= 2))
                );
                
                if (nameField && nameField.value) {
                  signerName = nameField.value;
                }
              }
              
              // Default to "Signer" if no name found
              mockFieldElement.dataset.signerName = signerName || "Signer";
              console.log(`DEBUG: Set signer name to "${mockFieldElement.dataset.signerName}" for signature field`);
            }
            
            // Add the value
            if (fieldData.type === 'signature' || fieldData.type === 'initials') {
              mockFieldElement.innerHTML = `<img src="${fieldData.value}" class="w-full h-full object-contain">`;
            } else {
              mockFieldElement.innerHTML = `<div class="p-2 w-full h-full flex items-center justify-center text-center">${fieldData.value}</div>`;
            }
            
            // Call the method to add the field to the PDF
            await this.addFieldToPdf(pdfDoc, page, mockFieldElement, x, y, rgb);
          } catch (fieldError) {
            console.error(`DEBUG: Error adding field ${fieldData.id} to PDF:`, fieldError);
            // Continue with other fields instead of stopping the entire process
          }
        }
      }
      
      // Save the PDF
      console.log("DEBUG: Saving PDF document...");
      const pdfBytes = await pdfDoc.save();
      console.log(`DEBUG: PDF generated successfully, size: ${pdfBytes.length} bytes`);
      
      // Generate a filename based on the document ID
      const filename = `document-${documentData.documentId || 'download'}.pdf`;
      
      // Create a blob and download the file
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      this.downloadFile(blob, filename);
      
      // Reset the button text
      if (button) {
        button.innerHTML = originalText;
        button.disabled = false;
      }
      
      console.log("DEBUG: PDF generation and download completed successfully");
      
      return true;
    } catch (error) {
      console.error("Error generating PDF:", error);
      
      // Reset the button text
      if (button) {
        button.innerHTML = originalText || "Save PDF";
        button.disabled = false;
      }
      
      // Show an alert instead of using showNotification
      alert(`Error generating PDF: ${error.message || 'Unknown error'}`);
      
      return false;
    }
  }
  
  // Helper method to get PDF data from the viewer
  async getPdfData(pdfViewerElement) {
    console.log("DEBUG: Getting PDF data from element:", pdfViewerElement);
    
    try {
      // Try multiple approaches to get the PDF URL
      let pdfUrl = null;
      
      // Approach 1: Use data-pdf-viewer-url-value attribute
      if (pdfViewerElement.dataset.pdfViewerUrlValue) {
        pdfUrl = pdfViewerElement.dataset.pdfViewerUrlValue;
        console.log("DEBUG: Found PDF URL from data-pdf-viewer-url-value attribute:", pdfUrl);
      }
      
      // Approach 2: Try common attribute name variations
      if (!pdfUrl) {
        const possibleAttributes = [
          'data-url-value',
          'data-pdf-url-value',
          'data-source-value',
          'data-pdf-source-value'
        ];
        
        for (const attr of possibleAttributes) {
          if (pdfViewerElement.hasAttribute(attr)) {
            pdfUrl = pdfViewerElement.getAttribute(attr);
            console.log(`DEBUG: Found PDF URL from ${attr} attribute:`, pdfUrl);
            break;
          }
        }
      }
      
      // Approach 3: Look for URL in iframe within the viewer
      if (!pdfUrl) {
        const iframe = pdfViewerElement.querySelector('iframe[src]');
        if (iframe && iframe.src) {
          pdfUrl = iframe.src;
          console.log("DEBUG: Found PDF URL from iframe src attribute:", pdfUrl);
        }
      }
      
      // Approach 4: Look for URL in an embedded object
      if (!pdfUrl) {
        const object = pdfViewerElement.querySelector('object[data]');
        if (object && object.data) {
          pdfUrl = object.data;
          console.log("DEBUG: Found PDF URL from object data attribute:", pdfUrl);
        }
      }
      
      // Approach 5: Look for PDF links anywhere in the document
      if (!pdfUrl) {
        const allLinks = document.querySelectorAll('a[href*=".pdf"]');
        if (allLinks.length > 0) {
          pdfUrl = allLinks[0].href;
          console.log("DEBUG: Found PDF URL from link in document:", pdfUrl);
        }
      }
      
      // If we found a URL, fetch the PDF
      if (pdfUrl) {
        console.log("DEBUG: Fetching PDF from URL:", pdfUrl);
        
        try {
          const response = await fetch(pdfUrl, {
            method: 'GET',
            cache: 'no-cache',
            headers: {
              'Accept': 'application/pdf'
            }
          });
          
          if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
          }
          
          console.log("DEBUG: PDF fetched successfully, converting to ArrayBuffer");
          return await response.arrayBuffer();
        } catch (fetchError) {
          console.error("DEBUG: Error fetching PDF:", fetchError);
          throw new Error(`Failed to fetch PDF: ${fetchError.message}`);
        }
      }
      
      throw new Error("No valid PDF URL found");
    } catch (error) {
      console.error("DEBUG: Error in getPdfData:", error);
      throw error;
    }
  }
  
  // Helper method to add a field to PDF
  async addFieldToPdf(pdfDoc, page, field, x, y, rgb) {
    console.log(`DEBUG: addFieldToPdf called for field ${field.id || field.dataset?.fieldId}`);
    
    try {
      // Determine field type from dataset, field.type, or class name
      let fieldType = field.type || 'unknown';
      
      // If field.type is not set, check dataset
      if (fieldType === 'unknown' && field.dataset && field.dataset.fieldType) {
        fieldType = field.dataset.fieldType;
      }
      
      // If still unknown, try to determine from class name
      if (fieldType === 'unknown' || !fieldType) {
        const className = field.className || '';
        if (className.includes('signature-field')) {
          fieldType = 'signature';
        } else if (className.includes('text-field')) {
          fieldType = 'text';
        } else if (className.includes('date-field')) {
          fieldType = 'date';
        } else if (className.includes('initials-field')) {
          fieldType = 'initials';
        }
      }

      // Always check the field for a div with text content - if found, treat as text field
      if (fieldType === 'unknown' || !fieldType) {
        const textElement = field.querySelector ? field.querySelector('div') : null;
        if (textElement && textElement.textContent) {
          console.log(`DEBUG: Found div with text content, treating as text field: "${textElement.textContent}"`);
          fieldType = 'text';
        }
      }
      
      console.log(`DEBUG: Processing ${fieldType} field at position (${x}, ${y})`);
      
      // Get field dimensions (from dataset or directly from field properties)
      const width = parseFloat(field.width || field.dataset?.width || 0);
      const height = parseFloat(field.height || field.dataset?.height || 0);
      
      // Call appropriate function based on field type
      switch (fieldType) {
        case 'signature':
          await this.addSignatureFieldToPdf(pdfDoc, page, field, x, y, width, height, rgb);
          break;
        case 'initials':
          await this.addInitialsFieldToPdf(pdfDoc, page, field, x, y, width, height, rgb);
          break;
        case 'text':
          await this.addTextFieldToPdf(pdfDoc, page, field, x, y, width, height, rgb);
          break;
        case 'date':
          await this.addDateFieldToPdf(pdfDoc, page, field, x, y, width, height, rgb);
          break;
        default:
          console.warn(`DEBUG: Unsupported field type: ${fieldType}`);
      }
    } catch (error) {
      console.error("DEBUG: Error in addFieldToPdf:", error);
      // Don't throw the error, just log it to allow processing of other fields
    }
  }
  
  async addSignatureFieldToPdf(pdfDoc, page, field, x, y, width, height, rgb) {
    try {
      // Get image source (handle both DOM elements and data objects)
      let imageData = null;
      
      // Try to get image from DOM element
      const img = field.querySelector ? field.querySelector('img') : null;
      if (img && img.src) {
        imageData = img.src;
      } 
      // If no DOM image, try to get from value property
      else if (field.value && typeof field.value === 'string' && field.value.startsWith('data:image')) {
        imageData = field.value;
      }
      
      if (!imageData) {
        console.warn(`DEBUG: No image source found for signature field`);
        return;
      }
      
      console.log(`DEBUG: Image data found for signature field (${imageData.substring(0, 30)}...)`);
      
      try {
        // Determine image format from data URL
        let imageFormat = 'png'; // Default format
        if (imageData.startsWith('data:image/png')) {
          imageFormat = 'png';
        } else if (imageData.startsWith('data:image/jpeg') || imageData.startsWith('data:image/jpg')) {
          imageFormat = 'jpeg';
        }
        
        // Embed the image into the PDF
        const embeddedImage = imageFormat === 'png' 
          ? await pdfDoc.embedPng(imageData)
          : await pdfDoc.embedJpg(imageData);
        
        // Calculate scaling for the image - INCREASED SCALING FACTORS
        // For signatures: 2.5x (was 1.5x)
        const scaleFactor = 2.5;
        
        // Get image dimensions
        const imgWidth = embeddedImage.width;
        const imgHeight = embeddedImage.height;
        
        // Calculate aspect ratio and dimensions to maintain it
        const aspectRatio = imgWidth / imgHeight;
        let drawWidth, drawHeight;
        
        if (aspectRatio > 1) {
          // Wider than tall
          drawWidth = width * scaleFactor;
          drawHeight = drawWidth / aspectRatio;
        } else {
          // Taller than wide or square
          drawHeight = height * scaleFactor;
          drawWidth = drawHeight * aspectRatio;
        }
        
        // Ensure minimum size for visibility
        const minSize = 50; // Increased minimum sizes
        drawWidth = Math.max(drawWidth, minSize);
        drawHeight = Math.max(drawHeight, minSize / aspectRatio);
        
        // Center the image within the field
        const xOffset = (width - drawWidth) / 2;
        const yOffset = (height - drawHeight) / 2;
        
        console.log(`DEBUG: Drawing signature image: size=${drawWidth}x${drawHeight}, position=(${x + xOffset}, ${y - yOffset})`);
        
        // Draw the image
        page.drawImage(embeddedImage, {
          x: x + xOffset,
          y: y - drawHeight - yOffset, // Adjust y position (PDF coordinates start at bottom)
          width: drawWidth,
          height: drawHeight
        });
        
        console.log(`DEBUG: Successfully added signature image to PDF`);
      } catch (imgError) {
        console.error(`DEBUG: Error embedding signature image:`, imgError);
        
        // Fallback to text if image embedding fails
        const helveticaFont = await pdfDoc.embedFont('Helvetica');
        page.drawText(`[signature]`, {
          x: x + 5,
          y: y - 15,
          size: 12,
          font: helveticaFont
        });
        
        // Define drawWidth and drawHeight for later C-box code
        const drawWidth = width;
        const drawHeight = height;
        const xOffset = 0;
        const yOffset = 0;
        
        console.log(`DEBUG: Used text fallback for signature field`);
      }
      
      // Add a C-shaped outline for signature fields
      try {
        // Get a name for the field - default to "Signer" if not available
        let signerName = "Signer";
        
        // Try to get name from field data attributes or parent elements if available
        if (field.dataset && field.dataset.signerName) {
          signerName = field.dataset.signerName;
        } else if (field.closest && field.closest('[data-signer-name]')) {
          signerName = field.closest('[data-signer-name]').dataset.signerName;
        }
        
        // We need valid dimensions for drawing the box - with proper fallbacks
        const drawWidthValue = typeof drawWidth !== 'undefined' ? drawWidth : width;
        const drawHeightValue = typeof drawHeight !== 'undefined' ? drawHeight : height;
        const xOffsetValue = typeof xOffset !== 'undefined' ? xOffset : 0;
        const yOffsetValue = typeof yOffset !== 'undefined' ? yOffset : 0;
        
        // Calculate position for C-shaped outline
        const outlineX = x + xOffsetValue - 10; // Slightly to the left of the field
        const outlineY = y - drawHeightValue - yOffsetValue; // Bottom of field
        const outlineHeight = drawHeightValue + 10; // Slightly taller than the field
        const outlineWidth = 30; // Width of the C shape
        
        console.log(`DEBUG: Drawing C-shaped outline for signature field with dimensions: w=${drawWidthValue}, h=${drawHeightValue}`);
        
        // Left vertical line
        page.drawLine({
          start: { x: outlineX, y: outlineY },
          end: { x: outlineX, y: outlineY + outlineHeight },
          thickness: 2,
          color: rgb(0, 0, 0),
          opacity: 0.9
        });
        
        // Top horizontal line (partial)
        page.drawLine({
          start: { x: outlineX, y: outlineY + outlineHeight },
          end: { x: outlineX + outlineWidth, y: outlineY + outlineHeight },
          thickness: 2,
          color: rgb(0, 0, 0),
          opacity: 0.9
        });
        
        // Bottom horizontal line (partial)
        page.drawLine({
          start: { x: outlineX, y: outlineY },
          end: { x: outlineX + outlineWidth, y: outlineY },
          thickness: 2,
          color: rgb(0, 0, 0),
          opacity: 0.9
        });
        
        // Add text based on field type
        let labelText = `Signed by: ${signerName}`;
        
        const font = await pdfDoc.embedFont('Helvetica');
        page.drawText(labelText, {
          x: outlineX + 5,
          y: outlineY - 15, // Below the field
          size: 9, // Small font size
          font: font,
          color: rgb(0, 0, 0),
          opacity: 1.0
        });
        
        console.log(`DEBUG: Successfully added signature border and text`);
      } catch (borderError) {
        console.error(`DEBUG: Error drawing signature border:`, borderError);
      }
    } catch (error) {
      console.error("DEBUG: Error in addSignatureFieldToPdf:", error);
    }
  }
  
  async addInitialsFieldToPdf(pdfDoc, page, field, x, y, width, height, rgb) {
    try {
      // Get image source (handle both DOM elements and data objects)
      let imageData = null;
      
      // Try to get image from DOM element
      const img = field.querySelector ? field.querySelector('img') : null;
      if (img && img.src) {
        imageData = img.src;
      } 
      // If no DOM image, try to get from value property
      else if (field.value && typeof field.value === 'string' && field.value.startsWith('data:image')) {
        imageData = field.value;
      }
      
      if (!imageData) {
        console.warn(`DEBUG: No image source found for initials field`);
        return;
      }
      
      console.log(`DEBUG: Image data found for initials field (${imageData.substring(0, 30)}...)`);
      
      try {
        // Determine image format from data URL
        let imageFormat = 'png'; // Default format
        if (imageData.startsWith('data:image/png')) {
          imageFormat = 'png';
        } else if (imageData.startsWith('data:image/jpeg') || imageData.startsWith('data:image/jpg')) {
          imageFormat = 'jpeg';
        }
        
        // Embed the image into the PDF
        const embeddedImage = imageFormat === 'png' 
          ? await pdfDoc.embedPng(imageData)
          : await pdfDoc.embedJpg(imageData);
        
        // Calculate scaling for the image - INCREASED SCALING FACTORS
        // For initials: 2.0x (was 1.2x)
        const scaleFactor = 2.0;
        
        // Get image dimensions
        const imgWidth = embeddedImage.width;
        const imgHeight = embeddedImage.height;
        
        // Calculate aspect ratio and dimensions to maintain it
        const aspectRatio = imgWidth / imgHeight;
        let drawWidth, drawHeight;
        
        if (aspectRatio > 1) {
          // Wider than tall
          drawWidth = width * scaleFactor;
          drawHeight = drawWidth / aspectRatio;
        } else {
          // Taller than wide or square
          drawHeight = height * scaleFactor;
          drawWidth = drawHeight * aspectRatio;
        }
        
        // Ensure minimum size for visibility
        const minSize = 30; // Increased minimum sizes
        drawWidth = Math.max(drawWidth, minSize);
        drawHeight = Math.max(drawHeight, minSize / aspectRatio);
        
        // Center the image within the field
        const xOffset = (width - drawWidth) / 2;
        const yOffset = (height - drawHeight) / 2;
        
        console.log(`DEBUG: Drawing initials image: size=${drawWidth}x${drawHeight}, position=(${x + xOffset}, ${y - yOffset})`);
        
        // Draw the image
        page.drawImage(embeddedImage, {
          x: x + xOffset,
          y: y - drawHeight - yOffset, // Adjust y position (PDF coordinates start at bottom)
          width: drawWidth,
          height: drawHeight
        });
        
        console.log(`DEBUG: Successfully added initials image to PDF`);
      } catch (imgError) {
        console.error(`DEBUG: Error embedding initials image:`, imgError);
        
        // Fallback to text if image embedding fails
        const helveticaFont = await pdfDoc.embedFont('Helvetica');
        page.drawText(`[initials]`, {
          x: x + 5,
          y: y - 15,
          size: 12,
          font: helveticaFont
        });
        
        // Define drawWidth and drawHeight for later C-box code
        const drawWidth = width;
        const drawHeight = height;
        const xOffset = 0;
        const yOffset = 0;
        
        console.log(`DEBUG: Used text fallback for initials field`);
      }
      
      // Add a C-shaped outline for initials fields
      try {
        // Get a name for the field - default to "Signer" if not available
        let signerName = "Signer";
        
        // Try to get name from field data attributes or parent elements if available
        if (field.dataset && field.dataset.signerName) {
          signerName = field.dataset.signerName;
        } else if (field.closest && field.closest('[data-signer-name]')) {
          signerName = field.closest('[data-signer-name]').dataset.signerName;
        }
        
        // We need valid dimensions for drawing the box - with proper fallbacks
        const drawWidthValue = typeof drawWidth !== 'undefined' ? drawWidth : width;
        const drawHeightValue = typeof drawHeight !== 'undefined' ? drawHeight : height;
        const xOffsetValue = typeof xOffset !== 'undefined' ? xOffset : 0;
        const yOffsetValue = typeof yOffset !== 'undefined' ? yOffset : 0;
        
        // Calculate position for C-shaped outline
        const outlineX = x + xOffsetValue - 10; // Slightly to the left of the field
        const outlineY = y - drawHeightValue - yOffsetValue; // Bottom of field
        const outlineHeight = drawHeightValue + 10; // Slightly taller than the field
        const outlineWidth = 30; // Width of the C shape
        
        console.log(`DEBUG: Drawing C-shaped outline for initials field with dimensions: w=${drawWidthValue}, h=${drawHeightValue}`);
        
        // Left vertical line
        page.drawLine({
          start: { x: outlineX, y: outlineY },
          end: { x: outlineX, y: outlineY + outlineHeight },
          thickness: 2,
          color: rgb(0, 0, 0),
          opacity: 0.9
        });
        
        // Top horizontal line (partial)
        page.drawLine({
          start: { x: outlineX, y: outlineY + outlineHeight },
          end: { x: outlineX + outlineWidth, y: outlineY + outlineHeight },
          thickness: 2,
          color: rgb(0, 0, 0),
          opacity: 0.9
        });
        
        // Bottom horizontal line (partial)
        page.drawLine({
          start: { x: outlineX, y: outlineY },
          end: { x: outlineX + outlineWidth, y: outlineY },
          thickness: 2,
          color: rgb(0, 0, 0),
          opacity: 0.9
        });
        
        // Add text based on field type
        let labelText = `Initialed by: ${signerName}`;
        
        const font = await pdfDoc.embedFont('Helvetica');
        page.drawText(labelText, {
          x: outlineX + 5,
          y: outlineY - 15, // Below the field
          size: 9, // Small font size
          font: font,
          color: rgb(0, 0, 0),
          opacity: 1.0
        });
        
        console.log(`DEBUG: Successfully added initials border and text`);
      } catch (borderError) {
        console.error(`DEBUG: Error drawing initials border:`, borderError);
      }
    } catch (error) {
      console.error("DEBUG: Error in addInitialsFieldToPdf:", error);
    }
  }
  
  async addTextFieldToPdf(pdfDoc, page, field, x, y, width, height, rgb) {
    try {
      // Get text content (handle both DOM elements and data objects)
      let textContent = '';
      
      // Try to get text from DOM element
      const textElement = field.querySelector ? field.querySelector('div') : null;
      if (textElement) {
        textContent = textElement.textContent || '';
        console.log(`DEBUG: Found text content in div: "${textContent}"`);
      } 
      // If no DOM element found, try to get from value property
      else if (field.value && typeof field.value === 'string') {
        textContent = field.value;
        console.log(`DEBUG: Using value property for text: "${textContent}"`);
      }
      // Try getting innerHTML if no div or value
      else if (field.innerHTML) {
        // Create a temporary element to strip HTML tags
        const temp = document.createElement('div');
        temp.innerHTML = field.innerHTML;
        textContent = temp.textContent || '';
        console.log(`DEBUG: Extracted text from innerHTML: "${textContent}"`);
      }
      // Try the dataset value as a last resort
      else if (field.dataset && field.dataset.value) {
        textContent = field.dataset.value;
        console.log(`DEBUG: Using dataset value: "${textContent}"`);
      }
      
      console.log(`DEBUG: Raw text content for text field: "${textContent}"`);
      
      // If still no text content, use default values
      if (!textContent || textContent.trim() === '') {
        textContent = 'Text Content';
        console.log(`DEBUG: Using default text content: "${textContent}"`);
      }
      
      // Clean the text content to avoid PDF encoding issues
      textContent = textContent.trim()
        .replace(/[\r\n\t\f\v]/g, ' ')  // Replace newlines and tabs with spaces
        .replace(/\s+/g, ' ')          // Replace multiple spaces with single space
        .replace(/[^\x20-\x7E]/g, ''); // Remove non-printable ASCII characters
      
      console.log(`DEBUG: Cleaned text content for text field: "${textContent}"`);
      
      // Skip if content is empty, placeholder, or common placeholder values
      const placeholders = ['[text]', '[date]', 'undefined', 'type here', 'mm/dd/yyyy'];
      const isPlaceholder = placeholders.some(p => textContent.toLowerCase().includes(p.toLowerCase()));
      
      if (isPlaceholder) {
        // Replace placeholders with useful content instead of skipping
        textContent = 'Sample Text';
        console.log(`DEBUG: Replaced placeholder with: "${textContent}"`);
      }
      
      try {
        // Embed a standard font
        const font = await pdfDoc.embedFont('Helvetica');
        
        // Use a fixed font size rather than scaling to fit the field
        const fontSize = 12; // Fixed large font size
        
        // Calculate text width but don't center it - just add a fixed margin
        const textWidth = font.widthOfTextAtSize(textContent, fontSize);
        const xPosition = x + 5; // Fixed small left margin
        
        // Position from bottom with a fixed offset
        const yPosition = y - (height / 2) + (fontSize / 3);
        
        console.log(`DEBUG: Drawing text with fixed font size ${fontSize} at (${xPosition}, ${yPosition})`);
        
        // Draw the text content without trying to fit it in the box
        page.drawText(textContent, {
          x: xPosition,
          y: yPosition,
          size: fontSize,
          font: font,
          color: rgb(0, 0, 0),
          lineHeight: fontSize * 1.2
        });
        
        console.log(`DEBUG: Successfully added text to PDF`);
        
        // Add a C-shaped outline and "Entered by" text for text fields
        try {
          // Get a name for the field - default to "Signer" if not available
          let signerName = "Signer";
          
          // Try to get name from field data attributes or parent elements if available
          if (field.dataset && field.dataset.signerName) {
            signerName = field.dataset.signerName;
          } else if (field.closest && field.closest('[data-signer-name]')) {
            signerName = field.closest('[data-signer-name]').dataset.signerName;
          }
          
          // Calculate position for C-shaped outline - adjust for text fields which have different positioning
          const outlineX = x - 10; // Left of the text
          const outlineY = y - height; // Bottom of the field
          const outlineHeight = height + 5; // Slightly taller than the field
          const outlineWidth = 30; // Width of the C shape
          
          console.log(`DEBUG: Drawing C-shaped outline for text field`);
          
          // Left vertical line
          page.drawLine({
            start: { x: outlineX, y: outlineY },
            end: { x: outlineX, y: outlineY + outlineHeight },
            thickness: 2,
            color: rgb(0, 0, 0),
            opacity: 0.9
          });
          
          // Top horizontal line (partial)
          page.drawLine({
            start: { x: outlineX, y: outlineY + outlineHeight },
            end: { x: outlineX + outlineWidth, y: outlineY + outlineHeight },
            thickness: 2,
            color: rgb(0, 0, 0),
            opacity: 0.9
          });
          
          // Bottom horizontal line (partial)
          page.drawLine({
            start: { x: outlineX, y: outlineY },
            end: { x: outlineX + outlineWidth, y: outlineY },
            thickness: 2,
            color: rgb(0, 0, 0),
            opacity: 0.9
          });
          
          // Add "Entered by: [name]" text
          const font = await pdfDoc.embedFont('Helvetica');
          let labelText = `Entered by: ${signerName}`;
          
          page.drawText(labelText, {
            x: outlineX + 5,
            y: outlineY - 15, // Below the field
            size: 9, // Small font size
            font: font,
            color: rgb(0, 0, 0),
            opacity: 1.0
          });
          
          console.log(`DEBUG: Successfully added text field border and text`);
        } catch (borderError) {
          console.error(`DEBUG: Error drawing text field border:`, borderError);
        }
      } catch (textError) {
        console.error(`DEBUG: Error adding text:`, textError);
        // Try a fallback approach with simpler text rendering
        try {
          const font = await pdfDoc.embedFont('Helvetica');
          page.drawText(textContent.substring(0, 50), { // Limit text length as a fallback
            x: x + 5,
            y: y - 15,
            size: 10,
            font: font
          });
          console.log(`DEBUG: Used fallback approach for text rendering`);
        } catch (fallbackError) {
          console.error(`DEBUG: Even fallback text rendering failed:`, fallbackError);
        }
      }
    } catch (error) {
      console.error("DEBUG: Error in addTextFieldToPdf:", error);
    }
  }
  
  async addDateFieldToPdf(pdfDoc, page, field, x, y, width, height, rgb) {
    try {
      // Get text content (handle both DOM elements and data objects)
      let textContent = '';
      
      // Try to get text from DOM element
      const textElement = field.querySelector ? field.querySelector('div') : null;
      if (textElement) {
        textContent = textElement.textContent || '';
        console.log(`DEBUG: Found text content in div: "${textContent}"`);
      } 
      // If no DOM element found, try to get from value property
      else if (field.value && typeof field.value === 'string') {
        textContent = field.value;
        console.log(`DEBUG: Using value property for text: "${textContent}"`);
      }
      // Try getting innerHTML if no div or value
      else if (field.innerHTML) {
        // Create a temporary element to strip HTML tags
        const temp = document.createElement('div');
        temp.innerHTML = field.innerHTML;
        textContent = temp.textContent || '';
        console.log(`DEBUG: Extracted text from innerHTML: "${textContent}"`);
      }
      // Try the dataset value as a last resort
      else if (field.dataset && field.dataset.value) {
        textContent = field.dataset.value;
        console.log(`DEBUG: Using dataset value: "${textContent}"`);
      }
      
      console.log(`DEBUG: Raw text content for date field: "${textContent}"`);
      
      // If still no text content, use default values
      if (!textContent || textContent.trim() === '') {
        textContent = '01/01/2023';
        console.log(`DEBUG: Using default text content: "${textContent}"`);
      }
      
      // Clean the text content to avoid PDF encoding issues
      textContent = textContent.trim()
        .replace(/[\r\n\t\f\v]/g, ' ')  // Replace newlines and tabs with spaces
        .replace(/\s+/g, ' ')          // Replace multiple spaces with single space
        .replace(/[^\x20-\x7E]/g, ''); // Remove non-printable ASCII characters
      
      console.log(`DEBUG: Cleaned text content for date field: "${textContent}"`);
      
      // Skip if content is empty, placeholder, or common placeholder values
      const placeholders = ['[text]', '[date]', 'undefined', 'type here', 'mm/dd/yyyy'];
      const isPlaceholder = placeholders.some(p => textContent.toLowerCase().includes(p.toLowerCase()));
      
      if (isPlaceholder) {
        // Replace placeholders with useful content instead of skipping
        textContent = '01/01/2023';
        console.log(`DEBUG: Replaced placeholder with: "${textContent}"`);
      }
      
      try {
        // Embed a standard font
        const font = await pdfDoc.embedFont('Helvetica');
        
        // Use a fixed font size rather than scaling to fit the field
        const fontSize = 12; // Fixed large font size
        
        // Calculate text width but don't center it - just add a fixed margin
        const textWidth = font.widthOfTextAtSize(textContent, fontSize);
        const xPosition = x + 5; // Fixed small left margin
        
        // Position from bottom with a fixed offset
        const yPosition = y - (height / 2) + (fontSize / 3);
        
        console.log(`DEBUG: Drawing date text with fixed font size ${fontSize} at (${xPosition}, ${yPosition})`);
        
        // For date fields, format them in a more recognizable date format if possible
        try {
          // Check if the text is a valid date
          const parsedDate = new Date(textContent);
          if (!isNaN(parsedDate.getTime())) {
            // If it's a valid date, format it consistently
            textContent = parsedDate.toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric'
            });
            console.log(`DEBUG: Reformatted date to: "${textContent}"`);
          }
        } catch (dateError) {
          console.log(`DEBUG: Could not parse as date: "${textContent}"`);
          // Keep original text if date parsing fails
        }
        
        // Draw the text content without trying to fit it in the box
        page.drawText(textContent, {
          x: xPosition,
          y: yPosition,
          size: fontSize,
          font: font,
          color: rgb(0, 0, 0),
          lineHeight: fontSize * 1.2
        });
        
        // For date fields, add a small calendar icon if there's room
        if (width > 80) {
          const iconSize = Math.min(16, height * 0.3);
          const iconX = x + width - iconSize - 5;
          const iconY = y - iconSize - 5;
          
          // Simple calendar icon (just a rectangle with a line)
          page.drawRectangle({
            x: iconX,
            y: iconY,
            width: iconSize,
            height: iconSize,
            borderColor: rgb(0.5, 0.3, 0.0),
            borderWidth: 1,
            color: rgb(1, 1, 1),
            opacity: 0.9
          });
          
          // Calendar top line
          page.drawLine({
            start: { x: iconX, y: iconY - iconSize * 0.25 },
            end: { x: iconX + iconSize, y: iconY - iconSize * 0.25 },
            thickness: 1,
            color: rgb(0.5, 0.3, 0.0),
            opacity: 0.9
          });
        }
        
        console.log(`DEBUG: Successfully added date text to PDF`);
        
        // Add a C-shaped outline and "Date entered by" text for date fields
        try {
          // Get a name for the field - default to "Signer" if not available
          let signerName = "Signer";
          
          // Try to get name from field data attributes or parent elements if available
          if (field.dataset && field.dataset.signerName) {
            signerName = field.dataset.signerName;
          } else if (field.closest && field.closest('[data-signer-name]')) {
            signerName = field.closest('[data-signer-name]').dataset.signerName;
          }
          
          // Calculate position for C-shaped outline - adjust for date fields which have different positioning
          const outlineX = x - 10; // Left of the text
          const outlineY = y - height; // Bottom of the field
          const outlineHeight = height + 5; // Slightly taller than the field
          const outlineWidth = 30; // Width of the C shape
          
          console.log(`DEBUG: Drawing C-shaped outline for date field`);
          
          // Left vertical line
          page.drawLine({
            start: { x: outlineX, y: outlineY },
            end: { x: outlineX, y: outlineY + outlineHeight },
            thickness: 2,
            color: rgb(0, 0, 0),
            opacity: 0.9
          });
          
          // Top horizontal line (partial)
          page.drawLine({
            start: { x: outlineX, y: outlineY + outlineHeight },
            end: { x: outlineX + outlineWidth, y: outlineY + outlineHeight },
            thickness: 2,
            color: rgb(0, 0, 0),
            opacity: 0.9
          });
          
          // Bottom horizontal line (partial)
          page.drawLine({
            start: { x: outlineX, y: outlineY },
            end: { x: outlineX + outlineWidth, y: outlineY },
            thickness: 2,
            color: rgb(0, 0, 0),
            opacity: 0.9
          });
          
          // Add "Date entered by: [name]" text
          const font = await pdfDoc.embedFont('Helvetica');
          let labelText = `Date entered by: ${signerName}`;
          
          page.drawText(labelText, {
            x: outlineX + 5,
            y: outlineY - 15, // Below the field
            size: 9, // Small font size
            font: font,
            color: rgb(0, 0, 0),
            opacity: 1.0
          });
          
          console.log(`DEBUG: Successfully added date field border and text`);
        } catch (borderError) {
          console.error(`DEBUG: Error drawing date field border:`, borderError);
        }
      } catch (textError) {
        console.error(`DEBUG: Error adding date text:`, textError);
        // Try a fallback approach with simpler text rendering
        try {
          const font = await pdfDoc.embedFont('Helvetica');
          page.drawText(textContent.substring(0, 50), { // Limit text length as a fallback
            x: x + 5,
            y: y - 15,
            size: 10,
            font: font
          });
          console.log(`DEBUG: Used fallback approach for date text rendering`);
        } catch (fallbackError) {
          console.error(`DEBUG: Even fallback text rendering failed:`, fallbackError);
        }
      }
    } catch (error) {
      console.error("DEBUG: Error in addDateFieldToPdf:", error);
    }
  }
  
  // Helper method to download a file
  downloadFile(blob, filename) {
    console.log("DEBUG: downloadFile called with blob size:", blob.size, "and filename:", filename);
    
    try {
      // Create a URL for the blob
      const url = window.URL.createObjectURL(blob);
      console.log("DEBUG: Blob URL created:", url);
      
      // Try modern download approach first
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      console.log("DEBUG: Download link created");
      
      // Some browsers require the element to be in the DOM
      document.body.appendChild(a);
      console.log("DEBUG: Link appended to document");
      
      // Trigger click to start download
      console.log("DEBUG: Triggering click on download link");
      a.click();
      
      // Clean up
      console.log("DEBUG: Removing link from document");
      setTimeout(() => {
        document.body.removeChild(a);
        console.log("DEBUG: Revoking blob URL");
        window.URL.revokeObjectURL(url);
      }, 100);
      
      console.log("DEBUG: Download process initiated");
      return true;
    } catch (error) {
      console.error("DEBUG: Error in primary download method:", error);
      
      // Fallback method using iframe
      try {
        console.log("DEBUG: Trying fallback download method (iframe)");
        const iframe = document.createElement('iframe');
        iframe.style.display = 'none';
        document.body.appendChild(iframe);
        
        const iframeDoc = iframe.contentWindow.document;
        const url = window.URL.createObjectURL(blob);
        
        // Create a link in the iframe and click it
        const a = iframeDoc.createElement('a');
        a.href = url;
        a.download = filename;
        iframeDoc.body.appendChild(a);
        a.click();
        
        // Clean up
        setTimeout(() => {
          document.body.removeChild(iframe);
          window.URL.revokeObjectURL(url);
        }, 100);
        
        console.log("DEBUG: Fallback download method completed");
        return true;
      } catch (fallbackError) {
        console.error("DEBUG: Error in fallback download method:", fallbackError);
        
        // Final fallback - open in new window
        try {
          console.log("DEBUG: Trying final fallback (new window)");
          const url = window.URL.createObjectURL(blob);
          const newWindow = window.open(url, '_blank');
          
          if (!newWindow) {
            console.warn("DEBUG: New window was blocked. Alerting user with instructions.");
            alert(`The PDF has been generated but couldn't be automatically downloaded. \n\nPlease change your browser settings to allow popups from this site, then try again.`);
          } else {
            console.log("DEBUG: PDF opened in new window");
            
            // Give the user instructions to save the PDF
            alert(`Your PDF has been generated and opened in a new tab.\n\nPlease use your browser's "Save As" feature (often Ctrl+S or Cmd+S) to save the file to your computer.`);
          }
          
          // Clean up the URL after a longer delay
          setTimeout(() => {
            window.URL.revokeObjectURL(url);
          }, 30000);
          
          return true;
        } catch (finalError) {
          console.error("DEBUG: All download methods failed:", finalError);
          alert(`The PDF was generated successfully, but your browser couldn't download it automatically. \n\nPlease try again or contact support if the problem persists.`);
          return false;
        }
      }
    }
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
      try {
        // Parse and format the date more robustly
      const date = new Date(value);
        
        // Validate that the date is valid
        if (isNaN(date.getTime())) {
          console.warn(`DEBUG: Invalid date value: "${value}"`);
          alert('Please enter a valid date');
          return;
        }
        
        // Format the date for display with a more readable format
      const formattedDate = date.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric', 
        year: 'numeric' 
      });
      
        console.log(`DEBUG: Formatted date field ${fieldId}: "${value}" → "${formattedDate}"`);
        
        // Save the formatted date
      this.updateField(fieldId, formattedDate);
        
        // Mark field as date type explicitly
        field.classList.add('date-field');
        
        // Update completion status
      this.updateFieldStatuses();
      } catch (error) {
        console.error(`DEBUG: Error processing date: ${error.message}`);
        alert('Error processing date. Please try a different format.');
      }
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