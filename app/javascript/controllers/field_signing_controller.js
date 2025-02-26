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
    this.initialize()
  }
  
  initialize() {
    // Check if all signatures are complete
    this.checkCompletionStatus()
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
  
  saveFieldValue(fieldId, value) {
    // Parse out the database ID from the field ID
    const dbId = fieldId.replace('field-', '')
    
    fetch(`/sign/${this.documentIdValue}/form_fields/${dbId}/complete`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': document.querySelector('meta[name="csrf-token"]').content
      },
      body: JSON.stringify({ value, token: this.tokenValue })
    })
    .catch(error => console.error('Error saving field value:', error))
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
    fetch(`/sign/${this.documentIdValue}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': document.querySelector('meta[name="csrf-token"]').content
      },
      body: JSON.stringify({ token: this.tokenValue })
    })
    .then(response => response.json())
    .then(data => {
      if (data.success) {
        // Show success and redirect
        if (data.redirect_url) {
          window.location.href = data.redirect_url;
        } else if (this.hasCompleteRedirectUrlValue) {
          window.location.href = this.completeRedirectUrlValue;
        }
      } else {
        console.error('Error completing document:', data.error);
        alert(data.error || 'An error occurred while completing the document.');
      }
    })
    .catch(error => {
      console.error('Error completing document:', error);
      alert('An error occurred while completing the document.');
    });
  }
} 