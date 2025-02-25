import { Controller } from "@hotwired/stimulus"

// Connects to data-controller="pdf-viewer"
export default class extends Controller {
  static targets = ["container", "loading", "pageNum", "pageCount", "zoomLevel"]
  static values = {
    url: String,
    page: { type: Number, default: 1 },
    scale: { type: Number, default: 1.0 }
  }

  connect() {
    console.log("PDF Viewer connected, URL:", this.urlValue);
    this.pages = []
    this.currentPage = this.pageValue
    this.currentScale = this.scaleValue
    this.isLoading = true
    
    // Check if loading target exists during connection
    if (this.hasLoadingTarget) {
      console.log("Loading target found:", this.loadingTarget);
    } else {
      console.warn("No loading target found during initialization");
      // Try to find it by class
      const loadingEl = document.querySelector('.pdf-loading');
      if (loadingEl) {
        console.log("Found loading element via querySelector, but it's not a proper target");
      }
    }
    
    // Add a direct event handler to manually hide loading after 5 seconds as a failsafe
    setTimeout(() => {
      console.log("Failsafe timeout reached - forcibly hiding loading indicator");
      this.hideLoadingIndicator();
      document.querySelectorAll(".pdf-loading").forEach(el => { 
        el.classList.add("hidden"); 
        el.style.display = "none"; 
        el.style.visibility = "hidden"; 
        el.style.opacity = "0"; 
        el.style.zIndex = "-1"; 
      });
    }, 5000);
    
    // Lazy load PDF.js
    this.loadPdfJs().then(() => {
      console.log("PDF.js loaded successfully");
      this.loadDocument()
    }).catch(error => {
      console.error("Error loading PDF.js:", error);
    })
  }
  
  disconnect() {
    // Clean up resources when controller is disconnected
    if (this.pdfDoc) {
      this.pdfDoc.destroy()
      this.pdfDoc = null
    }
    
    this.pages = []
  }

  async loadPdfJs() {
    console.log("Loading PDF.js...");
    const pdfjsLib = await import('pdfjs-dist')
    this.pdfjsLib = pdfjsLib

    // Set worker source
    console.log("Setting worker source to:", '/vendor/javascript/pdfjs/pdf.worker.mjs');
    pdfjsLib.GlobalWorkerOptions.workerSrc = '/vendor/javascript/pdfjs/pdf.worker.mjs'
    
    return pdfjsLib
  }

  async loadDocument() {
    console.log("Loading document from URL:", this.urlValue);
    this.isLoading = true
    
    try {
      // Load the PDF document
      console.log("Creating PDF loading task");
      const loadingTask = this.pdfjsLib.getDocument(this.urlValue)
      
      console.log("Awaiting loading task promise");
      this.pdfDoc = await loadingTask.promise
      
      console.log("PDF document loaded successfully with", this.pdfDoc.numPages, "pages");
      
      // Set page count
      const numPages = this.pdfDoc.numPages
      if (this.hasPageCountTarget) {
        this.pageCountTarget.textContent = numPages
      }
      
      // Important: Set loading to false BEFORE rendering
      this.isLoading = false
      
      // Force hide the loading indicator with multiple approaches
      this.hideLoadingIndicator();
      
      // Initial page render
      this.currentPage = 1
      this.pageValue = 1
      console.log("Rendering first page");
      this.renderPage(this.currentPage)
      
      // Set initial zoom level display
      if (this.hasZoomLevelTarget) {
        this.updateZoomLevelDisplay()
      }
      
      console.log("Document loading complete");
    } catch (error) {
      console.error('Error loading PDF:', error)
      this.isLoading = false
      
      // Still hide loading but show error
      this.hideLoadingIndicator();
      
      // Show error message where PDF would go
      if (this.hasCanvasTarget) {
        const container = this.canvasTarget.parentNode;
        container.innerHTML = `
          <div class="flex items-center justify-center h-full">
            <div class="text-red-500 text-center p-4">
              <p class="text-xl font-bold">Failed to load PDF</p>
              <p class="mt-2">${error.message || 'Unknown error'}</p>
            </div>
          </div>
        `;
      }
    }
  }

