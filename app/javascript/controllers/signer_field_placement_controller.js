import { Controller } from "@hotwired/stimulus"

// Connects to data-controller="signer-field-placement"
export default class SignerFieldPlacementController extends Controller {
  static targets = ["container", "fieldsList"]
  static values = { 
    documentId: String,
    signerId: { type: String, default: "" },
    mode: { type: String, default: "view" }
  }

  connect() {
    console.log("%c██████████████████████████████████████████████████", "color: blue; font-size: 20px;");
    console.log("%cSIGNER FIELD PLACEMENT CONTROLLER CONNECTED!!!", "color: blue; font-weight: bold; font-size: 24px;");
    console.log("%c██████████████████████████████████████████████████", "color: blue; font-size: 20px;");
    
    console.log("Signer Field Placement Controller connected")
    this.fields = []
    this.currentPage = 1
    this.lastKnownPdfScale = 1.0 // Track PDF scale
    
    // Enhanced debugging on connection
    console.log("Controller values initialized:")
    console.log(`- Document ID: ${this.documentIdValue}`)
    console.log(`- Current page: ${this.currentPage}`)
    console.log(`- Mode: ${this.modeValue}`)
    
    // Initialize
    this.setupEventListeners()
    
    // Check for targets after DOM is fully loaded
    setTimeout(() => {
      this.checkTargets()
    }, 500)
    
    // Load existing fields for current page
    this.loadFieldsForCurrentPage()

    // Listen for PDF scale changes
    this.listenForPdfScaleChanges()
    
    // Listen for PDF page changes
    this.listenForPdfPageChanges()
  }
  
  // Check if targets are properly connected
  checkTargets() {
    console.log("Checking controller targets:")
    console.log(`- Container target: ${this.hasContainerTarget ? 'Found' : 'Not found'}`)
  }

  setupEventListeners() {
    if (this.hasContainerTarget) {
      // Keyboard events for canceling
      document.addEventListener("keydown", this.handleKeyDown.bind(this))
      
      // Add window resize listener to handle container size changes
      window.addEventListener("resize", this.handleWindowResize.bind(this))
      
      console.log("Event listeners set up successfully")
    } else {
      console.warn("Container target not found, cannot set up event listeners")
    }
  }

  disconnect() {
    if (this.hasContainerTarget) {
      document.removeEventListener("keydown", this.handleKeyDown.bind(this))
      window.removeEventListener("resize", this.handleWindowResize.bind(this))
    }
  }

  handleKeyDown(event) {
    // ESC key functionality if needed
    if (event.key === "Escape") {
      // Close any modals or overlays if needed
    }
  }

  handleWindowResize() {
    console.log("Window resized, updating field positions");
    // Update field positions on window resize
    if (this.lastKnownPdfScale !== 1.0) {
      this.updateFieldsForZoomChange(this.lastKnownPdfScale);
    }
  }

