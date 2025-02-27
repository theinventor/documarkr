import { Controller } from "@hotwired/stimulus"

// Connects to data-controller="signature-pad"
export default class extends Controller {
  static targets = ["canvas", "clearButton", "saveButton", "preview", "container"]
  static values = {
    color: { type: String, default: "#000000" },
    lineWidth: { type: Number, default: 2.5 },
    savedImageData: String
  }

  connect() {
    // Clear console to help with debugging
    console.clear();
    console.log("=== SIGNATURE PAD DEBUGGING ===");
    console.log("Signature pad controller connected with ID:", this.element.id || "no ID");
    
    // Log targets for debugging
    console.log("Canvas target found:", this.hasCanvasTarget);
    if (this.hasCanvasTarget) {
      console.log("Canvas element:", this.canvasTarget);
      console.log("Canvas ID:", this.canvasTarget.id);
      console.log("Canvas dimensions:", {
        width: this.canvasTarget.width,
        height: this.canvasTarget.height,
        offsetWidth: this.canvasTarget.offsetWidth,
        offsetHeight: this.canvasTarget.offsetHeight
      });
    }
    
    // Important: For modal scenarios, we need to properly identify the container
    console.log("Container target found:", this.hasContainerTarget);
    if (!this.hasContainerTarget) {
      console.log("Using element as container since no container target found");
      // If no container target is specified, use the controller element itself
      this.element.dataset.signaturePadTarget = "container";
      console.log("Container now set to:", this.element);
    }
    
    // Extra logging of relevant DOM structure
    console.log("Parent elements:");
    let element = this.element;
    let i = 0;
    while (element && i < 5) {
      console.log(`- Level ${i}:`, element.tagName, element.id || "no id", 
                  element.className || "no class");
      element = element.parentElement;
      i++;
    }
    
    // Setup observers and initialize
    this.setupObserversAndInitialize();
  }
  
