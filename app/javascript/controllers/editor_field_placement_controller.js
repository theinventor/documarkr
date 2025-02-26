import { Controller } from "@hotwired/stimulus"
import { getFieldDimensions } from "utils/field_utils"

// Connects to data-controller="editor-field-placement"
export default class EditorFieldPlacementController extends Controller {
  static targets = ["container", "toolbarButton", "fieldsList", "signerSelect"]
  static values = { 
    documentId: String,
    signerId: { type: String, default: "" },
    mode: { type: String, default: "view" }
  }

  connect() {
    console.log("%c██████████████████████████████████████████████████", "color: green; font-size: 20px;");
    console.log("%cEDITOR FIELD PLACEMENT CONTROLLER CONNECTED!!!", "color: green; font-weight: bold; font-size: 24px;");
    console.log("%c██████████████████████████████████████████████████", "color: green; font-size: 20px;");
    
    console.log("Field Placement Controller connected")
    this.selectedFieldType = null
    this.fields = []
    this.currentPage = 1
    this.lastKnownPdfScale = 1.0 // Add tracking for PDF scale
    
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
      
      // Enhance the signer dropdown with color indicators
      this.enhanceSignerDropdown()
    }, 500) // Reduced from 1000ms to 500ms
    
    // Load existing fields for current page
    this.loadFieldsForCurrentPage()

    // Listen for PDF scale changes
    this.listenForPdfScaleChanges()
    
    // Listen for PDF page changes
    this.listenForPdfPageChanges()

    // Listen for page change events from the PDF viewer
    document.addEventListener('pdf-viewer:pageChanged', this.handlePdfPageChange.bind(this));
    
    // Listen for the fields visibility check event
    document.addEventListener('pdf-viewer:fieldsCheck', this.verifyFieldsVisibility.bind(this));
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
    
    // Add signer-specific class for color coding
    if (this.signerIdValue) {
      // Get the signer index from the signerSelect dropdown
      const signerIndex = this.getSignerIndexById(this.signerIdValue);
      if (signerIndex > 0) {
        // Add signer class (signer-1, signer-2, etc.)
        fieldElement.classList.add(`signer-${signerIndex}`);
      }
    }
    
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
    // Only process mouse up if we're in placement mode
    if (!this.isPlacingField || !this.hasContainerTarget) return;
    
    // Handle field placement finalization here
    this.isPlacingField = false;
    
    // Convert selection area to field placement data
    if (this.selectionStartX !== null && this.selectionStartY !== null) {
      // Get current container dimensions
      const containerRect = this.containerTarget.getBoundingClientRect();
      
      // Adjust selection to be contained within the container
      let selectionX = Math.max(0, Math.min(this.selectionEndX, containerRect.width));
      let selectionY = Math.max(0, Math.min(this.selectionEndY, containerRect.height));
      
      // Calculate dimensions
      const width = Math.abs(selectionX - this.selectionStartX);
      const height = Math.abs(selectionY - this.selectionStartY);
      
      // Normalize selection coordinates (top-left is always the start point)
      const startX = Math.min(this.selectionStartX, selectionX);
      const startY = Math.min(this.selectionStartY, selectionY);
      
      // Check if the selected area is too small - reject if smaller than minimum dimensions
      // This prevents accidental tiny fields from being created
      const MIN_WIDTH = 50;  // Minimum width in pixels
      const MIN_HEIGHT = 30; // Minimum height in pixels
      
      if (width < MIN_WIDTH || height < MIN_HEIGHT) {
        console.log("Selection area too small, ignoring field placement");
        this.removeSelectionBox();
        this.resetSelectionState();
        return;
      }
      
      // Convert pixel positions to percentages for storage
      const xPercent = (startX / containerRect.width) * 100;
      const yPercent = (startY / containerRect.height) * 100;
      const widthPercent = (width / containerRect.width) * 100;
      const heightPercent = (height / containerRect.height) * 100;
      
      // Create field object with field data
      const fieldData = {
        field_type: this.selectedFieldType,
        document_id: this.documentIdValue,
        document_signer_id: this.signerIdValue,
        page_number: this.currentPage,
        x_position: xPercent,
        y_position: yPercent,
        width: widthPercent,
        height: heightPercent,
        required: false
      };
      
      // Add the field
      this.saveField(fieldData);
      
      // Add field to the local fields array for tracking
      // Note: No element reference yet since it will be created by the server response
      const field = {
        field_type: this.selectedFieldType,
        document_id: this.documentIdValue,
        document_signer_id: this.signerIdValue,
        page_number: this.currentPage,
        x_position: xPercent,
        y_position: yPercent,
        width: widthPercent,
        height: heightPercent,
        required: false,
        element: null // Will be populated when server responds
      };
      
      // Remove the temporary selection box
      this.removeSelectionBox();
    }
    
    // Reset state for next selection
    this.resetSelectionState();
    
    // Restore the default cursor
    if (this.hasContainerTarget) {
      this.containerTarget.style.cursor = 'default';
    }
    
    // If we're in auto-reset mode, reset field selection after placement
    if (this.autoResetAfterPlacement) {
      this.selectedFieldType = null;
      this.resetToolbarButtonsState();
    }
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
    listItem.dataset.page = fieldData.page_number // Add page attribute for filtering
    
    // Create text content with field type and page number
    const textContent = document.createElement("div")
    textContent.classList.add("text-sm", "flex", "items-center")
    
    // Get field type display name
    let fieldTypeDisplay = ""
    switch (fieldData.field_type) {
      case "signature": fieldTypeDisplay = "Signature"; break
      case "initials": fieldTypeDisplay = "Initials"; break
      case "text": fieldTypeDisplay = "Text"; break
      case "date": fieldTypeDisplay = "Date"; break
      case "checkbox": fieldTypeDisplay = "Checkbox"; break
    }
    
    // Add color indicator if we have a signer ID
    if (fieldData.document_signer_id) {
      const signerIndex = this.getSignerIndexById(fieldData.document_signer_id);
      if (signerIndex > 0) {
        const colorIndicator = document.createElement("div");
        colorIndicator.classList.add("w-3", "h-3", "rounded-full", "mr-2", `signer-color-${signerIndex}`);
        textContent.appendChild(colorIndicator);
      }
    }
    
    const textSpan = document.createElement("span");
    textSpan.innerHTML = `
      <span class="font-medium">${fieldTypeDisplay}</span>
      <span class="text-gray-500 ml-2">Page ${fieldData.page_number}</span>
    `;
    textContent.appendChild(textSpan);
    
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
    
    // Append to list item
    listItem.appendChild(textContent)
    listItem.appendChild(deleteButton)
    
    // Add to list
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
    console.log(`Loading fields for page ${this.currentPage}`);
    
    // First, hide/show fields based on the current page
    this.fields.forEach(field => {
      if (field.element) {
        const fieldPage = parseInt(field.page_number);
        const currentPage = parseInt(this.currentPage);
        
        console.log(`Field ${field.serverId}: page ${fieldPage}, current page ${currentPage}`);
        
        if (fieldPage === currentPage) {
          // Show fields for the current page
          field.element.style.display = 'block';
          field.element.style.visibility = 'visible'; // Explicitly set visibility
          field.element.style.opacity = '1'; // Ensure opacity is set to fully visible
          field.element.style.zIndex = '100'; // Keep fields on top
          
          console.log(`Making field ${field.serverId} visible`);
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
        if (page === parseInt(this.currentPage)) {
          item.style.display = 'flex'; // List items use flex layout
        } else {
          item.style.display = 'none';
        }
      });
    }
    
    // Check if we've already loaded fields for this page
    const hasFieldsForCurrentPage = this.fields.some(field => 
      parseInt(field.page_number) === parseInt(this.currentPage)
    );
    
    // Only fetch from server if we haven't loaded fields for this page yet
    if (!hasFieldsForCurrentPage) {
      console.log(`Fetching fields for page ${this.currentPage} from server`);
      
      // Fetch fields for this page from the server
      fetch(`/documents/${this.documentIdValue}/form_fields?page_number=${this.currentPage}`)
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
            
            // Add a small delay to check if fields are still visible
            setTimeout(() => {
              this.verifyFieldsVisibility();
            }, 500);
          }
        })
        .catch(error => {
          console.error("Error loading fields:", error);
        });
    } else {
      console.log(`Using existing fields for page ${this.currentPage}`);
      
      // Verify fields are visible even for existing fields
      setTimeout(() => {
        this.verifyFieldsVisibility();
      }, 300);
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
    
    // Set position and size using percentage values
    fieldElement.style.left = `${xPercent}%`;
    fieldElement.style.top = `${yPercent}%`;
    fieldElement.style.width = `${widthPercent}%`;
    fieldElement.style.height = `${heightPercent}%`;
    
    // Set visibility based on current page - make sure fields are visible
    if (parseInt(fieldData.page_number) === this.currentPage) {
      fieldElement.style.display = 'block';
    } else {
      fieldElement.style.display = 'none';
    }
    
    // Apply scale transform if we have a non-default scale
    if (this.lastKnownPdfScale && this.lastKnownPdfScale !== 1.0) {
      fieldElement.style.transform = `scale(${this.lastKnownPdfScale})`;
      fieldElement.style.transformOrigin = 'top left';
    }
    
    // Make sure fields stay on top of the PDF content
    fieldElement.style.zIndex = '100';

    // Make sure we add the element to the correct container
    if (this.hasContainerTarget) {
      // Create a field label element
      const labelElement = document.createElement('div');
      labelElement.className = 'field-label';
      
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
      deleteButton.dataset.action = 'click->editor-field-placement#deleteFieldFromPdf'
      deleteButton.dataset.fieldId = fieldData.id
      fieldElement.appendChild(deleteButton)
      
      // Add resize handles
      this.addResizeHandles(fieldElement)
      
      // Add the field element to the container
      this.containerTarget.appendChild(fieldElement)
      
      // Log that we've added the field to the container
      console.log(`Added field to container: ${fieldData.field_type} (ID: ${fieldData.id}) - Visibility: ${fieldElement.style.display}`);
    } else {
      console.error("Container target not found, cannot add field to DOM");
    }
    
    // Add to fields array with complete data
    const fieldObj = {
      serverId: fieldData.id,
      field_type: fieldData.field_type,
      document_id: this.documentIdValue,
      document_signer_id: fieldData.document_signer_id,
      page_number: parseInt(fieldData.page_number),
      x_position: xPercent,
      y_position: yPercent,
      width: widthPercent,
      height: heightPercent,
      required: fieldData.required,
      element: fieldElement
    }
    
    this.fields.push(fieldObj)
    
    // Add to the fields list in the UI
    this.addFieldToList(fieldObj.serverId, fieldData)
    
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
    let fieldIndex = -1;
    
    // Check if this is a field loaded from the database (has 'db-' prefix)
    if (fieldId.startsWith('db-')) {
      const serverId = parseInt(fieldId.replace('db-', ''));
      fieldIndex = this.fields.findIndex(field => field.serverId === serverId);
    } else {
      // Regular client-side ID
      fieldIndex = this.fields.findIndex(field => field.id === fieldId);
    }
    
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
      } else if (fieldId.startsWith('db-')) {
        // If we have a db- prefix but no serverId in the field object
        field.serverId = parseInt(fieldId.replace('db-', ''));
        this.updateFieldOnServer(field);
      }
    } else {
      console.error(`Could not find field with ID ${fieldId} in fields array`);
    }
    
    // Clear resize data
    this.isResizing = false;
    this.resizeData = null;
    
    event.preventDefault();
  }

  updateFieldOnServer(field) {
    console.log(`Updating field with server ID ${field.serverId}:`, field);
    
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
    .then(response => {
      if (!response.ok) {
        throw new Error(`Server returned ${response.status}: ${response.statusText}`);
      }
      return response.json();
    })
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
      
      // Remove the field from our fields array
      this.fields.splice(fieldIndex, 1)
      
      // Delete it from the server
      this.deleteFieldFromServer(fieldId)
      
      // Also remove it from the UI fields list
      if (this.hasFieldsListTarget) {
        const listItem = this.fieldsListTarget.querySelector(`li[data-field-id="${fieldId}"]`)
        if (listItem) {
          listItem.remove()
        }
      }
      
      console.log(`Field ${fieldId} successfully removed`)
    } else {
      console.error(`Could not find field with server ID ${fieldId} in fields array`)
    }
  }

  // Add method to listen for PDF scale changes
  listenForPdfScaleChanges() {
    document.addEventListener('pdf-viewer:scaleChanged', (event) => {
      console.log('PDF scale change detected:', event.detail);
      const newScale = event.detail.scale;
      
      if (newScale !== this.lastKnownPdfScale) {
        console.log(`Updating fields for scale change: ${this.lastKnownPdfScale} -> ${newScale}`);
        this.lastKnownPdfScale = newScale;
        
        // Update all visible fields to maintain their relative positions
        this.updateFieldsForZoomChange(newScale);
      }
    });
  }

  // Update method to update field positions when zoom changes
  updateFieldsForZoomChange(newScale) {
    // Only update fields on the current page
    const currentPageFields = this.fields.filter(field => field.page_number === this.currentPage);
    
    console.log(`Updating ${currentPageFields.length} fields for zoom scale: ${newScale}`);
    
    currentPageFields.forEach(field => {
      if (field.element) {
        // Add the field-scaled class for better transitions
        field.element.classList.add('field-scaled');
        
        // Apply the scale transform
        field.element.style.transform = `scale(${newScale})`;
        field.element.style.transformOrigin = 'top left';
        
        // Calculate any position adjustments needed
        // This ensures that the field stays aligned with the PDF content
        // even when the container size changes due to scaling
        const container = this.containerTarget;
        const containerRect = container.getBoundingClientRect();
        
        // Store the original field position if not already saved
        if (!field.originalPosition) {
          field.originalPosition = {
            left: parseFloat(field.element.style.left), 
            top: parseFloat(field.element.style.top),
            width: parseFloat(field.element.style.width),
            height: parseFloat(field.element.style.height)
          };
        }
      }
    });
  }

  // Add method to listen for PDF page changes
  listenForPdfPageChanges() {
    // Listen for page change events from the PDF viewer
    document.addEventListener('pdf-viewer:pageChanged', (event) => {
      console.log('PDF page change detected:', event.detail);
      const newPage = event.detail.page;
      
      // Important: Only respond if the page actually changes
      // This prevents multiple redraws on the same page
      if (newPage && newPage !== this.currentPage) {
        console.log(`Changing page: ${this.currentPage} -> ${newPage}`);
        this.currentPage = newPage;
        
        // Load fields for the new page
        this.loadFieldsForCurrentPage();
      }
    });
  }

  // Helper method to get signer index by ID
  getSignerIndexById(signerId) {
    console.log(`Getting signer index for ID: ${signerId}`);
    
    if (!this.hasSignerSelectTarget) {
      console.warn("No signer select target found");
      return 0;
    }
    
    if (!signerId) {
      console.warn("No signer ID provided");
      return 0;
    }
    
    const options = Array.from(this.signerSelectTarget.options);
    console.log(`Found ${options.length} options in signer select`);
    
    for (let i = 0; i < options.length; i++) {
      console.log(`Option ${i}: value=${options[i].value}, signerId=${signerId}, match=${options[i].value === signerId.toString()}`);
      if (options[i].value === signerId.toString()) {
        console.log(`Found match at index ${i}`);
        return i; // Return the index (0 is "Select a signer", so actual signers start at 1)
      }
    }
    
    console.warn(`No matching signer found for ID: ${signerId}`);
    return 0;
  }

  // Method to enhance the signer dropdown with color indicators
  enhanceSignerDropdown() {
    if (!this.hasSignerSelectTarget) return;
    
    console.log("Enhancing signer dropdown with color indicators");
    
    // Get all options in the dropdown
    const options = Array.from(this.signerSelectTarget.options);
    
    // Skip the first option which is usually "Select a signer"
    for (let i = 1; i < options.length; i++) {
      const option = options[i];
      // Add signer-option-N class to each option based on its index
      option.classList.add(`signer-option-${i}`);
      console.log(`Added class signer-option-${i} to option: ${option.text}`);
    }
    
    // Add an event listener to update the selected option display
    this.signerSelectTarget.addEventListener('change', this.updateSelectedSignerDisplay.bind(this));
    
    // Initial update of the selected signer display
    this.updateSelectedSignerDisplay();
  }
  
  // Update the display of the selected signer with color
  updateSelectedSignerDisplay() {
    if (!this.hasSignerSelectTarget) return;
    
    const selectedIndex = this.signerSelectTarget.selectedIndex;
    
    // If there's a previous indicator, remove it
    const previousIndicator = this.signerSelectTarget.parentNode.querySelector('.signer-color-indicator');
    if (previousIndicator) {
      previousIndicator.remove();
    }
    
    // If a signer is selected (not the default option)
    if (selectedIndex > 0) {
      // Create a color indicator
      const colorIndicator = document.createElement('span');
      colorIndicator.classList.add('signer-color-indicator', `signer-color-${selectedIndex}`);
      
      // Insert it before the select
      this.signerSelectTarget.parentNode.insertBefore(colorIndicator, this.signerSelectTarget);
      
      console.log(`Added color indicator for signer index ${selectedIndex}`);
    }
  }

  // Add a new method to verify and ensure fields remain visible
  verifyFieldsVisibility(event) {
    console.log('Verifying field visibility');
    const currentPage = event.detail.page;
    const fields = this.element.querySelectorAll(`.signature-field[data-page="${currentPage}"]`);
    
    if (fields.length === 0) {
      console.log('No fields found for page', currentPage);
      return;
    }
    
    console.log(`Found ${fields.length} fields for page ${currentPage}, ensuring visibility`);
    
    fields.forEach(field => {
      // Ensure the field is visible and properly styled
      field.style.display = 'block';
      field.style.opacity = '1';
      field.style.visibility = 'visible';
      field.style.zIndex = '100';
      
      // Ensure field has proper pointer events
      field.style.pointerEvents = 'auto';
      
      // Log field dimensions and position for debugging
      const rect = field.getBoundingClientRect();
      console.log(`Field ${field.id || 'unknown'}: `, {
        width: rect.width,
        height: rect.height,
        top: rect.top,
        left: rect.left,
        visible: field.offsetParent !== null
      });
    });
  }

  // Add method to handle page change events from the PDF viewer
  handlePdfPageChange(event) {
    console.log('PDF page change detected:', event.detail);
    const newPage = event.detail.page;
    
    if (newPage && newPage !== this.currentPage) {
      console.log(`Changing page: ${this.currentPage} -> ${newPage}`);
      this.currentPage = newPage;
      
      // Load fields for the new page
      this.loadFieldsForCurrentPage();
    }
  }
}