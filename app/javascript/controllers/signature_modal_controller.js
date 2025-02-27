import { Controller } from "@hotwired/stimulus"

// Connects to data-controller="signature-modal"
export default class extends Controller {
  static targets = ["modal", "backdrop", "closeButton", "canvas", "signatureContainer", "initialsContainer", "buttonContainer"]
  
  connect() {
    console.log("Signature modal controller connected");
    this.setupModalHandlers();
  }
  
  setupModalHandlers() {
    // Setup close button
    if (this.hasCloseButtonTarget) {
      this.closeButtonTarget.addEventListener('click', this.close.bind(this));
    }
    
    // Setup backdrop click to close
    if (this.hasBackdropTarget) {
      this.backdropTarget.addEventListener('click', this.close.bind(this));
    }
    
    // Setup escape key handler
    this.escapeHandler = (e) => {
      if (e.key === 'Escape' && !this.modalTarget.classList.contains('hidden')) {
        this.close();
      }
    };
    document.addEventListener('keydown', this.escapeHandler);
    
    // Set up direct button handlers
    this.setupButtonHandlers();
    
    // Expose global methods
    window.openSigningModal = this.open.bind(this);
    window.closeSigningModal = this.close.bind(this);
    window.testDrawOnCanvas = this.testDraw.bind(this);
  }
  
  setupButtonHandlers() {
    // Direct handling for signature pad buttons
    document.querySelectorAll('[data-action*="signature-pad#clear"]').forEach(button => {
      button.addEventListener('click', (e) => {
        console.log("Clear button clicked - direct handler");
        const padDiv = button.closest('[data-controller="signature-pad"]');
        if (padDiv) {
          const canvas = padDiv.querySelector('canvas');
          if (canvas) {
            const context = canvas.getContext('2d');
            context.fillStyle = "white";
            context.fillRect(0, 0, canvas.width, canvas.height);
            
            // Also disable save button
            const saveButton = padDiv.querySelector('[data-action*="signature-pad#save"]');
            if (saveButton) {
              saveButton.disabled = true;
              saveButton.classList.add('opacity-50', 'cursor-not-allowed');
              saveButton.classList.remove('hover:bg-blue-700');
            }
          }
        }
      });
    });
    
    // Direct handling for save buttons 
    document.querySelectorAll('[data-action*="signature-pad#save"]').forEach(button => {
      button.addEventListener('click', (e) => {
        console.log("Save button clicked - direct handler");
        const padDiv = button.closest('[data-controller="signature-pad"]');
        if (padDiv) {
          const canvas = padDiv.querySelector('canvas');
          if (canvas) {
            try {
              const dataUrl = canvas.toDataURL("image/png");
              console.log("Generated data URL from direct handler, length:", dataUrl.length);
              
              // Dispatch event both ways to ensure it's caught
              padDiv.dispatchEvent(
                new CustomEvent('signature-pad:save', { 
                  detail: { signatureData: dataUrl },
                  bubbles: true 
                })
              );
              
              document.dispatchEvent(
                new CustomEvent('signature-pad:save', { 
                  detail: { signatureData: dataUrl },
                  bubbles: true 
                })
              );
              
              // Try direct controller action through field-signing controller
              const fieldSigningController = document.querySelector('[data-controller="field-signing"]')?.__stimulusController;
              if (fieldSigningController && typeof fieldSigningController.signatureComplete === 'function') {
                console.log("Directly calling field signing controller's signatureComplete method");
                fieldSigningController.signatureComplete({
                  detail: { signatureData: dataUrl }
                });
              } else {
                // Fallback - store in sessionStorage and close modal
                console.log("Using fallback to save signature");
                sessionStorage.setItem('last_signature_data', dataUrl);
                sessionStorage.setItem('last_signature_field_id', window.currentFieldId || '');
                
                // Try to update the field directly
                if (window.currentFieldId) {
                  const fieldElement = document.querySelector(`[data-field-id="${window.currentFieldId}"]`);
                  if (fieldElement) {
                    // Create image to display signature
                    const img = document.createElement('img');
                    img.src = dataUrl;
                    img.className = 'w-full h-full object-contain p-1';
                    
                    // Clear field content and add image
                    fieldElement.innerHTML = '';
                    fieldElement.appendChild(img);
                    
                    // Mark as completed
                    fieldElement.dataset.completed = 'true';
                    fieldElement.style.border = '2px solid #4CAF50';
                    fieldElement.style.backgroundColor = 'rgba(220, 252, 231, 0.7)';
                    
                    // Update field status in sidebar
                    const statusItem = document.querySelector(`.field-status-item[data-field-id="${window.currentFieldId}"]`);
                    if (statusItem) {
                      statusItem.dataset.fieldStatus = 'completed';
                      statusItem.querySelector('.field-status').classList.remove('bg-gray-300');
                      statusItem.querySelector('.field-status').classList.add('bg-green-500');
                    }
                  }
                }
              }
              
              // Close modal
              this.close();
            } catch (e) {
              console.error("Error saving signature:", e);
            }
          }
        }
      });
    });
  }
  