  setupObserversAndInitialize() {
    console.log("Setting up observers and initialization logic");
    
    // Create a MutationObserver to watch for visibility changes
    this.visibilityObserver = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        console.log("Mutation detected:", mutation.type, mutation.attributeName);
        
        if (mutation.type === "attributes" && 
            (mutation.attributeName === "style" || mutation.attributeName === "class")) {
          
          const isVisible = !!(this.element.offsetParent !== null || 
                             (this.element.style.display !== 'none' && 
                              !this.element.classList.contains('hidden')));
                              
          console.log("Element visibility changed:", isVisible);
          
          if (isVisible && !this.isInitialized) {
            console.log("Element became visible, initializing signature pad...");
            this.initializeSignaturePad();
          }
        }
      });
    });

    // Start observing the ELEMENT itself for visibility changes
    console.log("Starting visibility observer on element");
    this.visibilityObserver.observe(this.element, {
      attributes: true,
      attributeFilter: ['style', 'class']
    });
    
    // Also observe the modal dialog if we can find it
    const modal = this.element.closest('[data-field-signing-target="modal"]');
    if (modal) {
      console.log("Found modal, observing it for visibility changes");
      this.visibilityObserver.observe(modal, {
        attributes: true,
        attributeFilter: ['style', 'class']
      });
    }

    // Also initialize on connect if the element is already visible
    if (this.element.offsetParent !== null) {
      console.log("Element is visible on connect, initializing immediately");
      // Use setTimeout to ensure DOM is ready
      setTimeout(() => this.initializeSignaturePad(), 100); 
    } else {
      console.log("Element not visible yet, waiting for visibility change");
      
      // Force check modal visibility after a short delay
      setTimeout(() => {
        const modal = this.element.closest('[data-field-signing-target="modal"]');
        if (modal && !modal.classList.contains('hidden')) {
          console.log("Modal is visible after delay check, forcing initialization");
          this.initializeSignaturePad();
        }
      }, 500);
    }

    // Add window resize listener for responsive behavior
    this.resizeHandler = this.resizeCanvas.bind(this);
    window.addEventListener("resize", this.resizeHandler);
  }

  disconnect() {
    console.log("Signature pad controller disconnecting");
    // Remove event listeners
    if (this.canvasTarget) {
      this.canvasTarget.removeEventListener("mousedown", this.onMouseDownHandler, true);
      this.canvasTarget.removeEventListener("touchstart", this.onTouchStartHandler, true);
      document.removeEventListener("mousemove", this.onMouseMoveHandler, true);
      document.removeEventListener("mouseup", this.onMouseUpHandler, true);
      document.removeEventListener("touchend", this.onTouchEndHandler, true);
    }
    
    if (this.visibilityObserver) {
      this.visibilityObserver.disconnect();
    }
    
    if (this.resizeHandler) {
      window.removeEventListener("resize", this.resizeHandler);
    }
  }
  
  initializeSignaturePad() {
    console.log("Initializing pure JavaScript signature pad");
    
    if (!this.hasCanvasTarget) {
      console.error("No canvas target found - make sure you have an element with data-signature-pad-target='canvas'");
      return;
    }
    
    const canvas = this.canvasTarget;
    console.log("Canvas element:", canvas);
    
    // ⚠️ CRITICAL: Check if the containing modal is visible
    const modal = canvas.closest('[data-field-signing-target="modal"]') || canvas.closest('#signingModal');
    if (modal) {
      const isModalVisible = !modal.classList.contains('hidden') && window.getComputedStyle(modal).display !== 'none';
      console.log("Modal visibility:", isModalVisible ? "visible" : "hidden");
      
      if (!isModalVisible) {
        console.log("Modal not visible, will try again when visible");
        // Double check after a short delay - sometimes the modal becomes visible right after this check
        setTimeout(() => {
          if (!modal.classList.contains('hidden') && window.getComputedStyle(modal).display !== 'none') {
            console.log("Modal is now visible after delayed check, initializing");
            this.initializeSignaturePad();
          }
        }, 300);
        return;
      }
    }
    
    // Check if canvas itself is visible
    const canvasVisible = canvas.offsetParent !== null || 
                      getComputedStyle(canvas).display !== 'none';
    if (!canvasVisible) {
      console.log("Canvas not visible, will try again later");
      // Try again after a short delay - sometimes the canvas becomes visible right after this check
      setTimeout(() => this.initializeSignaturePad(), 250);
      return;
    }

    // IMPORTANT: Force z-index high to ensure canvas is on top
    canvas.style.zIndex = "99999";
    canvas.style.pointerEvents = "auto";
    canvas.style.touchAction = "none"; // Critical for touch devices
    
    // ⚠️ CRITICAL: Fix canvas size before anything else
    this.resizeCanvas();
    
    // Setup drawing state
    this.ctx = canvas.getContext("2d");
    this.isDrawing = false;
    this.lastX = 0;
    this.lastY = 0;
    this.hasSignature = false;
    this.isInitialized = true;
    
    // Setup event handlers with bindings
    this.onMouseDownHandler = this.onMouseDown.bind(this);
    this.onMouseMoveHandler = this.onMouseMove.bind(this);
    this.onMouseUpHandler = this.onMouseUp.bind(this);
    this.onTouchStartHandler = this.onTouchStart.bind(this);
    this.onTouchMoveHandler = this.onTouchMove.bind(this);
    this.onTouchEndHandler = this.onTouchEnd.bind(this);
    
    // ⚠️ CRITICAL: Remove any existing event listeners before adding new ones
    canvas.removeEventListener("mousedown", this.onMouseDownHandler, true);
    canvas.removeEventListener("touchstart", this.onTouchStartHandler, true);
    document.removeEventListener("mousemove", this.onMouseMoveHandler, true);
    document.removeEventListener("mouseup", this.onMouseUpHandler, true);
    document.removeEventListener("touchmove", this.onTouchMoveHandler, { capture: true, passive: false });
    document.removeEventListener("touchend", this.onTouchEndHandler, true);
    
    // Add event listeners - use capture phase to ensure events are caught
    console.log("Adding event listeners to canvas");
    canvas.addEventListener("mousedown", this.onMouseDownHandler, true);
    canvas.addEventListener("touchstart", this.onTouchStartHandler, { passive: false, capture: true });
    
    // Log canvas dimensions and styles
    console.log("Canvas dimensions after setup:", {
      width: canvas.width,
      height: canvas.height,
      offsetWidth: canvas.offsetWidth,
      offsetHeight: canvas.offsetHeight,
      style: canvas.getAttribute('style')
    });
    
    // Set default styles
    this.ctx.lineJoin = "round";
    this.ctx.lineCap = "round";
    this.ctx.lineWidth = this.lineWidthValue;
    this.ctx.strokeStyle = this.colorValue;
    
    // Clear canvas to ensure it's white
    this.ctx.fillStyle = "white";
    this.ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Draw a test line to verify the canvas is working
    this.ctx.beginPath();
    this.ctx.strokeStyle = "rgba(255,0,0,0.3)";
    this.ctx.lineWidth = 3;
    this.ctx.moveTo(10, 10);
    this.ctx.lineTo(canvas.width / 3, canvas.height / 3);
    this.ctx.stroke();
    this.ctx.lineWidth = this.lineWidthValue;
    this.ctx.strokeStyle = this.colorValue; // Reset to original color
    
    this.updateButtonState();
    
    // Add direct event handlers to buttons
    if (this.hasClearButtonTarget) {
      console.log("Setting up clear button");
      // Remove any existing event listeners first
      this.clearButtonTarget.removeEventListener('click', this.clearButtonTarget._clickHandler);
      
      // Create a new handler and store reference
      this.clearButtonTarget._clickHandler = () => this.clear();
      this.clearButtonTarget.addEventListener('click', this.clearButtonTarget._clickHandler);
    }
    
    if (this.hasSaveButtonTarget) {
      console.log("Setting up save button");
      // Remove any existing event listeners first
      this.saveButtonTarget.removeEventListener('click', this.saveButtonTarget._clickHandler);
      
      // Create a new handler and store reference
      this.saveButtonTarget._clickHandler = () => this.save();
      this.saveButtonTarget.addEventListener('click', this.saveButtonTarget._clickHandler);
    }
    
    console.log("Signature pad initialized and ready for drawing");
    
    // Add manual test for debugging in console
    window.testDrawOnCanvas = (canvasId) => {
      const testCanvas = canvasId ? document.getElementById(canvasId) : this.canvasTarget;
      if (!testCanvas) return console.error("Canvas not found");
      
      const ctx = testCanvas.getContext('2d');
      ctx.strokeStyle = 'red';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(50, 50);
      ctx.lineTo(testCanvas.width - 50, testCanvas.height - 50);
      ctx.stroke();
      console.log("Test line drawn on canvas:", testCanvas.id);
    };
  }

  resizeCanvas() {
    console.log("Resizing canvas");
    const canvas = this.canvasTarget;
    
    // Determine the container to use for sizing
    let container;
    if (this.hasContainerTarget) {
      container = this.containerTarget;
    } else {
      container = canvas.parentElement;
    }
    
    console.log("Container for canvas:", container);
    const ratio = Math.max(window.devicePixelRatio || 1, 1); // Use 1 as minimum ratio

    // Log container dimensions
    console.log("Container dimensions:", {
      width: container.clientWidth,
      height: container.clientHeight,
      offsetWidth: container.offsetWidth,
      offsetHeight: container.offsetHeight
    });

    // Save current drawing if any
    let imageData = null;
    if (this.ctx && this.hasSignature) {
      try {
        imageData = this.ctx.getImageData(0, 0, canvas.width, canvas.height);
      } catch (e) {
        console.error("Could not get image data:", e);
      }
    }

    // Make sure container has actual dimensions
    if (!container.clientWidth || !container.clientHeight || 
        container.clientWidth <= 10 || container.clientHeight <= 10) {
      console.warn("Container dimensions are too small, using fallback dimensions");
      // Apply a minimum size if container is too small
      const minWidth = 300;
      const minHeight = 200;
      canvas.width = minWidth * ratio;
      canvas.height = minHeight * ratio;
      canvas.style.width = minWidth + "px";
      canvas.style.height = minHeight + "px";
    } else {
      // Set canvas display size (CSS)
      canvas.style.width = container.clientWidth + "px";
      canvas.style.height = container.clientHeight + "px";
      
      // Set canvas actual size with higher resolution
      canvas.width = container.clientWidth * ratio;
      canvas.height = container.clientHeight * ratio;
    }
    
    // Scale context for retina displays
    if (this.ctx) {
      // Clear the transformation matrix before scaling
      this.ctx.setTransform(1, 0, 0, 1, 0, 0);
      this.ctx.scale(ratio, ratio);
      
      // Restore drawing if we had one
      if (imageData && imageData.width > 0 && imageData.height > 0) {
        try {
          this.ctx.putImageData(imageData, 0, 0);
        } catch (e) {
          console.error("Could not restore image data:", e);
        }
      } else {
        // Ensure white background
        this.ctx.fillStyle = "white";
        this.ctx.fillRect(0, 0, canvas.width / ratio, canvas.height / ratio);
      }
      
      // Reset styles that might have been lost
      this.ctx.lineJoin = "round";
      this.ctx.lineCap = "round";
      this.ctx.lineWidth = this.lineWidthValue;
      this.ctx.strokeStyle = this.colorValue;
    }
    
    console.log("Canvas resized:", {
      width: canvas.width,
      height: canvas.height,
      styleWidth: canvas.style.width,
      styleHeight: canvas.style.height,
      ratio: ratio
    });
  }
  
  // Mouse event handlers
  onMouseDown(e) {
    console.log("Mouse down event", e.type);
    e.preventDefault();  // Prevent default to ensure no text selection
    
    this.isDrawing = true;
    [this.lastX, this.lastY] = this.getCoordinates(e);
    console.log(`Starting draw at (${this.lastX}, ${this.lastY})`);
    
    // Add mouse move and up listeners to document (not canvas)
    document.addEventListener("mousemove", this.onMouseMoveHandler, true);
    document.addEventListener("mouseup", this.onMouseUpHandler, true);
    
    // Draw a dot if the user just clicks
    this.ctx.beginPath();
    this.ctx.arc(this.lastX, this.lastY, this.lineWidthValue / 2, 0, Math.PI * 2);
    this.ctx.fill();
    
    // Mark as having a signature
    this.hasSignature = true;
    this.updateButtonState();
  }
  
  onMouseMove(e) {
    if (!this.isDrawing) return;
    e.preventDefault();
    
    const [currentX, currentY] = this.getCoordinates(e);
    this.draw(this.lastX, this.lastY, currentX, currentY);
    [this.lastX, this.lastY] = [currentX, currentY];
  }
  
  onMouseUp(e) {
    console.log("Mouse up event", e.type);
    if (this.isDrawing) {
      this.isDrawing = false;
      this.hasSignature = true;
      this.updateButtonState();
      
      // Remove event listeners
      document.removeEventListener("mousemove", this.onMouseMoveHandler, true);
    }
  }
  
  // Touch event handlers
  onTouchStart(e) {
    console.log("Touch start event", e.type);
    e.preventDefault(); // Prevent scrolling
    e.stopPropagation(); // Stop event from bubbling
    
    if (e.touches.length !== 1) return;
    
    this.isDrawing = true;
    [this.lastX, this.lastY] = this.getTouchCoordinates(e);
    console.log(`Starting touch at (${this.lastX}, ${this.lastY})`);
    
    // Add touch move and end listeners to document (important for touch devices)
    document.addEventListener("touchmove", this.onTouchMoveHandler, { passive: false, capture: true });
    document.addEventListener("touchend", this.onTouchEndHandler, true);
    document.addEventListener("touchcancel", this.onTouchEndHandler, true);
    
    // Draw a dot if the user just taps
    this.ctx.beginPath();
    this.ctx.arc(this.lastX, this.lastY, this.lineWidthValue / 2, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.closePath();
    
    // Mark as having a signature
    this.hasSignature = true;
    this.updateButtonState();
  }
  
  onTouchMove(e) {
    if (!this.isDrawing) return;
    e.preventDefault(); // Prevent scrolling while drawing
    e.stopPropagation(); // Stop event from bubbling
    
    // Ensure we have touches
    if (e.touches.length !== 1) return;
    
    const [currentX, currentY] = this.getTouchCoordinates(e);
    console.log(`Touch move to (${currentX.toFixed(1)}, ${currentY.toFixed(1)})`);
    
    this.draw(this.lastX, this.lastY, currentX, currentY);
    [this.lastX, this.lastY] = [currentX, currentY];
    
    // Mark as having a signature
    this.hasSignature = true;
    this.updateButtonState();
  }
  
  onTouchEnd(e) {
    console.log("Touch end event", e.type);
    if (this.isDrawing) {
      this.isDrawing = false;
      this.hasSignature = true;
      this.updateButtonState();
      
      // Remove event listeners
      document.removeEventListener("touchmove", this.onTouchMoveHandler, { capture: true, passive: false });
      document.removeEventListener("touchend", this.onTouchEndHandler, true);
      document.removeEventListener("touchcancel", this.onTouchEndHandler, true);
    }
  }
  
  // Helper methods
  getCoordinates(event) {
    const canvas = this.canvasTarget;
    const rect = canvas.getBoundingClientRect();
    // Correct coordinate calculation accounting for CSS scaling
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    return [
      (event.clientX - rect.left) * scaleX,
      (event.clientY - rect.top) * scaleY
    ];
  }
  
  getTouchCoordinates(event) {
    const canvas = this.canvasTarget;
    const rect = canvas.getBoundingClientRect();
    const touch = event.touches[0];
    // Correct coordinate calculation accounting for CSS scaling
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    return [
      (touch.clientX - rect.left) * scaleX,
      (touch.clientY - rect.top) * scaleY
    ];
  }
  
  draw(startX, startY, endX, endY) {
    const ctx = this.ctx;
    
    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.lineTo(endX, endY);
    ctx.stroke();
    ctx.closePath();
    
    // Debug line drawing
    console.log(`Drawing line from (${startX.toFixed(1)}, ${startY.toFixed(1)}) to (${endX.toFixed(1)}, ${endY.toFixed(1)})`);
  }
  
  clear() {
    console.log("Clear button clicked");
    if (!this.ctx) return;
    
    const canvas = this.canvasTarget;
    const ratio = window.devicePixelRatio || 1;
    this.ctx.fillStyle = "white";
    this.ctx.fillRect(0, 0, canvas.width / ratio, canvas.height / ratio);
    this.hasSignature = false;
    this.updateButtonState();
    console.log("Canvas cleared");
  }
  
  save() {
    console.log("Save button clicked");
    if (!this.ctx || !this.hasSignature) return;
    
    try {
      const dataUrl = this.canvasTarget.toDataURL("image/png");
      console.log("Generated data URL length:", dataUrl.length);
      
      // Dispatch event to the field-signing controller with the correct property name
      // Note: The field-signing controller expects 'signatureData' property
      this.dispatch('save', { detail: { signatureData: dataUrl } });
      console.log("Signature saved and dispatched");
      
      // Also try direct event for backup
      document.dispatchEvent(
        new CustomEvent('signature-pad:save', { 
          detail: { signatureData: dataUrl },
          bubbles: true 
        })
      );
    } catch (error) {
      console.error("Error saving signature:", error);
      alert("There was an error saving your signature. Please try again.");
    }
  }
  
  updateButtonState() {
    if (this.hasSaveButtonTarget) {
      this.saveButtonTarget.disabled = !this.hasSignature;
      if (!this.hasSignature) {
        this.saveButtonTarget.classList.add('opacity-50', 'cursor-not-allowed');
        this.saveButtonTarget.classList.remove('hover:bg-blue-700');
      } else {
        this.saveButtonTarget.classList.remove('opacity-50', 'cursor-not-allowed');
        this.saveButtonTarget.classList.add('hover:bg-blue-700');
      }
    }
  }
  
  isEmpty() {
    return !this.hasSignature;
  }
}
