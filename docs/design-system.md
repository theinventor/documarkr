## Implementation Notes

1. **Adding the Fonts**

   To use the specified fonts, add these to your HTML head:

   ```html
   <link rel="preconnect" href="https://fonts.googleapis.com">
   <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
   <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono&family=Outfit:wght@400;500;600&family=Source+Serif+Pro:wght@400;600&display=swap" rel="stylesheet">
   ```

2. **Mobile PDF Viewer Implementation**

   For optimal mobile PDF viewing of letter-size documents:

   ```javascript
   // PDF.js initialization with mobile optimizations
   document.addEventListener("DOMContentLoaded", function() {
     const pdfCanvas = document.getElementById('pdf-canvas');
     const pdfContainer = document.querySelector('.pdf-container');
     
     // Load the PDF
     pdfjsLib.getDocument('document.pdf').promise.then(function(pdf) {
       pdf.getPage(1).then(function(page) {
         // Calculate scale to fit width on mobile
         const viewport = page.getViewport({ scale: 1 });
         const containerWidth = pdfContainer.clientWidth;
         const scale = containerWidth / viewport.width;
         
         // Apply the scale
         const scaledViewport = page.getViewport({ scale: scale });
         
         // Set canvas dimensions
         pdfCanvas.width = scaledViewport.width;
         pdfCanvas.height = scaledViewport.height;
         
         // Render the PDF
         const renderContext = {
           canvasContext: pdfCanvas.getContext('2d'),
           viewport: scaledViewport
         };
         page.render(renderContext);
       });
     });
     
     // Handle pinch-zoom on mobile
     let initialPinchDistance = 0;
     let currentScale = 1;
     
     pdfContainer.addEventListener('touchstart', function(e) {
       if (e.touches.length === 2) {
         initialPinchDistance = getPinchDistance(e);
       }
     });
     
     pdfContainer.addEventListener('touchmove', function(e) {
       if (e.touches.length === 2) {
         const currentDistance = getPinchDistance(e);
         const scaleFactor = currentDistance / initialPinchDistance;
         
         // Apply scaling (limit max/min scale)
         const newScale = Math.min(Math.max(currentScale * scaleFactor, 0.5), 3);
         pdfCanvas.style.transform = `scale(${newScale})`;
       }
     });
     
     pdfContainer.addEventListener('touchend', function(e) {
       if (e.touches.length < 2) {
         currentScale = parseFloat(pdfCanvas.style.transform.replace('scale(', '').replace(')', '') || 1);
       }
     });
     
     function getPinchDistance(e) {
       return Math.hypot(
         e.touches[0].pageX - e.touches[1].pageX,
         e.touches[0].pageY - e.touches[1].pageY
       );
     }
   });
   ```

3. **Form Field Positioning for Letter-Size PDFs**

   Handle form field positioning with this helper function:

   ```javascript
   /**
    * Convert PDF coordinates to screen coordinates for proper field placement
    * 
    * @param {Object} pdfPosition - Position in PDF coordinates (PDF is in points, 1/72 inch)
    * @param {Object} pageViewport - The PDF.js page viewport
    * @returns {Object} Screen coordinates for field positioning
    */
   function pdfToScreenCoordinates(pdfPosition, pageViewport) {
     // Letter size PDF is 8.5 x 11 inches or 612 x 792 points
     const pdfX = pdfPosition.x;
     const pdfY = pdfPosition.y;
     
     // Transform using the viewport transform
     const transform = pageViewport.transform;
     
     // Apply the transform
     const screenX = transform[0] * pdfX + transform[2] * pdfY + transform[4];
     const screenY = transform[1] * pdfX + transform[3] * pdfY + transform[5];
     
     return { x: screenX, y: screenY };
   }
   ```

