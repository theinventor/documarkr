import { Controller } from "@hotwired/stimulus"
import SignaturePad from 'signature_pad'

// Connects to data-controller="signature-pad"
export default class extends Controller {
  static targets = ["canvas", "clearButton", "saveButton", "preview"]
  static values = {
    color: { type: String, default: "#000000" },
    lineWidth: { type: Number, default: 2.5 },
    savedImageData: String
  }

  connect() {
    console.log("Signature pad controller connected");
    this.initializeSignaturePad();
    this.updateButtonState();
  }
  
  disconnect() {
    if (this.signaturePad) {
      this.signaturePad.off();
    }
  }
  
  initializeSignaturePad() {
    console.log("Initializing signature pad");
    
    const canvas = this.canvasTarget;
    
    // Set canvas to higher resolution for better quality signatures
    const ratio = Math.max(window.devicePixelRatio || 1, 2);
    canvas.width = canvas.offsetWidth * ratio;
    canvas.height = canvas.offsetHeight * ratio;
    
    // Adjust canvas context scale to maintain proper drawing
    const context = canvas.getContext("2d");
    context.scale(ratio, ratio);
    
    // Create the signature pad with improved options
    this.signaturePad = new SignaturePad(canvas, {
      backgroundColor: 'rgb(255, 255, 255)',
      penColor: this.colorValue || 'rgb(0, 0, 0)',
      velocityFilterWeight: 0.7,
      minWidth: 0.5,
      maxWidth: this.lineWidthValue || 2.5,
      throttle: 16, // Increase responsiveness
    });
    
    // Enable button when drawing begins
    this.signaturePad.addEventListener("beginStroke", () => {
      this.updateButtonState();
    });
    
    this.signaturePad.addEventListener("endStroke", () => {
      this.updateButtonState();
    });
    
    // Ensure proper size of canvas
    this.resizeCanvas();
    
    // Add window resize listener for responsive behavior
    window.addEventListener("resize", this.resizeCanvas.bind(this));
  }
  
  resizeCanvas() {
    const canvas = this.canvasTarget;
    const ratio = Math.max(window.devicePixelRatio || 1, 2);
    const parentWidth = canvas.parentElement.offsetWidth;
    
    // Save the current signature data if it exists
    let data = null;
    if (this.signaturePad && !this.signaturePad.isEmpty()) {
      data = this.signaturePad.toDataURL();
    }
    
    // Resize the canvas
    canvas.width = parentWidth * ratio;
    canvas.height = canvas.offsetHeight * ratio;
    
    // Adjust context scale
    const context = canvas.getContext("2d");
    context.scale(ratio, ratio);
    
    // Clear and redraw if we had previous signature data
    if (data) {
      this.signaturePad.clear();
      
      // Load image to redraw
      const image = new Image();
      image.onload = () => {
        context.drawImage(image, 0, 0, canvas.width / ratio, canvas.height / ratio);
      };
      image.src = data;
    }
  }
  
  clear() {
    if (this.signaturePad) {
      this.signaturePad.clear();
      this.updateButtonState();
    }
  }
  
  save() {
    if (!this.signaturePad || this.signaturePad.isEmpty()) {
      console.warn("Signature pad is empty!");
      return;
    }
    
    // Get signature as data URL with higher quality
    const signatureData = this.signaturePad.toDataURL('image/png');
    
    // Dispatch a custom event with the signature data
    const event = new CustomEvent('signature-pad:save', {
      detail: { signatureData },
      bubbles: true,
      cancelable: true
    });
    
    this.element.dispatchEvent(event);
    
    // Clear the pad after saving
    this.signaturePad.clear();
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
  
  loadSavedSignature() {
    // Draw saved signature onto canvas
    const img = new Image()
    img.onload = () => {
      this.clear()
      this.ctx.drawImage(img, 0, 0, this.canvas.width, this.canvas.height)
      this.updateButtonState()
      
      // Update preview if it exists
      if (this.hasPreviewTarget) {
        this.previewTarget.src = this.savedImageDataValue
        this.previewTarget.classList.remove("hidden")
      }
    }
    img.src = this.savedImageDataValue
  }
} 