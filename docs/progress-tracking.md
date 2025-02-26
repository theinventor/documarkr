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