  loadFieldsForCurrentPage() {
    console.log(`Loading fields for page ${this.currentPage}`);
    
    // First check if we're in multi-page view (all pages visible)
    const isMultiPageView = document.querySelector('.pdf-pages-container');
    const allPagesVisible = isMultiPageView !== null;
    
    // Hide/show fields based on the current page, unless all pages are visible
    this.fields.forEach(field => {
      if (field.element) {
        if (allPagesVisible || parseInt(field.pageNumber) === parseInt(this.currentPage)) {
          // Show fields for the current page or all pages if in multi-page view
          field.element.style.display = 'block';
        } else {
          // Hide fields for other pages
          field.element.style.display = 'none';
        }
      }
    });
    
    // Update the field list UI visibility
    if (this.hasFieldsListTarget) {
      const allListItems = this.fieldsListTarget.querySelectorAll('li[data-field-id]');
      allListItems.forEach(item => {
        const page = parseInt(item.dataset.page);
        if (allPagesVisible || page === parseInt(this.currentPage)) {
          item.style.display = 'flex'; // List items use flex layout
        } else {
          item.style.display = 'none';
        }
      });
    }
    
    // Check if we've already loaded fields for this page
    const hasFieldsForCurrentPage = this.fields.some(field => 
      parseInt(field.pageNumber) === parseInt(this.currentPage)
    );
    
    // Only fetch from server if we haven't loaded fields for this page yet
    if (!hasFieldsForCurrentPage) {
      console.log(`Fetching fields for page ${this.currentPage} from server`);
      
      // Fetch fields for this page from the server
      fetch(`/sign/${this.documentIdValue}/form_fields?page_number=${this.currentPage}`)
        .then(response => response.json())
        .then(data => {
          console.log(`Loaded ${data.length} fields for page ${this.currentPage}:`, data);
          
          // Add each field to the PDF
          if (Array.isArray(data)) {
            data.forEach(fieldData => {
              this.addFieldFromServer(fieldData);
            });
            
            // If we have a non-default scale, apply it to all fields that were just added
            if (this.lastKnownPdfScale && this.lastKnownPdfScale !== 1.0) {
              console.log(`Applying current scale ${this.lastKnownPdfScale} to newly loaded fields`);
              this.updateFieldsForZoomChange(this.lastKnownPdfScale);
            }
          }
        })
        .catch(error => {
          console.error("Error loading fields:", error);
        });
    } else {
      console.log(`Using existing fields for page ${this.currentPage}`);
    }
  }

