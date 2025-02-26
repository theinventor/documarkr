2-25-25
Initial scaffold of the app

2-26-25
PDF Viewer Zoom Fix:
- Problem: Inconsistent zoom levels when navigating pages
- Solution: Standardized zoom behavior
  - Start at exactly 100% (was fit-width)
  - 15% zoom increments (was 25%/20%)
  - Added 100% as explicit stopping point
- Key files:
  - app/javascript/controllers/pdf_viewer_controller.js
    - renderPage() - Sets initial scale
    - zoom button handlers - Control increment size
  - app/javascript/controllers/field_placement_controller.js
    - Works with PDF viewer to scale form fields

Important controllers:
- pdf_viewer_controller.js: Core PDF rendering
- field_placement_controller.js: Form field positioning/creation
- field_signing_controller.js: Field completion during signing
- signature_pad_controller.js: Signature creation UI

Critical interactions:
- PDF scale changes trigger "pdf-viewer:scaleChanged" event
- Field elements use percentage positioning for responsive layout
- Fields visibility controlled by page_number property

