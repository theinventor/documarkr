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

2-27-25
User Role Permissions:
- Error: "No documents to display. You currently don't have access to create documents."
- Problem: User's role doesn't have document creation permissions
- User roles system:
  ```ruby
  # app/models/user.rb
  enum :role, {
    signer: "signer",    # Default - can only sign documents
    creator: "creator",  # Can create and manage documents
    admin: "admin"       # Full system access
  }, default: "signer"
  
  def can_create_documents?
    creator? || admin?
  end
  ```
- Solution options:
  1. Change current user's role to "creator" in Rails console:
     ```ruby
     user = User.find_by(email: 'user@example.com')
     user.update(role: 'creator')
     ```
  2. Add admin UI for role management
  3. Modify registration to set role to "creator" for new users:
     ```ruby
     # In RegistrationsController
     def create
       super do |user|
         user.update(role: 'creator')
       end
     end
     ```

Dashboard Visibility:
- Documents shown on dashboard are filtered by status:
  - `@active_documents`: status is draft or pending
  - `@completed_documents`: status is completed, declined, or expired
  - `@documents_to_sign`: documents where user is a signer with pending status
- Documents only visible to their creator or signers
- If document missing from dashboard, check:
  1. Document status (must match expected scopes)
  2. Document ownership (current_user must be creator or signer)
  3. Document might be in "documents_to_sign" section if you're a signer

Document Signer Error Fix:
- Error: `undefined method 'humanize' for nil` on documents/show page
- Problem: Some document signers have nil status 
- Root cause: Status was nil for external signers without user accounts
- Implemented fixes:
  1. Immediate view fix: Added nil checks in view
     ```erb
     signer.status&.humanize || 'Pending'
     signer.user&.name || signer.name || 'Unknown'
     ```
  2. Permanent database fix: Created migration that:
     - Updates any existing nil statuses to 'pending'
     - Ensures status column has correct default
     - Makes status column not nullable
     ```ruby
     # Migration: EnsureStatusForDocumentSigners
     execute("UPDATE document_signers SET status = 'pending' WHERE status IS NULL")
     change_column_default :document_signers, :status, "pending"
     change_column_null :document_signers, :status, false, "pending"
     ```

Important notes:
- DocumentSigner can have null user_id (for external signers)
- External signers need proper nil checks in views
- Always use safe navigation (&.) when accessing potentially nil values

2-28-25
Public Signing Controller Implementation:
- Problem: Document signing required authentication, making it difficult for external signers
- Solution: Created a separate unauthenticated controller for public document signing
- Implementation details:
  - Generated `PublicSigningController` with `bin/rails generate controller PublicSigning show sign_complete complete`
  - Added routes for public document signing in `config/routes.rb`:
    ```ruby
    # Public document signing routes (no authentication required)
    get "documents/:id/sign/:token", to: "public_signing#show", as: "public_sign_document"
    post "documents/:id/sign", to: "public_signing#sign_complete", as: "public_sign_complete"
    get "documents/:id/complete", to: "public_signing#complete", as: "public_sign_complete_view"
    post "documents/:id/form_fields/:field_id/complete", to: "public_signing#complete_field", as: "public_complete_field"
    ```
  - Implemented controller methods with `skip_before_action :authenticate_user!`
  - Created views for the signing process:
    - `app/views/public_signing/show.html.erb` - Main signing interface
    - `app/views/public_signing/_signing_modal.html.erb` - Modal for completing fields
    - `app/views/public_signing/sign_complete.html.erb` - Processing page
    - `app/views/public_signing/complete.html.erb` - Completion confirmation
  - Updated `Document#signing_url_for` method to use the new controller
  - Modified JavaScript controllers to work with the new routes

