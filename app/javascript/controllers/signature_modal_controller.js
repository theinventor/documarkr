import { Controller } from "@hotwired/stimulus"

// Define signature fonts directly in this controller to avoid import issues
const SIGNATURE_FONTS = {
  handwriting1: {
    name: "Cedarville Cursive",
    family: "'Cedarville Cursive', cursive",
    url: "https://fonts.googleapis.com/css2?family=Cedarville+Cursive&display=swap",
    previewText: "John Doe"
  },
  handwriting2: {
    name: "Dancing Script",
    family: "'Dancing Script', cursive",
    url: "https://fonts.googleapis.com/css2?family=Dancing+Script:wght@500&display=swap",
    previewText: "John Doe"
  },
  handwriting3: {
    name: "Shadows Into Light",
    family: "'Shadows Into Light', cursive",
    url: "https://fonts.googleapis.com/css2?family=Shadows+Into+Light&display=swap", 
    previewText: "John Doe"
  }
}

// Helper functions needed for signatures - inlined to avoid import issues
function loadSignatureFonts() {
  // Actually load the fonts instead of just logging a message
  Object.values(SIGNATURE_FONTS).forEach(font => {
    // Create a link element for each font
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = font.url;
    document.head.appendChild(link);
    
    // Create a preload element for each font
    const preload = document.createElement('link');
    preload.rel = 'preload';
    preload.as = 'font';
    preload.href = font.url;
    preload.crossOrigin = 'anonymous';
    document.head.appendChild(preload);
    
    console.log(`Loading font: ${font.name} from ${font.url}`);
  });
}

function renderTextWithFont(canvas, text, fontKey, options = {}) {
  const ctx = canvas.getContext('2d');
  const font = SIGNATURE_FONTS[fontKey];
  
  if (!font) {
    console.error(`Font not found: ${fontKey}`);
    return false;
  }
  
  // Clear canvas
  ctx.fillStyle = 'white';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  // Set font properties
  const fontSize = options.fontSize || Math.min(canvas.height * 0.5, 60);
  ctx.font = `${fontSize}px ${font.family}`;
  console.log(`Rendering text "${text}" with font: ${ctx.font}`);
  
  ctx.fillStyle = options.color || 'black';
  ctx.textAlign = options.align || 'center';
  ctx.textBaseline = 'middle';
  
  // Calculate position
  const x = options.x || canvas.width / 2;
  const y = options.y || canvas.height / 2;
  
  // Draw text
  ctx.fillText(text, x, y);
  
  // Debug: Draw a border around the canvas to ensure it's visible
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
  ctx.lineWidth = 1;
  ctx.strokeRect(0, 0, canvas.width, canvas.height);
  
  return true;
}

function createFontPreviews(container, text, options = {}) {
  if (!container) return;
  
  // Clear container
  container.innerHTML = '';
  
  // Create preview for each font - using classes instead of inline styles for CSP
  Object.entries(SIGNATURE_FONTS).forEach(([key, font]) => {
    // Create preview container
    const previewContainer = document.createElement('div');
    previewContainer.className = 'font-preview-item p-3 border rounded-md cursor-pointer hover:bg-blue-50';
    previewContainer.setAttribute('data-font-key', key);
    
    // Create font preview
    const preview = document.createElement('div');
    preview.className = `font-preview-text text-center py-3 font-${key}`;
    preview.textContent = text || font.previewText;
    
    // Create font name label
    const label = document.createElement('div');
    label.className = 'font-name text-sm text-center mt-2 text-gray-700';
    label.textContent = font.name;
    
    // Add to container
    previewContainer.appendChild(preview);
    previewContainer.appendChild(label);
    container.appendChild(previewContainer);
    
    // Add click handler
    previewContainer.addEventListener('click', () => {
      if (options.onSelect) {
        options.onSelect(key, font);
      }
      
      // Add selected styling
      const items = container.querySelectorAll('.font-preview-item');
      items.forEach(item => {
        item.classList.remove('border-blue-500', 'bg-blue-50');
      });
      previewContainer.classList.add('border-blue-500', 'bg-blue-50');
    });
  });
}

