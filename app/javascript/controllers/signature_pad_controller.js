import { Controller } from "@hotwired/stimulus"

// Connects to data-controller="signature-pad"
export default class extends Controller {
  static targets = ["canvas", "clearButton", "saveButton", "preview"]
  static values = {
    color: { type: String, default: "#000000" },
    lineWidth: { type: Number, default: 2.5 },
    savedImageData: String
  }

  connect() {
    this.initializeCanvas()
    
    if (this.hasSavedImageDataValue && this.savedImageDataValue) {
      this.loadSavedSignature()
    }
  }
  
  initializeCanvas() {
    this.canvas = this.canvasTarget
    this.ctx = this.canvas.getContext("2d")
    
    // Set canvas size to match container
    this.resizeCanvas()
    
    // Set up drawing properties
    this.ctx.strokeStyle = this.colorValue
    this.ctx.lineWidth = this.lineWidthValue
    this.ctx.lineCap = "round"
    this.ctx.lineJoin = "round"
    
    // Track drawing state
    this.isDrawing = false
    this.lastX = 0
    this.lastY = 0
    
    // Set up events
    this.setupEventListeners()
    
    // Clear canvas to start
    this.clearCanvas()
  }
  
  resizeCanvas() {
    const container = this.canvas.parentElement
    this.canvas.width = container.clientWidth
    this.canvas.height = container.clientHeight || 150
  }
  
  setupEventListeners() {
    // Mouse events
    this.canvas.addEventListener("mousedown", this.startDrawing.bind(this))
    this.canvas.addEventListener("mousemove", this.draw.bind(this))
    this.canvas.addEventListener("mouseup", this.stopDrawing.bind(this))
    this.canvas.addEventListener("mouseout", this.stopDrawing.bind(this))
    
    // Touch events for mobile
    this.canvas.addEventListener("touchstart", this.handleTouchStart.bind(this))
    this.canvas.addEventListener("touchmove", this.handleTouchMove.bind(this))
    this.canvas.addEventListener("touchend", this.stopDrawing.bind(this))
    
    // Window resize
    window.addEventListener("resize", this.handleResize.bind(this))
  }
  
  disconnect() {
    // Remove event listeners
    this.canvas.removeEventListener("mousedown", this.startDrawing.bind(this))
    this.canvas.removeEventListener("mousemove", this.draw.bind(this))
    this.canvas.removeEventListener("mouseup", this.stopDrawing.bind(this))
    this.canvas.removeEventListener("mouseout", this.stopDrawing.bind(this))
    
    this.canvas.removeEventListener("touchstart", this.handleTouchStart.bind(this))
    this.canvas.removeEventListener("touchmove", this.handleTouchMove.bind(this))
    this.canvas.removeEventListener("touchend", this.stopDrawing.bind(this))
    
    window.removeEventListener("resize", this.handleResize.bind(this))
  }
  
  startDrawing(e) {
    this.isDrawing = true
    
    const { x, y } = this.getCoordinates(e)
    this.lastX = x
    this.lastY = y
  }
  
  draw(e) {
    if (!this.isDrawing) return
    
    const { x, y } = this.getCoordinates(e)
    
    this.ctx.beginPath()
    this.ctx.moveTo(this.lastX, this.lastY)
    this.ctx.lineTo(x, y)
    this.ctx.stroke()
    
    this.lastX = x
    this.lastY = y
  }
  
  stopDrawing() {
    this.isDrawing = false
    
    // Check if save button should be enabled
    this.updateSaveButtonState()
  }
  
  handleTouchStart(e) {
    e.preventDefault() // Prevent scrolling while drawing
    this.startDrawing(e.touches[0])
  }
  
  handleTouchMove(e) {
    e.preventDefault() // Prevent scrolling while drawing
    this.draw(e.touches[0])
  }
  
  handleResize() {
    // Save the current signature
    const signatureData = this.canvas.toDataURL()
    
    // Resize the canvas
    this.resizeCanvas()
    
    // Clear the canvas
    this.clearCanvas()
    
    // Redraw the signature if there was one
    if (signatureData && signatureData !== "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVQIW2NgAAIAAAUAAR4f7BQAAAAASUVORK5CYII=") {
      const img = new Image()
      img.onload = () => {
        this.ctx.drawImage(img, 0, 0, this.canvas.width, this.canvas.height)
      }
      img.src = signatureData
    }
  }
  
  getCoordinates(event) {
    const rect = this.canvas.getBoundingClientRect()
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top
    }
  }
  
  clearCanvas() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)
    this.updateSaveButtonState()
    
    // Dispatch an event indicating the signature was cleared
    this.dispatch("clear")
  }
  
  updateSaveButtonState() {
    if (!this.hasSaveButtonTarget) return
    
    // Check if canvas is empty
    const imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height).data
    const isEmpty = !imageData.some(channel => channel !== 0)
    
    this.saveButtonTarget.disabled = isEmpty
    
    if (isEmpty) {
      this.saveButtonTarget.classList.add("opacity-50", "cursor-not-allowed")
      this.saveButtonTarget.classList.remove("hover:bg-indigo-700")
    } else {
      this.saveButtonTarget.classList.remove("opacity-50", "cursor-not-allowed")
      this.saveButtonTarget.classList.add("hover:bg-indigo-700")
    }
  }
  
  saveSignature() {
    // Get signature as data URL
    const signatureData = this.canvas.toDataURL("image/png")
    
    // Update the preview if it exists
    if (this.hasPreviewTarget) {
      this.previewTarget.src = signatureData
      this.previewTarget.classList.remove("hidden")
    }
    
    // Save value to controller state
    this.savedImageDataValue = signatureData
    
    // Dispatch event with signature data
    this.dispatch("save", { detail: { signatureData } })
  }
  
  loadSavedSignature() {
    // Draw saved signature onto canvas
    const img = new Image()
    img.onload = () => {
      this.clearCanvas()
      this.ctx.drawImage(img, 0, 0, this.canvas.width, this.canvas.height)
      this.updateSaveButtonState()
      
      // Update preview if it exists
      if (this.hasPreviewTarget) {
        this.previewTarget.src = this.savedImageDataValue
        this.previewTarget.classList.remove("hidden")
      }
    }
    img.src = this.savedImageDataValue
  }
} 