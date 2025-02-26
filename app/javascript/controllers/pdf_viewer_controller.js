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
    
    // Force initial scale to be 1.0 (100%)
    this.currentScale = 1.0;
    this.scaleValue = 1.0;
    
    // Add debugging function to check for duplicate pages
    this.debugCheckDuplicatePages = () => {
      console.log("=== CHECKING FOR DUPLICATE PAGES ===");
      const pagesContainer = document.querySelector('.pdf-pages-container');
      if (!pagesContainer) {
        console.log("No pages container found!");
        return;
      }
      
      const pageContainers = pagesContainer.querySelectorAll('.pdf-page-container');
      console.log(`Found ${pageContainers.length} page containers`);
      
      // Check for duplicate page numbers
      const pageNumbers = {};
      pageContainers.forEach(container => {
        const pageNum = container.dataset.page;
        if (!pageNumbers[pageNum]) {
          pageNumbers[pageNum] = 1;
        } else {
          pageNumbers[pageNum]++;
          console.warn(`DUPLICATE PAGE ${pageNum} FOUND! (${pageNumbers[pageNum]} occurrences)`);
        }
      });
      
      // Log page numbers found
      console.log("Page numbers found:", Object.keys(pageNumbers).sort((a, b) => a - b).join(", "));
      
      // Check for any direct child page containers in the main container (outside pdf-pages-container)
      const directPageContainers = this.containerTarget.querySelectorAll(':scope > .pdf-page-container');
      if (directPageContainers.length > 0) {
        console.warn(`Found ${directPageContainers.length} page containers directly in main container!`);
      }
    };
    
    // Run the duplicate page check a few seconds after connection
    setTimeout(() => {
      this.debugCheckDuplicatePages();
    }, 3000);
    
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
          let newScale;
          
          // If we're below 100% and would cross 100% when zooming in,
          // use exactly 100% as an intermediate step
          if (oldScale < 1.0 && oldScale * 1.15 > 1.0) {
            newScale = 1.0; // Exactly 100%
          } else {
            newScale = Math.min(oldScale * 1.15, 3.0); // 15% increment, max 300%
          }
          
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
          let newScale;
          
          // If we're above 100% and would cross 100% when zooming out,
          // use exactly 100% as an intermediate step
          if (oldScale > 1.0 && oldScale * 0.85 < 1.0) {
            newScale = 1.0; // Exactly 100%
          } else {
            newScale = Math.max(oldScale * 0.85, 0.5); // 15% decrement, min 50%
          }
          
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
    // First ensure PDF.js is loaded
    await this.loadPdfJs();
    
    console.log("Loading PDF document from URL:", this.urlValue);
    
    // Clear any existing pages before loading a new document
    // This prevents duplicate pages if the document is loaded multiple times
    const existingPagesContainer = this.containerTarget.querySelector('.pdf-pages-container');
    if (existingPagesContainer) {
      console.log("Clearing existing pages container before loading new document");
      existingPagesContainer.remove();
    }
    
    try {
      // Fetch the PDF document
      const loadingTask = this.pdfjsLib.getDocument(this.urlValue);
      this.pdfDoc = await loadingTask.promise;
      console.log(`PDF document loaded successfully. Number of pages: ${this.pdfDoc.numPages}`);
      
      // Update page count display
      this.updatePageCount();
      
      // Initialize the pages array with the correct length
      this.pages = new Array(this.pdfDoc.numPages + 1).fill(null); // +1 because PDF pages are 1-indexed
      
      // Render all pages at once
      await this.renderAllPages();
      
      // Hide loading indicator
      this.hideLoadingIndicator();
      
      // Run duplicate page check after rendering
      setTimeout(() => {
        this.debugCheckDuplicatePages();
      }, 1000);
      
      // Dispatch event that the PDF is loaded
      this.element.dispatchEvent(new CustomEvent('pdf-viewer:loaded', {
        detail: {
          pageCount: this.pdfDoc.numPages
        },
        bubbles: true
      }));
    } catch (error) {
      console.error("Error loading PDF document:", error);
      // Show error in the container
      this.containerTarget.innerHTML = `
        <div class="p-4 bg-red-100 text-red-700 rounded">
          <p class="font-bold">Error loading document</p>
          <p>${error.message}</p>
        </div>
      `;
      this.hideLoadingIndicator();
    }
  }

  // Update page count display
  updatePageCount() {
    if (this.hasPageCountTarget && this.pdfDoc) {
      this.pageCountTarget.textContent = this.pdfDoc.numPages;
      console.log(`Updated page count display to ${this.pdfDoc.numPages} pages`);
    } else {
      console.warn("Could not update page count: Missing target or PDF document not loaded");
    }
  }

  async renderAllPages() {
    console.log(`Rendering all ${this.pdfDoc.numPages} pages`);
    
    // Create a container for all pages if it doesn't exist yet
    let pagesContainer = this.containerTarget.querySelector('.pdf-pages-container');
    
    // If the container doesn't exist or we need to rebuild it
    if (!pagesContainer) {
      // Remove any existing page containers directly in the main container
      const existingPageContainers = this.containerTarget.querySelectorAll('.pdf-page-container');
      existingPageContainers.forEach(container => container.remove());
      
      // Create the pages container
      pagesContainer = document.createElement('div');
      pagesContainer.className = 'pdf-pages-container';
      pagesContainer.style.display = 'flex';
      pagesContainer.style.flexDirection = 'column';
      pagesContainer.style.gap = '20px'; // Add space between pages
      
      // Clear the container first
      this.containerTarget.innerHTML = '';
      this.containerTarget.appendChild(pagesContainer);
    }
    
    // Early check: if pagesContainer already has page containers, clear them out
    // This prevents duplicate pages
    if (pagesContainer.querySelectorAll('.pdf-page-container').length > 0) {
      console.log("Clearing existing page containers to prevent duplicates");
      pagesContainer.innerHTML = '';
    }
    
    // Render each page
    for (let pageNum = 1; pageNum <= this.pdfDoc.numPages; pageNum++) {
      const pageContainer = document.createElement('div');
      pageContainer.className = 'pdf-page-container';
      pageContainer.dataset.page = pageNum;
      
      // Create canvas for this page
      const canvas = document.createElement('canvas');
      canvas.id = `page-canvas-${pageNum}`; // Ensure unique ID
      canvas.className = 'pdf-page';
      pageContainer.appendChild(canvas);
      
      // Add to the pages container
      pagesContainer.appendChild(pageContainer);
      
      // Store page info
      this.pages[pageNum] = {
        canvas: canvas,
        isRendered: false
      };
      
      // Render the page
      await this.renderPage(pageNum);
      
      // Dispatch page change event after the first page is rendered
      if (pageNum === 1) {
        this.dispatchPageChangeEvent(1);
      }
    }
  }

  async renderPage(pageNum) {
    if (!this.pdfDoc) return;
    
    const page = await this.pdfDoc.getPage(pageNum);
    
    // Get the canvas for this page or create one if it doesn't exist
    let canvas = document.getElementById(`page-canvas-${pageNum}`);
    let container;
    
    if (!canvas) {
      // Instead of creating a new container directly, first check if one exists
      container = document.querySelector(`.pdf-page-container[data-page="${pageNum}"]`);
      
      if (container) {
        // If container exists but canvas doesn't, just create the canvas
        canvas = document.createElement('canvas');
        canvas.id = `page-canvas-${pageNum}`;
        canvas.className = 'pdf-page';
        container.appendChild(canvas);
      } else {
        // Only create a new container if we can't find one for this page
        container = document.createElement('div');
        container.className = 'pdf-page-container';
        container.dataset.page = pageNum;
        
        // Create canvas for this page
        canvas = document.createElement('canvas');
        canvas.id = `page-canvas-${pageNum}`;
        canvas.className = 'pdf-page';
        container.appendChild(canvas);
        
        // Find the pdf-pages-container to add to
        const pagesContainer = document.querySelector('.pdf-pages-container');
        if (pagesContainer) {
          pagesContainer.appendChild(container);
        } else {
          // Fallback - add to the main container
          this.containerTarget.appendChild(container);
        }
      }
    } else {
      // Find the existing container
      container = canvas.closest('.pdf-page-container');
    }
    
    const ctx = canvas.getContext('2d');
    
    // Adjust scale based on the current scale factor
    const viewport = page.getViewport({ scale: this.currentScale });
    
    // Set canvas dimensions to match the viewport
    canvas.height = viewport.height;
    canvas.width = viewport.width;
    
    // Render the page
    const renderContext = {
      canvasContext: ctx,
      viewport: viewport
    };
    
    try {
      await page.render(renderContext);
      console.log(`Page ${pageNum} rendered at scale ${this.currentScale}`);
      
      // If this is the first page and we're just rendering one page (not all pages),
      // then dispatch the page change event
      if (pageNum === 1 && !this.isRenderingAllPages) {
        this.dispatchPageChangeEvent(1);
      }
      
      return true;
    } catch (error) {
      console.error(`Error rendering page ${pageNum}:`, error);
      return false;
    }
  }
  
  // We'll keep these methods but modify them to work with all pages
  zoomIn(event) {
    event.preventDefault();
    
    // Calculate the new scale value
    let newScale;
    const currentPercent = Math.round(this.currentScale * 100);
    
    if (currentPercent < 100) {
      // If below 100%, go to 100% directly
      newScale = 1.0;
    } else {
      // Otherwise increase by 15%
      newScale = this.currentScale + 0.15;
    }
    
    // Max zoom of 300%
    newScale = Math.min(newScale, 3.0);
    
    // Set the new scale value
    this.currentScale = newScale;
    
    // Update display and trigger re-render
    this.updateZoomLevelDisplay();
    // Force a re-render of all pages with the new scale
    this.scaleValueChanged();
  }
  
  zoomOut(event) {
    event.preventDefault();
    
    // Calculate the new scale value
    let newScale;
    const currentPercent = Math.round(this.currentScale * 100);
    
    if (currentPercent > 100) {
      // If above 100%, go to 100% directly
      newScale = 1.0;
    } else {
      // Otherwise decrease by 15%
      newScale = this.currentScale - 0.15;
    }
    
    // Min zoom of 50%
    newScale = Math.max(newScale, 0.5);
    
    // Set the new scale value
    this.currentScale = newScale;
    
    // Update display and trigger re-render
    this.updateZoomLevelDisplay();
    // Force a re-render of all pages with the new scale
    this.scaleValueChanged();
  }

  // Legacy page navigation methods will be kept for compatibility but won't do anything
  nextPage(event) {
    event?.preventDefault();
    // No-op - all pages are displayed
  }
  
  prevPage(event) {
    event?.preventDefault();
    // No-op - all pages are displayed
  }

  // Scale value changed - re-render all pages
  scaleValueChanged() {
    console.log("Scale value changed to:", this.currentScale);
    
    // Find the pages container
    const pagesContainer = document.querySelector('.pdf-pages-container');
    if (!pagesContainer) {
      console.warn("No pages container found - cannot apply zoom");
      return;
    }
    
    // Find all page containers
    const allPages = pagesContainer.querySelectorAll('.pdf-page-container');
    
    if (allPages.length > 0 && this.pdfDoc) {
      // Set flag to indicate we're rendering all pages
      this.isRenderingAllPages = true;
      
      const firstPageCanvas = allPages[0].querySelector('canvas');
      
      // Calculate scroll position relative to first page height
      let scrollRatio = 0;
      if (firstPageCanvas) {
        const rect = firstPageCanvas.getBoundingClientRect();
        const scrollTop = window.scrollY;
        scrollRatio = scrollTop / rect.height;
      }
      
      // Store current scroll position for later
      const renderPromises = [];
      
      // Re-render all pages with the new scale - without creating new elements
      for (let i = 1; i <= this.pdfDoc.numPages; i++) {
        renderPromises.push(this.renderPage(i));
      }
      
      // After all pages are rendered, reset scroll position proportionally and dispatch scale change event
      Promise.all(renderPromises).then(() => {
        this.isRenderingAllPages = false;
        
        // First dispatch the scale change event after all rendering is done
        this.dispatchScaleChangeEvent();
        
        if (scrollRatio > 0) {
          const firstPageCanvas = pagesContainer.querySelector('.pdf-page-container canvas');
          if (firstPageCanvas) {
            const newRect = firstPageCanvas.getBoundingClientRect();
            const newScrollY = scrollRatio * newRect.height;
            window.scrollTo({
              top: newScrollY,
              behavior: 'auto'
            });
          }
        }
      });
    } else {
      console.warn("No pages to re-render or PDF document not loaded");
    }
  }

  // Dispatch page change event - modified to include all pages info
  dispatchPageChangeEvent(pageNum) {
    this.element.dispatchEvent(new CustomEvent('pdf-viewer:pageChanged', {
      detail: {
        page: pageNum,
        pageCount: this.pdfDoc ? this.pdfDoc.numPages : 0,
        allPagesVisible: true,
        scale: this.currentScale
      },
      bubbles: true
    }));
  }

  updateZoomLevelDisplay() {
    if (this.hasZoomLevelTarget) {
      const percentage = Math.round(this.currentScale * 100);
      console.log("Updating zoom level display to:", percentage + "%", "Current scale:", this.currentScale);
      this.zoomLevelTarget.textContent = `${percentage}%`;
      
      // Don't dispatch scale change event here - let scaleValueChanged handle that
      // after the re-rendering is complete
    } else {
      console.warn("No zoom level target found to update display");
    }
  }
  
  // Dispatch scale change event
  dispatchScaleChangeEvent() {
    console.log("Dispatching scale change event:", this.currentScale);
    this.element.dispatchEvent(new CustomEvent('pdf-viewer:scaleChanged', {
      detail: {
        scale: this.currentScale,
        oldScale: this._oldScale || 1.0,
        allPages: true,
        pageCount: this.pdfDoc ? this.pdfDoc.numPages : 0
      },
      bubbles: true
    }));
    
    // Store current scale as old scale for next change
    this._oldScale = this.currentScale;
  }
  
  // This is called when the page value changes
  pageValueChanged() {
    if (!this.isLoading && this.pdfDoc && this.pageValue !== this.currentPage) {
      this.currentPage = this.pageValue
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