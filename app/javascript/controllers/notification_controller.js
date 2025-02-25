import { Controller } from "@hotwired/stimulus"

// Connects to data-controller="notification"
export default class extends Controller {
  static values = { 
    delay: { type: Number, default: 5000 } 
  }
  
  connect() {
    // Auto-dismiss the notification after the delay
    this.timeout = setTimeout(() => {
      this.close()
    }, this.delayValue)
  }
  
  disconnect() {
    if (this.timeout) {
      clearTimeout(this.timeout)
    }
  }
  
  close() {
    this.element.classList.add("opacity-0")
    setTimeout(() => {
      this.element.remove()
    }, 300)
  }
} 