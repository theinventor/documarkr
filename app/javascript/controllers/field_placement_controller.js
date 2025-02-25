import { Controller } from "@hotwired/stimulus"
import { getFieldDimensions } from "utils/field_utils"

// Connects to data-controller="field-placement"
export default class extends Controller {
  static targets = ["container", "toolbarButton", "fieldsList", "signerSelect"]
  static values = { 
    documentId: String,
    signerId: { type: String, default: "" },
    mode: { type: String, default: "view" }
  }

  connect() {
    console.log("Field Placement Controller connected")
    this.selectedFieldType = null
    this.fields = []
    this.currentPage = 1
    
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
      
      // Debug the state of the buttons
      this.debugButtonState()
      
      // If a signer is already selected, enable the buttons
      if (this.hasSignerSelectTarget && this.signerSelectTarget.value) {
        console.log(`Signer already selected: ${this.signerSelectTarget.value}`)
        this.signerIdValue = this.signerSelectTarget.value
        this.enableToolbarButtons()
      }
    }, 500) // Reduced from 1000ms to 500ms
    
    // Load existing fields for current page
    this.loadFieldsForCurrentPage()
  }
  
  // New method to check if targets are properly connected
  checkTargets() {
    console.log("Checking controller targets:")
    console.log(`- Container target: ${this.hasContainerTarget ? 'Found' : 'Not found'}`)
    console.log(`- Toolbar button targets: ${this.hasToolbarButtonTargets ? 'Found' : 'Not found'}`)
    console.log(`- Signer select target: ${this.hasSignerSelectTarget ? 'Found' : 'Not found'}`)
    
    // If we don't have toolbar button targets, try to find them manually
    if (!this.hasToolbarButtonTargets) {
      console.log("Attempting to find toolbar buttons with querySelector")
      this.manuallyFoundButtons = Array.from(document.querySelectorAll('[data-field-type]'))
      console.log(`Found ${this.manuallyFoundButtons.length} buttons via querySelector`)
    }
    
    this.debugButtonState()
  }

  setupEventListeners() {
    if (this.hasContainerTarget) {
      // Mouse events for field placement
      this.containerTarget.addEventListener("mousedown", this.handleMouseDown.bind(this))
      window.addEventListener("mousemove", this.handleMouseMove.bind(this))
      window.addEventListener("mouseup", this.handleMouseUp.bind(this))
      
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
      this.containerTarget.removeEventListener("mousedown", this.handleMouseDown.bind(this))
      window.removeEventListener("mousemove", this.handleMouseMove.bind(this))
      window.removeEventListener("mouseup", this.handleMouseUp.bind(this))
      document.removeEventListener("keydown", this.handleKeyDown.bind(this))
      window.removeEventListener("resize", this.handleWindowResize.bind(this))
    }
  }
  
  signerSelectChanged(event) {
    const signerId = event.target.value
    this.signerIdValue = signerId
    console.log(`Selected signer ID: ${signerId}`)
    
    // Enhanced debugging - log the button targets
    console.log(`Toolbar button targets found: ${this.hasToolbarButtonTargets}`)
    if (this.hasToolbarButtonTargets) {
      console.log(`Number of toolbar buttons: ${this.toolbarButtonTargets.length}`)
      // Log each button
      this.toolbarButtonTargets.forEach((button, index) => {
        console.log(`Button ${index}: ${button.innerText}, fieldType: ${button.dataset.fieldType}, disabled: ${button.hasAttribute('disabled')}`)
      })
    }
    
    // Enable/disable field placement buttons based on whether a signer is selected
    if (signerId) {
      console.log("Signer selected, enabling buttons")
      this.enableToolbarButtons()
      
      // Double-check button state after a short delay
      setTimeout(() => this.debugButtonState(), 200)
    } else {
      console.log("No signer selected, disabling buttons")
      this.disableToolbarButtons()
    }
    
    // Send debug info to server to verify signer selection
    this.debugSignerSelection(signerId)
  }

  // New helper methods to centralize button enabling/disabling
  enableToolbarButtons() {
    console.log("Enabling toolbar buttons")
    
    const buttons = this.hasToolbarButtonTargets ? this.toolbarButtonTargets : this.manuallyFoundButtons || []
    
    if (buttons.length === 0) {
      console.log("No toolbar button targets found to enable")
      console.log("Attempting to find toolbar buttons with alternate selectors")
      const altButtons = Array.from(document.querySelectorAll('button[data-field-type]')) 
      if (altButtons.length > 0) {
        console.log(`Found ${altButtons.length} buttons with alternate selector`)
        this.manuallyFoundButtons = altButtons
        altButtons.forEach(this.enableButton.bind(this))
      } else {
        console.error("Still couldn't find any toolbar buttons")
      }
      return
    }
    
    console.log(`Enabling ${buttons.length} toolbar buttons`)
    buttons.forEach(this.enableButton.bind(this))
  }
  
  enableButton(button) {
    // Log the button's current state
    console.log(`Enabling button: ${button.innerText.trim()}`)
    console.log(`- Initial disabled state: ${button.disabled}`)
    console.log(`- Has disabled attribute: ${button.hasAttribute('disabled')}`)
    
    // Remove disabled attributes in all possible ways
    button.disabled = false
    button.removeAttribute('disabled')
    
    // Update styles to reinforce the enabled state
    button.classList.remove('opacity-50', 'cursor-not-allowed')
    button.classList.add('cursor-pointer')
    
    // Force a DOM reflow to ensure the browser recognizes the changes
    button.style.display = 'inline-flex'
    void button.offsetHeight // Force reflow
    
    // Add pointer-events CSS to make sure it's clickable
    button.style.pointerEvents = 'auto'
    
    // Log button's final state after changes
    console.log(`- Final disabled state: ${button.disabled}`)
    console.log(`- Still has disabled attribute: ${button.hasAttribute('disabled')}`)
    
    // Debug check after a short delay to verify changes persisted
    setTimeout(() => {
      console.log(`Delayed check for ${button.innerText.trim()}: disabled=${button.disabled}`)
    }, 100)
  }
  
  disableToolbarButtons() {
    console.log("Disabling toolbar buttons")
    
    const buttons = this.hasToolbarButtonTargets ? this.toolbarButtonTargets : this.manuallyFoundButtons || []
    
    if (buttons.length === 0) {
      console.log("No toolbar button targets found to disable")
      return
    }
    
    buttons.forEach(button => {
      button.disabled = true
      button.setAttribute('disabled', '')
      button.classList.add('opacity-50', 'cursor-not-allowed')
      button.classList.remove('cursor-pointer')
      button.style.pointerEvents = 'none'
    })
  }

  // Add a new debug method to track button state
  debugButtonState() {
    if (this.hasToolbarButtonTargets) {
      console.log(`Found ${this.toolbarButtonTargets.length} toolbar buttons:`)
      this.toolbarButtonTargets.forEach((button, index) => {
        console.log(`Button ${index}: ${button.innerText}, disabled=${button.disabled}, has disabled attribute=${button.hasAttribute('disabled')}`)
      })
    } else {
      console.warn("No toolbar buttons found during debug")
    }
  }

  // Add a debug method to verify signer selection
  debugSignerSelection(signerId) {
    // Send a request to debug endpoint
    fetch(`/documents/${this.documentIdValue}/form_fields/debug_click`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': document.querySelector('meta[name="csrf-token"]').content
      },
      body: JSON.stringify({ 
        action: 'signer_select', 
        signer_id: signerId,
        controller: 'field_placement',
        timestamp: new Date().toISOString()
      })
    })
    .then(response => response.json())
    .then(data => {
      console.log("Debug response:", data)
    })
    .catch(error => {
      console.error("Error sending debug info:", error)
    })
  }

  selectFieldType(event) {
    if (!event || !event.currentTarget) {
      console.error("Invalid event or missing currentTarget in selectFieldType")
      return
    }
    
    // Stop propagation to prevent event bubbling issues
    event.stopPropagation()
    
    console.log("Field type button clicked:", event.currentTarget)
    
    // Make sure we have a valid button element
    const button = event.currentTarget
    if (!button) {
      console.error("Button element not found in event")
      return
    }
    
    // Set the selected field type
    this.selectedFieldType = button.dataset.fieldType
    console.log(`Field type selected: ${this.selectedFieldType}`)
    
    // Visually highlight the selected button
    const buttons = this.hasToolbarButtonTargets ? this.toolbarButtonTargets : this.manuallyFoundButtons || []
    buttons.forEach(btn => {
      if (btn === button) {
        btn.classList.add('ring-2', 'ring-indigo-500', 'bg-indigo-50')
      } else {
        btn.classList.remove('ring-2', 'ring-indigo-500', 'bg-indigo-50')
      }
    })
    
    // Update cursor style on container
    if (this.hasContainerTarget) {
      this.containerTarget.style.cursor = "crosshair"
    }
  }

  cancelFieldSelection() {
    this.selectedFieldType = null
    console.log("Field selection canceled")
    
    // Remove highlighting from buttons
    const buttons = this.hasToolbarButtonTargets ? this.toolbarButtonTargets : this.manuallyFoundButtons || []
    buttons.forEach(button => {
      button.classList.remove('ring-2', 'ring-indigo-500', 'bg-indigo-50')
    })
    
    // Reset cursor
    if (this.hasContainerTarget) {
      this.containerTarget.style.cursor = "default"
    }
    
    // If there's an active field element, remove it
    if (this.activeFieldElement) {
      this.activeFieldElement.remove()
      this.activeFieldElement = null
    }
  }

  handleMouseDown(event) {
    console.log("handleMouseDown triggered");
    
    // Check if we're clicking on a resize handle
    if (event.target.classList.contains('resize-handle')) {
      this.handleResizeStart(event);
      return;
    }
    
    // Only proceed if we have selected a field type and signer
    if (!this.selectedFieldType || !this.signerIdValue) {
      console.log("Field placement prevented: No field type or signer selected")
      return
    }
    
    // Get container bounding rect
    this.containerRect = this.containerTarget.getBoundingClientRect()
    console.log("Container dimensions:", this.containerRect)
    
    // Calculate position relative to the container
    const canvasX = event.clientX - this.containerRect.left
    const canvasY = event.clientY - this.containerRect.top
    console.log(`Mouse position relative to container: ${canvasX}, ${canvasY}`)
    
    // Save the starting position
    this.startX = event.clientX
    this.startY = event.clientY
    
    // Create a new field element
    const fieldElement = document.createElement("div")
    fieldElement.classList.add("signature-field", `field-${this.selectedFieldType}`)
    fieldElement.style.position = "absolute"
    
    // Set position using percentage values instead of pixels
    const xPercent = (canvasX / this.containerRect.width) * 100
    const yPercent = (canvasY / this.containerRect.height) * 100
    fieldElement.style.left = `${xPercent}%`
    fieldElement.style.top = `${yPercent}%`
    fieldElement.style.width = "100px"
    fieldElement.style.height = "50px"
    
    // Create field label with icon
    const labelElement = document.createElement("div")
    labelElement.classList.add("field-label")
    
    // Add icon based on field type
    let iconSvg = ""
    let labelText = ""
    
    switch (this.selectedFieldType) {
      case "signature":
        iconSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M6 8a.5.5 0 0 0 .5.5h1.5a.5.5 0 0 0 0-1H6.5A.5.5 0 0 0 6 8zm2.5 1a.5.5 0 0 0 0 1h1.5a.5.5 0 0 0 0-1h-1.5zm1.5-3a.5.5 0 0 0 0-1h-1.5a.5.5 0 0 0 0 1H10zM8 7a.5.5 0 0 0-.5-.5H6a.5.5 0 0 0 0 1h1.5A.5.5 0 0 0 8 7zm0-3a.5.5 0 0 0-.5-.5h-1a.5.5 0 0 0 0 1h1a.5.5 0 0 0 .5-.5zM2 2a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V2zm10-1H4a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V2a1 1 0 0 0-1-1z"/></svg>'
        labelText = "Signature"
        break
      case "initials":
        iconSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M2 2a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v13.5a.5.5 0 0 1-.777.416L8 13.101l-5.223 2.815A.5.5 0 0 1 2 15.5V2zm2-1a1 1 0 0 0-1 1v12.566l4.723-2.482a.5.5 0 0 1 .554 0L13 14.566V2a1 1 0 0 0-1-1H4z"/></svg>'
        labelText = "Initials"
        break
      case "text":
        iconSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M14.5 3a.5.5 0 0 1 .5.5v9a.5.5 0 0 1-.5.5h-13a.5.5 0 0 1-.5-.5v-9a.5.5 0 0 1 .5-.5h13zm-13-1A1.5 1.5 0 0 0 0 3.5v9A1.5 1.5 0 0 0 1.5 14h13a1.5 1.5 0 0 0 1.5-1.5v-9A1.5 1.5 0 0 0 14.5 2h-13z"/><path d="M3 5.5a.5.5 0 0 1 .5-.5h9a.5.5 0 0 1 0 1h-9a.5.5 0 0 1-.5-.5zM3 8a.5.5 0 0 1 .5-.5h9a.5.5 0 0 1 0 1h-9A.5.5 0 0 1 3 8zm0 2.5a.5.5 0 0 1 .5-.5h6a.5.5 0 0 1 0 1h-6a.5.5 0 0 1-.5-.5z"/></svg>'
        labelText = "Text"
        break
      case "date":
        iconSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M3.5 0a.5.5 0 0 1 .5.5V1h8V.5a.5.5 0 0 1 1 0V1h1a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V3a2 2 0 0 1 2-2h1V.5a.5.5 0 0 1 .5-.5zM1 4v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V4H1z"/></svg>'
        labelText = "Date"
        break
      case "checkbox":
        iconSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M14 1a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1h12zM2 0a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V2a2 2 0 0 0-2-2H2z"/><path d="M10.97 4.97a.75.75 0 0 1 1.071 1.05l-3.992 4.99a.75.75 0 0 1-1.08.02L4.324 8.384a.75.75 0 1 1 1.06-1.06l2.094 2.093 3.473-4.425a.235.235 0 0 1 .02-.022z"/></svg>'
        labelText = "Checkbox"
        break
    }
    
    labelElement.innerHTML = iconSvg + ' ' + labelText
    fieldElement.appendChild(labelElement)
    
    // Add resize handles to the field
    this.addResizeHandles(fieldElement)
    
    // Add the field to the container
    this.containerTarget.appendChild(fieldElement)
    
    // Store the active field element
    this.activeFieldElement = fieldElement
    
    // Prevent default behavior
    event.preventDefault()
    
    // Send debug info to the server
    this.debugMouseEvent(event, 'mouse_down')
  }

  handleMouseMove(event) {
    // Handle resize operation if active
    if (this.isResizing && this.activeFieldElement && this.resizeData) {
      this.handleResize(event);
      return;
    }

    if (!this.activeFieldElement || !this.selectedFieldType) {
      return
    }
    
    // Calculate the dimensions based on drag
    const width = Math.abs(event.clientX - this.startX)
    const height = Math.abs(event.clientY - this.startY)
    
    // Get minimum sizes based on field type
    const minDimensions = getFieldDimensions(this.selectedFieldType)
    
    // Set the width and height (with minimums)
    this.activeFieldElement.style.width = `${Math.max(width, minDimensions.width)}px`
    this.activeFieldElement.style.height = `${Math.max(height, minDimensions.height)}px`
    
    // Prevent default
    event.preventDefault()
  }

  handleMouseUp(event) {
    // Handle resize operation end if active
    if (this.isResizing && this.activeFieldElement) {
      this.handleResizeEnd(event);
      return;
    }

    if (!this.activeFieldElement || !this.selectedFieldType || !this.signerIdValue) {
      return
    }
    
    // Get final dimensions
    const width = parseFloat(this.activeFieldElement.style.width)
    const height = parseFloat(this.activeFieldElement.style.height)
    
    // Convert pixel dimensions to percentages
    let widthPercent, heightPercent;
    
    if (this.activeFieldElement.style.width.endsWith('px')) {
      widthPercent = (width / this.containerRect.width) * 100;
      heightPercent = (height / this.containerRect.height) * 100;
      
      // Update element to use percentage-based dimensions
      this.activeFieldElement.style.width = `${widthPercent}%`;
      this.activeFieldElement.style.height = `${heightPercent}%`;
    } else {
      // If already in percentages, extract the values
      widthPercent = parseFloat(this.activeFieldElement.style.width);
      heightPercent = parseFloat(this.activeFieldElement.style.height);
    }
    
    // Get position (should already be in percentages)
    let xPercent, yPercent;
    
    if (this.activeFieldElement.style.left.endsWith('px')) {
      const fieldLeft = parseFloat(this.activeFieldElement.style.left);
      const fieldTop = parseFloat(this.activeFieldElement.style.top);
      xPercent = (fieldLeft / this.containerRect.width) * 100;
      yPercent = (fieldTop / this.containerRect.height) * 100;
      
      // Update element to use percentage-based positioning
      this.activeFieldElement.style.left = `${xPercent}%`;
      this.activeFieldElement.style.top = `${yPercent}%`;
    } else {
      // If already in percentages, extract the values
      xPercent = parseFloat(this.activeFieldElement.style.left);
      yPercent = parseFloat(this.activeFieldElement.style.top);
    }
    
    // Create a unique field ID
    const fieldId = `field-${Date.now()}`
    
    // Create field data object
    const fieldData = {
      id: fieldId,
      field_type: this.selectedFieldType,
      document_id: this.documentIdValue,
      document_signer_id: this.signerIdValue,
      page_number: this.currentPage,
      x_position: xPercent,
      y_position: yPercent,
      width: widthPercent,
      height: heightPercent,
      required: true,
      element: this.activeFieldElement
    }
    
    // Update the element's ID
    this.activeFieldElement.id = fieldId
    
    // Add the field to our list of fields
    this.fields.push(fieldData)
    
    // Add the field to the fields list in the UI
    this.addFieldToList(fieldId, fieldData)
    
    // Save the field to the server
    this.saveField(fieldData, fieldId)
    
    // Reset active element
    this.activeFieldElement = null
    
    // Reset selection
    this.cancelFieldSelection()
    
    // Prevent default
    event.preventDefault()
  }

  handleKeyDown(event) {
    // ESC key cancels field placement
    if (event.key === "Escape" && this.selectedFieldType) {
      // If an active field element exists, remove it
      if (this.activeFieldElement) {
        this.containerTarget.removeChild(this.activeFieldElement)
        this.activeFieldElement = null
      }
      
      this.cancelFieldSelection()
    }
  }

  addFieldToList(fieldId, fieldData) {
    if (!this.hasFieldsListTarget) {
      console.warn("No fields list target found")
      return
    }
    
    // Create a list item for the field
    const listItem = document.createElement("li")
    listItem.classList.add("py-2", "px-3", "border-b", "border-gray-200", "flex", "justify-between", "items-center")
    listItem.dataset.fieldId = fieldId
    
    // Create text content with field type and page number
    const textContent = document.createElement("div")
    textContent.classList.add("text-sm")
    
    // Get field type display name
    let fieldTypeDisplay = ""
    switch (fieldData.field_type) {
      case "signature": fieldTypeDisplay = "Signature"; break
      case "initials": fieldTypeDisplay = "Initials"; break
      case "text": fieldTypeDisplay = "Text"; break
      case "date": fieldTypeDisplay = "Date"; break
      case "checkbox": fieldTypeDisplay = "Checkbox"; break
    }
    
    textContent.innerHTML = `
      <span class="font-medium">${fieldTypeDisplay}</span>
      <span class="text-gray-500 ml-2">Page ${fieldData.page_number}</span>
    `
    
    // Create delete button
    const deleteButton = document.createElement("button")
    deleteButton.classList.add("text-red-600", "hover:text-red-800")
    deleteButton.dataset.action = "field-placement#deleteField"
    deleteButton.dataset.fieldId = fieldId
    deleteButton.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
      </svg>
    `
    
    // Add the elements to the list item
    listItem.appendChild(textContent)
    listItem.appendChild(deleteButton)
    
    // Add the list item to the fields list
    this.fieldsListTarget.appendChild(listItem)
  }

  deleteField(event) {
    const fieldId = event.currentTarget.dataset.fieldId
    console.log(`Deleting field: ${fieldId}`)
    
    // Find the field in our array
    const fieldIndex = this.fields.findIndex(field => field.id === fieldId)
    
    if (fieldIndex !== -1) {
      const field = this.fields[fieldIndex]
      
      // Remove the field element from the DOM
      if (field.element && field.element.parentNode) {
        field.element.parentNode.removeChild(field.element)
      }
      
      // If the field has a server ID, delete it from the server
      if (field.serverId) {
        this.deleteFieldFromServer(field.serverId)
      }
      
      // Remove the field from our array
      this.fields.splice(fieldIndex, 1)
    }
    
    // Remove the list item from the DOM
    const listItem = this.fieldsListTarget.querySelector(`[data-field-id="${fieldId}"]`)
    if (listItem) {
      listItem.parentNode.removeChild(listItem)
    }
  }

  loadFieldsForCurrentPage() {
    console.log(`Loading fields for page ${this.currentPage}`)
    
    // Clear previous fields
    this.fields = this.fields.filter(field => {
      // Keep fields on other pages in the array
      if (field.page_number !== this.currentPage) {
        return true
      }
      
      // Remove fields on this page from the DOM
      if (field.element && field.element.parentNode) {
        field.element.parentNode.removeChild(field.element)
      }
      
      return false
    })
    
    // Clear fields list UI
    if (this.hasFieldsListTarget) {
      this.fieldsListTarget.innerHTML = ""
    }
    
    // Fetch fields for this page from the server
    fetch(`/documents/${this.documentIdValue}/form_fields?page_number=${this.currentPage}`)
      .then(response => response.json())
      .then(data => {
        console.log("Fields loaded:", data)
        
        // Add each field to the PDF
        if (Array.isArray(data)) {
          data.forEach(fieldData => {
            this.addFieldFromServer(fieldData)
          })
        }
      })
      .catch(error => {
        console.error("Error loading fields:", error)
      })
  }

  addFieldFromServer(fieldData) {
    console.log("Adding field from server:", fieldData)
    
    // Create a field element
    const fieldElement = document.createElement('div')
    fieldElement.className = `signature-field field-${fieldData.field_type}`
    fieldElement.dataset.fieldId = fieldData.id
    
    // Calculate position in percentages
    const xPercent = fieldData.x_position
    const yPercent = fieldData.y_position
    const widthPercent = fieldData.width
    const heightPercent = fieldData.height
    
    // Set position and size using percentage values
    fieldElement.style.left = `${xPercent}%`
    fieldElement.style.top = `${yPercent}%`
    fieldElement.style.width = `${widthPercent}%`
    fieldElement.style.height = `${heightPercent}%`
    
    // Create a field label element
    const labelElement = document.createElement('div')
    labelElement.className = 'field-label'
    
    // Add appropriate icon for the field type
    let fieldIcon = ''
    switch (fieldData.field_type) {
      case 'signature':
        fieldIcon = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="signature-icon"><path d="M15 3h6v6M14 10l7-7m-7 17H4a2 2 0 01-2-2V5"/></svg>'
        break
      case 'initials':
        fieldIcon = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="initials-icon"><path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>'
        break
      case 'text':
        fieldIcon = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="text-icon"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>'
        break
      case 'date':
        fieldIcon = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="date-icon"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>'
        break
      default:
        fieldIcon = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect></svg>'
    }
    
    labelElement.innerHTML = fieldIcon
    fieldElement.appendChild(labelElement)
    
    // Add trash icon for deleting the field
    const deleteButton = document.createElement('div')
    deleteButton.className = 'field-delete-button'
    deleteButton.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="trash-icon"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>'
    deleteButton.dataset.action = 'click->field-placement#deleteFieldFromPdf'
    deleteButton.dataset.fieldId = fieldData.id
    fieldElement.appendChild(deleteButton)
    
    // Add resize handles
    this.addResizeHandles(fieldElement)
    
    // Add the field element to the container
    this.containerTarget.appendChild(fieldElement)
    
    // Add to fields array
    const fieldObj = {
      id: `field-${Date.now()}`,
      serverId: fieldData.id,
      type: fieldData.field_type,
      element: fieldElement,
      x: xPercent,
      y: yPercent,
      width: widthPercent,
      height: heightPercent,
      pageNumber: fieldData.page_number,
      signerId: fieldData.document_signer_id
    }
    
    this.fields.push(fieldObj)
    
    // Add field to the list
    this.addFieldToList(fieldObj.id, fieldData)
    
    return fieldObj
  }

  saveField(fieldData, fieldId) {
    console.log(`Saving field ${fieldId} with data:`, fieldData)
    
    // Create a FormData object to send to the server
    const formData = new FormData()
    
    // Append the field data to the FormData
    Object.keys(fieldData).forEach(key => {
      if (key !== "element" && key !== "id") {  // Skip the DOM element and client-side ID
        formData.append(`form_field[${key}]`, fieldData[key])
      }
    })
    
    // Send the field data to the server
    this.sendFieldToServer(formData, fieldId)
  }
  
  sendFieldToServer(formData, fieldId) {
    // Send the field data to the server
    fetch(`/documents/${this.documentIdValue}/form_fields`, {
      method: "POST",
      body: formData,
      headers: {
        "X-CSRF-Token": document.querySelector("meta[name='csrf-token']").content
      }
    })
    .then(response => response.json())
    .then(data => {
      console.log("Field saved successfully:", data)
      
      // If the field was saved successfully, update the field ID in our local array
      if (data.id) {
        const index = this.fields.findIndex(field => field.id === fieldId)
        if (index !== -1) {
          this.fields[index].serverId = data.id
          
          // Update the ID in the DOM
          const fieldElement = document.getElementById(fieldId)
          if (fieldElement) {
            fieldElement.id = `db-${data.id}`
          }
          
          // Update the ID in the fields list
          const listItem = this.fieldsListTarget.querySelector(`[data-field-id="${fieldId}"]`)
          if (listItem) {
            listItem.dataset.fieldId = `db-${data.id}`
            listItem.querySelector('button').dataset.fieldId = `db-${data.id}`
          }
        }
      }
    })
    .catch(error => {
      console.error("Error saving field:", error)
    })
  }

  deleteFieldFromServer(fieldId) {
    // Send the delete request to the server
    fetch(`/documents/${this.documentIdValue}/form_fields/${fieldId}`, {
      method: "DELETE",
      headers: {
        "X-CSRF-Token": document.querySelector("meta[name='csrf-token']").content,
        "Content-Type": "application/json"
      }
    })
    .then(response => {
      if (response.ok) {
        console.log(`Field ${fieldId} deleted from server`)
      } else {
        throw new Error(`Server returned ${response.status}`)
      }
    })
    .catch(error => {
      console.error("Error deleting field:", error)
    })
  }

  saveAllFields() {
    console.log("Saving all fields")
    
    // Get all fields that don't have a server ID
    const unsavedFields = this.fields.filter(field => !field.serverId)
    
    // Save each field
    unsavedFields.forEach(field => {
      this.saveField(field, field.id)
    })
  }

  // Enhanced debug method for mouse events
  debugMouseEvent(event, eventType) {
    // Send a request to debug endpoint
    fetch(`/documents/${this.documentIdValue}/form_fields/debug_click`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': document.querySelector('meta[name="csrf-token"]').content
      },
      body: JSON.stringify({ 
        action: eventType, 
        field_type: this.selectedFieldType,
        signer_id: this.signerIdValue,
        page: this.currentPage,
        position: { 
          x: event.clientX,
          y: event.clientY
        },
        controller: 'field_placement',
        timestamp: new Date().toISOString()
      })
    })
    .then(response => response.json())
    .then(data => {
      console.log(`Debug response for ${eventType}:`, data)
    })
    .catch(error => {
      console.error(`Error sending debug info for ${eventType}:`, error)
    })
  }

  // Add new methods for resize functionality
  addResizeHandles(fieldElement) {
    // Create the resize container
    const resizersContainer = document.createElement("div");
    resizersContainer.classList.add("resizers");
    
    // Create the 8 resize handles
    const positions = ['top-left', 'top-middle', 'top-right', 
                       'middle-right', 'bottom-right', 'bottom-middle', 
                       'bottom-left', 'middle-left'];
    
    positions.forEach(position => {
      const handle = document.createElement("div");
      handle.classList.add("resize-handle", position);
      handle.dataset.position = position;
      resizersContainer.appendChild(handle);
    });
    
    // Add the handles to the field
    fieldElement.appendChild(resizersContainer);
  }

  handleResizeStart(event) {
    this.isResizing = true;
    
    // Find the field element (parent of the resize handle)
    let fieldElement = event.target.closest('.signature-field');
    this.activeFieldElement = fieldElement;
    
    // Store the handle position
    const handlePosition = event.target.dataset.position;
    
    // Store initial field size and position
    const fieldRect = fieldElement.getBoundingClientRect();
    const containerRect = this.containerTarget.getBoundingClientRect();
    
    this.resizeData = {
      startX: event.clientX,
      startY: event.clientY,
      startWidth: fieldRect.width,
      startHeight: fieldRect.height,
      startLeft: fieldRect.left - containerRect.left,
      startTop: fieldRect.top - containerRect.top,
      containerWidth: containerRect.width,
      containerHeight: containerRect.height,
      handlePosition: handlePosition
    };
    
    event.preventDefault();
  }

  handleResize(event) {
    if (!this.activeFieldElement || !this.resizeData) return;
    
    const rd = this.resizeData;
    const dx = event.clientX - rd.startX;
    const dy = event.clientY - rd.startY;
    
    let newWidth = rd.startWidth;
    let newHeight = rd.startHeight;
    let newLeft = rd.startLeft;
    let newTop = rd.startTop;
    
    // Calculate new dimensions based on the handle being dragged
    if (rd.handlePosition.includes('right')) {
      newWidth = Math.max(rd.startWidth + dx, 30); // Minimum width of 30px
    }
    if (rd.handlePosition.includes('bottom')) {
      newHeight = Math.max(rd.startHeight + dy, 30); // Minimum height of 30px
    }
    if (rd.handlePosition.includes('left')) {
      const newRight = rd.startLeft + rd.startWidth;
      newLeft = Math.min(rd.startLeft + dx, newRight - 30);
      newWidth = newRight - newLeft;
    }
    if (rd.handlePosition.includes('top')) {
      const newBottom = rd.startTop + rd.startHeight;
      newTop = Math.min(rd.startTop + dy, newBottom - 30);
      newHeight = newBottom - newTop;
    }
    
    // Convert to percentages
    const leftPercent = (newLeft / rd.containerWidth) * 100;
    const topPercent = (newTop / rd.containerHeight) * 100;
    const widthPercent = (newWidth / rd.containerWidth) * 100;
    const heightPercent = (newHeight / rd.containerHeight) * 100;
    
    // Update field position and size with percentage values
    this.activeFieldElement.style.left = `${leftPercent}%`;
    this.activeFieldElement.style.top = `${topPercent}%`;
    this.activeFieldElement.style.width = `${widthPercent}%`;
    this.activeFieldElement.style.height = `${heightPercent}%`;
    
    event.preventDefault();
  }

  handleResizeEnd(event) {
    if (!this.activeFieldElement) return;
    
    // Find the field in our fields array
    const fieldId = this.activeFieldElement.id;
    const fieldIndex = this.fields.findIndex(field => field.id === fieldId);
    
    if (fieldIndex !== -1) {
      const field = this.fields[fieldIndex];
      
      // Update field position and dimensions
      field.x_position = parseFloat(this.activeFieldElement.style.left);
      field.y_position = parseFloat(this.activeFieldElement.style.top);
      field.width = parseFloat(this.activeFieldElement.style.width);
      field.height = parseFloat(this.activeFieldElement.style.height);
      
      // Save changes to server
      if (field.serverId) {
        this.updateFieldOnServer(field);
      }
    }
    
    // Clear resize data
    this.isResizing = false;
    this.resizeData = null;
    
    event.preventDefault();
  }

  updateFieldOnServer(field) {
    // Create a FormData object to send to the server
    const formData = new FormData();
    
    // Add field data
    formData.append('form_field[x_position]', field.x_position);
    formData.append('form_field[y_position]', field.y_position);
    formData.append('form_field[width]', field.width);
    formData.append('form_field[height]', field.height);
    
    // Send update to server
    fetch(`/documents/${this.documentIdValue}/form_fields/${field.serverId}`, {
      method: "PATCH",
      body: formData,
      headers: {
        "X-CSRF-Token": document.querySelector("meta[name='csrf-token']").content
      }
    })
    .then(response => response.json())
    .then(data => {
      console.log("Field updated successfully:", data);
    })
    .catch(error => {
      console.error("Error updating field:", error);
    });
  }

  handleWindowResize() {
    // Update container rect when window is resized
    if (this.hasContainerTarget) {
      this.containerRect = this.containerTarget.getBoundingClientRect();
      console.log("Window resized. New container dimensions:", this.containerRect);
    }
  }

  // Add new method to handle deletion directly from the PDF view
  deleteFieldFromPdf(event) {
    event.preventDefault()
    event.stopPropagation()
    
    const fieldId = event.currentTarget.dataset.fieldId
    console.log(`Deleting field from PDF view: ${fieldId}`)
    
    // Find the field in our array
    const fieldIndex = this.fields.findIndex(field => field.serverId === parseInt(fieldId))
    
    if (fieldIndex !== -1) {
      const field = this.fields[fieldIndex]
      
      // Remove the field element from the DOM
      if (field.element && field.element.parentNode) {
        field.element.parentNode.removeChild(field.element)
      }
      
      // Delete it from the server
      this.deleteFieldFromServer(fieldId)
      
      // Remove the field from our array
      this.fields.splice(fieldIndex, 1)
      
      // Remove the list item from the fields list
      const listItem = this.fieldsListTarget.querySelector(`[data-field-id="${field.id}"]`)
      if (listItem) {
        listItem.parentNode.removeChild(listItem)
      }
    }
  }
}