function generateSignatureImageUrl(text, fontKey, options = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = options.width || 400;
  canvas.height = options.height || 150;
  
  renderTextWithFont(canvas, text, fontKey, options);
  
  return canvas.toDataURL('image/png');
}

// Connects to data-controller="signature-modal"
export default class extends Controller {
  static targets = [
    "modal", "backdrop", "closeButton", "canvas", 
    "signatureContainer", "initialsContainer", "buttonContainer",
    "nameInput", "initialsInput", 
    "fontPreviewsContainer", "initialsFontPreviewsContainer",
    "previewCanvas", "initialsPreviewCanvas",
    "previewContainer", "initialsPreviewContainer",
    "previewPlaceholder", "initialsPreviewPlaceholder",
    "saveSignatureButton", "saveInitialsButton"
  ]
  
  static values = {
    selectedFont: String,
    selectedInitialsFont: String
  }
  
  connect() {
    console.log("Signature modal controller connected");
    
    // Store reference to this controller instance in the DOM element
    // This makes it accessible via __stimulusController for direct access
    if (this.element) {
      this.element.__stimulusController = this;
      console.log("Stored controller reference in element");
    }
    
    this.setupModalHandlers();
    
    // Load fonts for handwriting styles
    loadSignatureFonts();
    
    // Pre-initialize font previews for both signature and initials
    if (this.hasFontPreviewsContainerTarget && this.fontPreviewsContainerTarget.children.length === 0) {
      console.log("Pre-initializing signature font previews");
      this.initFontSelectionUI('signature');
    }
    
    if (this.hasInitialsFontPreviewsContainerTarget && this.initialsFontPreviewsContainerTarget.children.length === 0) {
      console.log("Pre-initializing initials font previews");
      this.initFontSelectionUI('initials');
    }
    
    // Add global method for opening modal that works even if controller actions fail
    window.openSigningModal = (fieldType, fieldId) => {
      console.log("Direct call to open signature modal:", fieldType, fieldId);
      this.open(fieldType, fieldId);
    };
    
    // Make save methods globally accessible
    window.saveSignature = () => {
      console.log("Direct call to save signature");
      this.saveSignature();
    };
    
    window.saveInitials = () => {
      console.log("Direct call to save initials");
      this.saveInitials();
    };
    
    // Wait for DOM to be fully loaded
    setTimeout(() => {
      // Attach field handlers
      this.attachFieldHandlers();
    }, 300); // Wait for DOM to be fully ready
  }
  
  attachFieldHandlers() {
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
        this.open(fieldType, fieldId);
        
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
      if (e.key === 'Escape' && this.hasModalTarget && !this.modalTarget.classList.contains('hidden')) {
        this.close();
      }
    };
    document.addEventListener('keydown', this.escapeHandler);
    
    // Expose global methods
    window.openSigningModal = this.open.bind(this);
    window.closeSigningModal = this.close.bind(this);
    
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
                      const statusCircle = statusItem.querySelector('.field-status');
                      if (statusCircle) {
                        statusCircle.classList.remove('bg-gray-300');
                        statusCircle.classList.add('bg-green-500');
                      }
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
  
