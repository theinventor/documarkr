# Internal DocuSign Clone Specification
## For Rails 8 with Hotwire Implementation

## Table of Contents
1. [System Overview](#system-overview)
2. [Tech Stack](#tech-stack)
3. [User Roles & Permissions](#user-roles--permissions)
4. [Database Schema](#database-schema)
5. [Core Features](#core-features)
6. [User Interface & Workflows](#user-interface--workflows)
7. [PDF Handling](#pdf-handling)
8. [Security Considerations](#security-considerations)
9. [Implementation Roadmap](#implementation-roadmap)
10. [Testing Strategy](#testing-strategy)

## System Overview

This system is an internal enterprise solution for electronic document signing, similar to DocuSign but with a focused feature set. The application will allow users to upload PDF documents, place signature fields and other form elements on them, route to multiple signers, track signing metadata, and generate final signed PDFs with audit trails.

### Key Requirements
- Upload and process PDF documents
- Place text boxes, date fields, initials, and signature fields on PDFs
- Send documents to multiple signers with configurable signing order
- Track metadata (IP, email, timestamp, user agent) for audit purposes
- Allow users to draw or adopt signatures
- Generate finalized PDFs with signatures and optional metadata certification page

## Tech Stack

### Backend
- Ruby on Rails 8
- PostgreSQL database
- Active Storage for file management
- Sidekiq for background processing (document preparation, email notifications)
- HexaPDF for server-side PDF manipulation

### Frontend
- Rails views with Hotwire (Turbo + Stimulus)
- PDF.js for client-side PDF rendering
- Fabric.js for signature/drawing capabilities
- Stimulus controllers for JavaScript behavior

### Key Gems
- Devise for authentication
- CanCanCan for authorization
- HexaPDF for PDF manipulation
- Rails Mailer for notifications
- ActionText for rich text editing (email templates)

## User Roles & Permissions

### Admin
- Manage users and organization settings
- View all documents in the system
- Access audit logs and reports
- Configure system defaults

### Document Creator
- Upload documents
- Create templates
- Set up signature fields
- Send documents for signature
- Monitor document status
- Access documents they've created

### Signer
- View documents sent to them for signature
- Sign documents
- Download signed documents
- Delegate signing to another person (optional feature)

## Database Schema

### Users
```ruby
create_table "users", force: :cascade do |t|
  t.string "email", null: false
  t.string "encrypted_password", null: false
  t.string "first_name"
  t.string "last_name"
  t.string "role", default: "signer"
  t.string "reset_password_token"
  t.datetime "reset_password_sent_at"
  t.datetime "remember_created_at"
  t.string "confirmation_token"
  t.datetime "confirmed_at"
  t.datetime "confirmation_sent_at"
  t.string "unconfirmed_email"
  t.timestamps
  t.index ["email"], name: "index_users_on_email", unique: true
  t.index ["reset_password_token"], name: "index_users_on_reset_password_token", unique: true
end
```

### Documents
```ruby
create_table "documents", force: :cascade do |t|
  t.string "title", null: false
  t.text "message"
  t.integer "status", default: 0
  t.references "creator", null: false, foreign_key: { to_table: :users }
  t.datetime "completed_at"
  t.timestamps
  t.index ["status"], name: "index_documents_on_status"
end
```

### Document Signers
```ruby
create_table "document_signers", force: :cascade do |t|
  t.references "document", null: false, foreign_key: true
  t.references "user", null: false, foreign_key: true
  t.integer "order", default: 0
  t.integer "status", default: 0
  t.datetime "viewed_at"
  t.datetime "signed_at"
  t.string "ip_address"
  t.string "user_agent"
  t.timestamps
  t.index ["document_id", "order"], name: "index_document_signers_on_document_id_and_order"
end
```

### Form Fields
```ruby
create_table "form_fields", force: :cascade do |t|
  t.references "document", null: false, foreign_key: true
  t.references "document_signer", null: false, foreign_key: true
  t.string "field_type", null: false  # signature, initials, text, date
  t.integer "page_number", null: false
  t.float "x_position", null: false
  t.float "y_position", null: false
  t.float "width", null: false
  t.float "height", null: false
  t.text "value"  # stores the completed field value (e.g., signature image data)
  t.boolean "required", default: true
  t.timestamps
end
```

### Signatures
```ruby
create_table "signatures", force: :cascade do |t|
  t.references "user", null: false, foreign_key: true
  t.text "signature_data"  # Base64 encoded signature image
  t.boolean "is_default", default: false
  t.timestamps
end
```

### Audit Logs
```ruby
create_table "audit_logs", force: :cascade do |t|
  t.references "document", null: false, foreign_key: true
  t.references "user", null: false, foreign_key: true
  t.string "action", null: false  # created, viewed, signed, etc.
  t.string "ip_address"
  t.string "user_agent"
  t.text "metadata"  # JSON field for additional metadata
  t.timestamps
end
```

## Core Features

### Document Management
- Upload PDF documents via drag-and-drop or file picker
- Preview uploaded documents
- Add/edit document title and message to signers
- Copy existing documents to create new ones
- Organize documents by status (draft, sent, completed, declined)
- Document templates for frequently used forms

### Field Placement
- Visual PDF viewer with annotation capabilities
- Ability to place different field types on document:
  - Signature fields
  - Initial fields
  - Text fields
  - Date fields
- Assign fields to specific signers
- Set fields as required or optional
- Drag-and-drop positioning and resizing of fields

### Signing Process
- Sequential or parallel signing workflow options
- Email notifications for pending signatures
- Secure signing links
- Mobile-friendly signing experience
- Draw signature with mouse/touchscreen
- Type signature and select font style
- Upload signature image
- Save signature for future use
- Verification step before submission

### Security & Audit
- Record IP address, timestamp, email, and user agent for each action
- Generate audit trails for document history
- Protect document access with authentication
- Option to require email verification before signing
- Tamper-evident final documents
- Final PDF with certification page showing all metadata

## User Interface & Workflows

### Dashboard
- Overview of documents by status
- Action items (documents requiring attention)
- Recent activity log
- Quick links to create new documents

### Document Preparation Flow
1. **Upload Phase**
   - Upload PDF document
   - Set document title and optional message
   - Select signers from contacts or add new signers

2. **Design Phase**
   - PDF preview with page navigation
   - Sidebar with field types to drag onto document
   - Ability to assign fields to specific signers
   - Set signing order (sequential/parallel)

3. **Review & Send Phase**
   - Preview document with all fields
   - Review signing order and recipient information
   - Add custom email message
   - Send for signatures or save as draft

### Signing Flow
1. **Authentication**
   - Receive email with secure link
   - Verify identity (email verification, access code)

2. **Document Review**
   - View entire document
   - See which fields require completion

3. **Field Completion**
   - Navigate through required fields
   - Draw/select/upload signature
   - Complete all assigned fields

4. **Submission**
   - Review completed document
   - Submit signed document
   - Receive confirmation and download options

### Admin Interface
- User management
- Document oversight
- Template management
- System settings
- Activity logs and reports

## PDF Handling

### Client-Side (PDF.js + Fabric.js)
- Render PDF pages in the browser
- Convert PDF coordinates to screen coordinates
- Handle field placement via Fabric.js canvas overlays
- Enable drawing capabilities for signatures
- Preview finalized document with signatures

### Server-Side (HexaPDF)
- Process uploaded PDFs
- Generate thumbnails for document preview
- Create final PDF with embedded signatures
- Add metadata certification page
- Ensure document integrity
- Generate secure download links

### Field Rendering
- Use PDF.js to render the document
- Overlay Fabric.js canvas for interactive elements
- Store field positions relative to PDF coordinates
- Handle responsive scaling for different screen sizes

### Signature Capture
- Canvas-based drawing interface with Fabric.js
- Signature styling options (pen color, thickness)
- Type-to-sign with font selection
- Image upload processing
- Signature storage as SVG or PNG data

## Security Considerations

### Authentication & Authorization
- Secure login system with Devise
- Role-based access control with CanCanCan
- Temporary access links for external signers
- Session timeouts and security headers

### Document Security
- Encrypted storage of documents
- Secure viewing mechanisms (prevent downloads unless authorized)
- Digital fingerprinting of completed documents
- Tamper-evident final PDFs

### Data Protection
- Secure storage of signature data
- Encryption of sensitive metadata
- Compliance with data retention policies
- Option for document expiration

### Audit Trails
- Comprehensive logging of all actions
- Immutable audit records
- Detailed signature metadata
- Cryptographic verification options

## Implementation Roadmap

### Phase 1: Core Infrastructure (Weeks 1-2)
- Set up Rails 8 project with PostgreSQL
- Implement Devise for authentication
- Configure Active Storage for file uploads
- Create basic models and database schema
- Set up basic testing framework

### Phase 2: Document Management (Weeks 3-4)
- Implement document upload functionality
- Create PDF viewer with PDF.js
- Build document dashboard
- Implement basic document routing

### Phase 3: Form Fields & Design (Weeks 5-6)
- Implement field placement interface
- Create field types (signature, text, date, initials)
- Build field assignment to signers
- Develop document preview functionality

### Phase 4: Signing Process (Weeks 7-8)
- Develop signature capture with Fabric.js
- Implement signing workflow
- Create email notification system
- Build signature verification process

### Phase 5: Finalization & Security (Weeks 9-10)
- Implement final PDF generation
- Create audit trail and metadata page
- Enhance security features
- Develop tamper-evident mechanisms

### Phase 6: Testing & Refinement (Weeks 11-12)
- Comprehensive testing
- UI/UX refinement
- Performance optimization
- Security auditing

## Testing Strategy

### Unit Tests
- Model validations and relationships
- Service objects and business logic
- PDF manipulation functions

### Integration Tests
- Document upload and processing
- Field placement and positioning
- Signing workflows
- PDF generation

### End-to-End Tests
- Complete document lifecycle
- Multiple signer scenarios
- Edge cases for field placement
- Mobile device compatibility

### Security Testing
- Authentication mechanisms
- Authorization checks
- PDF security features
- Audit trail validation

## Development Guidelines

### Code Organization
- Follow Rails conventions for MVC
- Use service objects for complex business logic
- Organize Stimulus controllers by feature
- Keep PDF manipulation code in dedicated services

### Stimulus Controller Structure
```javascript
// app/javascript/controllers/pdf_viewer_controller.js
import { Controller } from "@hotwired/stimulus"
import { pdfjs } from "pdf-lib"

export default class extends Controller {
  static targets = ["container", "page", "canvas"]
  
  connect() {
    // Initialize PDF.js
    pdfjs.GlobalWorkerOptions.workerSrc = '/path/to/pdf.worker.js'
    this.loadDocument()
  }
  
  loadDocument() {
    // Load and render PDF
  }
  
  // Additional methods for PDF manipulation
}
```

### Key Stimulus Controllers
- `pdf_viewer_controller.js` - Handles PDF rendering and navigation
- `field_placement_controller.js` - Manages field positioning
- `signature_pad_controller.js` - Handles signature drawing
- `document_form_controller.js` - Manages document form submission

### Error Handling
- Comprehensive error handling for PDF operations
- Graceful fallbacks for unsupported browsers
- Clear error messages for users
- Detailed logging for debugging

## Deployment Considerations

### Environment Configuration
- Properly configured production environment
- Background job processing with Sidekiq
- PDF.js worker configuration
- Storage solution for documents (S3 recommended)

### Performance Optimization
- PDF rendering optimization
- Asynchronous processing for large documents
- Caching strategies for document previews
- Database indexing for frequent queries

### Scaling Considerations
- Horizontal scaling capability
- Database connection pooling
- Background job distribution
- File storage scaling strategy

### Monitoring
- Application performance monitoring
- Error tracking and reporting
- User activity analytics
- System health dashboards