Resend Signing Email Feature:
- Problem: No way to resend signing emails if signers lost or didn't receive them
- Solution: Added "Resend Email" button to document show page
- Implementation details:
  - Added route in `config/routes.rb`:
    ```ruby
    post :resend_signing_email, path: 'signers/:signer_id/resend'
    ```
  - Implemented `resend_signing_email` method in `DocumentsController`:
    ```ruby
    def resend_signing_email
      @document = Document.find(params[:id])
      @document_signer = @document.document_signers.find(params[:signer_id])
      DocumentMailer.signing_request(@document, @document_signer).deliver_later
      @document.log_activity(current_user, "resent_signing_email", request, {
        signer_id: @document_signer.id,
        signer_email: @document_signer.email,
        signer_name: @document_signer.name
      })
      redirect_to document_path(@document), notice: "Signing email has been resent to #{@document_signer.name} (#{@document_signer.email})."
    end
    ```
  - Added "Actions" column to signers table with resend button
  - Button only appears for:
    - Documents with "pending" status
    - Signers who haven't completed signing
    - Current signer or signers who have already viewed the document
    - Each resend is logged in the audit trail for tracking

Signing URL Fix:
- Problem: Email links were using incorrect URL format (not using the public routes)
- Root cause: The `signing_url_for` method was using `url_for` with controller/action instead of the named route helper
- Solution: Updated the method to use the named route helper with proper host and port
  ```ruby
  # Before
  def signing_url_for(signer)
    Rails.application.routes.url_helpers.url_for(
      controller: "public_signing",
      action: "show",
      id: self.id,
      token: signer.token,
      host: Rails.application.config.action_mailer.default_url_options[:host]
    )
  end
  
  # After
  def signing_url_for(signer)
    Rails.application.routes.url_helpers.public_sign_document_url(
      id: self.id,
      token: signer.token,
      host: Rails.application.config.action_mailer.default_url_options[:host],
      port: Rails.application.config.action_mailer.default_url_options[:port]
    )
  end
  ```
- This ensures that emails contain the correct URL format that matches our defined routes

Route Pattern Improvement:
- Problem: Public signing routes were using `/documents/:id/sign/:token` which mixed authenticated and unauthenticated paths
- Solution: Changed public signing routes to use a clearer `/sign/...` pattern
  ```ruby
  # Before
  get "documents/:id/sign/:token", to: "public_signing#show", as: "public_sign_document"
  post "documents/:id/sign", to: "public_signing#sign_complete", as: "public_sign_complete"
  get "documents/:id/complete", to: "public_signing#complete", as: "public_sign_complete_view"
  post "documents/:id/form_fields/:field_id/complete", to: "public_signing#complete_field", as: "public_complete_field"
  
  # After
  get "sign/:id/:token", to: "public_signing#show", as: "public_sign_document"
  post "sign/:id", to: "public_signing#sign_complete", as: "public_sign_complete"
  get "sign/:id/complete", to: "public_signing#complete", as: "public_sign_complete_view"
  post "sign/:id/form_fields/:field_id/complete", to: "public_signing#complete_field", as: "public_complete_field"
  ```
- Updated JavaScript controllers to use the new route pattern
- This creates a clearer separation between authenticated document routes (`/documents/...`) and public signing routes (`/sign/...`)

Checkpoint: Feb 26th, 2025
- You can register and sign up
- You can create documents
- You can upload a PDF and add fields to it
- You can add signers to the document and send them a signing link
- They can click and view the sign page (WIP)

3-1-25
PDF Viewer UI Improvements:
- Problem: PDF viewer only showed one page at a time with Next/Previous buttons
- Solution: Updated PDF viewer to render all pages at once vertically
- Implementation details:
  - Modified `pdf_viewer_controller.js`:
    - Added `renderAllPages()` method to render all pages vertically
    - Set initial scale to exactly 100% by default
    - Modified zoom functionality to apply to all pages
    - Kept legacy navigation methods for compatibility
  - Updated the signing view:
    - Removed pagination controls
    - Updated toolbar to show total page count
  - Enhanced field positioning:
    - Updated field_signing_controller.js to position fields on multiple pages
    - Added updateFieldPositions() method to calculate absolute positions
    - Added event listeners for scale changes and PDF loading
  - Added CSS for multi-page layout:
    - Created pdf-pages-container styles
    - Updated form-field classes for positioning in multi-page view
    - Added transition states for fields (hidden until positioned)
- Key files changed:
  - app/javascript/controllers/pdf_viewer_controller.js
  - app/javascript/controllers/field_signing_controller.js
  - app/views/public_signing/show.html.erb
  - app/assets/stylesheets/app.css

Checkpoint: March 1st, 2025
- PDF signing view shows all pages vertically at 100% zoom
- Form fields are positioned correctly on each page
- Fields become visible only after being positioned correctly
- Zoom controls work for all pages simultaneously

