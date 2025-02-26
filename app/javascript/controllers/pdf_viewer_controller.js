import { Controller } from "@hotwired/stimulus"

// Connects to data-controller="pdf-viewer"
export default class extends Controller {
  static targets = ["container", "loading", "pageNum", "pageCount", "zoomLevel", "prevButton", "nextButton"]
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
    
    // Track whether we've calculated initial scale
    this._initialScaleSet = false;
    
    // Zoom tracking - add explicit last zoom direction
    this.isZooming = false;
    this.lastZoomDirection = null; // 'in' or 'out'
    this.manualZoomMode = false; // Set to true after first manual zoom
    
    // Debug for zoom buttons
    setTimeout(() => {
      console.log("=== ZOOM FIX: Looking for zoom buttons ===");
      const zoomInBtn = document.getElementById('zoomInButton');
      const zoomOutBtn = document.getElementById('zoomOutButton');
      
      // Track whether we've already attached zoom handlers
      // to prevent multiple handlers being attached
      this._zoomHandlersAttached = false;
      
      if (zoomInBtn && zoomOutBtn && !this._zoomHandlersAttached) {
        console.log("ZOOM FIX: Found zoom buttons and attaching handlers");
        this._zoomHandlersAttached = true;
        
        // Store direct reference to the zoom level display element
        this._zoomLevelElement = this.hasZoomLevelTarget ? this.zoomLevelTarget : null;
        
        // Completely remove and recreate BOTH buttons to ensure no old handlers exist
        const zoomInParent = zoomInBtn.parentNode;
        const zoomOutParent = zoomOutBtn.parentNode;
        
        // Clone the buttons
        const newZoomInBtn = zoomInBtn.cloneNode(true);
        const newZoomOutBtn = zoomOutBtn.cloneNode(true);
        
        // Remove old buttons
        zoomInBtn.remove();
        zoomOutBtn.remove();
        
        // Add new buttons
        zoomInParent.appendChild(newZoomInBtn);
        zoomOutParent.appendChild(newZoomOutBtn);
        
        // === ZOOM IN BUTTON ===
        newZoomInBtn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          
          // Prevent zoom if already zooming
          if (this._zoomingInProgress) {
            console.log("Zoom operation already in progress, ignoring click");
            return;
          }
          
          // Set zooming flag - using a separate property from isZooming
          // to completely isolate this logic
          this._zoomingInProgress = true;
          
          // Mark that we've manually zoomed
          this.manualZoomMode = true;
          
          console.log("ZOOM FIX: Zoom IN starting");
          
          // Get the center point of the viewport relative to the document
          const viewportCenterX = window.innerWidth / 2;
          const viewportCenterY = window.innerHeight / 2;
          
          // Get the PDF container
          const pdfContainer = this.containerTarget;
          const containerRect = pdfContainer.getBoundingClientRect();
          
          // Calculate the point on the PDF where the viewport center is
          const pointXOnPdf = (window.scrollX + viewportCenterX - containerRect.left) / this.currentScale;
          const pointYOnPdf = (window.scrollY + viewportCenterY - containerRect.top) / this.currentScale;
          
          // Get current scale
          const oldScale = this.currentScale;
          
          // Calculate new scale - zoom in by 25%
          const newScale = Math.min(oldScale * 1.25, 3.0);
          
          console.log(`ZOOM FIX: Zoom IN from ${oldScale} to ${newScale}`);
          
          // Update internal scale without using scaleValue
          this.currentScale = newScale;
          
          // Manually update zoom display if we have reference to it
          if (this._zoomLevelElement) {
            const percentage = Math.round(newScale * 100);
            this._zoomLevelElement.textContent = `${percentage}%`;
            console.log("ZOOM DISPLAY updated manually to:", percentage + "%");
          }
          
          // IMPORTANT: Manually re-render the current page
          // We can't use reRenderCurrentPage because it might trigger value changes
          this._manualRenderWithNewScale(newScale, {
            pointXOnPdf,
            pointYOnPdf,
            container: pdfContainer
          });
          
          // Release zoom lock after a delay
          setTimeout(() => {
            this._zoomingInProgress = false;
            
            // Sync scale value at the end to maintain consistency
            // but only after zooming is complete
            this.scaleValue = newScale;
            
            console.log("Zoom IN operation complete");
          }, 300);
        });
        
        // === ZOOM OUT BUTTON ===
        newZoomOutBtn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          
          // Prevent zoom if already zooming
          if (this._zoomingInProgress) {
            console.log("Zoom operation already in progress, ignoring click");
            return;
          }
          
          // Set zooming flag
          this._zoomingInProgress = true;
          
          // Mark that we've manually zoomed
          this.manualZoomMode = true;
          
          console.log("ZOOM FIX: Zoom OUT starting");
          
          // Get the center point of the viewport relative to the document
          const viewportCenterX = window.innerWidth / 2;
          const viewportCenterY = window.innerHeight / 2;
          
          // Get the PDF container
          const pdfContainer = this.containerTarget;
          const containerRect = pdfContainer.getBoundingClientRect();
          
          // Calculate the point on the PDF where the viewport center is
          const pointXOnPdf = (window.scrollX + viewportCenterX - containerRect.left) / this.currentScale;
          const pointYOnPdf = (window.scrollY + viewportCenterY - containerRect.top) / this.currentScale;
          
          // Get current scale
          const oldScale = this.currentScale;
          
          // Calculate new scale - zoom out by 20%
          const newScale = Math.max(oldScale * 0.8, 0.5);
          
          console.log(`ZOOM FIX: Zoom OUT from ${oldScale} to ${newScale}`);
          
          // Update internal scale without using scaleValue
          this.currentScale = newScale;
          
          // Manually update zoom display if we have reference to it
          if (this._zoomLevelElement) {
            const percentage = Math.round(newScale * 100);
            this._zoomLevelElement.textContent = `${percentage}%`;
            console.log("ZOOM DISPLAY updated manually to:", percentage + "%");
          }
          
          // IMPORTANT: Manually re-render the current page
          this._manualRenderWithNewScale(newScale, {
            pointXOnPdf,
            pointYOnPdf,
            container: pdfContainer
          });
          
          // Release zoom lock after a delay
          setTimeout(() => {
            this._zoomingInProgress = false;
            
            // Sync scale value at the end to maintain consistency
            this.scaleValue = newScale;
            
            console.log("Zoom OUT operation complete");
          }, 300);
        });
        
        // Add a manual render method that doesn't trigger value changes
        this._manualRenderWithNewScale = async (scale, viewportInfo = null) => {
          console.log(`Manual render at scale: ${scale}`);
          
          if (!this.pdfDoc || !this.pages[this.currentPage]) {
            console.warn("Cannot render: PDF not loaded or current page not initialized");
            return;
          }
          
          try {
            // Get the current page
            const pageObj = this.pages[this.currentPage];
            const canvas = pageObj.canvas;
            const page = await this.pdfDoc.getPage(this.currentPage);
            
            // Get the viewport with the new scale
            const viewport = page.getViewport({ scale: scale });
            
            // Update canvas dimensions
            canvas.height = viewport.height;
            canvas.width = viewport.width;
            
            // Render to canvas
            const renderContext = {
              canvasContext: canvas.getContext('2d'),
              viewport: viewport
            };
            
            await page.render(renderContext).promise;
            console.log("Manual render complete");
            
            // Dispatch scale change event after rendering is complete
            this.dispatchScaleChangeEvent();
            
            // If we have viewport info, adjust the scroll position to keep the center point stable
            if (viewportInfo && viewportInfo.pointXOnPdf) {
              // Wait a tiny bit for the DOM to update
              setTimeout(() => {
                // Get new container position after rendering
                const newContainerRect = viewportInfo.container.getBoundingClientRect();
                
                // Calculate where our point should be in the new scale
                const newPointXInViewport = (viewportInfo.pointXOnPdf * scale) + newContainerRect.left;
                const newPointYInViewport = (viewportInfo.pointYOnPdf * scale) + newContainerRect.top;
                
                // Calculate new scroll position to center this point
                const newScrollX = newPointXInViewport - (window.innerWidth / 2);
                const newScrollY = newPointYInViewport - (window.innerHeight / 2);
                
                console.log(`Adjusting scroll to keep point (${viewportInfo.pointXOnPdf}, ${viewportInfo.pointYOnPdf}) centered`);
                
                // Smoothly scroll to new position
                window.scrollTo({
                  left: newScrollX,
                  top: newScrollY,
                  behavior: 'auto' // Use 'auto' for immediate scroll without animation
                });
              }, 10);
            }
          } catch (error) {
            console.error("Error in manual render:", error);
          }
        };
      }
    }, 1000);
    
    // Create a helper method to re-render the current page
    this.reRenderCurrentPage = () => {
      if (this.pages[this.currentPage]) {
        this.pages[this.currentPage].rendered = false;
        this.renderPage(this.currentPage);
      }
    };
    
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
      
      // Initialize navigation button states
      this.updateNavigationButtons();
      
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
    console.log(`Current scale before render: ${this.currentScale}, isZooming: ${this.isZooming}`);
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
      const containerWidth = this.containerTarget.clientWidth;
      
      // FIXED: Only calculate fit-to-width scale when:
      // 1. We're initializing the viewer for the first time (no pages rendered yet)
      // 2. The user hasn't manually zoomed
      if (!this._initialScaleSet && !this.manualZoomMode) {
        console.log("Initial scale calculation for fit-width");
        const viewport = page.getViewport({ scale: 1.0 });
        const fitScale = (containerWidth - 10) / viewport.width; // -10 for some padding
        this.currentScale = fitScale;
        this.scaleValue = fitScale;
        this.updateZoomLevelDisplay();
        this._initialScaleSet = true;
        console.log(`Set initial fit-width scale: ${fitScale}`);
      }
      
      const viewport = page.getViewport({ scale: this.currentScale });
      
      // Set canvas dimensions to match viewport
      const context = canvas.getContext('2d');
      canvas.height = viewport.height;
      canvas.width = viewport.width;
      
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
      
      // Update navigation button states
      this.updateNavigationButtons();
      
      // Trigger page changed event (Stimulus)
      this.dispatch("pageChanged", { detail: { page: pageNum } })
      
      // Also dispatch a custom DOM event for non-Stimulus controllers
      const customEvent = new CustomEvent('pdf-viewer:pageChanged', {
        bubbles: true,
        detail: { page: pageNum }
      });
      document.dispatchEvent(customEvent);
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
    
    // Always return false to prevent default behavior
    return false;
  }

  prevPage(event) {
    // Prevent default behavior and stop propagation to avoid scrolling
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    
    console.log(`prevPage called, current page: ${this.currentPage}, total pages: ${this.pdfDoc ? this.pdfDoc.numPages : 'unknown'}`);
    
    // Save current scroll position
    const scrollPos = window.scrollY;
    
    if (this.currentPage > 1) {
      console.log(`Navigating to previous page: ${this.currentPage - 1}`);
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
    } else {
      console.log("Already at first page, cannot go to previous page");
    }
    
    // Always return false to prevent default behavior
    return false;
  }
  
  updateZoomLevelDisplay() {
    // Add stack trace to see what's calling this method
    console.log("updateZoomLevelDisplay called from:", new Error().stack);
    
    if (this.hasZoomLevelTarget) {
      const percentage = Math.round(this.currentScale * 100)
      console.log("Updating zoom level display to:", percentage + "%", "Current scale:", this.currentScale);
      this.zoomLevelTarget.textContent = `${percentage}%`
      
      // Dispatch scale change event for fields to respond to
      this.dispatchScaleChangeEvent();
    } else {
      console.warn("No zoom level target found to update display");
    }
  }
  
  // Add method to dispatch scale change event
  dispatchScaleChangeEvent() {
    console.log("Dispatching PDF scale change event:", this.currentScale);
    
    // Create and dispatch a custom event with scale information
    const event = new CustomEvent('pdf-viewer:scaleChanged', {
      bubbles: true,
      detail: {
        scale: this.currentScale
      }
    });
    
    // TODO: CRITICAL ZOOM HANDLING - This event dispatch is essential for proper zoom behavior
    // Modifying this or related scale handling code may reintroduce zoom bugs where:
    // 1. Page navigation causes unintended zoom changes
    // 2. Manual zoom operations aren't properly tracked
    // 3. Fields don't scale correctly when the page is zoomed
    // Always test thoroughly with page navigation and manual zoom when changing this code!
    document.dispatchEvent(event);
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
    console.log(`scaleValueChanged called: scaleValue=${this.scaleValue}, currentScale=${this.currentScale}, isZooming=${this.isZooming}, _zoomingInProgress=${this._zoomingInProgress}`);
    
    // Completely bypass scale changes if we're in a manual zoom operation
    if (this.isZooming || this._zoomingInProgress) {
      console.log("PROTECTED: Ignoring automatic scale change during manual zoom operation");
      return;
    }
    
    // Check for very small differences caused by rounding errors
    const scaleDiff = Math.abs(this.scaleValue - this.currentScale);
    if (scaleDiff < 0.001) {
      console.log("Ignoring insignificant scale change (less than 0.001)");
      return;
    }
    
    if (!this.isLoading && this.pdfDoc && this.scaleValue !== this.currentScale) {
      console.log(`Applying scale change from ${this.currentScale} to ${this.scaleValue}`);
      this.currentScale = this.scaleValue;
      this.updateZoomLevelDisplay();
      
      // Re-render current page with new scale
      if (this.pages[this.currentPage]) {
        this.pages[this.currentPage].rendered = false;
        this.renderPage(this.currentPage);
      }
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

  // Update navigation button states based on current page
  updateNavigationButtons() {
    console.log("Updating navigation button states");
    // Enable/disable prev button
    if (this.hasPrevButtonTarget) {
      this.prevButtonTarget.disabled = this.currentPage <= 1;
      console.log(`Prev button disabled: ${this.prevButtonTarget.disabled}`);
    }
    
    // Enable/disable next button
    if (this.hasNextButtonTarget) {
      this.nextButtonTarget.disabled = this.currentPage >= this.pdfDoc.numPages;
      console.log(`Next button disabled: ${this.nextButtonTarget.disabled}`);
    }
  }

  // Helper method to manually check navigation button states
  checkNavigationButtons() {
    console.log("Manually checking navigation button states");
    
    // Check if we have button targets
    console.log(`Previous button target found: ${this.hasPrevButtonTarget}`);
    console.log(`Next button target found: ${this.hasNextButtonTarget}`);
    
    // Get buttons using querySelector as fallback if targets aren't found
    if (!this.hasPrevButtonTarget) {
      const prevBtn = document.querySelector('[data-action*="pdf-viewer#prevPage"]');
      if (prevBtn) {
        console.log("Found prev button via querySelector");
        prevBtn.disabled = this.currentPage <= 1;
      }
    }
    
    if (!this.hasNextButtonTarget) {
      const nextBtn = document.querySelector('[data-action*="pdf-viewer#nextPage"]');
      if (nextBtn) {
        console.log("Found next button via querySelector");
        nextBtn.disabled = this.currentPage >= (this.pdfDoc ? this.pdfDoc.numPages : 1);
      }
    }
    
    // Update navigation buttons properly
    this.updateNavigationButtons();
  }
} 