4. **Fixing iOS Safari Issues**

   For better iOS compatibility, add these styles:

   ```css
   /* Fix for iOS Safari scrolling and positioning issues */
   .pdf-container {
     -webkit-overflow-scrolling: touch;
     position: relative;
   }
   
   /* Fix safe areas for newer iOS devices with notches */
   @supports (padding-bottom: env(safe-area-inset-bottom)) {
     .pb-safe {
       padding-bottom: env(safe-area-inset-bottom);
     }
   }
   
   /* Prevent text size adjustment on rotation */
   html {
     -webkit-text-size-adjust: 100%;
   }
   
   /* Prevent unwanted highlighting on tap */
   .no-tap-highlight {
     -webkit-tap-highlight-color: transparent;
   }
   ```

5. **Advanced Layout Techniques for PDF Viewing**

   Create a responsive layout that adapts to both mobile and desktop:

   ```html
   <div class="document-layout">
     <!-- PDF Navigator - Sidebar on desktop, bottom sheet on mobile -->
     <div class="document-navigator">
       <div class="hidden md:block">
         <!-- Desktop sidebar navigation -->
         <div class="h-full bg-white rounded-lg shadow-lg p-4">
           <h3 class="font-medium text-gray-900 mb-3">Document Pages</h3>
           <div class="space-y-2">
             <!-- Thumbnail navigation would go here -->
             <div class="bg-primary-100 p-2 rounded">Page 1</div>
             <div class="hover:bg-gray-100 p-2 rounded">Page 2</div>
             <div class="hover:bg-gray-100 p-2 rounded">Page 3</div>
           </div>
         </div>
       </div>
       
       <!-- Mobile-only bottom navigator -->
       <div class="md:hidden fixed bottom-0 inset-x-0 bg-white z-30">
         <div class="flex justify-between items-center border-t border-gray-200 px-4 py-3">
           <button class="text-gray-500">
             <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
               <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
             </svg>
           </button>
           <span class="text-sm font-medium">Page 1 of 3</span>
           <button class="text-gray-500">
             <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
               <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
             </svg>
           </button>
         </div>
       </div>
     </div>
     
     <!-- PDF Viewer - Centered and responsive -->
     <div class="document-viewer">
       <div class="pdf-container" style="height: calc(100vh - 120px);">
         <!-- PDF Canvas Centered -->
         <div class="flex justify-center">
           <canvas id="pdf-canvas" class="max-w-full"></canvas>
         </div>
       </div>
     </div>
   </div>
   
   <style>
     @media (min-width: 768px) {
       .document-layout {
         display: grid;
         grid-template-columns: 250px 1fr;
         gap: 1rem;
         height: 100vh;
       }
       
       .document-navigator {
         height: 100%;
         overflow-y: auto;
       }
       
       .document-viewer {
         height: 100%;
         overflow-y: auto;
       }
     }
     
     @media (max-width: 767px) {
       .document-layout {
         display: block;
       }
       
       .document-viewer {
         padding-bottom: 60px; /* Space for bottom navigator */
       }
     }
   </style>
   ```

6. **Document Signature Field Mobile UI**

   Create signature fields that are touch-friendly on mobile:

   ```html
   <!-- Optimized Signature Field for Mobile -->
   <div class="signature-field-container">
     <!-- Large touch target -->
     <button class="signature-field-button">
       <div class="signature-field">
         <div class="signature-placeholder">
           <svg xmlns="http://www.w3.org/2000/svg" class="signature-icon" viewBox="0 0 20 20" fill="currentColor">
             <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
           </svg>
           <span class="signature-text">Tap to sign</span>
         </div>
       </div>
     </button>
   </div>
   
   <style>
     .signature-field-container {
       margin: 1rem 0;
     }
     
     .signature-field-button {
       width: 100%;
       border: none;
       background: transparent;
       padding: 0;
     }
     
     .signature-field {
       border: 2px dashed theme('colors.primary.400');
       background-color: theme('colors.primary.50');
       border-radius: 0.375rem;
       padding: 1.5rem 1rem;
       min-height: 5rem;
       display: flex;
       align-items: center;
       justify-content: center;
     }
     
     .signature-placeholder {
       display: flex;
       flex-direction: column;
       align-items: center;
       color: theme('colors.primary.500');
     }
     
     .signature-icon {
       height: 2rem;
       width: 2rem;
       margin-bottom: 0.5rem;
     }
     
     .signature-text {
       font-size: 0.875rem;
       font-weight: 500;
     }
     
     /* Larger touch targets on mobile */
     @media (max-width: 640px) {
       .signature-field {
         padding: 2rem 1rem;
         min-height: 6rem;
       }
       
       .signature-icon {
         height: 2.5rem;
         width: 2.5rem;
       }
       
       .signature-text {
         font-size: 1rem;
       }
     }
   </style>
   ```

