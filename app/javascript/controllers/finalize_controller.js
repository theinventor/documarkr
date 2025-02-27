import { Controller } from "@hotwired/stimulus"

// Connects to data-controller="finalize"
export default class extends Controller {
  static targets = ["field", "container", "pdfContainer", "savePdfButton"]
  static values = {
    documentId: Number
  }
  
  connect() {
    console.log("%c██████████████████████████████████████████████████", "color: teal; font-size: 20px;");
    console.log("%cFINALIZE CONTROLLER CONNECTED!!!", "color: teal; font-weight: bold; font-size: 24px;");
    console.log("%c██████████████████████████████████████████████████", "color: teal; font-size: 20px;");

    console.log("Finalize controller connected");
    
    // Install event listeners
    this.handlePageChangeEvent = this.handlePageChangeEvent.bind(this);
    document.addEventListener('pdf-viewer:pageChanged', this.handlePageChangeEvent);
    
    // Explicitly bind updateFieldPositions
    this.boundUpdateFieldPositions = this.updateFieldPositions.bind(this);
    
    // Listen for PDF viewer scale changes and loaded events
    document.addEventListener('pdf-viewer:scaleChanged', this.boundUpdateFieldPositions);
    document.addEventListener('pdf-viewer:loaded', this.boundUpdateFieldPositions);
  }
  
  disconnect() {
    // Remove event listeners
    document.removeEventListener('pdf-viewer:pageChanged', this.handlePageChangeEvent);
    document.removeEventListener('pdf-viewer:scaleChanged', this.boundUpdateFieldPositions);
    document.removeEventListener('pdf-viewer:loaded', this.boundUpdateFieldPositions);
  }
  
  handlePageChangeEvent(event) {
    console.log("Page changed to", event.detail.page);
    this.updateFieldPositions();
  }
  
  setupFieldPositionStyles() {
    // We're now applying styles directly in updateFieldPositions() for consistency
    // Just providing a fallback with a minimal set of styles
    if (!document.getElementById('field-positioning-styles')) {
      const styleEl = document.createElement('style');
      styleEl.id = 'field-positioning-styles';
      styleEl.innerHTML = `
        .form-field-container {
          position: absolute;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
        }
        
        .form-field-container.text-field,
        .form-field-container.date-field {
          justify-content: flex-start;
        }
        
        .form-field-container img {
          width: 100%;
          height: 100%;
          object-fit: contain;
          padding: 4px;
        }
      `;
      document.head.appendChild(styleEl);
    }
  }
  
  updateFieldPositions() {
    console.log("Updating field positions");
    
    // Make sure we have our custom styles
    this.setupFieldPositionStyles();
    
    // If no container target, bail early
    if (!this.hasContainerTarget) {
      console.warn("No container target found for field positioning");
      return;
    }
    
    // Get elements
    const container = this.containerTarget;
    const pdfContainer = document.querySelector('[data-pdf-viewer-target="container"]');
    
    if (!pdfContainer) {
      console.warn("No PDF container found for field positioning");
      return;
    }
    
    // Get the scale from the PDF viewer (may be stored on the element)
    let scale = pdfContainer.dataset.scale || 1.0;
    if (typeof scale === 'string') scale = parseFloat(scale);
    
    // Get the current page number from the viewer
    const currentPage = parseInt(pdfContainer.dataset.currentPage || 1);
    
    // Minimum field dimensions (matching signing flow)
    const MIN_FIELD_WIDTH = 100; 
    const MIN_FIELD_HEIGHT = 40;
    
    // Now position each field based on its coordinates and the current page
    this.fieldTargets.forEach(field => {
      const fieldPage = parseInt(field.dataset.page);
      
      // Only show fields on the current page
      if (fieldPage === currentPage) {
        // Use the same attribute names as in the signing flow for consistency
        const xPos = parseFloat(field.dataset.xPosition);
        const yPos = parseFloat(field.dataset.yPosition);
        const width = parseFloat(field.dataset.width);
        const height = parseFloat(field.dataset.height);
        
        // Apply scaling with the exact same formula used in the signing flow
        const scaledX = xPos * scale;
        const scaledY = yPos * scale;
        
        // Match the minimum field dimensions from signing flow
        const scaledWidth = Math.max(width * scale, MIN_FIELD_WIDTH);
        const scaledHeight = Math.max(height * scale, MIN_FIELD_HEIGHT);
        
        // Apply positioning exactly like in the signing flow
        field.style.position = "absolute";
        field.style.left = `${scaledX}px`;
        field.style.top = `${scaledY}px`;
        field.style.width = `${scaledWidth}px`;
        field.style.height = `${scaledHeight}px`;
        field.style.transform = "translate(-50%, -50%)";
        field.style.cursor = "pointer";
        field.style.border = "2px solid rgb(76, 175, 80)";
        field.style.borderRadius = "4px";
        field.style.backgroundColor = "rgba(220, 252, 231, 0.7)";
        
        // Show the field
        field.style.display = 'flex';
      } else {
        // Hide fields not on the current page
        field.style.display = 'none';
      }
    });
  }
  
  savePdf(event) {
    event.preventDefault();
    
    const button = this.savePdfButtonTarget;
    button.disabled = true;
    button.textContent = 'Generating PDF...';
    
    // Generate PDF
    fetch(`/documents/${this.documentIdValue}/finalize.pdf`, {
      method: 'GET',
      headers: {
        'Accept': 'application/pdf',
        'X-CSRF-Token': document.querySelector('meta[name="csrf-token"]').content
      }
    })
    .then(response => {
      if (!response.ok) {
        throw new Error('Failed to generate PDF');
      }
      return response.blob();
    })
    .then(blob => {
      // Create link to download
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      
      // Get document title for filename
      const docTitle = document.querySelector('h1').textContent.replace('Finalize: ', '').trim() || 'document';
      a.download = `${docTitle}-finalized.pdf`;
      
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      
      button.disabled = false;
      button.textContent = 'Save PDF';
    })
    .catch(error => {
      console.error('Error generating PDF:', error);
      button.disabled = false;
      button.textContent = 'Save PDF (Try again)';
      alert('Failed to generate PDF. Please try again.');
    });
  }
} 