  open(fieldType, fieldId) {
    console.log("Opening modal for", fieldType, fieldId);
    
    try {
      // Store field type and ID for reference
      this.fieldType = fieldType;
      this.currentFieldId = fieldId;
      window.currentFieldId = fieldId;
      
      // Show the modal
      if (this.hasModalTarget) {
        this.modalTarget.classList.remove('hidden');
        this.modalTarget.style.display = 'flex';
      }
      
      // Show the backdrop
      if (this.hasBackdropTarget) {
        this.backdropTarget.classList.remove('hidden');
        this.backdropTarget.style.display = 'block';
      }
      
      // Hide all containers first
      const containers = this.element.querySelectorAll('.modal-content');
      containers.forEach(container => {
        container.classList.add('hidden');
        container.style.display = 'none';
      });
      
      // Find the correct container
      const containerSelector = fieldType === 'signature' ? 'signatureContainer' : 'initialsContainer';
      
      // Show the appropriate container
      if (this[containerSelector + 'Target']) {
        this[containerSelector + 'Target'].classList.remove('hidden');
        this[containerSelector + 'Target'].style.display = 'block';
      }
      
      // Check if document signer already has saved preferences
      this.checkForSavedPreferences(fieldType);
      
      // Initialize the font selection UI
      this.initFontSelectionUI(fieldType);
      
      return true;
    } catch (error) {
      console.error("Error in open method:", error);
      return false;
    }
  }
  
  // Check for saved font preferences
  async checkForSavedPreferences(fieldType) {
    try {
      const fieldSigningController = document.querySelector('[data-controller="field-signing"]')?.__stimulusController;
      if (!fieldSigningController || !fieldSigningController.documentIdValue || !fieldSigningController.tokenValue) {
        console.log("Cannot check for saved preferences - missing field signing controller or values");
        return;
      }
      
      const documentId = fieldSigningController.documentIdValue;
      const token = fieldSigningController.tokenValue;
      
      // Fetch the saved preferences
      const response = await fetch(`/sign/${documentId}/get_font_preference?token=${token}`);
      
      if (!response.ok) {
        console.log("Failed to fetch font preferences");
        return;
      }
      
      const data = await response.json();
      console.log("Retrieved font preferences:", data);
      
      // Check if we have preferences for this field type
      if (fieldType === 'signature' && data.signature_font) {
        this.selectedFontValue = data.signature_font;
        
        // Get the name from the input field if it exists
        const name = document.querySelector('[data-signature-modal-target="nameInput"]')?.value || 
                    data.name ||
                    "Your Signature";
        
        // Update the preview
        if (this.hasPreviewCanvasTarget) {
          this.updatePreview(name, data.signature_font);
          
          // Enable the save button
          if (this.hasSaveSignatureButtonTarget) {
            this.saveSignatureButtonTarget.disabled = false;
            this.saveSignatureButtonTarget.classList.remove('opacity-50', 'cursor-not-allowed');
          }
        }
      } else if (fieldType === 'initials' && data.initials_font) {
        this.selectedInitialsFontValue = data.initials_font;
        
        // Get initials value
        const initials = document.querySelector('[data-signature-modal-target="initialsInput"]')?.value || 
                        data.initials ||
                        "JD";
        
        // Update the preview
        if (this.hasInitialsPreviewCanvasTarget) {
          this.updateInitialsPreview(initials, data.initials_font);
          
          // Enable the save button
          if (this.hasSaveInitialsButtonTarget) {
            this.saveInitialsButtonTarget.disabled = false;
            this.saveInitialsButtonTarget.classList.remove('opacity-50', 'cursor-not-allowed');
          }
        }
      }
      
    } catch (error) {
      console.error("Error checking for saved preferences:", error);
    }
    
    // Initialize the font selection UI after checking preferences
    this.initFontSelectionUI(fieldType);
  }
  
