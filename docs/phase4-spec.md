## Deployment Considerations

### Configuration for Production

When deploying the signing functionality to production, consider these important settings:

1. **Email Configuration**:
   ```ruby
   # config/environments/production.rb
   config.action_mailer.delivery_method = :smtp
   config.action_mailer.smtp_settings = {
     address:              ENV['SMTP_SERVER'],
     port:                 ENV['SMTP_PORT'],
     domain:               ENV['SMTP_DOMAIN'],
     user_name:            ENV['SMTP_USERNAME'],
     password:             ENV['SMTP_PASSWORD'],
     authentication:       'plain',
     enable_starttls_auto: true
   }
   config.action_mailer.default_url_options = { host: ENV['APPLICATION_HOST'] }
   ```

2. **Background Jobs**:
   ```ruby
   # config/environments/production.rb
   config.active_job.queue_adapter = :sidekiq
   ```

3. **PDF Rendering**:
   - Ensure HexaPDF and required fonts are properly installed
   - Consider caching rendered PDFs for performance
   - Monitor memory usage for large document processing

4. **Security Considerations**:
   - Use SSL/TLS for all communications
   - Set appropriate Content-Security-Policy headers
   - Implement rate limiting on authentication attempts
   - Log all signature activity for audit purposes

### Optimizing Performance

1. **Signature Rendering**:
   - Use client-side caching for signature images
   - Consider using WebP format for signature storage
   - Implement lazy loading for saved signatures

2. **PDF Handling**:
   - Optimize PDF rendering with appropriate memory settings
   - Consider splitting large PDFs into smaller chunks for rendering
   - Implement progressive loading for multi-page documents

3. **Background Job Processing**:
   - Configure proper concurrency for Sidekiq workers
   - Set appropriate timeouts for PDF generation jobs
   - Implement retry mechanisms for failed signature processing

## Additional Features to Consider

### Sequential vs. Parallel Signing

You can extend the current implementation to support both sequential and parallel signing workflows:

```ruby
# Add to Document model
def sequential_signing?
  signing_mode == 'sequential'
end

def parallel_signing?
  signing_mode == 'parallel'
end

def notify_signers
  if sequential_signing?
    notify_next_signer
  else
    notify_all_signers
  end
end

def notify_all_signers
  document_signers.draft.each do |signer|
    signer.mark_as_pending!
    SigningRequestMailer.signing_request(signer).deliver_later
  end
end
```

### Document Expiration

Add automatic expiration for documents that haven't been signed:

```ruby
# Add to Document model
def expire_if_needed
  if pending? && created_at < 30.days.ago
    update(status: :expired)
    document_signers.pending.update_all(status: :expired)
    DocumentExpirationMailer.document_expired(self).deliver_later
  end
end
```

Create a background job to check for expired documents:

```ruby
# app/jobs/check_document_expiration_job.rb
class CheckDocumentExpirationJob < ApplicationJob
  queue_as :default
  
  def perform
    Document.pending.where('created_at < ?', 30.days.ago).find_each do |document|
      document.expire_if_needed
    end
  end
end
```

Schedule this job to run daily:

```ruby
# config/initializers/sidekiq.rb
Sidekiq::Cron::Job.create(
  name: 'Check document expiration - daily',
  cron: '0 0 * * *',
  class: 'CheckDocumentExpirationJob'
)
```

### Custom Signing Order

Extend the current implementation to allow reordering of signers:

```ruby
# Add to DocumentEditorController
def reorder_signers
  @document = Document.find(params[:document_id])
  
  # Ensure we have a valid order of signer IDs
  signer_ids = params[:signer_ids].map(&:to_i)
  
  # Verify all signers belong to this document
  if @document.document_signers.pluck(:id).sort == signer_ids.sort
    # Update order for each signer
    signer_ids.each_with_index do |id, index|
      @document.document_signers.find(id).update(order: index + 1)
    end
    
    render json: { success: true }
  else
    render json: { success: false, error: "Invalid signer order" }, status: :unprocessable_entity
  end
end
```

## Conclusion

This completes the implementation of the signing process for the DocuSign clone. The system now provides:

1. Secure authentication for signers
2. Signature capture with drawing, typing, and uploading options
3. Multiple field types (signature, initials, text, date)
4. Complete signing workflow with verification
5. Email notifications for document status updates
6. Comprehensive audit trail with metadata

Following this guide, a junior developer should be able to implement a fully functional electronic signing system that meets the basic requirements of the project. The system can be extended with additional features as needed, such as more advanced field types, templates, or integration with other services.

Remember that electronic signature solutions may have legal and compliance requirements depending on your jurisdiction. Be sure to consult legal experts to ensure your implementation meets the necessary standards for your specific use case.## Deployment Considerations

### Configuration for Production

When deploying the signing functionality to production, consider these important settings:

1. **Email Configuration**:
   ```ruby
   # config/environments/production.rb
   config.action_mailer.delivery_method = :smtp
   config.action_mailer.smtp_settings = {
     address:              ENV['SMTP_SERVER'],
     port:                 ENV['SMTP_PORT'],
     domain:               ENV['SMTP_DOMAIN'],
     user_name:            ENV['SMTP_USERNAME'],
     password:             ENV['SMTP_PASSWORD'],
     authentication:       'plain',
     enable_starttls_auto: true
   }
   config.action_mailer.default_url_options = { host: ENV['APPLICATION_HOST'] }
   ```

2. **Background Jobs**:
   ```ruby
   # config/environments/production.rb
   config.active_job.queue_adapter = :sidekiq
   ```

3. **PDF Rendering**:
   - Ensure HexaPDF and required fonts are properly installed
   - Consider caching rendered PDFs for performance
   - Monitor memory usage for large document processing

4. **Security Considerations**:
   - Use SSL/TLS for all communications
   - Set appropriate Content-Security-Policy headers
   - Implement rate limiting on authentication attempts
   - Log all signature activity for audit purposes

### Optimizing Performance

1. **Signature Rendering**:
   - Use client-side caching for signature images
   - Consider using WebP format for signature storage
   - Implement lazy loading for saved signatures

2. **PDF Handling**:
   - Optimize PDF rendering with appropriate memory settings
   - Consider splitting large PDFs into smaller chunks for rendering
   - Implement progressive loading for multi-page documents

3. **Background Job Processing**:
   - Configure proper concurrency for Sidekiq workers
   - Set appropriate timeouts for PDF generation jobs
   - Implement retry mechanisms for failed signature processing

## Additional Features to Consider

### Sequential vs. Parallel Signing

You can extend the current implementation to support both sequential and parallel signing workflows:

```ruby
# Add to Document model
def sequential_signing?
  signing_mode == 'sequential'
end

def parallel_signing?
  signing_mode == 'parallel'
end

def notify_signers
  if sequential_signing?
    notify_next_signer
  else
    notify_all_signers
  end
end

def notify_all_signers
  document_signers.draft.each do |signer|
    signer.mark_as_pending!
    SigningRequestMailer.signing_request(signer).deliver_later
  end
end
```

### Document Expiration

Add automatic expiration for documents that haven't been signed:

```ruby
# Add to Document model
def expire_if_needed
  if pending? && created_at < 30.days.ago
    update(status: :expired)
    document_signers.pending.update_all(status: :expired)
    DocumentExpirationMailer.document_expired(self).deliver_later
  end
end
```

Create a background job to check for expired documents:

```ruby
# app/jobs/check_document_expiration_job.rb
class CheckDocumentExpirationJob < ApplicationJob
  queue_as :default
  
  def perform
    Document.pending.where('created_at < ?', 30.days.ago).find_each do |document|
      document.expire_if_needed
    end
  end
end
```

Schedule this job to run daily:

```ruby
# config/initializers/sidekiq.rb
Sidekiq::Cron::Job.create(
  name: 'Check document expiration - daily',
  cron: '0 0 * * *',
  class: 'CheckDocumentExpirationJob'
)
```

### Custom Signing Order

Extend the current implementation to allow reordering of signers:

```ruby
# Add to DocumentEditorController
def reorder_signers
  @document = Document.find(params[:document_id])
  
  # Ensure we have a valid order of signer IDs
  signer_ids = params[:signer_ids].map(&:to_i)
  
  # Verify all signers belong to this document
  if @document.document_signers.pluck(:id).sort == signer_ids.sort
    # Update order for each signer
    signer_ids.each_with_index do |id, index|
      @document.document_signers.find(id).update(order: index + 1)
    end
    
    render json: { success: true }
  else
    render json: { success: false, error: "Invalid signer order" }, status: :unprocessable_entity
  end
end
```

## Conclusion

This completes the implementation of the signing process for the DocuSign clone. The system now provides:

1. Secure authentication for signers
2. Signature capture with drawing, typing, and uploading options
3. Multiple field types (signature, initials, text, date)
4. Complete signing workflow with verification
5. Email notifications for document status updates
6. Comprehensive audit trail with metadata

Following this guide, a junior developer should be able to implement a fully functional electronic signing system that meets the basic requirements of the project. The system can be extended with additional features as needed, such as more advanced field types, templates, or integration with other services.

Remember that electronic signature solutions may have legal and compliance requirements depending on your jurisdiction. Be sure to consult legal experts to ensure your implementation meets the necessary standards for your specific use case.# Phase 4: Signing Process Implementation Guide

This guide provides detailed implementation instructions for Phase 4 of the DocuSign clone, focusing on the signing process. It includes all necessary code, commands, and explanations for implementing the signature capture, signing workflow, and verification processes.