7. **Dark Mode Support**

   Add dark mode support to your design system:

   ```css
   /* Dark mode variables */
   :root {
     color-scheme: light dark;
   }
   
   @media (prefers-color-scheme: dark) {
     :root {
       --color-primary-50: #0c1e34;
       --color-primary-100: #0d2646;
       --color-primary-200: #0f3061;
       --color-primary-300: #104e9c;
       --color-primary-400: #1564c6;
       --color-primary-500: #2779e3;
       --color-primary-600: #5599ed;
       --color-primary-700: #80b2f2;
       --color-primary-800: #adcdf8;
       --color-primary-900: #d6e6fb;
       --color-primary-950: #ebf3fd;
       
       /* Adjust other colors for dark mode */
     }
     
     .bg-white {
       background-color: #1f2937;
     }
     
     .text-gray-900 {
       color: #f9fafb;
     }
     
     .text-gray-700 {
       color: #e5e7eb;
     }
     
     .text-gray-500 {
       color: #9ca3af;
     }
     
     .border-gray-200 {
       border-color: #374151;
     }
     
     /* Invert document colors for better readability */
     .pdf-container canvas {
       filter: invert(0.9) hue-rotate(180deg);
     }
   }
   ```

8. **Document Progress Indicators**

   Create visual indicators for document completion status:

   ```html
   <div class="document-progress">
     <div class="progress-bar-container">
       <div class="progress-steps">
         <div class="progress-step completed">
           <div class="step-circle"></div>
           <div class="step-label">Uploaded</div>
         </div>
         <div class="progress-step completed">
           <div class="step-circle"></div>
           <div class="step-label">Prepared</div>
         </div>
         <div class="progress-step active">
           <div class="step-circle"></div>
           <div class="step-label">Signing</div>
         </div>
         <div class="progress-step">
           <div class="step-circle"></div>
           <div class="step-label">Completed</div>
         </div>
       </div>
       <div class="progress-line"></div>
     </div>
   </div>
   
   <style>
     .document-progress {
       margin: 2rem 0;
     }
     
     .progress-bar-container {
       position: relative;
       padding: 0 1rem;
     }
     
     .progress-steps {
       display: flex;
       justify-content: space-between;
       position: relative;
       z-index: 1;
     }
     
     .progress-step {
       display: flex;
       flex-direction: column;
       align-items: center;
     }
     
     .step-circle {
       width: 24px;
       height: 24px;
       border-radius: 50%;
       background-color: white;
       border: 2px solid theme('colors.gray.300');
       margin-bottom: 0.5rem;
     }
     
     .step-label {
       font-size: 0.75rem;
       color: theme('colors.gray.500');
       white-space: nowrap;
     }
     
     .progress-step.completed .step-circle {
       background-color: theme('colors.success.500');
       border-color: theme('colors.success.500');
     }
     
     .progress-step.completed .step-label {
       color: theme('colors.success.600');
     }
     
     .progress-step.active .step-circle {
       border-color: theme('colors.primary.500');
       border-width: 3px;
     }
     
     .progress-step.active .step-label {
       color: theme('colors.primary.600');
       font-weight: 500;
     }
     
     .progress-line {
       position: absolute;
       top: 12px;
       left: 0;
       right: 0;
       height: 2px;
       background-color: theme('colors.gray.300');
       z-index: 0;
     }
     
     /* Responsive adjustments for mobile */
     @media (max-width: 640px) {
       .step-label {
         display: none;
       }
       
       .progress-step.active .step-label {
         display: block;
         position: absolute;
         top: 30px;
       }
     }
   </style>
   ```