  // Initialize the font selection UI for signatures or initials
  initFontSelectionUI(fieldType) {
    console.log(`Setting up font selection UI for ${fieldType}`);
    console.log('Name input exists:', this.hasNameInputTarget);
    console.log('Font previews container exists:', this.hasFontPreviewsContainerTarget);
    
    // Set up the right input field and preview container based on field type
    if (fieldType === 'signature') {
      // Set up for signature
      if (this.hasNameInputTarget && this.hasFontPreviewsContainerTarget) {
        // Check DOM elements are available
        console.log('Signature container element:', this.fontPreviewsContainerTarget);
        
        // Create manual previews if needed
        if (this.fontPreviewsContainerTarget.children.length === 0) {
          console.log("Creating manual font previews for signature");
          
          // Clear container
          this.fontPreviewsContainerTarget.innerHTML = '';
          
          Object.entries(SIGNATURE_FONTS).forEach(([key, font]) => {
            // Create preview container as a div
            const previewDiv = document.createElement('div');
            previewDiv.className = 'font-preview-item p-3 border rounded-md cursor-pointer hover:bg-blue-50';
            previewDiv.setAttribute('data-font-key', key);
            
            // Add preview text with font class
            const textPreview = document.createElement('div');
            textPreview.className = `font-${key} text-center py-3`;
            textPreview.style.fontFamily = font.family; // Add direct style to ensure font is applied
            textPreview.textContent = this.nameInputTarget.value || "John Doe";
            
            // Add font name label
            const fontName = document.createElement('div');
            fontName.className = 'text-sm text-center mt-2 text-gray-700';
            fontName.textContent = font.name;
            
            // Assemble preview
            previewDiv.appendChild(textPreview);
            previewDiv.appendChild(fontName);
            
            // Add click handler to select font
            previewDiv.addEventListener('click', () => {
              // Set the selected font
              this.selectedFontValue = key;
              
              // Update the preview
              this.updatePreview(this.nameInputTarget.value || "Your Signature", key);
              
              // Highlight this option
              const items = this.fontPreviewsContainerTarget.querySelectorAll('.font-preview-item');
              items.forEach(item => item.classList.remove('border-blue-500', 'bg-blue-50'));
              previewDiv.classList.add('border-blue-500', 'bg-blue-50');
              
              // Enable save button
              if (this.hasSaveSignatureButtonTarget) {
                this.saveSignatureButtonTarget.disabled = false;
                this.saveSignatureButtonTarget.classList.remove('opacity-50', 'cursor-not-allowed');
              }
            });
            
            // Add to container
            this.fontPreviewsContainerTarget.appendChild(previewDiv);
          });
        }
        
        // Add input change handler
        this.nameInputTarget.addEventListener('input', () => {
          if (this.selectedFontValue) {
            this.updatePreview(this.nameInputTarget.value || "Your Signature", this.selectedFontValue);
          }
        });
      } else {
        console.error("Missing required targets for signature UI");
      }
    } else if (fieldType === 'initials') {
      // Set up for initials
      if (this.hasInitialsInputTarget && this.hasInitialsFontPreviewsContainerTarget) {
        // Check DOM elements are available
        console.log('Initials container element:', this.initialsFontPreviewsContainerTarget);
        
        // Create manual previews if needed
        if (this.initialsFontPreviewsContainerTarget.children.length === 0) {
          console.log("Creating manual font previews for initials");
          
          // Clear container
          this.initialsFontPreviewsContainerTarget.innerHTML = '';
          
          Object.entries(SIGNATURE_FONTS).forEach(([key, font]) => {
            // Create preview container as a div
            const previewDiv = document.createElement('div');
            previewDiv.className = 'font-preview-item p-3 border rounded-md cursor-pointer hover:bg-blue-50';
            previewDiv.setAttribute('data-font-key', key);
            
            // Add preview text with font class
            const textPreview = document.createElement('div');
            textPreview.className = `font-${key} text-center py-3`;
            textPreview.style.fontFamily = font.family; // Add direct style to ensure font is applied
            textPreview.textContent = this.initialsInputTarget.value || "JD";
            
            // Add font name label
            const fontName = document.createElement('div');
            fontName.className = 'text-sm text-center mt-2 text-gray-700';
            fontName.textContent = font.name;
            
            // Assemble preview
            previewDiv.appendChild(textPreview);
            previewDiv.appendChild(fontName);
            
            // Add click handler to select font
            previewDiv.addEventListener('click', () => {
              // Set the selected font
              this.selectedInitialsFontValue = key;
              
              // Update the preview
              this.updateInitialsPreview(this.initialsInputTarget.value || "JD", key);
              
              // Highlight this option
              const items = this.initialsFontPreviewsContainerTarget.querySelectorAll('.font-preview-item');
              items.forEach(item => item.classList.remove('border-blue-500', 'bg-blue-50'));
              previewDiv.classList.add('border-blue-500', 'bg-blue-50');
              
              // Enable save button
              if (this.hasSaveInitialsButtonTarget) {
                this.saveInitialsButtonTarget.disabled = false;
                this.saveInitialsButtonTarget.classList.remove('opacity-50', 'cursor-not-allowed');
              }
            });
            
            // Add to container
            this.initialsFontPreviewsContainerTarget.appendChild(previewDiv);
          });
        }
        
        // Add input change handler
        this.initialsInputTarget.addEventListener('input', () => {
          if (this.selectedInitialsFontValue) {
            this.updateInitialsPreview(this.initialsInputTarget.value || "JD", this.selectedInitialsFontValue);
          }
        });
      } else {
        console.error("Missing required targets for initials UI");
      }
    }
  }
  