3-2-25
PDF Viewer Bug Fixes:
- Problem: Error loading document with "this.updatePageCount is not a function"
- Root cause: Missing method in pdf_viewer_controller.js
- Solution: Added updatePageCount method to update the page count display
- Additional fix: Corrected pdfjsLib reference in loadDocument method
- Key files changed:
  - app/javascript/controllers/pdf_viewer_controller.js

Checkpoint: March 2nd, 2025
- PDF viewer loads documents without errors
- All pages display vertically at 100% zoom
- Form fields are correctly positioned on each page

3-3-25
PDF Viewer and Field Positioning Improvements:
- Problem: Zoom only affecting first page and fields not showing at all
- Solution: Implemented proper zoom handling for multi-page view
- Implementation details:
  - Updated pdf_viewer_controller.js:
    - Fixed scaleValueChanged to re-render all pages when scale changes
    - Added Promise.all to ensure all pages are rendered before triggering events
    - Improved position preservation during zoom
    - Added more detailed event data for scale change events
  - Updated field_signing_controller.js:
    - Improved field positioning system with robust page-relative coordinates
    - Added event listeners for scale changes with proper binding
    - Added additional logging for better troubleshooting
    - Added failsafe timer for field positioning
  - Enhanced CSS styling:
    - Made fields initially invisible until properly positioned
    - Added 'positioned' class to show fields after correct positioning
    - Improved visual styling of form fields
- Key files changed:
  - app/javascript/controllers/pdf_viewer_controller.js
  - app/javascript/controllers/field_signing_controller.js
  - app/assets/stylesheets/app.css

3-4-25
Controller Error Fixes:
- Problem: Browser console showed multiple errors related to missing targets and canvas sizing
- Root causes:
  1. Missing `container` target in field_signing_controller.js
  2. Canvas size errors in signature_pad_controller.js causing "Failed to execute 'getImageData'" errors
  3. DOM structure issues in the field container layout
- Solutions:
  1. Fixed field_signing_controller.js:
     - Added safety checks for the missing container target
     - Improved error handling in the updateFieldPositions method
     - Fixed event handling to avoid errors when targets are missing
  2. Fixed signature_pad_controller.js:
     - Added minimum size settings for the canvas (300×150)
     - Added delay to initialize canvas after container is ready
     - Added try/catch blocks to prevent errors from crashing the application
     - Fixed canvas resize logic to handle zero-dimension cases
  3. Updated view template:
     - Fixed container positioning to ensure form fields layer covers the whole document
     - Improved positioning of the container target elements
     - Updated CSS for better container visibility
- Key files changed:
  - app/javascript/controllers/field_signing_controller.js
  - app/javascript/controllers/signature_pad_controller.js
  - app/views/public_signing/show.html.erb

Checkpoint: March 4th, 2025
- Browser console errors eliminated
- Signature pad initializes properly with correct dimensions
- Form fields positioned correctly with proper error handling
- Improved reliability of the multi-page PDF view

3-5-25
Multi-Page Zoom Fix:
- Problem: Zoom functionality only affected the first page
- Root cause: Issues in pdf_viewer_controller.js with how zoom was applied across pages
- Solution: Comprehensive update to zoom functionality
  - Fixed scaleValueChanged method to properly re-render all pages
  - Improved page rendering to handle multi-page layout
  - Updated event dispatching order to ensure fields are repositioned after zoom
  - Modified field positioning logic to scale field dimensions with page zoom
  - Enhanced CSS to better handle field visibility during zoom operations
- Key files changed:
  - app/javascript/controllers/pdf_viewer_controller.js
  - app/javascript/controllers/field_signing_controller.js
  - app/assets/stylesheets/app.css

Checkpoint: March 5th, 2025
- Zoom functionality now works correctly across all pages
- Form fields maintain proper positioning and scaling when zooming
- Page navigation and field positioning in multi-page view is fully functional
- Fixed CSS styling for better field visibility and user experience


2/27/2025
- have signing working, and pdf making working
- the pdf is ugly, the meta annotations are really ugly too
- TODO: make each field type a separate function so they can fine-tune the appearance of each field type without LLM breaking the others with each edit.