9. **Practical Application in Rails**

   For Rails applications, implement the design system with these approaches:

   ```ruby
   # app/helpers/tailwind_helper.rb
   module TailwindHelper
     def button_classes(variant = :primary, size = :md)
       base_classes = "inline-flex items-center justify-center font-medium transition-colors rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2"
       
       variant_classes = case variant.to_sym
                         when :primary
                           "text-white bg-primary-600 border border-transparent hover:bg-primary-700 focus:ring-primary-500"
                         when :secondary
                           "text-primary-700 bg-primary-100 border border-transparent hover:bg-primary-200 focus:ring-primary-500"
                         when :outline
                           "text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 focus:ring-primary-500"
                         when :danger
                           "text-white bg-error-600 border border-transparent hover:bg-error-700 focus:ring-error-500"
                         else
                           "text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 focus:ring-primary-500"
                         end
       
       size_classes = case size.to_sym
                      when :sm
                        "px-3 py-1.5 text-xs"
                      when :md
                        "px-4 py-2 text-sm"
                      when :lg
                        "px-6 py-3 text-base"
                      else
                        "px-4 py-2 text-sm"
                      end
       
       "#{base_classes} #{variant_classes} #{size_classes}"
     end
     
     def card_classes(padding = true)
       classes = "bg-white rounded-lg shadow overflow-hidden"
       classes += " p-6" if padding
       classes
     end
     
     def form_input_classes
       "block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
     end
   end
   ```

   Usage in ERB templates:

   ```erb
   <!-- app/views/documents/show.html.erb -->
   <div class="<%= card_classes %>">
     <h2 class="text-lg font-medium text-gray-900">Document Details</h2>
     <div class="mt-4">
       <p class="text-sm text-gray-500">Created on <%= @document.created_at.strftime("%B %d, %Y") %></p>
     </div>
     <div class="mt-6">
       <%= link_to "Edit Document", edit_document_path(@document), class: button_classes(:primary) %>
       <%= link_to "Download", document_path(@document, format: :pdf), class: button_classes(:outline) %>
     </div>
   </div>
   ```

10. **Mobile-First Tailwind Utilities**

    Create custom utilities for your mobile PDF experience:

    ```javascript
    // tailwind.config.js
    module.exports = {
      theme: {
        extend: {
          // ... other theme extensions
          
          // Custom utilities for document viewer
          spacing: {
            'safe-bottom': 'env(safe-area-inset-bottom)',
            'document-height': 'calc(100vh - 120px)',
            'letter-width': '8.5in',
            'letter-height': '11in',
          },
          
          // Custom z-index values for layering
          zIndex: {
            'pdf-controls': 10,
            'field-overlay': 20,
            'field': 30,
            'field-selected': 40,
            'modal': 50,
          },
          
          // Custom animation
          animation: {
            'pulse-light': 'pulse-light 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
          },
          keyframes: {
            'pulse-light': {
              '0%, 100%': { opacity: 1 },
              '50%': { opacity: 0.7 },
            },
          },
        },
      },
      plugins: [
        // Custom plugin for document-specific utilities
        function({ addUtilities }) {
          const newUtilities = {
            '.touch-manipulation': {
              'touch-action': 'manipulation',
            },
            '.pdf-fit-width': {
              'max-width': '100%',
              'height': 'auto',
            },
            '.pdf-fit-height': {
              'max-height': '100%',
              'width': 'auto',
            },
            '.prevent-zoom': {
              'touch-action': 'pan-x pan-y',
            },
            '.field-draggable': {
              'cursor': 'move',
              'user-select': 'none',
              'touch-action': 'none',
            },
          }
          
          addUtilities(newUtilities)
        },
      ],
    }
    ```

This design system provides a comprehensive set of components, styles, and utilities that work beautifully on both mobile and desktop while accommodating letter-size PDFs. The vibrant color scheme adds personality while maintaining professionalism, and the mobile-specific enhancements ensure a great experience on smaller screens.