  // Update signature preview
  updatePreview(text, fontKey) {
    if (!this.hasPreviewCanvasTarget || !fontKey) return;
    
    console.log(`Updating preview with text "${text}" and font "${fontKey}"`);
    
    // Show the canvas, hide the placeholder
    this.previewCanvasTarget.classList.remove('hidden');
    if (this.hasPreviewPlaceholderTarget) {
      this.previewPlaceholderTarget.classList.add('hidden');
    }
    
    // Set canvas size
    const dpr = window.devicePixelRatio || 1;
    const canvas = this.previewCanvasTarget;
    const container = canvas.parentElement;
    
    // Ensure the container has dimensions
    if (container.clientWidth === 0 || container.clientHeight === 0) {
      console.error("Preview container has zero dimensions:", container);
      return;
    }
    
    console.log(`Canvas container dimensions: ${container.clientWidth}x${container.clientHeight}`);
    
    canvas.width = container.clientWidth * dpr;
    canvas.height = container.clientHeight * dpr;
    
    console.log(`Canvas dimensions set to: ${canvas.width}x${canvas.height}`);
    
    // Render preview
    const result = renderTextWithFont(canvas, text, fontKey, {
      fontSize: Math.min(canvas.height / 2.5, 60) * dpr,
      x: canvas.width / 2,
      y: canvas.height / 2
    });
    
    console.log(`Preview render result: ${result ? 'success' : 'failed'}`);
  }
  
  // Update initials preview
  updateInitialsPreview(text, fontKey) {
    if (!this.hasInitialsPreviewCanvasTarget || !fontKey) return;
    
    console.log(`Updating initials preview with text "${text}" and font "${fontKey}"`);
    
    // Show the canvas, hide the placeholder
    this.initialsPreviewCanvasTarget.classList.remove('hidden');
    if (this.hasInitialsPreviewPlaceholderTarget) {
      this.initialsPreviewPlaceholderTarget.classList.add('hidden');
    }
    
    // Set canvas size
    const dpr = window.devicePixelRatio || 1;
    const canvas = this.initialsPreviewCanvasTarget;
    const container = canvas.parentElement;
    
    // Ensure the container has dimensions
    if (container.clientWidth === 0 || container.clientHeight === 0) {
      console.error("Initials preview container has zero dimensions:", container);
      return;
    }
    
    console.log(`Initials canvas container dimensions: ${container.clientWidth}x${container.clientHeight}`);
    
    canvas.width = container.clientWidth * dpr;
    canvas.height = container.clientHeight * dpr;
    
    console.log(`Initials canvas dimensions set to: ${canvas.width}x${canvas.height}`);
    
    // Render preview
    const result = renderTextWithFont(canvas, text, fontKey, {
      fontSize: Math.min(canvas.height / 2.5, 60) * dpr,
      x: canvas.width / 2,
      y: canvas.height / 2
    });
    
    console.log(`Initials preview render result: ${result ? 'success' : 'failed'}`);
  }
  
