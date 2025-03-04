import { Controller } from "@hotwired/stimulus"

// Connects to data-controller="signature-modal"
export default class extends Controller {
  static targets = ["modal", "backdrop", "closeButton", "canvas", "signatureContainer", "initialsContainer", "buttonContainer"]
  
  connect() {
    console.log("Signature modal controller connected");
    this.setupModalHandlers();
    
    // CRITICAL FIX: Add direct event listeners to ALL signature and initial fields to ensure modal opens
    console.log("Adding direct field click handlers to open signature modal");
    
    // Add global method for opening modal that works even if controller actions fail
    window.openSignatureModal = (fieldType, fieldId) => {
      console.log("Direct call to open signature modal:", fieldType, fieldId);
      this.open(fieldType);
      // Store the field ID globally for reference
      window.currentFieldId = fieldId;
    };
    
    // Wait for DOM to be fully loaded
    setTimeout(() => {
      // Find all signature and initials fields
      const fields = document.querySelectorAll('[data-field-type="signature"], [data-field-type="initials"]');
      console.log(`Found ${fields.length} signature/initial fields to attach handlers to`);
      
      fields.forEach(field => {
        const fieldType = field.dataset.fieldType;
        const fieldId = field.dataset.fieldId;
        
        console.log(`Adding direct click handler to ${fieldType} field: ${fieldId}`);
        
        // Remove any existing click handlers to prevent duplicates
        field.removeEventListener('click', field._modalOpenHandler);
        
        // Create a new handler
        field._modalOpenHandler = (e) => {
          e.preventDefault();
          e.stopPropagation();
          
          console.log(`Direct field click on ${fieldType} field ${fieldId}`);
          
          // Store current field ID for reference
          window.currentFieldId = fieldId;
          
          // Call our open method directly
          this.open(fieldType);
          
          // Store the field ID in the field-signing controller as well
          const fieldSigningController = document.querySelector('[data-controller="field-signing"]')?.__stimulusController;
          if (fieldSigningController) {
            fieldSigningController.currentFieldValue = fieldId;
          }
          
          return false;
        };
        
        // Add the click handler
        field.addEventListener('click', field._modalOpenHandler);
      });
    }, 300); // Wait for DOM to be fully ready
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
    
    // Correct Escape key handler
    this.escapeHandler = (event) => {
      if (event.key === 'Escape' && !this.modalTarget.classList.contains('hidden')) {
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
    
    // NEW: Add a helper function to force drawing activation
    window.activateDrawingOnCurrentCanvas = () => {
      console.log("Manually activating drawing on current canvas");
      
      // Try to find the current canvas
      const modal = document.querySelector('#signingModal');
      if (!modal || modal.classList.contains('hidden')) {
        console.log("Modal not visible, can't activate drawing");
        return false;
      }
      
      // Find the visible content container
      const visibleContent = modal.querySelector('.modal-content:not(.hidden)');
      if (!visibleContent) {
        console.log("No visible content container found");
        return false;
      }
      
      // Find the canvas
      const canvas = visibleContent.querySelector('canvas');
      if (!canvas) {
        console.log("No canvas found in visible content");
        return false;
      }
      
      console.log("Found canvas:", canvas.id);
      
      // Use the testDraw method to activate drawing
      const controller = document.querySelector('[data-controller="signature-modal"]')?.__stimulusController;
      if (controller && typeof controller.testDraw === 'function') {
        console.log("Using controller method to activate drawing");
        controller.testDraw({ target: canvas });
        return true;
      } else {
        // Fallback - direct manipulation
        console.log("Fallback: Direct manipulation to activate drawing");
        
        // Make sure canvas has the right properties
        canvas.style.pointerEvents = 'auto';
        canvas.style.touchAction = 'none';
        canvas.style.userSelect = 'none';
        
        // Force a redraw with a dot to verify canvas is working
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = 'rgba(0,0,255,0.5)';
          ctx.beginPath();
          ctx.arc(10, 10, 5, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = 'black';
          
          // Add direct event listeners to the canvas
          console.log("Adding direct event listeners to canvas");
          
          // Drawing state
          const state = { isDrawing: false, lastX: 0, lastY: 0 };
          
          // Event handlers
          const drawHandler = function(e) {
            if (!state.isDrawing) return;
            
            e.preventDefault();
            e.stopPropagation();
            
            const rect = canvas.getBoundingClientRect();
            const x = (e.clientX || e.touches[0].clientX) - rect.left;
            const y = (e.clientY || e.touches[0].clientY) - rect.top;
            
            ctx.beginPath();
            ctx.moveTo(state.lastX, state.lastY);
            ctx.lineTo(x, y);
            ctx.stroke();
            
            state.lastX = x;
            state.lastY = y;
          };
          
          const startHandler = function(e) {
            e.preventDefault();
            e.stopPropagation();
            
            state.isDrawing = true;
            
            const rect = canvas.getBoundingClientRect();
            state.lastX = (e.clientX || e.touches[0].clientX) - rect.left;
            state.lastY = (e.clientY || e.touches[0].clientY) - rect.top;
            
            // Add move handlers
            document.addEventListener('mousemove', drawHandler);
            document.addEventListener('touchmove', drawHandler);
          };
          
          const stopHandler = function() {
            state.isDrawing = false;
            
            // Remove move handlers
            document.removeEventListener('mousemove', drawHandler);
            document.removeEventListener('touchmove', drawHandler);
          };
          
          // Add start handlers
          canvas.addEventListener('mousedown', startHandler);
          canvas.addEventListener('touchstart', startHandler);
          
          // Add stop handlers
          document.addEventListener('mouseup', stopHandler);
          document.addEventListener('touchend', stopHandler);
          
          return true;
        }
        
        return false;
      }
    };
    
    // Auto-trigger the drawing activation helper after a delay when the modal becomes visible
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'attributes' && 
            (mutation.attributeName === 'style' || mutation.attributeName === 'class')) {
          
          const modal = document.querySelector('#signingModal');
          if (modal && !modal.classList.contains('hidden') && 
              window.getComputedStyle(modal).display !== 'none') {
            
            console.log("Modal became visible, activating drawing after delay");
            setTimeout(() => {
              window.activateDrawingOnCurrentCanvas();
            }, 300);
          }
        }
      });
    });
    
    // Start observing the modal for visibility changes
    const modal = document.querySelector('#signingModal');
    if (modal) {
      observer.observe(modal, {
        attributes: true,
        attributeFilter: ['style', 'class']
      });
    }
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
    console.log("OPEN METHOD CALLED", event);
    
    try {
      // Determine the field type from the event
      let fieldType = null;
      
      // Handle different types of events to get the field type
      if (typeof event === 'string') {
        // Direct string provided (e.g., "signature" or "initials")
        fieldType = event;
      } else if (event && event.target) {
        // Event with target (clicked element)
        if (event.target.dataset && event.target.dataset.fieldType) {
          fieldType = event.target.dataset.fieldType;
        } else if (event.target.closest) {
          // Try to find closest element with field-type data attribute
          const fieldElement = event.target.closest('[data-field-type]');
          if (fieldElement) {
            fieldType = fieldElement.dataset.fieldType;
          }
        }
      } else if (event && event.detail && event.detail.fieldType) {
        // Custom event with fieldType in detail
        fieldType = event.detail.fieldType;
      }
      
      console.log("Field type determined:", fieldType);
      this.fieldType = fieldType; // Store for later reference
      
      // Get the current field ID
      let currentFieldId = null;
      if (event && event.target && event.target.dataset && event.target.dataset.fieldId) {
        currentFieldId = event.target.dataset.fieldId;
      } else if (event && event.detail && event.detail.fieldId) {
        currentFieldId = event.detail.fieldId;
      } else if (event && event.target && event.target.closest) {
        const fieldElement = event.target.closest('[data-field-id]');
        if (fieldElement) {
          currentFieldId = fieldElement.dataset.fieldId;
        }
      }
      console.log("Current field ID:", currentFieldId);
      this.currentFieldId = currentFieldId;
      
      // Find the correct container and canvas based on field type
      const containerSelector = fieldType === 'signature' ? 'signatureContainer' : 'initialsContainer';
      const canvasId = fieldType === 'signature' ? 'signatureCanvas' : 'initialsCanvas';
      
      // Show the modal
      if (this.hasModalTarget) {
        this.modalTarget.classList.remove('hidden');
        this.modalTarget.style.display = 'flex';
        console.log("Modal displayed:", this.modalTarget);
      }
      
      // Show the backdrop
      if (this.hasBackdropTarget) {
        this.backdropTarget.classList.remove('hidden');
        this.backdropTarget.style.display = 'block';
        console.log("Backdrop displayed");
      }
      
      // Hide all containers first
      const containers = this.element.querySelectorAll('.modal-content');
      containers.forEach(container => {
        container.classList.add('hidden');
        container.style.display = 'none';
      });
      
      // Show the appropriate container
      if (this[containerSelector + 'Target']) {
        this[containerSelector + 'Target'].classList.remove('hidden');
        this[containerSelector + 'Target'].style.display = 'block';
        console.log(`Container ${containerSelector} displayed`);
      }
      
      // CRITICAL: Make sure button container is displayed
      if (this.hasButtonContainerTarget) {
        this.buttonContainerTargets.forEach(container => {
          container.style.display = 'flex';
          console.log("Button container displayed");
        });
      }
      
      // Find canvas
      let canvas = document.getElementById(canvasId);
      if (!canvas) {
        console.error(`Canvas not found with ID: ${canvasId}`);
        // Try to find canvas via target
        if (this.hasCanvasTarget) {
          canvas = this.canvasTargets.find(c => c.id === canvasId);
          console.log("Canvas found via target:", canvas);
        }
      }
      
      if (!canvas) {
        console.error("Could not find canvas element");
        return;
      }
      
      console.log("Using canvas:", canvas.id);
      
      // CRITICAL: Ensure canvas is properly styled and sized
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      
      // Set canvas display dimensions (CSS)
      canvas.style.width = '100%';
      canvas.style.height = '100%';
      canvas.style.position = 'absolute';
      canvas.style.left = '0';
      canvas.style.top = '0';
      canvas.style.zIndex = '1002';
      
      // Set pointer events and touch action
      canvas.style.pointerEvents = 'auto'; // CRITICAL
      canvas.style.touchAction = 'none';  // CRITICAL for touch devices
      canvas.style.userSelect = 'none';   // Prevent text selection
      canvas.style.cursor = 'crosshair';  // Show drawing cursor
      
      // Set canvas actual size in pixels
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      
      console.log(`Canvas sized: ${canvas.width}x${canvas.height} (display: ${rect.width}x${rect.height})`);
      
      // Clear canvas to white
      const ctx = canvas.getContext("2d");
      if (ctx) {
        // Scale context for high DPI displays
        ctx.scale(dpr, dpr);
        
        // Clear to white
        ctx.fillStyle = "white";
        ctx.fillRect(0, 0, canvas.width / dpr, canvas.height / dpr);
        
        // Draw a subtle guide line
        ctx.strokeStyle = "rgba(0, 0, 0, 0.05)";
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(20, rect.height / 2);
        ctx.lineTo(rect.width - 20, rect.height / 2);
        ctx.stroke();
        
        // Reset styles
        ctx.lineWidth = 2.5;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.strokeStyle = "#000000";
      }
      
      // Store canvas reference
      this.currentCanvas = canvas;
      
      // IMMEDIATELY set up drawing handlers - no delays
      console.log("Setting up direct drawing handlers immediately");
      this.setupDirectDrawingHandlers(canvas);
      
      // Setup button handlers too
      this.setupButtonHandlers(canvas);
      
      // Initialize the save button state (disabled)
      this.disableSaveButton();
      
      // Check canvas content after a delay to update button state
      setTimeout(() => this.checkCanvasContentAndUpdateButton(canvas), 200);
      
      console.log("Modal and canvas initialization complete - should be ready for drawing");
      
      // CRITICAL NEW ADDITION: Automatically trigger the testDraw method after a short delay
      // This uses the known-working test button functionality
      setTimeout(() => {
        console.log("Auto-triggering testDraw to ensure drawing is activated");
        this.testDraw({ target: canvas });
      }, 100);
      
      return canvas;
    } catch (error) {
      console.error("Error in open method:", error);
    }
  }
  
  // Add direct drawing fallback functionality
  setupDirectDrawingHandlers(canvas) {
    // Safety check to make sure we have a valid canvas element
    if (!canvas || !(canvas instanceof HTMLCanvasElement)) {
      console.error("Invalid canvas element provided to setupDirectDrawingHandlers:", canvas);
      
      // Try to find the canvas if it wasn't provided correctly
      if (this.fieldType) {
        const canvasId = this.fieldType === 'signature' ? 'signatureCanvas' : 'initialsCanvas';
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
    
    // Clean up any existing handlers
    this.cleanupCanvasEventListeners(canvas);
    
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
    
    // CRITICAL: Set canvas properties for drawing
    canvas.style.pointerEvents = 'auto';
    canvas.style.touchAction = 'none';
    canvas.style.userSelect = 'none'; // Prevent text selection
    canvas.style.webkitUserSelect = 'none'; // For Safari
    canvas.style.cursor = 'crosshair';
    
    // Set default drawing styles
    ctx.lineWidth = 2.5;
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
      if (!drawingState.isDrawing) {
        console.log("Not drawing - ignoring move event", event.type);
        return;
      }
      
      // Prevent default browser behavior
      event.preventDefault();
      event.stopPropagation();
      
      const coords = getCoordinates(event, canvas);
      
      // Normalize coordinates for device pixel ratio
      const ratio = window.devicePixelRatio || 1;
      const x = coords.x / ratio;
      const y = coords.y / ratio;
      
      // CRITICAL DEBUG: Log the drawing coordinates each time
      console.log(`Drawing from (${drawingState.lastX.toFixed(1)}, ${drawingState.lastY.toFixed(1)}) to (${x.toFixed(1)}, ${y.toFixed(1)})`);
      
      ctx.beginPath();
      ctx.moveTo(drawingState.lastX, drawingState.lastY);
      ctx.lineTo(x, y);
      ctx.stroke();
      
      // Update last position
      drawingState.lastX = x;
      drawingState.lastY = y;
      
      // Update save button after drawing
      this.checkCanvasContentAndUpdateButton(canvas);
      
      // Return false to ensure event doesn't propagate further
      return false;
    };
    
    // Start drawing
    const startDrawing = (event) => {
      // Use setTimeout to ensure this executes after any other possible handlers
      setTimeout(() => {
        console.log("========= STARTING DRAWING =========");
        console.log(`Start drawing event: ${event.type} on canvas ${canvas.id}`);
        console.log("Canvas ready state:", canvas.getAttribute('data-drawing-ready'));
        console.log("Canvas style:", canvas.getAttribute('style'));
        console.log("Canvas dimensions:", {
          width: canvas.width,
          height: canvas.height,
          clientWidth: canvas.clientWidth,
          clientHeight: canvas.clientHeight
        });
        
        // Prevent any default behaviors
        event.preventDefault();
        event.stopPropagation();
        
        const coords = getCoordinates(event, canvas);
        
        // Normalize coordinates for device pixel ratio
        const ratio = window.devicePixelRatio || 1;
        const x = coords.x / ratio;
        const y = coords.y / ratio;
        
        console.log(`Starting point: (${x.toFixed(1)}, ${y.toFixed(1)})`);
        
        // Set drawing state
        drawingState.isDrawing = true;
        drawingState.lastX = x;
        drawingState.lastY = y;
        
        // Draw a single point to ensure even a single click is registered
        ctx.beginPath();
        ctx.arc(x, y, 0.5, 0, Math.PI * 2);
        ctx.fill();
        
        // For pointer events, set capture to ensure all move events go to canvas
        if (event.type === 'pointerdown' && typeof canvas.setPointerCapture === 'function') {
          try {
            canvas.setPointerCapture(event.pointerId);
            console.log("Pointer capture set for pointerId:", event.pointerId);
          } catch (e) {
            console.error("Error setting pointer capture:", e);
          }
        }
        
        // Add all possible document-level event handlers
        console.log("Adding document-level event handlers");
        
        // Use all available event types for maximum compatibility
        document.addEventListener('mousemove', draw, { capture: true, passive: false });
        document.addEventListener('touchmove', draw, { capture: true, passive: false });
        document.addEventListener('pointermove', draw, { capture: true, passive: false });
        
        document.addEventListener('mouseup', stopDrawing, { capture: true });
        document.addEventListener('touchend', stopDrawing, { capture: true });
        document.addEventListener('touchcancel', stopDrawing, { capture: true });
        document.addEventListener('pointerup', stopDrawing, { capture: true });
        document.addEventListener('pointercancel', stopDrawing, { capture: true });
        
        // Also add direct handlers to canvas
        canvas.addEventListener('mousemove', draw, { passive: false });
        canvas.addEventListener('touchmove', draw, { passive: false });
        canvas.addEventListener('pointermove', draw, { passive: false });
        
        // Update save button state
        this.checkCanvasContentAndUpdateButton(canvas);
        
        // Draw a test dot in the corner to verify drawing works
        ctx.fillStyle = 'rgba(0,0,255,0.5)';
        ctx.beginPath();
        ctx.arc(10, 10, 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'black';
        
        console.log("Drawing state initialized and handlers attached");
        console.log("====================================");
      }, 0);
      
      // Prevent default and stop propagation
      event.preventDefault();
      event.stopPropagation();
      return false;
    };
    
    // Stop drawing
    const stopDrawing = (event) => {
      if (!drawingState.isDrawing) {
        console.log("Not currently drawing - ignoring stop event");
        return;
      }
      
      console.log("==== STOPPING DRAWING ====");
      console.log("Stop drawing event type:", event ? event.type : "no event");
      drawingState.isDrawing = false;
      
      // Release pointer capture if applicable
      if (event && event.type === 'pointerup' && event.pointerId !== undefined && typeof canvas.releasePointerCapture === 'function') {
        try {
          canvas.releasePointerCapture(event.pointerId);
          console.log("Pointer capture released for pointerId:", event.pointerId);
        } catch (e) {
          console.error("Error releasing pointer capture:", e);
        }
      }
      
      // Verbose cleanup of ALL possible event listeners to avoid any leaks
      console.log("Removing ALL document-level event handlers");
      
      // Mouse events
      document.removeEventListener('mousemove', draw, { capture: true });
      document.removeEventListener('mousemove', draw, false);
      document.removeEventListener('mouseup', stopDrawing, { capture: true });
      document.removeEventListener('mouseup', stopDrawing, false);
      
      // Touch events
      document.removeEventListener('touchmove', draw, { capture: true, passive: false });
      document.removeEventListener('touchmove', draw, { capture: true });
      document.removeEventListener('touchmove', draw, false);
      document.removeEventListener('touchend', stopDrawing, { capture: true });
      document.removeEventListener('touchend', stopDrawing, false);
      document.removeEventListener('touchcancel', stopDrawing, { capture: true });
      document.removeEventListener('touchcancel', stopDrawing, false);
      
      // Pointer events
      document.removeEventListener('pointermove', draw, { capture: true, passive: false });
      document.removeEventListener('pointermove', draw, { capture: true });
      document.removeEventListener('pointermove', draw, false);
      document.removeEventListener('pointerup', stopDrawing, { capture: true });
      document.removeEventListener('pointerup', stopDrawing, false);
      document.removeEventListener('pointercancel', stopDrawing, { capture: true });
      document.removeEventListener('pointercancel', stopDrawing, false);
      
      // Canvas-specific event listeners
      console.log("Removing canvas-level move handlers");
      canvas.removeEventListener('mousemove', draw, { passive: false });
      canvas.removeEventListener('mousemove', draw);
      canvas.removeEventListener('touchmove', draw, { passive: false });
      canvas.removeEventListener('touchmove', draw);
      canvas.removeEventListener('pointermove', draw, { passive: false });
      canvas.removeEventListener('pointermove', draw);
      
      // Update save button after drawing is complete
      this.checkCanvasContentAndUpdateButton(canvas);
      console.log("Drawing stopped and event handlers removed");
      console.log("====================================");
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
    
    // CRITICAL: Remove all existing event listeners directly
    canvas.removeEventListener("mousedown", startDrawing, true);
    canvas.removeEventListener("mousedown", startDrawing, false);
    canvas.removeEventListener("touchstart", startDrawing, true);
    canvas.removeEventListener("touchstart", startDrawing, false);
    canvas.removeEventListener("pointerdown", startDrawing, true);
    canvas.removeEventListener("pointerdown", startDrawing, false);
    
    // Set up event listeners with both capturing and bubbling phase for maximum compatibility
    canvas.addEventListener("mousedown", startDrawing, { capture: true });
    canvas.addEventListener("touchstart", startDrawing, { capture: true, passive: false });
    canvas.addEventListener("pointerdown", startDrawing, { capture: true });
    
    // Also add in bubbling phase as backup
    canvas.addEventListener("mousedown", startDrawing);
    canvas.addEventListener("touchstart", startDrawing, { passive: false });
    canvas.addEventListener("pointerdown", startDrawing);
    
    // Initial clear
    clearCanvas();
    
    // Store handlers in global object for later cleanup
    if (!window._canvasEventHandlers) {
      window._canvasEventHandlers = {};
    }
    window._canvasEventHandlers[canvas.id] = {
      draw: draw,
      stopDrawing: stopDrawing,
      startDrawing: startDrawing
    };
    
    // Mark canvas as ready for drawing
    canvas.setAttribute('data-drawing-ready', 'true');
    console.log("Canvas is now ready for drawing:", canvas.id);
    
    // Do NOT draw a test pattern anymore - we want clean canvas
    
    // Set up button handlers
    this.setupButtonHandlers(canvas);
    
    // Store reference to canvas for global methods
    this.currentCanvas = canvas;
    
    // Draw a single dot in the corner to verify canvas is working
    ctx.fillStyle = 'rgba(0,0,0,0.05)';
    ctx.beginPath();
    ctx.arc(5, 5, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'black';
    
    return canvas;
  }
  
  close() {
    console.log("Closing modal");
    
    // Hide modal
    if (this.hasModalTarget) {
      this.modalTarget.classList.add('hidden');
      this.modalTarget.style.display = 'none';
    }

    // Explicitly hide backdrop
    const backdrop = document.getElementById('modalBackdrop');
    if (backdrop) {
      backdrop.classList.add('hidden');
      backdrop.style.display = 'none';
    }

    // Resume PDF viewer
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
  testDraw(event) {
    console.log("TEST DRAW CALLED", event ? event.type : "no event", this.fieldType);
    
    try {
      let canvas = null;
      
      // Try to get canvas from event if it's a canvas element
      if (event && event.target && event.target instanceof HTMLCanvasElement) {
        canvas = event.target;
      } 
      // Try to find canvas in closest element if it's not directly on canvas
      else if (event && event.target) {
        canvas = event.target.closest('canvas');
      }
      
      // If no canvas found and we know the field type, try to get it by ID
      if (!canvas && this.fieldType) {
        const canvasId = this.fieldType === 'signature' ? 'signatureCanvas' : 'initialsCanvas';
        canvas = document.getElementById(canvasId);
      }
      
      // Still no canvas, try current canvas or find any canvas in modal
      if (!canvas) {
        canvas = this.currentCanvas;
        
        if (!canvas) {
          // Last resort - find any canvas in the visible modal content
          const visibleContent = this.modalTarget.querySelector('.modal-content:not(.hidden)');
          if (visibleContent) {
            canvas = visibleContent.querySelector('canvas');
          }
        }
      }
      
      if (!canvas) {
        console.error("TEST DRAW: Could not find canvas");
        return;
      }
      
      console.log("TEST DRAW using canvas:", canvas.id);
      
      // Instead of drawing a test pattern, just ensure the canvas is ready for drawing
      // and redo the drawing handler setup if needed
      
      // Make sure canvas has the right properties
      canvas.style.pointerEvents = 'auto';
      canvas.style.touchAction = 'none';
      canvas.style.userSelect = 'none';
      
      // Adjust canvas size if needed
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      if (canvas.width !== rect.width * dpr) {
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        canvas.style.width = rect.width + 'px';
        canvas.style.height = rect.height + 'px';
        
        const ctx = canvas.getContext('2d');
        ctx.scale(dpr, dpr);
      }
      
      // Refresher for drawing handlers - this reapplies all the event listeners
      console.log("TEST DRAW: Refreshing drawing handlers");
      this.setupDirectDrawingHandlers(canvas);
      
      // Check canvas content to update save button
      this.checkCanvasContentAndUpdateButton(canvas);
      
      // Store canvas reference
      this.currentCanvas = canvas;
      
      return true;
    } catch (error) {
      console.error("Error in testDraw:", error);
      return false;
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

  // Helper method to clean up existing event listeners
  cleanupCanvasEventListeners(canvas) {
    if (!canvas) return;
    
    console.log("Cleaning up existing event listeners for canvas:", canvas.id);
    
    // Remove existing handlers from global store
    if (window._canvasEventHandlers && window._canvasEventHandlers[canvas.id]) {
      const oldHandlers = window._canvasEventHandlers[canvas.id];
      
      // Remove document-level handlers
      document.removeEventListener('mousemove', oldHandlers.draw);
      document.removeEventListener('mouseup', oldHandlers.stopDrawing);
      document.removeEventListener('touchmove', oldHandlers.draw);
      document.removeEventListener('touchend', oldHandlers.stopDrawing);
      document.removeEventListener('pointermove', oldHandlers.draw);
      document.removeEventListener('pointerup', oldHandlers.stopDrawing);
      
      // Remove canvas-level start drawing handlers if they exist
      if (oldHandlers.startDrawing) {
        canvas.removeEventListener("mousedown", oldHandlers.startDrawing);
        canvas.removeEventListener("touchstart", oldHandlers.startDrawing);
        canvas.removeEventListener("pointerdown", oldHandlers.startDrawing);
      }
      
      // Clear handlers from global store
      delete window._canvasEventHandlers[canvas.id];
    }
    
    // Important: Do NOT replace the canvas with a clone as it disconnects all our bindings
    // and makes drawing impossible. Just return the original canvas.
    return canvas;
  }
} 