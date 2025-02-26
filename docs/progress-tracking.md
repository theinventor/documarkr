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

