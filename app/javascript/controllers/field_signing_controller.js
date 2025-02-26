import { Controller } from "@hotwired/stimulus"

// Connects to data-controller="field-signing"
export default class extends Controller {
  static targets = ["field", "container", "modal", "pageContainer", "signatureCanvas"]
  static values = {
    documentId: Number,
    signerId: Number,
    token: String,
    page: { type: Number, default: 1 },
    currentField: { type: String, default: "" },
    completeRedirectUrl: String
  }
  
  connect() {
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
      field.style.width = `${width}px`;
      field.style.height = `${height}px`;
      field.style.transform = 'translate(-50%, -50%)';
      
      // Add a class to identify the page this field belongs to
      field.classList.add(`page-${pageNumber}-field`);
      
      // If the field is not already completed, convert it to an appropriate input
      if (!isCompleted) {
        if (fieldType === 'text') {
          // Replace with an actual text input
          const label = field.querySelector('.text-xs');
          if (label) {
            const required = field.dataset.required === "true";
            
            // Clear the field
            field.innerHTML = '';
            
            // Create and add input
            const input = document.createElement('input');
            input.type = 'text';
            input.className = 'w-full h-full p-1 text-sm border-none focus:ring-2 focus:ring-blue-500';
            input.placeholder = required ? 'Text *' : 'Text';
            input.required = required;
            input.dataset.action = 'change->field-signing#handleInputChange';
            
            field.appendChild(input);
            field.dataset.action = ''; // Remove the modal open action
          }
        } 
        else if (fieldType === 'date') {
          // Replace with an actual date input
          const label = field.querySelector('.text-xs');
          if (label) {
            const required = field.dataset.required === "true";
            
            // Clear the field
            field.innerHTML = '';
            
            // Create and add input
            const input = document.createElement('input');
            input.type = 'date';
            input.className = 'w-full h-full p-1 text-sm border-none focus:ring-2 focus:ring-blue-500';
            input.required = required;
            input.dataset.action = 'change->field-signing#handleInputChange';
            
            // Set default value to today's date
            const today = new Date().toISOString().split('T')[0];
            input.value = today;
            
            field.appendChild(input);
            field.dataset.action = ''; // Remove the modal open action
          }
        }
        // Keep signature/initials as clickable areas that open the modal
      }
    });
  }
  
  // Update field positions based on the current PDF pages in the DOM
  updateFieldPositions() {
    console.log("Updating field positions for multi-page layout");
    
    // Check if we have a container target
    if (!this.hasContainerTarget) {
      console.error("Missing container target! Cannot position fields.");
      return;
    }
    
    // Find all PDF page containers in the document - specifically inside the pdf-pages-container
    const pagesContainer = document.querySelector('.pdf-pages-container');
    if (!pagesContainer) {
      console.warn("No pages container found - delaying field positioning");
      setTimeout(() => this.updateFieldPositions(), 500);
      return;
    }
    
    const pageContainers = pagesContainer.querySelectorAll('.pdf-page-container');
    
    if (!pageContainers.length) {
      console.log("No page containers found yet, will try again later");
      setTimeout(() => this.updateFieldPositions(), 500);
      return;
    }
    
    console.log(`Found ${pageContainers.length} page containers`);
    
    try {
      // Get the container rect to calculate relative positions
      const containerRect = this.containerTarget.getBoundingClientRect();
      
      // For each page, find its top offset and position fields accordingly
      pageContainers.forEach(pageContainer => {
        const pageNumber = parseInt(pageContainer.dataset.page, 10);
        const pageCanvas = pageContainer.querySelector('canvas');
        
        if (!pageCanvas) {
          console.log(`No canvas found for page ${pageNumber}`);
          return;
        }
        
        const pageRect = pageCanvas.getBoundingClientRect();
        
        // Calculate page offset relative to container
        const pageOffsetTop = pageRect.top - containerRect.top;
        const pageOffsetLeft = pageRect.left - containerRect.left;
        
        console.log(`Page ${pageNumber} positioned at: left=${pageOffsetLeft}, top=${pageOffsetTop}, width=${pageRect.width}, height=${pageRect.height}`);
        
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
          const xPosAbsolute = (xPosPercent / 100) * pageRect.width;
          const yPosAbsolute = (yPosPercent / 100) * pageRect.height;
          
          // Set absolute position relative to the container
          field.style.position = 'absolute';
          field.style.left = `${pageOffsetLeft + xPosAbsolute}px`;
          field.style.top = `${pageOffsetTop + yPosAbsolute}px`;
          
          // Set the width and height based on the scaled page
          const fieldWidth = parseFloat(field.dataset.width);
          const fieldHeight = parseFloat(field.dataset.height);
          
          // Apply the same scale factor that's being used on the page
          const scale = pageRect.width / pageCanvas.width;
          field.style.width = `${fieldWidth * scale}px`;
          field.style.height = `${fieldHeight * scale}px`;
          
          // Use transform for centering (offset by 50% of the field's width and height)
          field.style.transform = 'translate(-50%, -50%)';
          
          // Make field visible now that it's correctly positioned
          field.classList.add('positioned');
          
          console.log(`Positioned field ${field.dataset.fieldId} at: left=${field.style.left}, top=${field.style.top}, width=${field.style.width}, height=${field.style.height}`);
        });
      });
    } catch (error) {
      console.error("Error positioning fields:", error);
    }
  }
  
  // Handle the page change event
  handlePageChange(event) {
    console.log("Page change event received:", event);
    // In the new layout with all pages displayed, we just need to ensure
    // fields are positioned correctly
    this.updateFieldPositions();
  }
  
  openSignatureModal(event) {
    event.preventDefault()
    
    // Only respond to empty fields
    const field = event.currentTarget
    if (field.dataset.completed === "true") return
    
    const fieldType = field.dataset.fieldType
    const fieldId = field.dataset.fieldId
    
    this.currentFieldValue = fieldId
    
    // Show the appropriate modal
    if (this.hasModalTarget) {
      // Determine which part of the modal to show
      const modalContent = this.modalTarget.querySelector(`.modal-content[data-field-type="${fieldType}"]`)
      if (modalContent) {
        // Hide all content sections, show the current one
        this.modalTarget.querySelectorAll('.modal-content').forEach(content => {
          content.classList.add('hidden')
        })
        modalContent.classList.remove('hidden')
        
        // Show the modal
        this.modalTarget.classList.remove('hidden')
        
        // Add modal backdrop
        const backdrop = document.createElement('div')
        backdrop.className = 'modal-backdrop fixed inset-0 bg-black bg-opacity-50 z-40'
        document.body.appendChild(backdrop)
        this.backdrop = backdrop
        
        // If this is a signature field, initialize the signature pad
        if (fieldType === 'signature' || fieldType === 'initials') {
          this.initializeSignaturePad()
        }
        
        // If text field, focus on the input
        if (fieldType === 'text') {
          setTimeout(() => {
            const input = modalContent.querySelector('input[type="text"]')
            if (input) input.focus()
          }, 100)
        }
        
        // If date field, initialize with current date
        if (fieldType === 'date') {
          const input = modalContent.querySelector('input[type="date"]')
          if (input && !input.value) {
            const today = new Date().toISOString().split('T')[0]
            input.value = today
          }
        }
      }
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
      // Create an image element to show the signature
      const img = document.createElement('img')
      img.src = value
      img.className = 'w-full h-full object-contain'
      
      // Clear the field and add the image
      field.innerHTML = ''
      field.appendChild(img)
    } else if (fieldType === 'text' || fieldType === 'date') {
      // Create a div to show the text value
      const div = document.createElement('div')
      div.className = 'w-full h-full flex items-center justify-center text-center p-1'
      div.textContent = value
      
      // Clear the field and add the div
      field.innerHTML = ''
      field.appendChild(div)
    }
    
    // Mark as completed
    field.dataset.completed = "true"
    field.classList.remove('border-dashed')
    field.classList.add('border-solid', 'bg-gray-50')
    
    // Check if all fields are completed
    this.checkCompletionStatus()
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
} 