  // Save signature
  saveSignature(event) {
    console.log("saveSignature method called", event);
    
    if (!this.selectedFontValue || !this.hasNameInputTarget) {
      console.error("Cannot save signature - missing font or name input", {
        selectedFont: this.selectedFontValue,
        hasNameInput: this.hasNameInputTarget
      });
      return;
    }
    
    try {
      const name = this.nameInputTarget.value || "Your Signature";
      console.log(`Generating signature image for "${name}" with font ${this.selectedFontValue}`);
      
      const imageUrl = generateSignatureImageUrl(name, this.selectedFontValue, {
        width: 400,
        height: 150
      });
      
      console.log("Generated signature image URL, length:", imageUrl.length);
      
      // Get the current field ID from window or data attribute
      const fieldId = window.currentFieldId || this.currentFieldId;
      console.log("Using field ID:", fieldId);
      
      // Dispatch event with signature data
      const signatureEvent = new CustomEvent('signature-pad:save', {
        detail: {
          signatureData: imageUrl,
          fontKey: this.selectedFontValue,
          fieldId: fieldId,
          fieldType: 'signature'
        },
        bubbles: true
      });
      
      // Dispatch on document
      console.log("Dispatching signature-pad:save event");
      document.dispatchEvent(signatureEvent);
      
      // Try direct method call on field-signing controller
      const fieldSigningController = document.querySelector('[data-controller="field-signing"]');
      const controller = fieldSigningController?.__stimulusController;
      
      if (controller && typeof controller.signatureComplete === 'function') {
        console.log("Calling field-signing controller's signatureComplete method directly");
        controller.signatureComplete({
          detail: { 
            signatureData: imageUrl,
            fontKey: this.selectedFontValue,
            fieldId: fieldId,
            fieldType: 'signature'
          }
        });
      } else {
        console.log("Could not find field-signing controller or signatureComplete method", {
          controller: !!controller,
          method: controller ? typeof controller.signatureComplete : 'N/A'
        });
        
        // Always use the fallback to update UI directly
        if (fieldId) {
          console.log("Using direct DOM fallback for field", fieldId);
          const fieldElement = document.querySelector(`[data-field-id="${fieldId}"]`);
          if (fieldElement) {
            // Create image to display signature
            const img = document.createElement('img');
            img.src = imageUrl;
            img.className = 'w-full h-full object-contain p-1';
            
            // Clear field content and add image
            fieldElement.innerHTML = '';
            fieldElement.appendChild(img);
            
            // Mark as completed
            fieldElement.dataset.completed = 'true';
            fieldElement.style.border = '2px solid #4CAF50';
            fieldElement.style.backgroundColor = 'rgba(220, 252, 231, 0.7)';
            
            // Also update field status in sidebar if it exists
            const statusItem = document.querySelector(`.field-status-item[data-field-id="${fieldId}"]`);
            if (statusItem) {
              statusItem.dataset.fieldStatus = 'completed';
              const statusCircle = statusItem.querySelector('.field-status');
              if (statusCircle) {
                statusCircle.classList.remove('bg-gray-300');
                statusCircle.classList.add('bg-green-500');
              }
            }
          } else {
            console.warn(`Field element with ID ${fieldId} not found`);
          }
        } else {
          console.warn("No field ID available for direct DOM update");
        }
      }
      
      // Store in session storage as additional fallback
      sessionStorage.setItem('last_signature_data', imageUrl);
      sessionStorage.setItem('last_signature_field_id', fieldId || '');
      
      // Close the modal
      console.log("Closing signature modal");
      this.close();
    } catch (error) {
      console.error("Error saving signature:", error);
    }
  }
  