## Table of Contents
1. [Setup Prerequisites](#setup-prerequisites)
2. [Database Updates](#database-updates)
3. [Signing Authentication](#signing-authentication)
4. [Signature Capture Implementation](#signature-capture-implementation)
5. [Signing Workflow](#signing-workflow)
6. [Email Notifications](#email-notifications)
7. [Audit Trail Implementation](#audit-trail-implementation)
8. [Signature Completion and Next Steps](#signature-completion-and-next-steps)
9. [Testing](#testing)

## Setup Prerequisites

Ensure you have completed Phase 3 and have the following in place:
- Form Field model and Document Editor functionality
- Document Signer model with appropriate statuses
- Basic email configuration for mailers
- PDF.js and Fabric.js installed

Install additional required gems:

```ruby
# Gemfile (additions)
gem 'jwt'                  # For secure signing tokens
gem 'color-generator'      # For unique signer colors
gem 'browser'              # For user agent parsing
gem 'geocoder'             # For IP address location (optional)
```

Run bundle install:

```bash
bundle install
```

## Database Updates

### Add Signature Model

```bash
rails generate model Signature user:references signature_data:text is_default:boolean style:string
```

Update the migration for the Signature model:

```ruby
# db/migrate/TIMESTAMP_create_signatures.rb
class CreateSignatures < ActiveRecord::Migration[8.0]
  def change
    create_table :signatures do |t|
      t.references :user, null: false, foreign_key: true
      t.text :signature_data, null: false
      t.boolean :is_default, default: false
      t.string :style, default: 'drawn'
      t.timestamps
    end
    
    add_index :signatures, [:user_id, :is_default]
  end
end
```

### Update the Document Signer model

```bash
rails generate migration AddSigningDetailsToDocumentSigners signing_token:string token_expires_at:datetime signing_url:string completed_redirect_url:string decline_reason:text
```

Update the migration:

```ruby
# db/migrate/TIMESTAMP_add_signing_details_to_document_signers.rb
class AddSigningDetailsToDocumentSigners < ActiveRecord::Migration[8.0]
  def change
    add_column :document_signers, :signing_token, :string
    add_column :document_signers, :token_expires_at, :datetime
    add_column :document_signers, :signing_url, :string
    add_column :document_signers, :completed_redirect_url, :string
    add_column :document_signers, :decline_reason, :text
    
    add_index :document_signers, :signing_token, unique: true
  end
end
```

Run migrations:

```bash
rails db:migrate
```

## Signing Authentication

### Generate Secure Tokens

Update the Document Signer model to handle secure token generation:

```ruby
# app/models/document_signer.rb (additions)
class DocumentSigner < ApplicationRecord
  # Add to existing code
  
  before_create :generate_signing_token
  
  def generate_signing_url(host)
    return nil unless signing_token.present?
    
    Rails.application.routes.url_helpers.sign_document_url(
      token: signing_token,
      host: host
    )
  end
  
  def token_valid?
    signing_token.present? && token_expires_at.present? && token_expires_at > Time.current
  end
  
  def regenerate_token!
    generate_signing_token
    save
  end
  
  private
  
  def generate_signing_token
    self.signing_token = SecureRandom.urlsafe_base64(32)
    self.token_expires_at = 30.days.from_now
  end
end
```

### Create Signing Controller

```bash
rails generate controller Signing show authenticate verify complete decline
```

Implement the controller:

```ruby
# app/controllers/signing_controller.rb
class SigningController < ApplicationController
  skip_before_action :authenticate_user!, only: [:show, :authenticate, :verify, :complete, :decline]
  before_action :set_document_signer, only: [:show, :authenticate, :verify, :complete, :decline]
  before_action :ensure_token_valid, only: [:show, :authenticate]
  before_action :ensure_signer_pending, only: [:verify, :complete, :decline]
  
  def show
    session[:signer_token] = params[:token]
    
    # If user is already authenticated, proceed to signing
    if authenticate_signer
      redirect_to verify_signing_path
    else
      # Otherwise, show authentication form
      render :authenticate
    end
  end
  
  def authenticate
    # Simple email verification as authentication
    if params[:email].present? && params[:email].downcase == @document_signer.email.downcase
      # Set session to mark as authenticated
      session[:authenticated_signer_id] = @document_signer.id
      
      # Log activity
      @document_signer.document.log_activity(@document_signer.user, 'authenticated', request)
      
      redirect_to verify_signing_path
    else
      flash.now[:alert] = "Email address doesn't match our records. Please try again."
      render :authenticate
    end
  end
  
  def verify
    # Check if all required fields are complete
    @document = @document_signer.document
    
    # Get fields for this signer
    @fields = @document_signer.form_fields.includes(:document).order(:page_number, :tab_order)
    
    # Group fields by page for easy navigation
    @fields_by_page = @fields.group_by(&:page_number)
    @pages = @fields_by_page.keys.sort
    
    # Get existing signatures for this user
    @user = @document_signer.user
    @saved_signatures = @user.signatures.order(created_at: :desc)
    
    # Log activity
    @document.log_activity(@user, 'viewed for signing', request)
  end
  
  def complete
    @document = @document_signer.document
    
    # Validate all required fields are filled
    if params[:fields].present?
      all_valid = true
      
      params[:fields].each do |field_id, value|
        field = @document_signer.form_fields.find(field_id)
        
        # Skip if field doesn't belong to this signer
        next unless field
        
        # Store field value
        field.value = value
        all_valid = false unless field.save
      end
      
      if all_valid
        # Mark signer as completed
        @document_signer.update(
          status: :completed,
          signed_at: Time.current,
          ip_address: request.remote_ip,
          user_agent: request.user_agent
        )
        
        # Log activity
        @document.log_activity(@document_signer.user, 'signed', request)
        
        # Check if all signers have completed
        if @document.document_signers.where(status: :pending).none?
          # Generate final document
          GenerateFinalDocumentJob.perform_later(@document.id)
          
          # Mark document as completed
          @document.update(
            status: :completed,
            completed_at: Time.current
          )
          
          # Notify document creator
          DocumentCompletionMailer.document_completed(@document).deliver_later
        else
          # Notify next signer if using sequential signing
          next_signer = @document.document_signers.where(status: :draft).order(:order).first
          
          if next_signer
            next_signer.update(status: :pending)
            
            # Send email to next signer
            SigningRequestMailer.signing_request(next_signer).deliver_later
          end
        end
        
        flash[:success] = "Thank you! You have successfully signed the document."
        redirect_to thank_you_signing_path
      else
        flash[:error] = "There was a problem saving your signature. Please try again."
        redirect_to verify_signing_path
      end
    else
      flash[:error] = "Please complete all required fields."
      redirect_to verify_signing_path
    end
  end
  
  def decline
    @document = @document_signer.document
    
    if params[:decline_reason].present?
      # Mark signer as declined
      @document_signer.update(
        status: :declined,
        decline_reason: params[:decline_reason],
        signed_at: Time.current,
        ip_address: request.remote_ip,
        user_agent: request.user_agent
      )
      
      # Log activity
      @document.log_activity(@document_signer.user, 'declined', request)
      
      # Notify document creator
      DocumentCompletionMailer.document_declined(@document, @document_signer).deliver_later
      
      flash[:notice] = "You have declined to sign this document."
      redirect_to thank_you_signing_path(declined: true)
    else
      flash[:error] = "Please provide a reason for declining."
      redirect_to verify_signing_path
    end
  end
  
  def thank_you
    @declined = params[:declined].present?
  end
  
  private
  
  def set_document_signer
    token = params[:token] || session[:signer_token]
    
    @document_signer = DocumentSigner.find_by(signing_token: token)
    
    unless @document_signer
      flash[:error] = "Invalid or expired signing link."
      redirect_to root_path
    end
  end
  
  def ensure_token_valid
    unless @document_signer.token_valid?
      flash[:error] = "This signing link has expired."
      redirect_to root_path
    end
  end
  
  def ensure_signer_pending
    unless authenticate_signer && @document_signer.pending?
      flash[:error] = "You don't have permission to sign this document."
      redirect_to root_path
    end
  end
  
  def authenticate_signer
    if session[:authenticated_signer_id] == @document_signer.id
      true
    else
      false
    end
  end
end
```

### Update Routes

Add routes for the signing process:

```ruby
# config/routes.rb (additions)
Rails.application.routes.draw do
  # ... existing routes
  
  # Signing routes
  get 'sign/:token', to: 'signing#show', as: :sign_document
  post 'sign/:token/authenticate', to: 'signing#authenticate', as: :authenticate_signing
  get 'sign/verify', to: 'signing#verify', as: :verify_signing
  post 'sign/complete', to: 'signing#complete', as: :complete_signing
  post 'sign/decline', to: 'signing#decline', as: :decline_signing
  get 'sign/thank-you', to: 'signing#thank_you', as: :thank_you_signing
end
```

## Signature Capture Implementation

### Create Signature Model

Update the Signature model:

```ruby
# app/models/signature.rb
class Signature < ApplicationRecord
  belongs_to :user
  
  validates :signature_data, presence: true
  validates :style, inclusion: { in: ['drawn', 'typed', 'uploaded'] }
  
  scope :default_first, -> { order(is_default: :desc, created_at: :desc) }
  
  before_save :ensure_only_one_default
  
  def make_default!
    user.signatures.where.not(id: id).update_all(is_default: false)
    update(is_default: true)
  end
  
  def display_name
    created_at_str = created_at.strftime("%b %d, %Y")
    "#{style.humanize} signature (#{created_at_str})"
  end
  
  private
  
  def ensure_only_one_default
    if is_default?
      user.signatures.where.not(id: id).update_all(is_default: false)
    end
  end
end
```

### Add Signatures Controller

```bash
rails generate controller Signatures create manage delete make_default
```

Implement the controller:

```ruby
# app/controllers/signatures_controller.rb
class SignaturesController < ApplicationController
  before_action :authenticate_user!
  before_action :set_signature, only: [:delete, :make_default]
  
  def create
    @signature = current_user.signatures.new(signature_params)
    
    if @signature.save
      # Make this signature default if it's the user's first signature
      @signature.make_default! if current_user.signatures.count == 1
      
      respond_to do |format|
        format.html { redirect_to manage_signatures_path, notice: 'Signature saved successfully.' }
        format.json { render json: { success: true, signature: @signature } }
      end
    else
      respond_to do |format|
        format.html { redirect_to manage_signatures_path, alert: 'Could not save signature.' }
        format.json { render json: { success: false, errors: @signature.errors.full_messages } }
      end
    end
  end
  
  def manage
    @signatures = current_user.signatures.default_first
    @new_signature = current_user.signatures.new
  end
  
  def delete
    @signature.destroy
    
    # If we deleted the default signature, make another one default
    if @signature.is_default? && current_user.signatures.any?
      current_user.signatures.first.make_default!
    end
    
    respond_to do |format|
      format.html { redirect_to manage_signatures_path, notice: 'Signature deleted.' }
      format.json { render json: { success: true } }
    end
  end
  
  def make_default
    @signature.make_default!
    
    respond_to do |format|
      format.html { redirect_to manage_signatures_path, notice: 'Default signature updated.' }
      format.json { render json: { success: true } }
    end
  end
  
  private
  
  def set_signature
    @signature = current_user.signatures.find(params[:id])
  end
  
  def signature_params
    params.require(:signature).permit(:signature_data, :style)
  end
end
```

Update routes for signatures:

```ruby
# config/routes.rb (additions)
resources :signatures, only: [:create] do
  collection do
    get :manage
  end
  
  member do
    delete :delete
    post :make_default
  end
end
```

### Create Signature Pad Stimulus Controller

```bash
rails generate stimulus signature_pad
```

Implement the controller:

```javascript
// app/javascript/controllers/signature_pad_controller.js
import { Controller } from "@hotwired/stimulus"
import { fabric } from "fabric"

export default class extends Controller {
  static targets = [
    "canvas", "dataField", "clearButton", "saveButton", 
    "typeOption", "drawOption", "typeInput", "fontSelect", 
    "uploadOption", "uploadInput", "styleField"
  ]
  
  static values = {
    width: { type: Number, default: 400 },
    height: { type: Number, default: 150 },
    strokeWidth: { type: Number, default: 3 },
    strokeColor: { type: String, default: "#000000" },
    backgroundColor: { type: String, default: "#FFFFFF" },
    readOnly: { type: Boolean, default: false },
    currentMode: { type: String, default: "draw" }
  }
  
  connect() {
    this.initializeCanvas()
    this.setCurrentMode(this.currentModeValue)
  }
  
  disconnect() {
    if (this.canvas) {
      this.canvas.dispose()
    }
  }
  
  initializeCanvas() {
    // Create the canvas
    this.canvas = new fabric.Canvas(this.canvasTarget, {
      isDrawingMode: true,
      width: this.widthValue,
      height: this.heightValue,
      backgroundColor: this.backgroundColorValue
    })
    
    // Configure the brush
    this.canvas.freeDrawingBrush.width = this.strokeWidthValue
    this.canvas.freeDrawingBrush.color = this.strokeColorValue
    
    // Set canvas to read-only if specified
    if (this.readOnlyValue) {
      this.disableDrawing()
    }
    
    // Update data field when canvas changes
    this.canvas.on('path:created', this.updateDataField.bind(this))
    this.canvas.on('object:modified', this.updateDataField.bind(this))
    this.canvas.on('object:added', this.updateDataField.bind(this))
    this.canvas.on('object:removed', this.updateDataField.bind(this))
  }
  
  updateDataField() {
    // Convert canvas to data URL and store in hidden field
    if (this.hasDataFieldTarget) {
      const dataUrl = this.canvas.toDataURL('image/png')
      this.dataFieldTarget.value = dataUrl
    }
  }
  
  clear() {
    this.canvas.clear()
    this.canvas.backgroundColor = this.backgroundColorValue
    this.canvas.renderAll()
    
    if (this.hasDataFieldTarget) {
      this.dataFieldTarget.value = ''
    }
  }
  
  setCurrentMode(mode) {
    this.currentModeValue = mode
    
    // Update style field
    if (this.hasStyleFieldTarget) {
      this.styleFieldTarget.value = mode
    }
    
    // Clear any existing signature
    this.clear()
    
    // Reset UI
    if (this.hasDrawOptionTarget) this.drawOptionTarget.classList.remove('active')
    if (this.hasTypeOptionTarget) this.typeOptionTarget.classList.remove('active')
    if (this.hasUploadOptionTarget) this.uploadOptionTarget.classList.remove('active')
    
    if (this.hasTypeInputTarget) this.typeInputTarget.classList.add('d-none')
    if (this.hasFontSelectTarget) this.fontSelectTarget.classList.add('d-none')
    if (this.hasUploadInputTarget) this.uploadInputTarget.classList.add('d-none')
    
    // Enable specific mode
    switch (mode) {
      case 'draw':
        this.enableDrawingMode()
        if (this.hasDrawOptionTarget) this.drawOptionTarget.classList.add('active')
        break
      case 'type':
        this.enableTypingMode()
        if (this.hasTypeOptionTarget) this.typeOptionTarget.classList.add('active')
        if (this.hasTypeInputTarget) this.typeInputTarget.classList.remove('d-none')
        if (this.hasFontSelectTarget) this.fontSelectTarget.classList.remove('d-none')
        break
      case 'upload':
        this.enableUploadMode()
        if (this.hasUploadOptionTarget) this.uploadOptionTarget.classList.add('active')
        if (this.hasUploadInputTarget) this.uploadInputTarget.classList.remove('d-none')
        break
    }
  }
  
  enableDrawingMode() {
    this.canvas.isDrawingMode = true
    this.canvas.selection = false
  }
  
  enableTypingMode() {
    this.canvas.isDrawingMode = false
    this.canvas.selection = true
    
    // Focus the text input
    if (this.hasTypeInputTarget) {
      setTimeout(() => this.typeInputTarget.focus(), 100)
    }
  }
  
  enableUploadMode() {
    this.canvas.isDrawingMode = false
    this.canvas.selection = true
  }
  
  switchToDraw() {
    this.setCurrentMode('draw')
  }
  
  switchToType() {
    this.setCurrentMode('type')
  }
  
  switchToUpload() {
    this.setCurrentMode('upload')
  }
  
  updateTypedSignature() {
    if (!this.hasTypeInputTarget || !this.hasFontSelectTarget) return
    
    const text = this.typeInputTarget.value.trim()
    if (!text) return
    
    // Clear canvas
    this.canvas.clear()
    this.canvas.backgroundColor = this.backgroundColorValue
    
    // Add text object
    const selectedFont = this.fontSelectTarget.value
    const textOptions = {
      fontFamily: selectedFont,
      left: 20,
      top: this.heightValue / 2,
      fontSize: 40,
      fill: this.strokeColorValue
    }
    
    const textObj = new fabric.Text(text, textOptions)
    
    // Scale text to fit within canvas
    const scaleFactor = Math.min(
      (this.widthValue - 40) / textObj.width,
      1
    )
    
    textObj.scaleX = scaleFactor
    textObj.scaleY = scaleFactor
    
    this.canvas.add(textObj)
    this.canvas.renderAll()
    this.updateDataField()
  }
  
  handleUpload(event) {
    const file = event.target.files[0]
    if (!file) return
    
    // Check file type
    if (!file.type.match('image.*')) {
      alert('Please select an image file')
      return
    }
    
    const reader = new FileReader()
    
    reader.onload = (e) => {
      const imgData = e.target.result
      
      fabric.Image.fromURL(imgData, (img) => {
        // Clear canvas
        this.canvas.clear()
        this.canvas.backgroundColor = this.backgroundColorValue
        
        // Calculate scale to fit within canvas while maintaining aspect ratio
        const scaleFactor = Math.min(
          this.widthValue / img.width,
          this.heightValue / img.height
        )
        
        img.scaleX = scaleFactor
        img.scaleY = scaleFactor
        
        // Center the image
        img.left = (this.widthValue - img.width * scaleFactor) / 2
        img.top = (this.heightValue - img.height * scaleFactor) / 2
        
        this.canvas.add(img)
        this.canvas.renderAll()
        this.updateDataField()
      })
    }
    
    reader.readAsDataURL(file)
  }
  
  loadSignature(event) {
    const signatureData = event.currentTarget.dataset.signatureData
    
    if (signatureData) {
      fabric.Image.fromURL(signatureData, (img) => {
        // Clear canvas
        this.canvas.clear()
        this.canvas.backgroundColor = this.backgroundColorValue
        
        // Calculate scale to fit within canvas while maintaining aspect ratio
        const scaleFactor = Math.min(
          this.widthValue / img.width,
          this.heightValue / img.height
        )
        
        img.scaleX = scaleFactor
        img.scaleY = scaleFactor
        
        // Center the image
        img.left = (this.widthValue - img.width * scaleFactor) / 2
        img.top = (this.heightValue - img.height * scaleFactor) / 2
        
        this.canvas.add(img)
        this.canvas.renderAll()
        this.updateDataField()
      })
    }
  }
  
  disableDrawing() {
    this.canvas.isDrawingMode = false
    this.canvas.selection = false
    this.canvas.forEachObject(obj => {
      obj.selectable = false
      obj.evented = false
    })
  }
}
```

## Signing Workflow

### Signing Authentication View

```erb
<!-- app/views/signing/authenticate.html.erb -->
<div class="container py-5">
  <div class="row justify-content-center">
    <div class="col-md-8 col-lg-6">
      <div class="card shadow">
        <div class="card-header bg-primary text-white py-3">
          <h1 class="h4 mb-0">Verify your identity</h1>
        </div>
        
        <div class="card-body p-4">
          <p class="mb-4">
            You've been invited to sign <strong><%= @document_signer.document.title %></strong>.
            Please verify your identity to continue.
          </p>
          
          <%= form_with url: authenticate_signing_path(token: @document_signer.signing_token), 
                        method: :post, local: true, 
                        class: "needs-validation", novalidate: true do |f| %>
            
            <div class="mb-3">
              <label for="email" class="form-label">Email Address</label>
              <div class="input-group">
                <span class="input-group-text">
                  <i class="bi bi-envelope"></i>
                </span>
                <%= f.email_field :email, class: "form-control", 
                                  placeholder: "Enter your email address", required: true,
                                  value: @document_signer.email %>
              </div>
              <div class="form-text">
                Please enter the email address that was used to send you this signing request.
              </div>
            </div>
            
            <div class="d-grid">
              <%= f.submit "Continue to Document", class: "btn btn-primary btn-lg" %>
            </div>
          <% end %>
        </div>
      </div>
    </div>
  </div>
</div>
```

### Signing Verification View

```erb
<!-- app/views/signing/verify.html.erb -->
<div class="container-fluid" data-controller="document-signing" 
     data-document-signing-document-id-value="<%= @document.id %>"
     data-document-signing-signer-id-value="<%= @document_signer.id %>">
  <div class="row g-0">
    <!-- Left panel: Document & Fields -->
    <div class="col-md-8 vh-100 d-flex flex-column">
      <!-- Header -->
      <div class="bg-light p-3 border-bottom d-flex justify-content-between align-items-center">
        <div>
          <h1 class="h4 mb-0"><%= @document.title %></h1>
          <p class="text-muted mb-0 small">
            From: <%= @document.creator.name %> • 
            Pages: <span data-document-signing-target="currentPage">1</span>/<span data-document-signing-target="pageCount">-</span>
          </p>
        </div>
        
        <div class="btn-group">
          <button class="btn btn-sm btn-outline-secondary" 
                  data-action="click->document-signing#prevPage" 
                  data-document-signing-target="prevButton">
            <i class="bi bi-chevron-left"></i> Previous
          </button>
          <button class="btn btn-sm btn-outline-secondary" 
                  data-action="click->document-signing#nextPage" 
                  data-document-signing-target="nextButton">
            Next <i class="bi bi-chevron-right"></i>
          </button>
        </div>
      </div>
      
      <!-- Document Viewer -->
      <div class="flex-grow-1 position-relative overflow-auto">
        <div class="pdf-container d-flex justify-content-center p-3" 
             data-document-signing-target="pdfContainer">
          <!-- PDF will be rendered here -->
          <canvas data-document-signing-target="pdfCanvas"></canvas>
          
          <!-- Field overlay -->
          <div class="field-overlay position-absolute top-0 start-0" 
               data-document-signing-target="fieldOverlay"></div>
        </div>
      </div>
      
      <!-- Footer with progress -->
      <div class="bg-light p-3 border-top">
        <div class="d-flex justify-content-between align-items-center">
          <button class="btn btn-sm btn-outline-danger" 
                  data-bs-toggle="modal" data-bs-target="#declineModal">
            Decline to Sign
          </button>
          
          <div class="progress flex-grow-1 mx-3" style="height: 10px;">
            <div class="progress-bar bg-success" role="progressbar" 
                 style="width: 0%" 
                 data-document-signing-target="progressBar"></div>
          </div>
          
          <button class="btn btn-success" 
                  data-action="click->document-signing#submitSignature" 
                  data-document-signing-target="submitButton">
            Complete Signing
          </button>
        </div>
      </div>
    </div>
    
    <!-- Right panel: Signing Info -->
    <div class="col-md-4 vh-100 overflow-auto border-start">
      <div class="p-3">
        <div class="alert alert-info mb-4">
          <h4 class="alert-heading"><i class="bi bi-info-circle"></i> Signing Instructions</h4>
          <p>Please complete all required fields in the document. You can navigate through pages using the buttons at the top.</p>
          <p class="mb-0">Once all fields are completed, click "Complete Signing" to finalize your signature.</p>
        </div>
        
        <!-- Current Field -->
        <div class="card mb-4 d-none" data-document-signing-target="fieldCard">
          <div class="card-header">
            <h2 class="h5 mb-0">
              <span data-document-signing-target="fieldLabel">Complete this field</span>
              <span class="badge bg-danger ms-2" data-document-signing-target="requiredBadge">Required</span>
            </h2>
          </div>
          <div class="card-body">
            <!-- Field Input (dynamic based on field type) -->
            <div data-document-signing-target="fieldInput"></div>
            
            <!-- Signature Pad (for signature/initials fields) -->
            <div data-document-signing-target="signaturePad" class="d-none">
              <div class="mb-3">
                <div class="btn-group w-100" role="group" data-controller="signature-pad" 
                     data-signature-pad-current-mode-value="draw">
                  <!-- Signature type tabs -->
                  <button type="button" class="btn btn-outline-primary active" 
                          data-signature-pad-target="drawOption" 
                          data-action="click->signature-pad#switchToDraw">
                    <i class="bi bi-pen"></i> Draw
                  </button>
                  <button type="button" class="btn btn-outline-primary" 
                          data-signature-pad-target="typeOption" 
                          data-action="click->signature-pad#switchToType">
                    <i class="bi bi-keyboard"></i> Type
                  </button>
                  <button type="button" class="btn btn-outline-primary" 
                          data-signature-pad-target="uploadOption" 
                          data-action="click->signature-pad#switchToUpload">
                    <i class="bi bi-upload"></i> Upload
                  </button>
                </div>
                
                <!-- Draw signature -->
                <div class="border rounded p-2 bg-white text-center my-3">
                  <canvas data-signature-pad-target="canvas"></canvas>
                </div>
                
                <!-- Type signature -->
                <div class="d-none" data-signature-pad-target="typeInput">
                  <div class="mb-2">
                    <label class="form-label">Type your signature</label>
                    <input type="text" class="form-control" placeholder="Your name" 
                           data-action="input->signature-pad#updateTypedSignature">
                  </div>
                  <div class="mb-2">
                    <label class="form-label">Select font style</label>
                    <select class="form-select" data-signature-pad-target="fontSelect" 
                            data-action="change->signature-pad#updateTypedSignature">
                      <option value="'Dancing Script', cursive">Signature</option>
                      <option value="'Homemade Apple', cursive">Handwritten</option>
                      <option value="Arial, sans-serif">Simple</option>
                      <option value="'Times New Roman', serif">Formal</option>
                    </select>
                  </div>
                </div>
                
                <!-- Upload signature -->
                <div class="d-none" data-signature-pad-target="uploadInput">
                  <div class="mb-2">
                    <label class="form-label">Upload signature image</label>
                    <input type="file" class="form-control" accept="image/*" 
                           data-action="change->signature-pad#handleUpload">
                  </div>
                </div>
                
                <!-- Saved signatures -->
                <div class="mb-2">
                  <label class="form-label d-flex justify-content-between align-items-center">
                    <span>Your saved signatures</span>
                    <button type="button" class="btn btn-sm btn-outline-secondary" 
                            data-bs-toggle="modal" data-bs-target="#manageSignaturesModal">
                      Manage
                    </button>
                  </label>
                  
                  <div class="row g-2">
                    <% @saved_signatures.each do |signature| %>
                      <div class="col-6">
                        <button type="button" class="btn btn-outline-secondary w-100 h-100 p-2" 
                                data-action="click->signature-pad#loadSignature" 
                                data-signature-data="<%= signature.signature_data %>">
                          <img src="<%= signature.signature_data %>" alt="Saved signature" 
                               class="img-fluid" style="max-height: 50px;">
                        </button>
                      </div>
                    <% end %>
                    
                    <% if @saved_signatures.empty? %>
                      <div class="col-12">
                        <div class="border rounded p-3 text-center text-muted">
                          No saved signatures yet
                        </div>
                      </div>
                    <% end %>
                  </div>
                </div>
                
                <div class="d-flex justify-content-between">
                  <button type="button" class="btn btn-outline-secondary" 
                          data-signature-pad-target="clearButton" 
                          data-action="click->signature-pad#clear">
                    Clear
                  </button>
                  <button type="button" class="btn btn-primary" 
                          data-action="click->document-signing#applySignature">
                    Apply
                  </button>
                </div>
                
                <!-- Hidden fields for signature data -->
                <input type="hidden" data-signature-pad-target="dataField" 
                       data-document-signing-target="signatureData">
                <input type="hidden" data-signature-pad-target="styleField" value="draw">
              </div>
            </div>
            
            <!-- Text Field Input -->
            <div data-document-signing-target="textInput" class="d-none">
              <div class="mb-3">
                <label class="form-label">Enter text</label>
                <input type="text" class="form-control" 
                       data-document-signing-target="textInputField">
              </div>
              <div class="d-flex justify-content-end">
                <button type="button" class="btn btn-primary" 
                        data-action="click->document-signing#applyText">
                  Apply
                </button>
              </div>
            </div>
            
            <!-- Date Field Input -->
            <div data-document-signing-target="dateInput" class="d-none">
              <div class="mb-3">
                <label class="form-label">Select date</label>
                <input type="date" class="form-control" 
                       data-document-signing-target="dateInputField" 
                       value="<%= Date.current.to_s %>">
              </div>
              <div class="d-flex justify-content-end">
                <button type="button" class="btn btn-primary" 
                        data-action="click->document-signing#applyDate">
                  Apply
                </button>
              </div>
            </div>
          </div>
        </div>
        
        <!-- Field List (summary of all fields) -->
        <div class="card">
          <div class="card-header">
            <h2 class="h5 mb-0">Fields to Complete</h2>
          </div>
          <div class="card-body p-0">
            <ul class="list-group list-group-flush" data-document-signing-target="fieldList">
              <% @fields.each do |field| %>
                <li class="list-group-item d-flex justify-content-between align-items-center" 
                    data-field-id="<%= field.id %>" 
                    data-document-signing-target="fieldListItem"
                    data-action="click->document-signing#goToField">
                  <div class="d-flex align-items-center">
                    <i class="bi bi-<%= field.field_icon %> me-2"></i>
                    <span><%= field.label.present? ? field.label : field.field_type.humanize %></span>
                    <% if field.required? %>
                      <span class="badge bg-danger ms-2">Required</span>
                    <% end %>
                  </div>
                  <span class="badge bg-secondary" data-document-signing-target="fieldStatus" 
                        data-field-id="<%= field.id %>">
                    Pending
                  </span>
                </li>
              <% end %>
            </ul>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>

<!-- Decline Modal -->
<div class="modal fade" id="declineModal" tabindex="-1" aria-labelledby="declineModalLabel" aria-hidden="true">
  <div class="modal-dialog">
    <div class="modal-content">
      <div class="modal-header">
        <h5 class="modal-title" id="declineModalLabel">Decline to Sign</h5>
        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
      </div>
      <div class="modal-body">
        <%= form_with url: decline_signing_path, method: :post, local: true do |f| %>
          <div class="mb-3">
            <label for="decline_reason" class="form-label">Reason for declining</label>
            <%= f.text_area :decline_reason, class: "form-control", rows: 4, required: true %>
          </div>
          <div class="d-grid">
            <%= f.submit "Confirm Decline", class: "btn btn-danger" %>
          </div>
        <% end %>
      </div>
    </div>
  </div>
</div>

<!-- Manage Signatures Modal -->
<div class="modal fade" id="manageSignaturesModal" tabindex="-1" aria-labelledby="manageSignaturesModalLabel" aria-hidden="true">
  <div class="modal-dialog modal-lg">
    <div class="modal-content">
      <div class="modal-header">
        <h5 class="modal-title" id="manageSignaturesModalLabel">Manage Your Signatures</h5>
        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
      </div>
      <div class="modal-body">
        <div class="row">
          <div class="col-md-6">
            <h6>Create New Signature</h6>
            <div data-controller="signature-pad" 
                 data-signature-pad-current-mode-value="draw">
              <!-- Signature type tabs -->
              <div class="btn-group w-100 mb-2" role="group">
                <button type="button" class="btn btn-outline-primary active" 
                        data-signature-pad-target="drawOption" 
                        data-action="click->signature-pad#switchToDraw">
                  <i class="bi bi-pen"></i> Draw
                </button>
                <button type="button" class="btn btn-outline-primary" 
                        data-signature-pad-target="typeOption" 
                        data-action="click->signature-pad#switchToType">
                  <i class="bi bi-keyboard"></i> Type
                </button>
                <button type="button" class="btn btn-outline-primary" 
                        data-signature-pad-target="uploadOption" 
                        data-action="click->signature-pad#switchToUpload">
                  <i class="bi bi-upload"></i> Upload
                </button>
              </div>
              
              <!-- Draw signature -->
              <div class="border rounded p-2 bg-white text-center mb-3">
                <canvas data-signature-pad-target="canvas"></canvas>
              </div>
              
              <!-- Type signature -->
              <div class="d-none" data-signature-pad-target="typeInput">
                <div class="mb-2">
                  <label class="form-label">Type your signature</label>
                  <input type="text" class="form-control" placeholder="Your name" 
                         data-action="input->signature-pad#updateTypedSignature">
                </div>
                <div class="mb-2">
                  <label class="form-label">Select font style</label>
                  <select class="form-select" data-signature-pad-target="fontSelect" 
                          data-action="change->signature-pad#updateTypedSignature">
                    <option value="'Dancing Script', cursive">Signature</option>
                    <option value="'Homemade Apple', cursive">Handwritten</option>
                    <option value="Arial, sans-serif">Simple</option>
                    <option value="'Times New Roman', serif">Formal</option>
                  </select>
                </div>
              </div>
              
              <!-- Upload signature -->
              <div class="d-none" data-signature-pad-target="uploadInput">
                <div class="mb-2">
                  <label class="form-label">Upload signature image</label>
                  <input type="file" class="form-control" accept="image/*" 
                         data-action="change->signature-pad#handleUpload">
                </div>
              </div>
              
              <!-- Form to save signature -->
              <%= form_with url: signatures_path, method: :post, data: { turbo: false } do |f| %>
                <%= f.hidden_field :signature_data, data: { signature_pad_target: "dataField" } %>
                <%= f.hidden_field :style, data: { signature_pad_target: "styleField" } %>
                
                <div class="d-flex justify-content-between">
                  <button type="button" class="btn btn-outline-secondary" 
                          data-signature-pad-target="clearButton" 
                          data-action="click->signature-pad#clear">
                    Clear
                  </button>
                  <%= f.submit "Save Signature", class: "btn btn-primary",
                              data: { signature_pad_target: "saveButton" } %>
                </div>
              <% end %>
            </div>
          </div>
          
          <div class="col-md-6">
            <h6>Your Saved Signatures</h6>
            <% if @saved_signatures.any? %>
              <div class="list-group">
                <% @saved_signatures.each do |signature| %>
                  <div class="list-group-item d-flex justify-content-between align-items-center">
                    <div>
                      <img src="<%= signature.signature_data %>" alt="Saved signature" 
                           style="max-height: 40px;">
                      <small class="d-block text-muted">
                        <%= signature.display_name %>
                        <% if signature.is_default? %>
                          <span class="badge bg-success">Default</span>
                        <% end %>
                      </small>
                    </div>
                    <div class="btn-group">
                      <% unless signature.is_default? %>
                        <%= button_to make_default_signature_path(signature), method: :post, 
                                     class: "btn btn-sm btn-outline-success", 
                                     form: { data: { turbo: false } } do %>
                          Make Default
                        <% end %>
                      <% end %>
                      
                      <%= button_to delete_signature_path(signature), method: :delete, 
                                   class: "btn btn-sm btn-outline-danger", 
                                   form: { data: { turbo: false } } do %>
                        <i class="bi bi-trash"></i>
                      <% end %>
                    </div>
                  </div>
                <% end %>
              </div>
            <% else %>
              <div class="alert alert-info">
                No saved signatures yet. Create your first signature to save it.
              </div>
            <% end %>
          </div>
        </div>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
      </div>
    </div>
  </div>
</div>

<!-- Hidden Form for Submitting All Field Values -->
<%= form_with url: complete_signing_path, method: :post, data: { document_signing_target: "submitForm" } do |f| %>
  <!-- Hidden fields will be added here dynamically -->
<% end %>
```

### Document Signing Stimulus Controller

```bash
rails generate stimulus document_signing
```

```javascript
// app/javascript/controllers/document_signing_controller.js
import { Controller } from "@hotwired/stimulus"
import * as pdfjs from "pdfjs-dist"

// Set worker path
pdfjs.GlobalWorkerOptions.workerSrc = 
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js"

export default class extends Controller {
  static targets = [
    "pdfContainer", "pdfCanvas", "fieldOverlay", "currentPage", "pageCount", 
    "prevButton", "nextButton", "fieldList", "fieldListItem", "fieldStatus",
    "progressBar", "fieldCard", "fieldLabel", "requiredBadge", "fieldInput",
    "signaturePad", "textInput", "dateInput", "submitForm", "submitButton",
    "signatureData", "textInputField", "dateInputField"
  ]
  
  static values = {
    documentId: String,
    signerId: String,
    canvasScale: { type: Number, default: 1.5 },
    currentPage: { type: Number, default: 1 },
    completedFields: { type: Array, default: [] },
    activeFieldId: String
  }
  
  connect() {
    this.pdfDoc = null
    this.pageRendering = false
    this.pageNumPending = null
    this.fields = []
    this.fieldsByPage = {}
    
    this.initPdf()
    
    // Track window resize for field positioning
    window.addEventListener('resize', this.handleResize.bind(this))
  }
  
  disconnect() {
    window.removeEventListener('resize', this.handleResize.bind(this))
  }
  
  async initPdf() {
    try {
      // Fetch document info and fields
      const response = await fetch(`/documents/${this.documentIdValue}.json`)
      const data = await response.json()
      
      // Load PDF
      this.loadPdf(data.document.pdf_url)
      
      // Set page count
      this.pageCountTarget.textContent = data.document.page_count
      
      // Get all fields for this signer
      this.fields = data.fields.filter(field => 
        field.document_signer_id === parseInt(this.signerIdValue)
      )
      
      // Group fields by page
      this.fieldsByPage = this.fields.reduce((acc, field) => {
        if (!acc[field.page_number]) {
          acc[field.page_number] = []
        }
        acc[field.page_number].push(field)
        return acc
      }, {})
      
      // Find the first page with fields
      if (Object.keys(this.fieldsByPage).length > 0) {
        const firstPage = Math.min(...Object.keys(this.fieldsByPage).map(p => parseInt(p)))
        if (firstPage !== this.currentPageValue) {
          this.currentPageValue = firstPage
        }
      }
      
      // Update field list status
      this.updateFieldListStatus()
    } catch (error) {
      console.error("Error initializing document:", error)
    }
  }
  
  loadPdf(url) {
    pdfjs.getDocument(url).promise.then(pdfDoc => {
      this.pdfDoc = pdfDoc
      this.renderPage(this.currentPageValue)
    }).catch(error => {
      console.error("Error loading PDF:", error)
    })
  }
  
  renderPage(num) {
    this.pageRendering = true
    
    this.pdfDoc.getPage(num).then(page => {
      const viewport = page.getViewport({ scale: this.canvasScaleValue })
      this.pdfCanvasTarget.height = viewport.height
      this.pdfCanvasTarget.width = viewport.width
      
      const renderContext = {
        canvasContext: this.pdfCanvasTarget.getContext('2d'),
        viewport: viewport
      }
      
      const renderTask = page.render(renderContext)
      
      renderTask.promise.then(() => {
        this.pageRendering = false
        
        if (this.pageNumPending !== null) {
          this.renderPage(this.pageNumPending)
          this.pageNumPending = null
        }
        
        this.currentPageTarget.textContent = num
        this.updateButtonStates()
        
        // Adjust field overlay size to match canvas
        this.syncFieldOverlaySize()
        
        // Render fields for this page
        this.renderFields(num)
      })
    })
  }
  
  syncFieldOverlaySize() {
    const canvas = this.pdfCanvasTarget
    this.fieldOverlayTarget.style.width = `${canvas.width}px`
    this.fieldOverlayTarget.style.height = `${canvas.height}px`
  }
  
  renderFields(pageNum) {
    // Clear existing field elements
    this.fieldOverlayTarget.innerHTML = ''
    
    // Get fields for current page
    const fields = this.fieldsByPage[pageNum] || []
    
    // Render each field
    fields.forEach(field => {
      this.createFieldElement(field)
    })
  }
  
  createFieldElement(field) {
    const fieldEl = document.createElement('div')
    fieldEl.className = 'document-field signing'
    fieldEl.dataset.fieldId = field.id
    fieldEl.dataset.fieldType = field.field_type
    
    // Position the field
    fieldEl.style.left = `${field.x_position}px`
    fieldEl.style.top = `${field.y_position}px`
    fieldEl.style.width = `${field.width}px`
    fieldEl.style.height = `${field.height}px`
    
    // Set status
    const isCompleted = this.completedFieldsValue.includes(field.id.toString())
    if (isCompleted) {
      fieldEl.classList.add('completed')
    } else {
      fieldEl.classList.add('empty')
    }
    
    // Add field label
    const label = document.createElement('div')
    label.className = 'field-label'
    label.textContent = field.label || field.field_type.charAt(0).toUpperCase() + field.field_type.slice(1)
    fieldEl.appendChild(label)
    
    // If the field has a value (is completed), display it
    if (field.value) {
      this.displayFieldValue(fieldEl, field)
      
      // Mark as completed if not already
      if (!isCompleted) {
        this.completedFieldsValue = [...this.completedFieldsValue, field.id.toString()]
      }
    }
    
    // Add click event listener
    fieldEl.addEventListener('click', () => {
      this.showFieldInput(field)
    })
    
    // Add to overlay
    this.fieldOverlayTarget.appendChild(fieldEl)
    
    return fieldEl
  }
  
  displayFieldValue(fieldEl, field) {
    if (field.field_type === 'signature' || field.field_type === 'initials') {
      // For signature fields, display the signature image
      const img = document.createElement('img')
      img.src = field.value
      img.className = 'w-100 h-100'
      img.style.objectFit = 'contain'
      fieldEl.appendChild(img)
    } else if (field.field_type === 'text') {
      // For text fields, display the text
      const text = document.createElement('div')
      text.className = 'w-100 h-100 d-flex align-items-center justify-content-center'
      text.textContent = field.value
      fieldEl.appendChild(text)
    } else if (field.field_type === 'date') {
      // For date fields, display formatted date
      const text = document.createElement('div')
      text.className = 'w-100 h-100 d-flex align-items-center justify-content-center'
      text.textContent = field.value
      fieldEl.appendChild(text)
    }
  }
  
  showFieldInput(field) {
    // Set active field ID
    this.activeFieldIdValue = field.id.toString()
    
    // Show field card
    this.fieldCardTarget.classList.remove('d-none')
    
    // Set field label
    this.fieldLabelTarget.textContent = field.label || 
                                        field.field_type.charAt(0).toUpperCase() + 
                                        field.field_type.slice(1)
    
    // Set required badge visibility
    if (field.required) {
      this.requiredBadgeTarget.classList.remove('d-none')
    } else {
      this.requiredBadgeTarget.classList.add('d-none')
    }
    
    // Hide all input types
    this.signaturePadTarget.classList.add('d-none')
    this.textInputTarget.classList.add('d-none')
    this.dateInputTarget.classList.add('d-none')
    
    // Show the appropriate input based on field type
    if (field.field_type === 'signature' || field.field_type === 'initials') {
      this.signaturePadTarget.classList.remove('d-none')
      
      // If the field already has a value, load it
      if (field.value) {
        // We need to wait for the signature pad to initialize
        setTimeout(() => {
          const event = new CustomEvent('loadSignature', {
            detail: { signatureData: field.value }
          })
          this.signatureDataTarget.dispatchEvent(event)
        }, 100)
      }
    } else if (field.field_type === 'text') {
      this.textInputTarget.classList.remove('d-none')
      this.textInputFieldTarget.value = field.value || ''
    } else if (field.field_type === 'date') {
      this.dateInputTarget.classList.remove('d-none')
      this.dateInputFieldTarget.value = field.value || new Date().toISOString().split('T')[0]
    }
    
    // Scroll field into view if needed
    const fieldElement = this.fieldOverlayTarget.querySelector(
      `.document-field[data-field-id="${field.id}"]`
    )
    
    if (fieldElement) {
      fieldElement.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }
  
  applySignature() {
    if (!this.activeFieldIdValue) return
    
    const signatureData = this.signatureDataTarget.value
    
    if (!signatureData) {
      alert('Please draw or select a signature before applying.')
      return
    }
    
    // Find the active field
    const field = this.fields.find(f => f.id.toString() === this.activeFieldIdValue)
    if (!field) return
    
    // Update the field value
    field.value = signatureData
    
    // Mark as completed
    if (!this.completedFieldsValue.includes(this.activeFieldIdValue)) {
      this.completedFieldsValue = [...this.completedFieldsValue, this.activeFieldIdValue]
    }
    
    // Update the field element
    const fieldElement = this.fieldOverlayTarget.querySelector(
      `.document-field[data-field-id="${field.id}"]`
    )
    
    if (fieldElement) {
      // Clear existing content
      while (fieldElement.childNodes.length > 1) {
        fieldElement.removeChild(fieldElement.lastChild)
      }
      
      // Add signature image
      this.displayFieldValue(fieldElement, field)
      
      // Update styling
      fieldElement.classList.remove('empty')
      fieldElement.classList.add('completed')
    }
    
    // Update field list status
    this.updateFieldListStatus()
    
    // Hide field card
    this.fieldCardTarget.classList.add('d-none')
    
    // Clear the active field
    this.activeFieldIdValue = null
  }
  
  applyText() {
    if (!this.activeFieldIdValue) return
    
    const textValue = this.textInputFieldTarget.value
    
    // Find the active field
    const field = this.fields.find(f => f.id.toString() === this.activeFieldIdValue)
    if (!field) return
    
    // Update the field value
    field.value = textValue
    
    // Mark as completed if not empty
    if (textValue) {
      if (!this.completedFieldsValue.includes(this.activeFieldIdValue)) {
        this.completedFieldsValue = [...this.completedFieldsValue, this.activeFieldIdValue]
      }
    } else {
      // Remove from completed if empty
      this.completedFieldsValue = this.completedFieldsValue.filter(id => id !== this.activeFieldIdValue)
    }
    
    // Update the field element
    const fieldElement = this.fieldOverlayTarget.querySelector(
      `.document-field[data-field-id="${field.id}"]`
    )
    
    if (fieldElement) {
      // Clear existing content
      while (fieldElement.childNodes.length > 1) {
        fieldElement.removeChild(fieldElement.lastChild)
      }
      
      if (textValue) {
        // Add text
        this.displayFieldValue(fieldElement, field)
        
        // Update styling
        fieldElement.classList.remove('empty')
        fieldElement.classList.add('completed')
      } else {
        // Update styling
        fieldElement.classList.remove('completed')
        fieldElement.classList.add('empty')
      }
    }
    
    // Update field list status
    this.updateFieldListStatus()
    
    // Hide field card
    this.fieldCardTarget.classList.add('d-none')
    
    // Clear the active field
    this.activeFieldIdValue = null
  }
  
  applyDate() {
    if (!this.activeFieldIdValue) return
    
    const dateValue = this.dateInputFieldTarget.value
    
    // Find the active field
    const field = this.fields.find(f => f.id.toString() === this.activeFieldIdValue)
    if (!field) return
    
    // Parse and format the date
    const date = new Date(dateValue)
    const formattedDate = date.toLocaleDateString()
    
    // Update the field value
    field.value = formattedDate
    
    // Mark as completed
    if (!this.completedFieldsValue.includes(this.activeFieldIdValue)) {
      this.completedFieldsValue = [...this.completedFieldsValue, this.activeFieldIdValue]
    }
    
    // Update the field element
    const fieldElement = this.fieldOverlayTarget.querySelector(
      `.document-field[data-field-id="${field.id}"]`
    )
    
    if (fieldElement) {
      // Clear existing content
      while (fieldElement.childNodes.length > 1) {
        fieldElement.removeChild(fieldElement.lastChild)
      }
      
      // Add date text
      this.displayFieldValue(fieldElement, field)
      
      // Update styling
      fieldElement.classList.remove('empty')
      fieldElement.classList.add('completed')
    }
    
    // Update field list status
    this.updateFieldListStatus()
    
    // Hide field card
    this.fieldCardTarget.classList.add('d-none')
    
    // Clear the active field
    this.activeFieldIdValue = null
  }
  
  updateFieldListStatus() {
    // Update field list items
    this.fieldListItemTargets.forEach(item => {
      const fieldId = item.dataset.fieldId
      const field = this.fields.find(f => f.id.toString() === fieldId)
      
      if (!field) return
      
      const statusBadge = item.querySelector('[data-document-signing-target="fieldStatus"]')
      if (!statusBadge) return
      
      if (this.completedFieldsValue.includes(fieldId)) {
        statusBadge.textContent = 'Completed'
        statusBadge.classList.remove('bg-secondary')
        statusBadge.classList.add('bg-success')
        item.classList.add('list-group-item-success')
      } else {
        statusBadge.textContent = 'Pending'
        statusBadge.classList.remove('bg-success')
        statusBadge.classList.add('bg-secondary')
        item.classList.remove('list-group-item-success')
      }
    })
    
    // Update progress bar
    const totalFields = this.fields.length
    const completedFields = this.completedFieldsValue.length
    
    if (totalFields > 0) {
      const percentage = (completedFields / totalFields) * 100
      this.progressBarTarget.style.width = `${percentage}%`
      
      // Enable or disable the submit button
      const requiredFields = this.fields.filter(f => f.required)
      const allRequiredCompleted = requiredFields.every(f => 
        this.completedFieldsValue.includes(f.id.toString())
      )
      
      this.submitButtonTarget.disabled = !allRequiredCompleted
    }
  }
  
  goToField(e) {
    const fieldId = e.currentTarget.dataset.fieldId
    const field = this.fields.find(f => f.id.toString() === fieldId)
    
    if (!field) return
    
    // Navigate to the page with this field
    if (field.page_number !== this.currentPageValue) {
      this.currentPageValue = field.page_number
      this.queueRenderPage(field.page_number)
    }
    
    // After the page loads, show the field input
    setTimeout(() => {
      this.showFieldInput(field)
    }, 500)
  }
  
  submitSignature() {
    // Check if all required fields are completed
    const requiredFields = this.fields.filter(f => f.required)
    const allRequiredCompleted = requiredFields.every(f => 
      this.completedFieldsValue.includes(f.id.toString())
    )
    
    if (!allRequiredCompleted) {
      alert('Please complete all required fields before submitting.')
      return
    }
    
    // Create hidden inputs for all field values
    const form = this.submitFormTarget
    form.innerHTML = ''
    
    this.fields.forEach(field => {
      if (field.value) {
        const input = document.createElement('input')
        input.type = 'hidden'
        input.name = `fields[${field.id}]`
        input.value = field.value
        form.appendChild(input)
      }
    })
    
    // Submit the form
    form.submit()
  }
  
  // PDF navigation methods
  prevPage() {
    if (this.currentPageValue <= 1) return
    
    this.currentPageValue--
    this.queueRenderPage(this.currentPageValue)
  }
  
  nextPage() {
    if (this.currentPageValue >= this.pdfDoc.numPages) return
    
    this.currentPageValue++
    this.queueRenderPage(this.currentPageValue)
  }
  
  queueRenderPage(num) {
    if (this.pageRendering) {
      this.pageNumPending = num
    } else {
      this.renderPage(num)
    }
  }
  
  updateButtonStates() {
    this.prevButtonTarget.disabled = this.currentPageValue <= 1
    this.nextButtonTarget.disabled = this.currentPageValue >= this.pdfDoc?.numPages
  }
  
  handleResize() {
    this.syncFieldOverlaySize()
  }
}
```

### Styling for the Signing Process

```css
/* app/assets/stylesheets/signing.css */
.document-field.signing {
  position: absolute;
  border: 2px solid;
  background-color: rgba(255, 255, 255, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 20;
  box-sizing: border-box;
  font-size: 14px;
  cursor: pointer;
  overflow: hidden;
}

.document-field.signing.empty {
  border-color: #dc3545;
  border-style: dashed;
}

.document-field.signing.completed {
  border-color: #28a745;
  border-style: solid;
}

.document-field.signing .field-label {
  position: absolute;
  top: -20px;
  left: 0;
  font-size: 10px;
  background-color: rgba(255, 255, 255, 0.8);
  padding: 2px 5px;
  border-radius: 2px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
}

.pdf-container {
  background-color: #f5f5f5;
  min-height: 80vh;
}

/* Signature pad styling */
@import url('https://fonts.googleapis.com/css2?family=Dancing+Script&family=Homemade+Apple&display=swap');
```

### Thank You Page

```erb
<!-- app/views/signing/thank_you.html.erb -->
<div class="container py-5">
  <div class="row justify-content-center">
    <div class="col-md-8 col-lg-6">
      <div class="card shadow text-center">
        <div class="card-body p-5">
          <% if @declined %>
            <div class="mb-4">
              <i class="bi bi-x-circle text-danger" style="font-size: 4rem;"></i>
            </div>
            <h1 class="h3 mb-3">Document Declined</h1>
            <p class="mb-4 text-muted">
              You have declined to sign this document. The document owner has been notified.
            </p>
          <% else %>
            <div class="mb-4">
              <i class="bi bi-check-circle text-success" style="font-size: 4rem;"></i>
            </div>
            <h1 class="h3 mb-3">Thank You for Signing!</h1>
            <p class="mb-4 text-muted">
              Your signature has been recorded. You will receive a confirmation email once all parties have signed the document.
            </p>
          <% end %>
          
          <div class="d-grid">
            <a href="<%= root_path %>" class="btn btn-primary">Return to Homepage</a>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>
```

## Email Notifications

### Document Completion Mailer

```bash
rails generate mailer DocumentCompletion document_completed document_declined
```

```ruby
# app/mailers/document_completion_mailer.rb
class DocumentCompletionMailer < ApplicationMailer
  def document_completed(document)
    @document = document
    @creator = document.creator
    @signers = document.document_signers.includes(:user)
    
    attachments["#{@document.title.parameterize}.pdf"] = @document.completed_file.download
    
    mail(
      to: @creator.email,
      subject: "Document Completed: #{@document.title}"
    )
  end
  
  def document_declined(document, document_signer)
    @document = document
    @creator = document.creator
    @signer = document_signer
    @decline_reason = document_signer.decline_reason
    
    mail(
      to: @creator.email,
      subject: "Document Declined: #{@document.title}"
    )
  end
end
```

Create email templates:

```erb
<!-- app/views/document_completion_mailer/document_completed.html.erb -->
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <div style="background-color: #28a745; padding: 20px; text-align: center; border-bottom: 4px solid #218838;">
    <h1 style="color: white; margin: 0;">Document Completed</h1>
  </div>
  
  <div style="padding: 20px;">
    <p>Hello <%= @creator.name %>,</p>
    
    <p>Good news! Your document "<strong><%= @document.title %></strong>" has been signed by all parties and is now complete.</p>
    
    <div style="background-color: #f8f9fa; padding: 15px; margin: 20px 0; border-left: 4px solid #28a745;">
      <h2 style="margin-top: 0; font-size: 18px;">Document Details</h2>
      <p style="margin-bottom: 5px;"><strong>Title:</strong> <%= @document.title %></p>
      <p style="margin-bottom: 5px;"><strong>Completed:</strong> <%= @document.completed_at.strftime("%B %d, %Y at %I:%M %p") %></p>
      <p style="margin-bottom: 0;"><strong>Signers:</strong></p>
      <ul>
        <% @signers.each do |signer| %>
          <li>
            <%= signer.user.name %> (<%= signer.user.email %>) - 
            Signed on <%= signer.signed_at&.strftime("%B %d, %Y at %I:%M %p") %>
          </li>
        <% end %>
      </ul>
    </div>
    
    <p>A copy of the signed document is attached to this email for your records.</p>
    
    <p>Thank you,<br>
    Document Signing System</p>
  </div>
  
  <div style="background-color: #f8f9fa; padding: 15px; text-align: center; font-size: 12px; color: #6c757d; border-top: 1px solid #dee2e6;">
    <p>This is an automated message. Please do not reply to this email.</p>
  </div>
</div>
```

```erb
<!-- app/views/document_completion_mailer/document_declined.html.erb -->
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <div style="background-color: #dc3545; padding: 20px; text-align: center; border-bottom: 4px solid #c82333;">
    <h1 style="color: white; margin: 0;">Document Declined</h1>
  </div>
  
  <div style="padding: 20px;">
    <p>Hello <%= @creator.name %>,</p>
    
    <p><strong><%= @signer.user.name %></strong> has declined to sign your document "<strong><%= @document.title %></strong>".</p>
    
    <div style="background-color: #f8f9fa; padding: 15px; margin: 20px 0; border-left: 4px solid #dc3545;">
      <h2 style="margin-top: 0; font-size: 18px;">Decline Reason</h2>
      <p style="margin-bottom: 0;"><%= @decline_reason %></p>
    </div>
    
    <p>You may need to make changes to the document and send a new signing request.</p>
    
    <p>Thank you,<br>
    Document Signing System</p>
  </div>
  
  <div style="background-color: #f8f9fa; padding: 15px; text-align: center; font-size: 12px; color: #6c757d; border-top: 1px solid #dee2e6;">
    <p>This is an automated message. Please do not reply to this email.</p>
  </div>
</div>
```

## Audit Trail Implementation

### Generate Final Document Job

```bash
rails generate job GenerateFinalDocument
```

```ruby
# app/jobs/generate_final_document_job.rb
class GenerateFinalDocumentJob < ApplicationJob
  queue_as :default
  
  def perform(document_id)
    document = Document.find_by(id: document_id)
    return unless document
    
    # Load the original PDF
    original_pdf = HexaPDF::Document.open(download_original_pdf(document))
    
    # Create a new PDF for the audit trail
    audit_trail = create_audit_trail(document)
    
    # Merge the PDFs
    merged_pdf = merge_pdfs(original_pdf, audit_trail)
    
    # Create a temporary file for the merged PDF
    temp_file = Tempfile.new(['completed_', '.pdf'])
    begin
      merged_pdf.write(temp_file.path)
      
      # Attach the completed file to the document
      document.completed_file.attach(
        io: File.open(temp_file.path),
        filename: "#{document.title.parameterize}_completed.pdf",
        content_type: 'application/pdf'
      )
      
      # Update document status
      document.update(status: :completed, completed_at: Time.current)
    ensure
      temp_file.close
      temp_file.unlink
    end
  end
  
  private
  
  def download_original_pdf(document)
    temp_file = Tempfile.new(['original_', '.pdf'])
    begin
      temp_file.binmode
      temp_file.write(document.file.download)
      temp_file.flush
      temp_file.path
    rescue => e
      temp_file.close
      temp_file.unlink
      raise e
    end
  end
  
  def create_audit_trail(document)
    pdf = HexaPDF::Document.new
    
    # Add audit trail page
    page = pdf.pages.add
    canvas = page.canvas
    
    # Set up font and sizes
    canvas.font('Helvetica', size: 12)
    title_size = 16
    heading_size = 14
    
    # Title
    canvas.font('Helvetica', size: title_size)
    canvas.text("Certificate of Completion", at: [50, 750])
    
    # Document Info
    canvas.font('Helvetica', size: heading_size)
    canvas.text("Document Information", at: [50, 700])
    
    canvas.font('Helvetica', size: 12)
    canvas.text("Title: #{document.title}", at: [50, 680])
    canvas.text("Document ID: #{document.id}", at: [50, 660])
    canvas.text("Created: #{document.created_at.strftime('%B %d, %Y at %I:%M %p')}", at: [50, 640])
    canvas.text("Completed: #{document.completed_at.strftime('%B %d, %Y at %I:%M %p')}", at: [50, 620])
    
    # Signer Information
    canvas.font('Helvetica', size: heading_size)
    canvas.text("Signer Information", at: [50, 580])
    
    y_position = 560
    document.document_signers.includes(:user).each_with_index do |signer, index|
      canvas.font('Helvetica', size: 12)
      canvas.text("#{index + 1}. #{signer.user.name} (#{signer.user.email})", at: [50, y_position])
      canvas.text("   Signed on: #{signer.signed_at.strftime('%B %d, %Y at %I:%M %p')}", at: [50, y_position - 20])
      canvas.text("   IP Address: #{signer.ip_address}", at: [50, y_position - 40])
      canvas.text("   User Agent: #{signer.user_agent&.truncate(80)}", at: [50, y_position - 60])
      
      y_position -= 80
      
      # Add a new page if we're running out of space
      if y_position < 100
        page = pdf.pages.add
        canvas = page.canvas
        canvas.font('Helvetica', size: heading_size)
        canvas.text("Signer Information (continued)", at: [50, 750])
        y_position = 730
      end
    end
    
    # Add footer
    add_footer(pdf)
    
    pdf
  end
  
  def add_footer(pdf)
    pdf.pages.each do |page|
      canvas = page.canvas
      canvas.font('Helvetica', size: 8)
      canvas.text(
        "This certificate documents the electronic signing of this document. " +
        "Digital signatures are legally binding and equivalent to handwritten signatures.",
        at: [50, 50]
      )
      
      # Add timestamp
      canvas.text(
        "Certificate generated: #{Time.current.strftime('%B %d, %Y at %I:%M %p')}",
        at: [50, 30]
      )
    end
  end
  
  def merge_pdfs(original, audit_trail)
    # Create a new PDF
    merged = HexaPDF::Document.new
    
    # Add all pages from the original document
    original.pages.each do |page|
      merged.pages << merged.import(page)
    end
    
    # Add all pages from the audit trail
    audit_trail.pages.each do |page|
      merged.pages << merged.import(page)
    end
    
    merged
  end
end
```

## Signature Completion and Next Steps

### Update Document Model for Signature Routing

```ruby
# app/models/document.rb (additions)
def next_signer
  return nil unless pending?
  
  # Get the first pending signer based on order
  document_signers.pending.ordered.first
end

def notify_next_signer
  next_signer_record = next_signer
  return false unless next_signer_record
  
  # Send email notification
  SigningRequestMailer.signing_request(next_signer_record).deliver_later
  
  true
end

def all_signed?
  document_signers.where.not(status: :completed).none?
end

def generate_signing_urls(host)
  document_signers.each do |signer|
    signer.signing_url = signer.generate_signing_url(host)
    signer.save
  end
end
```

### Update Document Signer Model for Signature Routing

```ruby
# app/models/document_signer.rb (additions)
def mark_as_pending!
  update(status: :pending)
end

def mark_as_completed!(request = nil)
  update(
    status: :completed,
    signed_at: Time.current,
    ip_address: request&.remote_ip,
    user_agent: request&.user_agent
  )
end

def mark_as_declined!(reason, request = nil)
  update(
    status: :declined,
    decline_reason: reason,
    signed_at: Time.current,
    ip_address: request&.remote_ip,
    user_agent: request&.user_agent
  )
end
```

### Update Document Editor Controller for Sending

```ruby
# app/controllers/document_editor_controller.rb (additions to prepare_for_signing method)
def prepare_for_signing
  @document = Document.find(params[:document_id])
  
  # Ensure the document has fields and signers
  unless @document.ready_for_signing?
    redirect_to edit_document_editor_path(@document), 
                alert: "Document must have at least one field and one signer before sending"
    return
  end
  
  # Generate signing URLs for all signers
  @document.generate_signing_urls(request.host_with_port)
  
  # Set document status to pending
  @document.update(status: :pending)
  
  # Mark the first signer as pending based on order
  first_signer = @document.document_signers.ordered.first
  first_signer.mark_as_pending! if first_signer
  
  # Send email to the first signer
  SigningRequestMailer.signing_request(first_signer).deliver_later if first_signer
  
  # Log the activity
  @document.log_activity(current_user, 'sent for signing', request)
  
  redirect_to document_path(@document), notice: "Document has been sent for signing!"
end
```

## System Tests

### Create System Tests for Signing Flow

```ruby
# test/system/signing_flow_test.rb
require "application_system_test_case"

class SigningFlowTest < ApplicationSystemTestCase
  setup do
    @document = documents(:pending)
    @document_signer = document_signers(:pending)
    
    # Ensure the document has a file attached
    unless @document.file.attached?
      @document.file.attach(
        io: File.open(Rails.root.join("test/fixtures/files/sample.pdf")),
        filename: "sample.pdf",
        content_type: "application/pdf"
      )
    end
    
    # Ensure the signer has a token
    unless @document_signer.signing_token
      @document_signer.regenerate_token!
    end
    
    # Create test fields
    unless @document.form_fields.exists?
      @document.form_fields.create!(
        document_signer: @document_signer,
        field_type: "signature",
        page_number: 1,
        x_position: 100,
        y_position: 100,
        width: 200,
        height: 50,
        required: true,
        label: "Signature"
      )
      
      @document.form_fields.create!(
        document_signer: @document_signer,
        field_type: "text",
        page_number: 1,
        x_position: 100,
        y_position: 200,
        width: 200,
        height: 30,
        required: true,
        label: "Full Name"
      )
      
      @document.form_fields.create!(
        document_signer: @document_signer,
        field_type: "date",
        page_number: 1,
        x_position: 100,
        y_position: 300,
        width: 200,
        height: 30,
        required: true,
        label: "Date"
      )
    end
  end
  
  test "complete signing process" do
    # Visit signing link
    visit sign_document_url(token: @document_signer.signing_token)
    
    # Authenticate
    fill_in "Email Address", with: @document_signer.user.email
    click_button "Continue to Document"
    
    # Wait for PDF to load
    assert_selector "h1", text: @document.title
    sleep 1 # Give time for the PDF to load
    
    # Click on signature field
    signature_field = find("li", text: "Signature")
    signature_field.click
    
    # Sign in the signature pad
    canvas = find("canvas")
    
    # Simulate drawing on the canvas
    page.driver.browser.action
      .move_to(canvas.native, 10, 10)
      .click_and_hold
      .move_by(100, 50)
      .release
      .perform
    
    # Apply signature
    click_button "Apply"
    
    # Click on text field
    text_field = find("li", text: "Full Name")
    text_field.click
    
    # Fill in text
    fill_in "Enter text", with: "John Doe"
    click_button "Apply"
    
    # Click on date field
    date_field = find("li", text: "Date")
    date_field.click
    
    # Fill in date
    # The date field is already filled with current date
    click_button "Apply"
    
    # Complete signing
    click_button "Complete Signing"
    
    # Verify success page
    assert_selector "h1", text: "Thank You for Signing!"
  end
  
  test "declining to sign" do
    # Visit signing link
    visit sign_document_url(token: @document_signer.signing_token)
    
    # Authenticate
    fill_in "Email Address", with: @document_signer.user.email
    click_button "Continue to Document"
    
    # Wait for PDF to load
    assert_selector "h1", text: @document.title
    
    # Click decline button
    click_button "Decline to Sign"
    
    # Fill in reason
    within "#declineModal" do
      fill_in "Reason for declining", with: "I disagree with the terms"
      click_button "Confirm Decline"
    end
    
    # Verify declined page
    assert_selector "h1", text: "Document Declined"
  end
end
```

## Testing

### Create Unit Tests for Signature Functionality

```ruby
# test/models/signature_test.rb
require "test_helper"

class SignatureTest < ActiveSupport::TestCase
  setup do
    @user = users(:admin)
    @signature = Signature.new(
      user: @user,
      signature_data: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
      style: 'drawn'
    )
  end
  
  test "should be valid with required attributes" do
    assert @signature.valid?
  end
  
  test "should require signature_data" do
    @signature.signature_data = nil
    assert_not @signature.valid?
  end
  
  test "should require a valid style" do
    @signature.style = 'invalid'
    assert_not @signature.valid?
    
    @signature.style = 'drawn'
    assert @signature.valid?
    
    @signature.style = 'typed'
    assert @signature.valid?
    
    @signature.style = 'uploaded'
    assert @signature.valid?
  end
  
  test "should ensure only one default signature per user" do
    # Create first signature as default
    first_signature = Signature.create!(
      user: @user,
      signature_data: "data:image/png;base64,AAAA",
      style: 'drawn',
      is_default: true
    )
    
    # Create second signature also marked as default
    second_signature = Signature.create!(
      user: @user,
      signature_data: "data:image/png;base64,BBBB",
      style: 'typed',
      is_default: true
    )
    
    # Reload first signature and verify it's no longer default
    first_signature.reload
    assert_not first_signature.is_default?
    
    # Verify second signature is now default
    assert second_signature.is_default?
  end
  
  test "make_default! should work correctly" do
    # Create three signatures
    first = Signature.create!(
      user: @user,
      signature_data: "data:image/png;base64,AAAA",
      style: 'drawn',
      is_default: false
    )
    
    second = Signature.create!(
      user: @user,
      signature_data: "data:image/png;base64,BBBB",
      style: 'typed',
      is_default: true
    )
    
    third = Signature.create!(
      user: @user,
      signature_data: "data:image/png;base64,CCCC",
      style: 'uploaded',
      is_default: false
    )
    
    # Make the third signature default
    third.make_default!
    
    # Reload all signatures
    first.reload
    second.reload
    third.reload
    
    # Verify only third is default
    assert_not first.is_default?
    assert_not second.is_default?
    assert third.is_default?
  end
end
```

```ruby
# test/models/document_signer_test.rb
require "test_helper"

class DocumentSignerTest < ActiveSupport::TestCase
  setup do
    @document = documents(:draft)
    @user = users(:regular)
    @document_signer = DocumentSigner.new(
      document: @document,
      user: @user,
      order: 1,
      status: :draft
    )
  end
  
  test "should be valid with required attributes" do
    assert @document_signer.valid?
  end
  
  test "should require a document" do
    @document_signer.document = nil
    assert_not @document_signer.valid?
  end
  
  test "should require a user" do
    @document_signer.user = nil
    assert_not @document_signer.valid?
  end
  
  test "should have unique user per document" do
    @document_signer.save!
    
    duplicate = DocumentSigner.new(
      document: @document,
      user: @user,
      order: 2,
      status: :draft
    )
    
    assert_not duplicate.valid?
  end
  
  test "should generate signing token on create" do
    @document_signer.save!
    assert_not_nil @document_signer.signing_token
    assert_not_nil @document_signer.token_expires_at
  end
  
  test "token_valid? should return correct value" do
    @document_signer.save!
    assert @document_signer.token_valid?
    
    @document_signer.token_expires_at = 1.day.ago
    assert_not @document_signer.token_valid?
    
    @document_signer.signing_token = nil
    assert_not @document_signer.token_valid?
  end
  
  test "regenerate_token! should create new token" do
    @document_signer.save!
    original_token = @document_signer.signing_token
    original_expires = @document_signer.token_expires_at
    
    @document_signer.regenerate_token!
    
    assert_not_equal original_token, @document_signer.signing_token
    assert_not_equal original_expires, @document_signer.token_expires_at
  end
  
  test "mark_as_pending! should update status" do
    @document_signer.save!
    @document_signer.mark_as_pending!
    
    assert_equal "pending", @document_signer.status
  end
  
  test "mark_as_completed! should update status and timestamp" do
    @document_signer.save!
    
    assert_nil @document_signer.signed_at
    
    @document_signer.mark_as_completed!
    
    assert_equal "completed", @document_signer.status
    assert_not_nil @document_signer.signed_at
  end
  
  test "mark_as_declined! should update status, reason and timestamp" do
    @document_signer.save!
    
    assert_nil @document_signer.signed_at
    assert_nil @document_signer.decline_reason
    
    @document_signer.mark_as_declined!("I don't agree with the terms")
    
    assert_equal "declined", @document_signer.status
    assert_equal "I don't agree with the terms", @document_signer.decline_reason
    assert_not_nil @document_signer.signed_at
  end
end
```

### Create Integration Tests for Signing Flow

```ruby
# test/controllers/signing_controller_test.rb
require "test_helper"

class SigningControllerTest < ActionDispatch::IntegrationTest
  setup do
    @document = documents(:pending)
    @document_signer = document_signers(:pending)
    
    # Ensure the document has a file attached
    unless @document.file.attached?
      @document.file.attach(
        io: File.open(Rails.root.join("test/fixtures/files/sample.pdf")),
        filename: "sample.pdf",
        content_type: "application/pdf"
      )
    end
    
    # Ensure the signer has a token
    unless @document_signer.signing_token
      @document_signer.regenerate_token!
    end
  end
  
  test "should show authentication page for valid token" do
    get sign_document_url(token: @document_signer.signing_token)
    assert_response :success
    assert_select "h1", "Verify your identity"
  end
  
  test "should redirect for invalid token" do
    get sign_document_url(token: "invalid-token")
    assert_redirected_to root_path
    assert_equal "Invalid or expired signing link.", flash[:error]
  end
  
  test "should authenticate with correct email" do
    post authenticate_signing_url(token: @document_signer.signing_token), 
         params: { email: @document_signer.user.email }
    
    assert_redirected_to verify_signing_path
    assert_equal @document_signer.id, session[:authenticated_signer_id]
  end
  
  test "should reject authentication with incorrect email" do
    post authenticate_signing_url(token: @document_signer.signing_token), 
         params: { email: "wrong@example.com" }
    
    assert_response :success
    assert_nil session[:authenticated_signer_id]
    assert_select "div.alert-danger", /Email address doesn't match/
  end
  
  test "should show verification page for authenticated user" do
    # First authenticate
    post authenticate_signing_url(token: @document_signer.signing_token), 
         params: { email: @document_signer.user.email }
    
    # Then access verification page
    get verify_signing_path
    assert_response :success
    assert_select "h1", text: /#{@document.title}/
  end
  
  test "should redirect unauthenticated users from verification page" do
    get verify_signing_path
    assert_redirected_to root_path
  end
  
  test "should complete signing process with valid fields" do
    # First authenticate
    post authenticate_signing_url(token: @document_signer.signing_token), 
         params: { email: @document_signer.user.email }
    
    # Create test fields
    field1 = @document.form_fields.create!(
      document_signer: @document_signer,
      field_type: "signature",
      page_number: 1,
      x_position: 100,
      y_position: 100,
      width: 200,
      height: 50,
      required: true
    )
    
    field2 = @document.form_fields.create!(
      document_signer: @document_signer,
      field_type: "text",
      page_number: 1,
      x_position: 100,
      y_position: 200,
      width: 200,
      height: 30,
      required: true
    )
    
    # Submit completed fields
    post complete_signing_path, params: {
      fields: {
        field1.id => "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
        field2.id => "Sample Text"
      }
    }
    
    # Verify redirect to thank you page
    assert_redirected_to thank_you_signing_path
    
    # Verify signer status updated
    @document_signer.reload
    assert_equal "completed", @document_signer.status
    assert_not_nil @document_signer.signed_at
    
    # Verify field values saved
    field1.reload
    field2.reload
    assert_not_nil field1.value
    assert_equal "Sample Text", field2.value
  end
  
  test "should decline document with reason" do
    # First authenticate
    post authenticate_signing_url(token: @document_signer.signing_token), 
         params: { email: @document_signer.user.email }
    
    # Submit decline
    post decline_signing_path, params: {
      decline_reason: "I do not agree with the terms"
    }
    
    # Verify redirect to thank you page
    assert_redirected_to thank_you_signing_path(declined: true)
    
    # Verify signer status updated
    @document_signer.reload
    assert_equal "declined", @document_signer.status
    assert_equal "I do not agree with the terms", @document_signer.decline_reason
    assert_not_nil @document_signer.signed_at
  end
endd => "Sample Text"
      }
    }
    
    # Verify redirect to thank you page
    assert_redirected_to thank_you_signing_path
    
    # Verify signer status updated
    @document_signer.reload
    assert_equal "completed", @document_signer.status
    assert_not_nil @document_signer.signed_at
    
    # Verify field values saved
    field1.reload
    field2.reload
    assert_not_nil field1.value
    assert_equal "Sample Text", field2.value
  end
  
  test "should decline document with reason" do
    # First authenticate
    post authenticate_signing_url(token: @document_signer.signing_token), 
         params: { email: @document_signer.user.email }
    
    # Submit decline
    post decline_signing_path, params: {
      decline_reason: "I do not agree with the terms"
    }
    
    # Verify redirect to thank you page
    assert_redirected_to thank_you_signing_path(declined: true)
    
    # Verify signer status updated
    @document_signer.reload
    assert_equal "declined", @document_signer.status
    assert_equal "I do not agree with the terms", @document_signer.decline_reason
    assert_not_nil @document_signer.signed_at
  end
end
