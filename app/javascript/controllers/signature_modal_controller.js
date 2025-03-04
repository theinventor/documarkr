import { Controller } from "@hotwired/stimulus"
import { createFontPreviews, renderTextWithFont, generateSignatureImageUrl } from "../utils/font_utils.js"

export default class extends Controller {
  static targets = [
    "modal", "backdrop", "closeButton", "nameInput", 
    "fontPreviewsContainer", "previewCanvas", "previewContainer", 
    "previewPlaceholder", "signatureContainer"
  ]
  
  connect() {
    console.log("Signature modal controller connected")
    
    // Initialize the signature modal
    this.currentFieldType = null
    this.currentFieldId = null
    this.selectedFontKey = null
    
    // Make the controller accessible globally for debugging
    if (this.element) {
      this.element.__stimulusController = this
      console.log("Signature modal controller attached to element:", this.element)
    }
    
    // Initialize font previews if there's a name input with a value
    if (this.hasNameInputTarget && this.hasPreviewCanvasTarget && this.hasFontPreviewsContainerTarget) {
      const nameInput = this.nameInputTarget
      if (nameInput.value) {
        this.initializeFontPreviews(nameInput.value)
      }
    }
    
    // Add event listeners for input changes
    if (this.hasNameInputTarget) {
      this.nameInputTarget.addEventListener('input', this.handleNameInput.bind(this))
    }
  }
  
  open(fieldType, fieldId) {
    console.log("Opening signature modal", { fieldType, fieldId })
    
    // Store the current field information
    this.currentFieldType = fieldType
    this.currentFieldId = fieldId
    
    // Show the modal
    this.modalTarget.classList.remove('hidden')
    this.modalTarget.classList.add('flex')
    
    // Show the backdrop if it exists
    if (this.hasBackdropTarget) {
      this.backdropTarget.classList.remove('hidden')
    }
    
    // Show the appropriate content based on field type
    const containers = this.element.querySelectorAll('.modal-content')
    containers.forEach(container => {
      container.classList.add('hidden')
    })
    
    const targetContent = this.element.querySelector(`.modal-content[data-field-type="${fieldType}"]`)
    if (targetContent) {
      targetContent.classList.remove('hidden')
    }
    
    // Initialize font previews
    if (this.hasFontPreviewsContainerTarget) {
      const nameInput = this.hasNameInputTarget ? this.nameInputTarget.value : 'Your Signature'
      this.initializeFontPreviews(nameInput || 'Your Signature')
    }
    
    // Focus on the name input if available
    if (this.hasNameInputTarget) {
      setTimeout(() => {
        this.nameInputTarget.focus()
      }, 100)
    }
  }
  
  close() {
    console.log("Closing signature modal")
    
    // Hide the modal
    this.modalTarget.classList.add('hidden')
    this.modalTarget.classList.remove('flex')
    
    // Hide the backdrop if it exists
    if (this.hasBackdropTarget) {
      this.backdropTarget.classList.add('hidden')
    }
    
    // Reset state
    this.currentFieldType = null
    this.currentFieldId = null
    this.selectedFontKey = null
    
    // Reset preview
    if (this.hasPreviewCanvasTarget) {
      this.previewCanvasTarget.classList.add('hidden')
    }
    
    if (this.hasPreviewPlaceholderTarget) {
      this.previewPlaceholderTarget.classList.remove('hidden')
    }
  }
  
  initializeFontPreviews(text) {
    if (!this.hasFontPreviewsContainerTarget) return
    
    createFontPreviews(this.fontPreviewsContainerTarget, text, {
      onSelect: (fontKey) => {
        this.selectedFontKey = fontKey
        this.updatePreview(text, fontKey)
      }
    })
  }
  
  updatePreview(text, fontKey) {
    if (!this.hasPreviewCanvasTarget) return
    
    // Hide placeholder and show canvas
    if (this.hasPreviewPlaceholderTarget) {
      this.previewPlaceholderTarget.classList.add('hidden')
    }
    
    this.previewCanvasTarget.classList.remove('hidden')
    
    // Set canvas dimensions
    const canvas = this.previewCanvasTarget
    const container = this.previewContainerTarget
    canvas.width = container.offsetWidth
    canvas.height = container.offsetHeight
    
    // Render text with selected font
    renderTextWithFont(canvas, text, fontKey)
  }
  
  handleNameInput(event) {
    const text = event.currentTarget.value || 'Your Signature'
    
    // Update font previews with new text
    this.initializeFontPreviews(text)
    
    // Update preview if a font is selected
    if (this.selectedFontKey) {
      this.updatePreview(text, this.selectedFontKey)
    }
  }
  
  saveSignature() {
    console.log("Saving signature with controller method");
    
    if (!this.hasNameInputTarget) {
      console.error("Cannot save signature: missing name input target");
      return;
    }
    
    if (!this.selectedFontKey) {
      console.error("Cannot save signature: no font selected");
      alert("Please select a signature style before saving");
      return;
    }
    
    const name = this.nameInputTarget.value || 'Your Signature';
    const fontKey = this.selectedFontKey;
    const fieldId = this.currentFieldId;
    const fieldType = this.currentFieldType;
    
    console.log(`Saving ${fieldType} with name: ${name}, font: ${fontKey}, field: ${fieldId}`);
    
    try {
      // Generate signature image URL
      const signatureData = generateSignatureImageUrl(name, fontKey, {
        width: fieldType === 'initials' ? 100 : 400,
        height: fieldType === 'initials' ? 60 : 150
      });
      
      // Dispatch event to notify field signing controller
      const event = new CustomEvent('signature:complete', {
        detail: {
          signatureData,
          fontKey,
          fieldType,
          fieldId
        }
      });
      
      document.dispatchEvent(event);
      
      // Close the modal
      this.close();
    } catch (error) {
      console.error("Error saving signature:", error);
      alert("There was an error saving your signature. Please try again.");
    }
  }
} 