  addFieldFromServer(fieldData) {
    console.log("Adding field from server:", fieldData);
    
    // Create a field element
    const fieldElement = document.createElement('div');
    fieldElement.className = `signature-field field-${fieldData.field_type}`;
    
    // Add signer-specific class for color coding
    if (fieldData.document_signer_id) {
      // Get the signer index from the signerSelect dropdown
      const signerIndex = this.getSignerIndexById(fieldData.document_signer_id);
      if (signerIndex > 0) {
        // Add signer class (signer-1, signer-2, etc.)
        fieldElement.classList.add(`signer-${signerIndex}`);
      }
    }
    
    // Set the ID with db- prefix to indicate it's from the database
    fieldElement.id = `db-${fieldData.id}`;
    fieldElement.dataset.fieldId = fieldData.id;
    fieldElement.dataset.page = fieldData.page_number; // Add page attribute for filtering
    fieldElement.dataset.signerId = fieldData.document_signer_id; // Store signer ID for reference
    
    // Calculate position in percentages
    const xPercent = fieldData.x_position;
    const yPercent = fieldData.y_position;
    const widthPercent = fieldData.width;
    const heightPercent = fieldData.height;
    
    // Check if we're in multi-page view
    const isMultiPageView = document.querySelector('.pdf-pages-container');
    
    if (isMultiPageView) {
      // Find the specific page container for this field
      const pageContainer = document.querySelector(`.pdf-page-container[data-page="${fieldData.page_number}"]`);
      
      if (pageContainer) {
        // Position is relative to the page container in multi-page view
        const containerRect = pageContainer.getBoundingClientRect();
        
        // Set position and size using percentage values
        fieldElement.style.left = `${xPercent}%`;
        fieldElement.style.top = `${yPercent}%`;
        fieldElement.style.width = `${widthPercent}%`;
        fieldElement.style.height = `${heightPercent}%`;
        
        // Add the field to the specific page container
        pageContainer.appendChild(fieldElement);
      } else {
        // Fallback to main container if page container not found
        fieldElement.style.left = `${xPercent}%`;
        fieldElement.style.top = `${yPercent}%`;
        fieldElement.style.width = `${widthPercent}%`;
        fieldElement.style.height = `${heightPercent}%`;
        
        // Add the field to the main container
        this.containerTarget.appendChild(fieldElement);
      }
    } else {
      // Set position and size using percentage values
      fieldElement.style.left = `${xPercent}%`;
      fieldElement.style.top = `${yPercent}%`;
      fieldElement.style.width = `${widthPercent}%`;
      fieldElement.style.height = `${heightPercent}%`;
      
      // Set visibility based on current page
      if (parseInt(fieldData.page_number) === parseInt(this.currentPage)) {
        fieldElement.style.display = 'block';
      } else {
        fieldElement.style.display = 'none';
      }
      
      // Add the field to the container
      this.containerTarget.appendChild(fieldElement);
    }
    
    // Create a field label element
    const labelElement = document.createElement('div');
    labelElement.className = 'field-label';
    
    // Add appropriate icon for the field type
    let fieldIcon = ''
    switch (fieldData.field_type) {
      case 'signature':
        fieldIcon = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="signature-icon"><path d="M15 3h6v6M14 10l7-7m-7 17H4a2 2 0 01-2-2V5"/></svg>'
        labelElement.innerHTML = fieldIcon + ' Signature'
        break
      case 'initials':
        fieldIcon = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="initials-icon"><path d="M3 5h4v14H3V5zm14 0h4v14h-4V5zm-7 0h4v14h-4V5z"/></svg>'
        labelElement.innerHTML = fieldIcon + ' Initials'
        break
      case 'text':
        fieldIcon = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="text-icon"><path d="M4 6h16M4 12h16M4 18h16"/></svg>'
        labelElement.innerHTML = fieldIcon + ' Text'
        break
      case 'date':
        fieldIcon = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="date-icon"><path d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>'
        labelElement.innerHTML = fieldIcon + ' Date'
        break
      case 'checkbox':
        fieldIcon = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="checkbox-icon"><path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg>'
        labelElement.innerHTML = fieldIcon + ' Checkbox'
        break
      default:
        labelElement.textContent = fieldData.field_type.charAt(0).toUpperCase() + fieldData.field_type.slice(1)
    }
    
    fieldElement.appendChild(labelElement);
    
    // Add click event for field completion
    fieldElement.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.handleFieldClick(fieldData.id, fieldData.field_type);
    });
    
    // Store the field in our internal list
    const fieldObj = {
      ...fieldData,
      element: fieldElement,
      pageNumber: fieldData.page_number // Ensure we use pageNumber consistently
    };
    
    this.fields.push(fieldObj);
    
    // Add the positioned class after a short delay to ensure it's fully rendered
    setTimeout(() => {
      fieldElement.classList.add('positioned');
      console.log(`Field ${fieldData.id} is now positioned and visible`);
    }, 100);
    
    return fieldElement;
  }

  // Handle field click for signing
  handleFieldClick(fieldId, fieldType) {
    console.log(`Field clicked: ${fieldId}, Type: ${fieldType}`);
    
    // Dispatch an event that the signing controller can listen for
    const event = new CustomEvent('field-placement:field-clicked', {
      detail: {
        fieldId: fieldId,
        fieldType: fieldType
      },
      bubbles: true
    });
    
    this.element.dispatchEvent(event);
  }

  // Helper method for getting signer index
  getSignerIndexById(signerId) {
    // This is a simplified version - in a real app you'd look this up from the data
    return parseInt(signerId) || 0;
  }

  // Listen for PDF scale changes
  listenForPdfScaleChanges() {
    document.addEventListener('pdf-viewer:scaleChanged', (event) => {
      console.log('PDF scale changed:', event.detail);
      const newScale = event.detail.scale;
      
      if (newScale !== this.lastKnownPdfScale) {
        this.lastKnownPdfScale = newScale;
        this.updateFieldsForZoomChange(newScale);
      }
    });
  }

  // Update field positions when PDF scale changes
  updateFieldsForZoomChange(newScale) {
    console.log(`Updating fields for scale change to ${newScale}`);
    
    this.fields.forEach(field => {
      if (field.element) {
        // Apply the scale transform to each field
        field.element.style.transform = `scale(${newScale})`;
        field.element.style.transformOrigin = 'top left';
      }
    });
  }

  // Listen for PDF page changes
  listenForPdfPageChanges() {
    document.addEventListener('pdf-viewer:pageChanged', (event) => {
      console.log('PDF page changed:', event.detail);
      const newPage = event.detail.page;
      
      if (this.currentPage !== newPage) {
        this.currentPage = newPage;
        this.loadFieldsForCurrentPage();
      }
    });
  }
} 