  disconnect() {
    // Remove all event listeners
    document.removeEventListener('keydown', this.escapeHandler);
    
    // Remove global methods
    delete window.openSigningModal;
    delete window.closeSigningModal;
    delete window.testDrawOnCanvas;
  }
  
  open(event) {
    // Get field type - either from event or parameter
    let fieldType;
    
    if (typeof event === 'string') {
      fieldType = event;
    } else if (event?.currentTarget?.dataset?.fieldType) {
      fieldType = event.currentTarget.dataset.fieldType;
      event.preventDefault();
      event.stopPropagation();
    } else if (event?.detail?.fieldType) {
      fieldType = event.detail.fieldType;
    } else {
      console.error("Cannot determine field type for modal");
      return;
    }
    
    console.log("Opening modal for field type:", fieldType);
    
    // Ensure PDF viewer loading element exists to prevent errors
    this.ensurePdfViewerElements();
    
    // Show backdrop - CRITICAL: ensure it's visible with proper z-index
    if (this.hasBackdropTarget) {
      this.backdropTarget.classList.remove('hidden');
      this.backdropTarget.style.display = 'block';
      this.backdropTarget.style.zIndex = '999';
      this.backdropTarget.style.opacity = '0.75';
      this.backdropTarget.style.backgroundColor = '#000000';
    }
    
    // Show modal with proper z-index
    this.modalTarget.classList.remove('hidden');
    this.modalTarget.style.display = 'flex';
    this.modalTarget.style.zIndex = '1000';
    
    // Show correct content
    const modalContents = this.modalTarget.querySelectorAll('.modal-content');
    modalContents.forEach(content => {
      content.classList.add('hidden');
      content.style.display = 'none';
    });
    
    const targetContent = this.modalTarget.querySelector(`.modal-content[data-field-type="${fieldType}"]`);
    if (targetContent) {
      targetContent.classList.remove('hidden');
      targetContent.style.display = 'block';
      
      // Make sure buttons are visible
      const buttonContainer = targetContent.querySelector('[data-signature-modal-target="buttonContainer"]');
      if (buttonContainer) {
        buttonContainer.classList.remove('hidden');
        buttonContainer.style.display = 'flex !important';
        // Force show all buttons
        buttonContainer.querySelectorAll('button').forEach(button => {
          button.style.display = 'inline-block !important';
        });
      }
    }
    
    // Initialize canvas for signature/initials
    if (fieldType === 'signature' || fieldType === 'initials') {
      // Store current field type for reference
      this.currentFieldType = fieldType;
      
      // Get the current field ID
      if (event && event.currentTarget && event.currentTarget.dataset && event.currentTarget.dataset.fieldId) {
        window.currentFieldId = event.currentTarget.dataset.fieldId;
        console.log("Setting current field ID:", window.currentFieldId);
      } else if (event && event.detail && event.detail.fieldId) {
        window.currentFieldId = event.detail.fieldId;
        console.log("Setting current field ID from event detail:", window.currentFieldId);
      }
      
      setTimeout(() => {
        const canvasId = fieldType === 'signature' ? 'signatureCanvas' : 'initialsCanvas';
        const canvas = document.getElementById(canvasId);
        
        if (canvas) {
          // CRITICAL: Store canvas reference
          this.currentCanvas = canvas;
          
          // CRITICAL: Set canvas properties for drawing correctly
          console.log("Setting critical canvas properties for drawing");
          canvas.style.zIndex = '1002';
          canvas.style.touchAction = 'none';
          canvas.style.pointerEvents = 'auto';
          canvas.style.position = 'absolute';
          canvas.style.userSelect = 'none';
          canvas.style.webkitUserSelect = 'none';
          canvas.style.cursor = 'crosshair';
          
          // Fix canvas size based on container
          const container = canvas.parentElement;
          const rect = container.getBoundingClientRect();
          const ratio = Math.max(window.devicePixelRatio || 1, 2);
          
          // Clear console to help with debugging
          console.log("Canvas container dimensions:", {
            width: rect.width,
            height: rect.height
          });
          
          // Set CSS display size
          canvas.style.width = '100%';
          canvas.style.height = '100%';
          
          // Set canvas actual size (high resolution)
          canvas.width = rect.width * ratio;
          canvas.height = rect.height * ratio;
          
          // Scale context for retina display
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.scale(ratio, ratio);
            ctx.fillStyle = "white";
            ctx.fillRect(0, 0, canvas.width / ratio, canvas.height / ratio);
            
            // Draw faint guide lines to help with drawing
            ctx.strokeStyle = 'rgba(200,200,200,0.3)';
            ctx.lineWidth = 0.5;
            
            // Draw signature guide line
            if (fieldType === 'signature') {
              const height = canvas.height / ratio;
              const width = canvas.width / ratio;
              const lineY = height * 0.65;
              
              ctx.beginPath();
              ctx.moveTo(width * 0.1, lineY);
              ctx.lineTo(width * 0.9, lineY);
              ctx.stroke();
            }
            
            // Reset style
            ctx.strokeStyle = '#000000';
            ctx.lineWidth = 2;
          }
          
          // CRITICAL: Force drawing to work by directly attaching event listeners
          this.setupDirectDrawingHandlers(canvas);
          
          // Force controller initialization as backup
          const containerTarget = fieldType === 'signature' ? 
            this.signatureContainerTarget : this.initialsContainerTarget;
          
          if (containerTarget) {
            // Try to get the controller instance
            const padController = containerTarget.querySelector('[data-controller="signature-pad"]')?.__stimulusController;
            
            if (padController) {
              console.log("Found signature pad controller, forcing initialization");
              if (typeof padController.initializeSignaturePad === 'function') {
                padController.initializeSignaturePad();
              }
            }
          }
          
          // Draw test pattern after a short delay
          setTimeout(() => this.testDraw(canvasId), 200);
        }
      }, 100);
    }
    