  // Save initials
  saveInitials(event) {
    console.log("saveInitials method called", event);
    
    if (!this.selectedInitialsFontValue || !this.hasInitialsInputTarget) {
      console.error("Cannot save initials - missing font or initials input", {
        selectedFont: this.selectedInitialsFontValue,
        hasInitialsInput: this.hasInitialsInputTarget
      });
      return;
    }
    
    try {
      const initials = this.initialsInputTarget.value || "JD";
      console.log(`Generating initials image for "${initials}" with font ${this.selectedInitialsFontValue}`);
      
      const imageUrl = generateSignatureImageUrl(initials, this.selectedInitialsFontValue, {
        width: 200,
        height: 100
      });
      
      console.log("Generated initials image URL, length:", imageUrl.length);
      
      // Get the current field ID from window or data attribute
      const fieldId = window.currentFieldId || this.currentFieldId;
      console.log("Using field ID for initials:", fieldId);
      
      // Dispatch event with initials data
      const initialsEvent = new CustomEvent('signature-pad:save', {
        detail: {
          signatureData: imageUrl,
          fontKey: this.selectedInitialsFontValue,
          fieldId: fieldId,
          fieldType: 'initials'
        },
        bubbles: true
      });
      
      // Dispatch on document
      console.log("Dispatching signature-pad:save event for initials");
      document.dispatchEvent(initialsEvent);
      
      // Try direct method call on field-signing controller
      const fieldSigningController = document.querySelector('[data-controller="field-signing"]');
      const controller = fieldSigningController?.__stimulusController;
      
      if (controller && typeof controller.signatureComplete === 'function') {
        console.log("Calling field-signing controller's signatureComplete method directly for initials");
        controller.signatureComplete({
          detail: { 
            signatureData: imageUrl,
            fontKey: this.selectedInitialsFontValue,
            fieldId: fieldId,
            fieldType: 'initials'
          }
        });
      } else {
        console.log("Could not find field-signing controller or signatureComplete method", {
          controller: !!controller,
          method: controller ? typeof controller.signatureComplete : 'N/A'
        });
        
        // Always use the fallback to update UI directly
        if (fieldId) {
          console.log("Using direct DOM fallback for initials field", fieldId);
          const fieldElement = document.querySelector(`[data-field-id="${fieldId}"]`);
          if (fieldElement) {
            // Create image to display initials
            const img = document.createElement('img');
            img.src = imageUrl;
            img.className = 'w-full h-full object-contain p-1';
            
            // Clear field content and add image
            fieldElement.innerHTML = '';
            fieldElement.appendChild(img);
            
            // Mark as completed
            fieldElement.dataset.completed = 'true';
            fieldElement.classList.remove('border-dashed');
            fieldElement.classList.add('border-solid');
            fieldElement.classList.add('bg-green-50');
            fieldElement.classList.add('border-green-500');
            
            // Also update field status in sidebar if it exists
            const statusItem = document.querySelector(`.field-status-item[data-field-id="${fieldId}"]`);
            if (statusItem) {
              statusItem.dataset.fieldStatus = 'completed';
              const statusCircle = statusItem.querySelector('.field-status');
              if (statusCircle) {
                statusCircle.classList.remove('bg-gray-300');
                statusCircle.classList.add('bg-green-500');
              }
            }
          } else {
            console.warn(`Field element with ID ${fieldId} not found`);
          }
        } else {
          console.warn("No field ID available for direct DOM update");
        }
      }
      
      // Store in session storage as additional fallback
      sessionStorage.setItem('last_initials_data', imageUrl);
      sessionStorage.setItem('last_initials_field_id', fieldId || '');
      
      // Close the modal
      console.log("Closing signature modal after initials save");
      this.close();
    } catch (error) {
      console.error("Error saving initials:", error);
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
      if (!drawingState.isDrawing) return;
      
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
    if (this.hasBackdropTarget) {
      this.backdropTarget.classList.add('hidden');
    }
    
    if (this.hasModalTarget) {
      this.modalTarget.classList.add('hidden');
    }
    
    // Resume PDF rendering
    document.dispatchEvent(new CustomEvent('pdf-viewer:unpause'));
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
    // Safety check to avoid errors
    if (!canvas) {
      console.log("No canvas provided to setupButtonHandlers");
      return;
    }
    
    console.log("Setting up button handlers for canvas");
    
    // Find the parent content container
    const contentContainer = canvas?.closest('.modal-content');
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