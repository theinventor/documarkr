import { Controller } from "@hotwired/stimulus"

// Connects to data-controller="pdf-viewer"
export default class extends Controller {
  static targets = ["container", "pageNum", "prevButton", "nextButton"]
  static values = {
    url: String,
    page: { type: Number, default: 1 }
  }

  connect() {
    console.log("PDF Viewer controller connected")
    this.loadingElement = this.element.querySelector('.pdf-loading')
    
    if (this.urlValue) {
      this.loadingElement?.classList.remove('hidden')
      this.loadPdfJs()
    }
  }

  async loadPdfJs() {
    try {
      const pdfjs = await import('pdfjs-dist')
      pdfjs.GlobalWorkerOptions.workerSrc = '/vendor/javascript/pdfjs/pdf.worker.mjs'
      this.loadDocument(pdfjs)
    } catch (error) {
      console.error("Error loading PDF.js:", error)
      this.loadingElement?.classList.add('hidden')
      this.containerTarget.innerHTML = `
        <div class="p-4 text-center">
          <div class="text-red-600">Failed to load PDF viewer</div>
          <p class="text-gray-700 mt-2">Please try refreshing the page.</p>
        </div>
      `
    }
  }

  async loadDocument(pdfjs) {
    try {
      console.log(`Loading PDF from ${this.urlValue}`)
      const loadingTask = pdfjs.getDocument(this.urlValue)
      this.pdfDoc = await loadingTask.promise
      console.log(`PDF loaded with ${this.pdfDoc.numPages} pages`)
      
      // Set up pagination
      this.totalPages = this.pdfDoc.numPages
      this.currentPage = this.pageValue
      
      // Update UI
      if (this.hasPageNumTarget) {
        this.pageNumTarget.textContent = `Page ${this.currentPage} of ${this.totalPages}`
      }
      
      // Enable/disable nav buttons
      this.updateNavButtons()
      
      // Render the current page
      this.renderPage(this.currentPage)
      
      // Hide loading indicator
      this.loadingElement?.classList.add('hidden')
    } catch (error) {
      console.error("Error loading PDF document:", error)
      this.loadingElement?.classList.add('hidden')
      this.containerTarget.innerHTML = `
        <div class="p-4 text-center">
          <div class="text-red-600">Unable to load document</div>
          <p class="text-gray-700 mt-2">${error.message}</p>
        </div>
      `
    }
  }

  async renderPage(pageNumber) {
    try {
      const page = await this.pdfDoc.getPage(pageNumber)
      
      // Clear the container
      this.containerTarget.innerHTML = ''
      
      // Create a canvas for this page
      const canvas = document.createElement('canvas')
      canvas.className = 'pdf-page w-full'
      this.containerTarget.appendChild(canvas)
      
      const context = canvas.getContext('2d')
      
      // Calculate viewport (fit to container width)
      const containerWidth = this.containerTarget.clientWidth
      const viewport = page.getViewport({ scale: 1.0 })
      const scale = containerWidth / viewport.width
      const scaledViewport = page.getViewport({ scale })
      
      // Set canvas dimensions to match the viewport
      canvas.width = scaledViewport.width
      canvas.height = scaledViewport.height
      
      // Render the page
      await page.render({
        canvasContext: context,
        viewport: scaledViewport
      }).promise
      
      // Update current page value
      this.currentPage = pageNumber
      this.pageValue = pageNumber
      
      // Update page display
      if (this.hasPageNumTarget) {
        this.pageNumTarget.textContent = `Page ${this.currentPage} of ${this.totalPages}`
      }
      
      // Update navigation buttons
      this.updateNavButtons()
      
    } catch (error) {
      console.error(`Error rendering page ${pageNumber}:`, error)
      this.containerTarget.innerHTML = `
        <div class="p-4 text-center">
          <div class="text-red-600">Error rendering page ${pageNumber}</div>
          <p class="text-gray-700 mt-2">${error.message}</p>
        </div>
      `
    }
  }
  
  updateNavButtons() {
    if (this.hasPrevButtonTarget) {
      this.prevButtonTarget.disabled = this.currentPage <= 1
    }
    
    if (this.hasNextButtonTarget) {
      this.nextButtonTarget.disabled = this.currentPage >= this.totalPages
    }
  }
  
  nextPage() {
    if (this.currentPage < this.totalPages) {
      this.renderPage(this.currentPage + 1)
    }
  }
  
  prevPage() {
    if (this.currentPage > 1) {
      this.renderPage(this.currentPage - 1)
    }
  }
} 