  async renderPage(pageNum) {
    console.log(`Starting to render page ${pageNum}`);
    
    // Don't render if we're still loading the document
    if (this.isLoading) {
      console.warn(`Attempted to render page ${pageNum} while document is still loading`);
      return;
    }
    
    console.log(`Rendering page ${pageNum}, current loading state:`, this.isLoading);
    // Another check for the loading indicator visibility
    if (this.hasLoadingTarget) {
      console.log(`Loading indicator visibility before render: display=${this.loadingTarget.style.display}, class=${this.loadingTarget.className}`);
      // Force hide it again for safety
      this.hideLoadingIndicator();
    } else {
      console.warn("No loading target found during page render");
      // Try with direct querySelector
      const loadingEl = document.querySelector('.pdf-loading');
      if (loadingEl) {
        console.log("Found loading element via querySelector during render");
        loadingEl.classList.add('hidden');
        loadingEl.style.display = 'none';
      }
    }

    // Make sure page number is valid
    if (pageNum < 1 || pageNum > this.pdfDoc.numPages) {
      console.log(`Invalid page number: ${pageNum} (total pages: ${this.pdfDoc.numPages})`);
      return;
    }
    
    // Update page number display
    if (this.hasPageNumTarget) {
      this.pageNumTarget.textContent = pageNum;
    }
    
    try {
      // Get the page
      console.log(`Getting page ${pageNum} from PDF document`);
      const page = await this.pdfDoc.getPage(pageNum);
      
      // Create or find canvas for this page
      let canvas = this.containerTarget.querySelector(`canvas[data-page="${pageNum}"]`);
      if (!canvas) {
        console.log(`Creating new canvas for page ${pageNum}`);
        // Create new canvas
        canvas = document.createElement('canvas');
        canvas.setAttribute('data-page', pageNum);
        this.containerTarget.appendChild(canvas);
        
        // Store page reference
        this.pages[pageNum] = { canvas, rendered: false };
      } else {
        console.log(`Found existing canvas for page ${pageNum}`);
      }
      
      // Get viewport at current scale
      const containerWidth = this.containerTarget.clientWidth
      let scale = this.currentScale
      
      // Adjust scale to fit width if first render
      if (!this.pages[pageNum].rendered) {
        const viewport = page.getViewport({ scale: 1.0 })
        scale = (containerWidth - 10) / viewport.width // -10 for some padding
        this.currentScale = scale
        this.scaleValue = scale
        this.updateZoomLevelDisplay()
      }
      
      const viewport = page.getViewport({ scale: this.currentScale })
      
      // Set canvas dimensions to match viewport
      const context = canvas.getContext('2d')
      canvas.height = viewport.height
      canvas.width = viewport.width
      
      // Render PDF page into canvas context
      const renderContext = {
        canvasContext: context,
        viewport: viewport
      }
      
      await page.render(renderContext).promise
      
      // Hide other pages
      this.containerTarget.querySelectorAll('canvas').forEach(c => {
        if (c !== canvas) {
          c.classList.add('hidden')
        } else {
          c.classList.remove('hidden')
        }
      })
      
      // Mark page as rendered
      this.pages[pageNum].rendered = true
      
      // Trigger page changed event
      this.dispatch("pageChanged", { detail: { page: pageNum } })
    } catch (error) {
      console.error('Error rendering page:', error)
    }
  }

  nextPage(event) {
    // Prevent default behavior and stop propagation to avoid scrolling
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    
    // Save current scroll position
    const scrollPos = window.scrollY;
    
    if (this.currentPage < this.pdfDoc.numPages) {
      this.currentPage++
      this.pageValue = this.currentPage
      this.renderPage(this.currentPage)
      
      // Restore scroll position after a brief delay
      setTimeout(() => {
        window.scrollTo({
          top: scrollPos,
          behavior: 'auto'
        });
      }, 10);
      
      // Return false to ensure the browser doesn't follow the href
      return false;
    }
  }

  prevPage(event) {
    // Prevent default behavior and stop propagation to avoid scrolling
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    
    // Save current scroll position
    const scrollPos = window.scrollY;
    
    if (this.currentPage > 1) {
      this.currentPage--
      this.pageValue = this.currentPage
      this.renderPage(this.currentPage)
      
      // Restore scroll position after a brief delay
      setTimeout(() => {
        window.scrollTo({
          top: scrollPos,
          behavior: 'auto'
        });
      }, 10);
      
      // Return false to ensure the browser doesn't follow the href
      return false;
    }
  }
  
  zoomIn(event) {
    // Prevent default behavior and stop propagation to avoid scrolling
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    
    this.currentScale = Math.min(this.currentScale * 1.25, 3.0) // Max 300%
    this.scaleValue = this.currentScale
    this.updateZoomLevelDisplay()
    
    // Re-render current page with new scale
    this.pages[this.currentPage].rendered = false
    this.renderPage(this.currentPage)
    
    // Return false to ensure the browser doesn't follow the href
    return false;
  }
  
  zoomOut(event) {
    // Prevent default behavior and stop propagation to avoid scrolling
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    
    this.currentScale = Math.max(this.currentScale * 0.8, 0.5) // Min 50%
    this.scaleValue = this.currentScale
    this.updateZoomLevelDisplay()
    
    // Re-render current page with new scale
    this.pages[this.currentPage].rendered = false
    this.renderPage(this.currentPage)
    
    // Return false to ensure the browser doesn't follow the href
    return false;
  }
  
  updateZoomLevelDisplay() {
    if (this.hasZoomLevelTarget) {
      const percentage = Math.round(this.currentScale * 100)
      this.zoomLevelTarget.textContent = `${percentage}%`
    }
  }
  
  // This is called when the page value changes
  pageValueChanged() {
    if (!this.isLoading && this.pdfDoc && this.pageValue !== this.currentPage) {
      this.currentPage = this.pageValue
      this.renderPage(this.currentPage)
    }
  }
  
  // This is called when the scale value changes
  scaleValueChanged() {
    if (!this.isLoading && this.pdfDoc && this.scaleValue !== this.currentScale) {
      this.currentScale = this.scaleValue
      this.updateZoomLevelDisplay()
      
      // Re-render current page with new scale
      this.pages[this.currentPage].rendered = false
      this.renderPage(this.currentPage)
    }
  }

  // New robust method to hide loading indicator
  hideLoadingIndicator() {
    console.log("Attempting to hide loading indicator");
    
    // Try with target system first
    if (this.hasLoadingTarget) {
      console.log("Using target system to hide loading indicator");
      this.loadingTarget.classList.add('hidden');
      this.loadingTarget.style.display = 'none';
      this.loadingTarget.style.visibility = 'hidden';
      this.loadingTarget.style.opacity = '0';
      this.loadingTarget.style.pointerEvents = 'none';
    } else {
      // Fallback to querySelector if target not found
      console.warn("No loading target available, trying querySelector");
      const loadingEl = document.querySelector('.pdf-loading');
      if (loadingEl) {
        console.log("Found loading element via querySelector");
        loadingEl.classList.add('hidden');
        loadingEl.style.display = 'none';
        loadingEl.style.visibility = 'hidden';
        loadingEl.style.opacity = '0';
        loadingEl.style.pointerEvents = 'none';
      } else {
        console.error("Could not find loading element by any method");
      }
    }
  }
} 