    // Pause PDF rendering
    document.dispatchEvent(new CustomEvent('pdf-viewer:pause'));
    
    // Check initial canvas content after modal is open
    setTimeout(() => {
      const visibleCanvas = this.element.querySelector('canvas:not([style*="display: none"])');
      if (visibleCanvas) {
        this.checkCanvasContentAndUpdateButton(visibleCanvas);
      }
    }, 200);
  }
  
  // Add direct drawing fallback functionality
  setupDirectDrawingHandlers(canvas) {
    // Safety check to make sure we have a valid canvas element
    if (!canvas || !(canvas instanceof HTMLCanvasElement)) {
      console.error("Invalid canvas element provided to setupDirectDrawingHandlers:", canvas);
      
      // Try to find the canvas if it wasn't provided correctly
      if (this.currentFieldType) {
        const canvasId = this.currentFieldType === 'signature' ? 'signatureCanvas' : 'initialsCanvas';
        canvas = document.getElementById(canvasId);
        
        if (!canvas) {
          // Last resort - find any canvas in the visible modal content
          const visibleContent = this.modalTarget.querySelector('.modal-content:not(.hidden)');
          if (visibleContent) {
            canvas = visibleContent.querySelector('canvas');
          }
        }
        
        if (!canvas) {
          console.error("Could not find canvas element for direct drawing handlers");
          return;
        }
      } else {
        return;
      }
    }
    
    console.log("Setting up direct drawing handlers for canvas:", canvas.id);
    
    // Initialize drawing state
    const drawingState = {
      isDrawing: false,
      lastX: 0,
      lastY: 0
    };
    
    // Get canvas context
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      console.error("Cannot get canvas context");
      return;
    }
    
    // Set default drawing styles
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#000000";
    
    // Helper function to get correct coordinates
    const getCoordinates = (event, canvas) => {
      const rect = canvas.getBoundingClientRect();
      
      // Handle different event types
      let clientX, clientY;
      
      if (event.touches && event.touches.length > 0) {
        // Touch event
        clientX = event.touches[0].clientX;
        clientY = event.touches[0].clientY;
      } else if (event.changedTouches && event.changedTouches.length > 0) {
        // Touch end event
        clientX = event.changedTouches[0].clientX;
        clientY = event.changedTouches[0].clientY;
      } else {
        // Mouse or pointer event
        clientX = event.clientX;
        clientY = event.clientY;
      }
      
      // Convert to canvas coordinates
      return {
        x: (clientX - rect.left) * (canvas.width / rect.width),
        y: (clientY - rect.top) * (canvas.height / rect.height)
      };
    };
    
    // Drawing function
    const draw = (event) => {
      if (!drawingState.isDrawing) return;
      
      // Prevent default behavior to avoid issues
      event.preventDefault();
      event.stopPropagation();
      
      const coords = getCoordinates(event, canvas);
      
      // Normalize coordinates for device pixel ratio
      const ratio = window.devicePixelRatio || 1;
      const x = coords.x / ratio;
      const y = coords.y / ratio;
      
      ctx.beginPath();
      ctx.moveTo(drawingState.lastX, drawingState.lastY);
      ctx.lineTo(x, y);
      ctx.stroke();
      
      // Update last position
      drawingState.lastX = x;
      drawingState.lastY = y;
      
      // Enable save button since drawing occurred
      this.enableSaveButton();
      
      // After drawing, check if canvas has content
      this.checkCanvasContentAndUpdateButton(canvas);
    };
    
    // Start drawing
    const startDrawing = (event) => {
      console.log("Starting drawing on canvas:", canvas.id, "Event type:", event.type);
      
      // Prevent default behavior to avoid browser handling
      event.preventDefault();
      event.stopPropagation();
      
      const coords = getCoordinates(event, canvas);
      
      // Normalize coordinates for device pixel ratio
      const ratio = window.devicePixelRatio || 1;
      const x = coords.x / ratio;
      const y = coords.y / ratio;
      
      drawingState.isDrawing = true;
      drawingState.lastX = x;
      drawingState.lastY = y;
      
      // Draw a single point to ensure even a single click is registered
      ctx.beginPath();
      ctx.arc(x, y, 0.5, 0, Math.PI * 2);
      ctx.fill();
      
      // For pointer events, set capture to ensure all move events go to canvas
      if (event.type === 'pointerdown') {
        console.log("Setting pointer capture for better drawing");
        try {
          canvas.setPointerCapture(event.pointerId);
        } catch (e) {
          console.error("Error setting pointer capture:", e);
        }
      }
      
      // Store handlers in global object for later cleanup
      if (!window._canvasEventHandlers) {
        window._canvasEventHandlers = {};
      }
      window._canvasEventHandlers[canvas.id] = {
        draw: draw,
        stopDrawing: stopDrawing
      };
      
      // Add move and up handlers directly to document to handle cases when moving outside of canvas
      if (event.type === 'mousedown') {
        document.addEventListener('mousemove', draw);
        document.addEventListener('mouseup', stopDrawing);
      } else if (event.type === 'touchstart') {
        document.addEventListener('touchmove', draw, { passive: false });
        document.addEventListener('touchend', stopDrawing);
      } else if (event.type === 'pointerdown') {
        document.addEventListener('pointermove', draw);
        document.addEventListener('pointerup', stopDrawing);
      }
      
      // Start checking for content after initial dot
      this.checkCanvasContentAndUpdateButton(canvas);
    };
    
    // Stop drawing
    const stopDrawing = (event) => {
      if (!drawingState.isDrawing) return;
      
      drawingState.isDrawing = false;
      
      // Release pointer capture if needed
      if (event && event.type === 'pointerup' && event.pointerId) {
        try {
          canvas.releasePointerCapture(event.pointerId);
        } catch (e) {
          console.log("Error releasing pointer capture:", e);
        }
      }
      
      // Remove document-level handlers
      if (event) {
        if (event.type === 'mouseup') {
          document.removeEventListener('mousemove', draw);
          document.removeEventListener('mouseup', stopDrawing);
        } else if (event.type === 'touchend') {
          document.removeEventListener('touchmove', draw);
          document.removeEventListener('touchend', stopDrawing);
        } else if (event.type === 'pointerup') {
          document.removeEventListener('pointermove', draw);
          document.removeEventListener('pointerup', stopDrawing);
        }
      }
      
      // Final check for content when drawing stops
      this.checkCanvasContentAndUpdateButton(canvas);
    };
    
    // Clear canvas
    const clearCanvas = () => {
      const width = canvas.width / (window.devicePixelRatio || 1);
      const height = canvas.height / (window.devicePixelRatio || 1);
      
      ctx.fillStyle = "white";
      ctx.fillRect(0, 0, width, height);
      
      // Disable save button after clearing
      this.disableSaveButton();
    };
    
    // Make clear function available on canvas for other handlers
    canvas.clear = clearCanvas;
    
    // CRITICAL: Remove existing handlers with direct references
    if (window._canvasEventHandlers && window._canvasEventHandlers[canvas.id]) {
      const oldHandlers = window._canvasEventHandlers[canvas.id];
      document.removeEventListener('mousemove', oldHandlers.draw);
      document.removeEventListener('mouseup', oldHandlers.stopDrawing);
      document.removeEventListener('touchmove', oldHandlers.draw);
      document.removeEventListener('touchend', oldHandlers.stopDrawing);
      document.removeEventListener('pointermove', oldHandlers.draw);
      document.removeEventListener('pointerup', oldHandlers.stopDrawing);
    }
    
    // Remove existing handlers if any
    canvas.removeEventListener("mousedown", startDrawing);
    canvas.removeEventListener("mousemove", draw);
    document.removeEventListener("mouseup", stopDrawing);
    
    canvas.removeEventListener("touchstart", startDrawing);
    canvas.removeEventListener("touchmove", draw);
    document.removeEventListener("touchend", stopDrawing);
    
    canvas.removeEventListener("pointerdown", startDrawing);
    canvas.removeEventListener("pointermove", draw);
    document.removeEventListener("pointerup", stopDrawing);
    
    // Set up event listeners for mouse events
    canvas.addEventListener("mousedown", startDrawing);
    
    // Set up event listeners for touch events
    canvas.addEventListener("touchstart", startDrawing, { passive: false });
    
    // Set up event listeners for pointer events (modern approach)
    // CRITICAL: Make sure this has the highest priority
    canvas.addEventListener("pointerdown", startDrawing, { capture: true });
    
    // Initial clear
    clearCanvas();
    
    // Set up button handlers
    this.setupButtonHandlers(canvas);
    
    console.log("Direct drawing handlers setup complete for canvas:", canvas.id);
    
    // Draw a test pattern to confirm setup worked
    ctx.strokeStyle = "#0000FF";
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(50, 50);
    ctx.stroke();
    
    ctx.strokeStyle = "#000000"; // Reset to black
    
    // Store reference to canvas for global methods
    this.currentCanvas = canvas;
  }
  
  close() {
    console.log("Closing modal");
    
    // Hide modal
    if (this.hasBackdropTarget) {
      this.backdropTarget.classList.add('hidden');
      this.backdropTarget.style.display = 'none';
    }
    
    if (this.hasModalTarget) {
      this.modalTarget.classList.add('hidden');
      this.modalTarget.style.display = 'none';
    }
    
    // Ensure body is visible
    document.body.style.removeProperty('overflow');
    document.body.style.display = 'block';
    
    // Resume PDF rendering
    document.dispatchEvent(new CustomEvent('pdf-viewer:unpause'));
    
    // Force redraw to prevent black screen
    setTimeout(() => {
      document.body.style.opacity = 0.99;
      setTimeout(() => document.body.style.opacity = 1, 10);
    }, 10);
  }
  
  // Helper method to enable the save button
  enableSaveButton() {
    const modalContents = this.modalTarget.querySelectorAll('.modal-content');
    modalContents.forEach(content => {
      if (!content.classList.contains('hidden')) {
        const saveButton = content.querySelector('button[data-action="save"]');
        if (saveButton) {
          console.log("Enabling save button");
          saveButton.disabled = false;
          saveButton.classList.remove('opacity-50', 'cursor-not-allowed');
        }
      }
    });
  }
  
  // Helper method to disable the save button
  disableSaveButton() {
    const modalContents = this.modalTarget.querySelectorAll('.modal-content');
    modalContents.forEach(content => {
      if (!content.classList.contains('hidden')) {
        const saveButton = content.querySelector('button[data-action="save"]');
        if (saveButton) {
          console.log("Disabling save button");
          saveButton.disabled = true;
          saveButton.classList.add('opacity-50', 'cursor-not-allowed');
        }
      }
    });
  }
  
  // Helper to ensure PDF viewer elements exist
  ensurePdfViewerElements() {
    console.log("Ensuring PDF viewer elements exist");
    
    // Check for PDF viewer container
    const pdfContainer = document.querySelector('[data-pdf-viewer-target="container"]');
    if (!pdfContainer) {
      console.warn("PDF viewer container not found, this might cause issues");
    }
    
    // Check for loading element in PDF viewer
    const pdfLoading = document.querySelector('[data-pdf-viewer-target="loading"]');
    if (!pdfLoading) {
      console.warn("PDF viewer loading element not found, creating it");
      
      // Find the container to append to
      const container = pdfContainer || document.querySelector('[data-controller="pdf-viewer"]');
      
      if (container) {
        // Create loading element
        const loadingDiv = document.createElement('div');
        loadingDiv.setAttribute('data-pdf-viewer-target', 'loading');
        loadingDiv.className = 'pdf-loading absolute inset-0 flex items-center justify-center bg-white bg-opacity-75';
        
        // Add spinner and text
        loadingDiv.innerHTML = `
          <div class="text-center">
            <svg class="animate-spin h-8 w-8 mx-auto text-gray-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <p class="mt-2 text-sm text-gray-500">Loading document...</p>
          </div>
        `;
        
        // Append to container
        container.appendChild(loadingDiv);
        console.log("Created PDF viewer loading element");
      } else {
        console.error("Cannot find PDF viewer container to add loading element");
      }
    }
  }
  
  // Debug method to test canvas
  testDraw(canvasId) {
    console.log("Received event:", canvasId?.type || canvasId);
    
    let canvas = null;
    
    // Handle various input types
    if (canvasId instanceof Event) {
      // Handle special case for pointer events
      if (canvasId.type && canvasId.type.includes('pointer')) {
        console.log("Special handling for pointer event");
        
        // First try to get the canvas from the event target
        if (canvasId.target instanceof HTMLCanvasElement) {
          canvas = canvasId.target;
        } else {
          // Try to find the closest canvas
          canvas = canvasId.target.closest('canvas');
        }
        
        // If still not found, use the current canvas
        if (!canvas && this.currentCanvas) {
          canvas = this.currentCanvas;
        }
        
        // As a last resort, find the visible canvas in the modal
        if (!canvas) {
          const visibleContent = this.modalTarget.querySelector('.modal-content:not(.hidden)');
          if (visibleContent) {
            canvas = visibleContent.querySelector('canvas');
            console.log("Found canvas in active modal content:", canvas?.id);
          }
        }
      } else if (canvasId.currentTarget && canvasId.currentTarget.dataset && canvasId.currentTarget.dataset.fieldId) {
        // Using dataset.fieldId attribute from the debug buttons
        canvasId = canvasId.currentTarget.dataset.fieldId;
        canvas = document.getElementById(canvasId);
      }
    } else if (typeof canvasId === 'string') {
      // Normal string ID
      canvas = document.getElementById(canvasId);
    } else if (canvasId instanceof HTMLCanvasElement) {
      // Already a canvas element
      canvas = canvasId;
    }
    
    if (!canvas) {
      console.error("Canvas not found from", canvasId);
      
      // Try one more time with current field type
      if (this.currentFieldType) {
        const fallbackId = this.currentFieldType === 'signature' ? 'signatureCanvas' : 'initialsCanvas';
        canvas = document.getElementById(fallbackId);
        if (canvas) {
          console.log("Using fallback canvas by field type:", fallbackId);
        }
      }
      
      // Last resort - check for any canvas in the visible modal content
      if (!canvas) {
        const visibleContent = this.modalTarget.querySelector('.modal-content:not(.hidden)');
        if (visibleContent) {
          canvas = visibleContent.querySelector('canvas');
          if (canvas) {
            console.log("Found canvas in visible modal content:", canvas.id);
          }
        }
      }
      
      if (!canvas) {
        return;
      }
    }
    
    console.log("Found canvas:", canvas.id);
    
    try {
      // Always make sure the canvas has the right properties set
      canvas.style.pointerEvents = 'auto';
      canvas.style.touchAction = 'none';
      
      // Fix canvas size for drawing
      const ratio = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      
      // Only adjust dimensions if they're not already set
      if (canvas.width < rect.width || canvas.height < rect.height) {
        canvas.width = rect.width * ratio;
        canvas.height = rect.height * ratio;
      }
      
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        console.error("Could not get drawing context for canvas");
        return;
      }
      
      // Clear existing drawings
      ctx.setTransform(1, 0, 0, 1, 0, 0); // Reset transformations
      ctx.scale(ratio, ratio); // Scale for device pixel ratio
      
      // Set background to white if needed
      ctx.fillStyle = "white";
      ctx.fillRect(0, 0, canvas.width / ratio, canvas.height / ratio);
      
      // Draw subtle diagonal line pattern
      ctx.strokeStyle = 'rgba(200, 200, 200, 0.5)';
      ctx.lineWidth = 1;
      
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(canvas.width / ratio / 3, canvas.height / ratio / 3);
      ctx.stroke();
      
      ctx.beginPath();
      ctx.moveTo(0, canvas.height / ratio);
      ctx.lineTo(canvas.width / ratio / 3, canvas.height / ratio * 2/3);
      ctx.stroke();
      
      ctx.beginPath();
      ctx.moveTo(canvas.width / ratio, 0);
      ctx.lineTo(canvas.width / ratio * 2/3, canvas.height / ratio / 3);
      ctx.stroke();
      
      // Reset to default styles
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      
      console.log("Test drawing complete on canvas:", canvas.id);
      
      // Store reference to canvas for future use
      this.currentCanvas = canvas;
      
      // Set up direct drawing handlers again to ensure everything works
      this.setupDirectDrawingHandlers(canvas);
      
      // After drawing test pattern, check canvas content
      this.checkCanvasContentAndUpdateButton(canvas);
    } catch (e) {
      console.error("Error in test draw:", e);
    }
  }
  
  // Action for direct clear button click
  clear(event) {
    const canvas = this.closestCanvas(event);
    if (!canvas) return;
    
    const context = canvas.getContext('2d');
    if (!context) return;
    
    context.fillStyle = "white";
    context.fillRect(0, 0, canvas.width, canvas.height);
    
    // Find save button and disable it
    const saveButton = event.currentTarget.closest('.p-3').querySelector('[data-action*="signature-pad#save"]');
    if (saveButton) {
      saveButton.disabled = true;
      saveButton.classList.add('opacity-50', 'cursor-not-allowed');
      saveButton.classList.remove('hover:bg-blue-700');
    }
  }
  
  // Helper to find closest canvas to an event
  closestCanvas(event) {
    const container = event.currentTarget.closest('[data-controller="signature-pad"]');
    return container ? container.querySelector('canvas') : null;
  }
  
  setupButtonHandlers(canvas) {
    console.log("Setting up button handlers for canvas:", canvas.id);
    
    // Find the parent content container
    const contentContainer = canvas.closest('.modal-content');
    if (!contentContainer) {
      console.error("Could not find parent content container for button handlers");
      return;
    }
    
    // Find the buttons
    const clearButton = contentContainer.querySelector('[data-signature-pad-target="clearButton"]');
    const saveButton = contentContainer.querySelector('[data-signature-pad-target="saveButton"]');
    
    console.log("Found buttons:", 
      clearButton ? "Clear button found" : "No clear button", 
      saveButton ? "Save button found" : "No save button"
    );
    
    // Set up clear button
    if (clearButton) {
      console.log("Setting up clear button handler");
      
      // Remove existing handlers to prevent duplicates
      const oldClearHandler = clearButton._clearHandler;
      if (oldClearHandler) {
        clearButton.removeEventListener('click', oldClearHandler);
      }
      
      // Create new handler
      const clearHandler = (event) => {
        event.preventDefault();
        event.stopPropagation();
        
        console.log("Clear button clicked for canvas:", canvas.id);
        
        // Clear the canvas
        const ctx = canvas.getContext('2d');
        if (ctx) {
          // Get dimensions accounting for device pixel ratio
          const width = canvas.width / (window.devicePixelRatio || 1);
          const height = canvas.height / (window.devicePixelRatio || 1);
          
          // Fill with white
          ctx.fillStyle = 'white';
          ctx.fillRect(0, 0, width, height);
        }
        
        // Disable save button
        this.disableSaveButton();
      };
      
      // Store and add the handler
      clearButton._clearHandler = clearHandler;
      clearButton.addEventListener('click', clearHandler);
    }
    
    // Set up save button
    if (saveButton) {
      console.log("Setting up save button handler");
      
      // Remove existing handlers to prevent duplicates
      const oldSaveHandler = saveButton._saveHandler;
      if (oldSaveHandler) {
        saveButton.removeEventListener('click', oldSaveHandler);
      }
      
      // Create new handler
      const saveHandler = (event) => {
        event.preventDefault();
        event.stopPropagation();
        
        console.log("Save button clicked for canvas:", canvas.id);
        
        try {
          // Generate data URL from canvas
          const dataUrl = canvas.toDataURL('image/png');
          if (!dataUrl || dataUrl === 'data:,') {
            console.error("Failed to generate valid data URL from canvas");
            return;
          }
          
          console.log("Generated data URL with length:", dataUrl.length);
          
          // Determine field type from canvas ID
          const fieldType = canvas.id === 'signatureCanvas' ? 'signature' : 'initials';
          
          // Get the current field ID from global variable or data attribute
          let fieldId = window.currentFieldId;
          
          // If field ID isn't available, get it from field-signing controller
          if (!fieldId) {
            const fieldSigningController = document.querySelector('[data-controller="field-signing"]');
            if (fieldSigningController && fieldSigningController.__stimulusController) {
              fieldId = fieldSigningController.__stimulusController.currentFieldValue;
            }
          }
          
          console.log("Saving signature for field ID:", fieldId);
          
          // Store in session storage as fallback
          sessionStorage.setItem('last_signature_data', dataUrl);
          sessionStorage.setItem('last_signature_field_id', fieldId || '');
          
          // Create custom event with signature data
          const signatureEvent = new CustomEvent('signature-pad:save', {
            detail: {
              signatureData: dataUrl,
              fieldId: fieldId
            },
            bubbles: true
          });
          
          // Try multiple dispatch methods to ensure it's caught
          // 1. Dispatch on document
          document.dispatchEvent(signatureEvent);
          console.log("Dispatched event on document");
          
          // 2. Dispatch on the canvas container
          const padContainer = canvas.closest('[data-controller="signature-pad"]');
          if (padContainer) {
            padContainer.dispatchEvent(signatureEvent);
            console.log("Dispatched event on pad container");
          }
          
          // 3. Try direct method call
          const fieldSigningController = document.querySelector('[data-controller="field-signing"]')?.__stimulusController;
          if (fieldSigningController && typeof fieldSigningController.signatureComplete === 'function') {
            console.log("Directly calling field signing controller's signatureComplete method");
            fieldSigningController.signatureComplete({
              detail: { 
                signatureData: dataUrl,
                fieldId: fieldId
              }
            });
          } else {
            console.warn("Field signing controller method not available, using DOM fallback");
            
            // 4. Fallback to direct DOM manipulation
            if (fieldId) {
              const fieldElement = document.querySelector(`[data-field-id="${fieldId}"]`);
              if (fieldElement) {
                console.log("Updating field element directly:", fieldId);
                
                // Create image to display signature
                const img = document.createElement('img');
                img.src = dataUrl;
                img.className = 'w-full h-full object-contain p-1';
                
                // Clear field content and add image
                fieldElement.innerHTML = '';
                fieldElement.appendChild(img);
                
                // Mark as completed
                fieldElement.dataset.completed = 'true';
                fieldElement.style.border = '2px solid #4CAF50';
                fieldElement.style.backgroundColor = 'rgba(220, 252, 231, 0.7)';
                
                // Update field status in sidebar
                const statusItem = document.querySelector(`.field-status-item[data-field-id="${fieldId}"]`);
                if (statusItem) {
                  statusItem.dataset.fieldStatus = 'completed';
                  const statusCircle = statusItem.querySelector('.field-status');
                  if (statusCircle) {
                    statusCircle.classList.remove('bg-gray-300');
                    statusCircle.classList.add('bg-green-500');
                  }
                }
              }
            }
          }
          
          // Force close the modal after saving
          console.log("Forcing modal close");
          setTimeout(() => this.close(), 100);
          
        } catch (error) {
          console.error("Error saving signature:", error);
        }
      };
      
      // Store and add the handler
      saveButton._saveHandler = saveHandler;
      saveButton.addEventListener('click', saveHandler);
      
      // Make sure save button is initially enabled if canvas has content
      const ctx = canvas.getContext('2d');
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      let hasContent = false;
      
      // Check if canvas has non-white pixels
      for (let i = 0; i < data.length; i += 4) {
        // If any pixel is not white (255,255,255,255)
        if (data[i] < 255 || data[i+1] < 255 || data[i+2] < 255) {
          hasContent = true;
          break;
        }
      }
      
      if (hasContent) {
        saveButton.disabled = false;
        saveButton.classList.remove('opacity-50', 'cursor-not-allowed');
      } else {
        saveButton.disabled = true;
        saveButton.classList.add('opacity-50', 'cursor-not-allowed');
      }
    }
    
    console.log("Button handlers setup complete");
  }
  
  // Add a new method to check canvas content and update save button
  checkCanvasContentAndUpdateButton(canvas) {
    console.log("Checking canvas content to update save button state");
    
    if (!canvas) {
      console.warn("No canvas provided to checkCanvasContentAndUpdateButton");
      return;
    }
    
    // Find the closest button container
    const buttonContainer = canvas.closest('[data-controller="signature-pad"]')?.querySelector('[data-signature-pad-target="saveButton"]') || 
                           this.element.querySelector('[data-signature-pad-target="saveButton"]');
    
    if (!buttonContainer) {
      console.warn("Could not find save button for canvas");
      return;
    }
    
    try {
      const ctx = canvas.getContext('2d');
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      
      // Threshold to determine if canvas has content (allow for very light marks)
      let nonWhitePixels = 0;
      const threshold = 5; // Lower values make it more sensitive
      
      // Check multiple pixels for non-white content
      for (let i = 0; i < data.length; i += 4) {
        // For each pixel, check if it's significantly non-white
        // Allow for very light marks by using threshold
        if (
          255 - data[i] > threshold ||    // Red
          255 - data[i+1] > threshold ||  // Green
          255 - data[i+2] > threshold     // Blue
        ) {
          nonWhitePixels++;
          // Only need a few pixels to confirm content
          if (nonWhitePixels > 10) {
            break;
          }
        }
      }
      
      const hasContent = nonWhitePixels > 10;
      console.log(`Canvas content check: ${hasContent ? 'HAS CONTENT' : 'Empty'} (${nonWhitePixels} non-white pixels found)`);
      
      // Update button state
      buttonContainer.disabled = !hasContent;
      
      if (!hasContent) {
        buttonContainer.classList.add('opacity-50', 'cursor-not-allowed');
        buttonContainer.classList.remove('hover:bg-blue-700');
      } else {
        buttonContainer.classList.remove('opacity-50', 'cursor-not-allowed');
        buttonContainer.classList.add('hover:bg-blue-700');
      }
      
      // Also try to update through the signature-pad controller
      const signaturePadController = canvas.closest('[data-controller="signature-pad"]')?.__stimulusController;
      if (signaturePadController && typeof signaturePadController.updateButtonState === 'function') {
        signaturePadController.hasSignature = hasContent;
        signaturePadController.updateButtonState();
      }
    } catch (error) {
      console.error("Error checking canvas content:", error);
    }
  }
} 