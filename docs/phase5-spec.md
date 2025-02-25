# Phase 5: Finalization & Security Implementation Guide

This guide provides detailed implementation instructions for Phase 5 of the DocuSign clone, focusing on document finalization, security, and tamper-evident features. It includes all necessary code, commands, and explanations for implementing these critical components.

## Table of Contents
1. [Setup Prerequisites](#setup-prerequisites)
2. [Database Updates](#database-updates)
3. [Final PDF Generation](#final-pdf-generation)
4. [Audit Trail System](#audit-trail-system)
5. [Document Security](#document-security)
6. [Tamper-Evident Mechanisms](#tamper-evident-mechanisms)
7. [Document Verification](#document-verification)
8. [Notifications and Access Control](#notifications-and-access-control)
9. [Testing](#testing)
10. [Production Security Considerations](#production-security-considerations)

## Setup Prerequisites

Ensure you have completed Phase 4 and have the following in place:
- Document signing functionality
- Form Field and Document Signer models
- PDF.js and HexaPDF integrations

Install additional required gems:

```ruby
# Gemfile (additions)
gem 'openssl'              # For cryptographic operations
gem 'pdf-reader'           # For PDF inspection
gem 'rqrcode'              # For QR code generation
gem 'image_processing'     # For processing QR codes and signatures
gem 'rubyzip'              # For creating zip archives of documents
```

Run bundle install:

```bash
bundle install
```

## Database Updates

### Add Document Verification Fields

```bash
rails generate migration AddSecurityFieldsToDocuments verification_hash:string verification_method:string verification_timestamp:datetime verified_by:references security_level:string public_access_token:string access_count:integer access_expires_at:datetime
```

Update the migration:

```ruby
# db/migrate/TIMESTAMP_add_security_fields_to_documents.rb
class AddSecurityFieldsToDocuments < ActiveRecord::Migration[8.0]
  def change
    add_column :documents, :verification_hash, :string
    add_column :documents, :verification_method, :string
    add_column :documents, :verification_timestamp, :datetime
    add_reference :documents, :verified_by, null: true, foreign_key: { to_table: :users }
    add_column :documents, :security_level, :string, default: 'standard'
    add_column :documents, :public_access_token, :string
    add_column :documents, :access_count, :integer, default: 0
    add_column :documents, :access_expires_at, :datetime
    
    add_index :documents, :verification_hash
    add_index :documents, :public_access_token, unique: true
  end
end
```

### Add Audit Log Details

```bash
rails generate migration AddDetailsToAuditLogs ip_location:string browser_info:jsonb device_info:jsonb signature_id:references verification_data:jsonb
```

Update the migration:

```ruby
# db/migrate/TIMESTAMP_add_details_to_audit_logs.rb
class AddDetailsToAuditLogs < ActiveRecord::Migration[8.0]
  def change
    add_column :audit_logs, :ip_location, :string
    add_column :audit_logs, :browser_info, :jsonb, default: {}
    add_column :audit_logs, :device_info, :jsonb, default: {}
    add_reference :audit_logs, :signature, null: true, foreign_key: true
    add_column :audit_logs, :verification_data, :jsonb, default: {}
    
    # Add index for faster querying
    add_index :audit_logs, [:document_id, :created_at]
  end
end
```

Run migrations:

```bash
rails db:migrate
```

## Final PDF Generation

### Create Document Finalizer Service

Create a service to manage the final PDF generation:

```ruby
# app/services/document_finalizer_service.rb
class DocumentFinalizerService
  attr_reader :document, :errors
  
  def initialize(document)
    @document = document
    @errors = []
  end
  
  def finalize
    return false unless document.completed?
    return true if document.completed_file.attached?
    
    ActiveRecord::Base.transaction do
      begin
        # Generate the final PDF with signatures
        final_pdf = generate_final_pdf
        
        # Create the audit trail page
        audit_trail = generate_audit_trail
        
        # Merge the PDFs
        merged_pdf = merge_pdfs(final_pdf, audit_trail)
        
        # Generate hash and sign the PDF
        add_security_features(merged_pdf)
        
        # Save the finalized document
        save_finalized_document(merged_pdf)
        
        # Notify all participants
        notify_participants
        
        return true
      rescue => e
        @errors << "Failed to finalize document: #{e.message}"
        Rails.logger.error("Document finalization error: #{e.message}")
        Rails.logger.error(e.backtrace.join("\n"))
        raise ActiveRecord::Rollback
        return false
      end
    end
    
    false
  end
  
  private
  
  def generate_final_pdf
    # Load the original PDF
    original_pdf = HexaPDF::Document.open(download_original_pdf)
    
    # Get all form fields grouped by page
    fields_by_page = document.form_fields.includes(:document_signer)
                             .group_by(&:page_number)
    
    # Add the signature images and field values to the PDF
    fields_by_page.each do |page_number, fields|
      # Skip if this is an invalid page number
      next if page_number <= 0 || page_number > original_pdf.pages.count
      
      page = original_pdf.pages[page_number - 1]
      canvas = page.canvas
      
      fields.each do |field|
        next unless field.value.present?
        
        # Get coordinates and dimensions (convert to PDF coordinate system)
        x = field.x_position
        y = page.box.height - field.y_position - field.height
        width = field.width
        height = field.height
        
        case field.field_type
        when 'signature', 'initials'
          # Add signature image
          add_signature_image(canvas, field.value, x, y, width, height)
        when 'text'
          # Add text
          add_text(canvas, field.value, x, y, width, height)
        when 'date'
          # Add date
          add_text(canvas, field.value, x, y, width, height)
        end
      end
    end
    
    original_pdf
  end
  
  def generate_audit_trail
    pdf = HexaPDF::Document.new
    
    # Add audit trail page
    page = pdf.pages.add
    canvas = page.canvas
    
    # Set up fonts
    pdf.fonts.add("Helvetica")
    title_font = "Helvetica"
    regular_font = "Helvetica"
    
    # Title
    canvas.font(title_font, size: 18)
    canvas.text("Certificate of Completion", at: [50, 750])
    
    # Document Info
    canvas.font(title_font, size: 14)
    canvas.text("Document Information", at: [50, 700])
    
    canvas.font(regular_font, size: 11)
    canvas.text("Title: #{document.title}", at: [50, 680])
    canvas.text("Document ID: #{document.id}", at: [50, 660])
    canvas.text("Created: #{document.created_at.strftime('%B %d, %Y at %I:%M %p')}", at: [50, 640])
    canvas.text("Completed: #{document.completed_at.strftime('%B %d, %Y at %I:%M %p')}", at: [50, 620])
    canvas.text("Creator: #{document.creator.name} (#{document.creator.email})", at: [50, 600])
    
    # Signer Information
    canvas.font(title_font, size: 14)
    canvas.text("Signer Information", at: [50, 560])
    
    y_position = 540
    document.document_signers.includes(:user).order(:order).each_with_index do |signer, index|
      canvas.font(regular_font, size: 11)
      status_text = signer.status.humanize
      status_text += " - #{signer.decline_reason}" if signer.declined? && signer.decline_reason.present?
      
      canvas.text("Signer #{index + 1}: #{signer.user.name} (#{signer.user.email})", at: [50, y_position])
      canvas.text("Status: #{status_text}", at: [70, y_position - 15])
      
      if signer.completed?
        canvas.text("Signed on: #{signer.signed_at.strftime('%B %d, %Y at %I:%M %p')}", at: [70, y_position - 30])
        canvas.text("IP Address: #{signer.ip_address || 'Not recorded'}", at: [70, y_position - 45])
        canvas.text("IP Location: #{get_ip_location(signer.ip_address) || 'Not recorded'}", at: [70, y_position - 60])
        canvas.text("Browser: #{get_browser_info(signer.user_agent) || 'Not recorded'}", at: [70, y_position - 75])
      end
      
      y_position -= 90
      
      # Add a new page if we're running out of space
      if y_position < 100
        page = pdf.pages.add
        canvas = page.canvas
        canvas.font(title_font, size: 14)
        canvas.text("Signer Information (continued)", at: [50, 750])
        y_position = 730
      end
    end
    
    # Document Audit Trail
    if y_position < 150
      page = pdf.pages.add
      canvas = page.canvas
      canvas.font(title_font, size: 14)
      canvas.text("Document Audit Trail", at: [50, 750])
      y_position = 730
    else
      canvas.font(title_font, size: 14)
      canvas.text("Document Audit Trail", at: [50, y_position])
      y_position -= 20
    end
    
    canvas.font(regular_font, size: 11)
    document.audit_logs.order(created_at: :asc).each do |log|
      log_text = "#{log.created_at.strftime('%Y-%m-%d %H:%M:%S')} - "
      log_text += "#{log.user&.name || 'System'} - #{log.action}"
      
      # Handle text wrapping for long audit logs
      text_lines = wrap_text(log_text, 90)
      text_lines.each do |line|
        canvas.text(line, at: [50, y_position])
        y_position -= 15
      end
      
      # Add a new page if we're running out of space
      if y_position < 100
        page = pdf.pages.add
        canvas = page.canvas
        canvas.font(title_font, size: 14)
        canvas.text("Document Audit Trail (continued)", at: [50, 750])
        y_position = 730
      end
    end
    
    # Add verification QR code
    add_verification_qr_code(pdf)
    
    # Add footer to all pages
    add_footer_to_all_pages(pdf)
    
    pdf
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
  
  def add_security_features(pdf)
    # Generate a document hash
    document_hash = generate_document_hash(pdf)
    
    # Store the hash in the document
    document.update(
      verification_hash: document_hash,
      verification_method: 'sha256',
      verification_timestamp: Time.current,
      public_access_token: SecureRandom.urlsafe_base64(32),
      access_expires_at: 30.days.from_now
    )
    
    # Add invisible digital signature
    apply_digital_signature(pdf, document_hash)
  end
  
  def save_finalized_document(pdf)
    # Create a temporary file for the PDF
    temp_file = Tempfile.new(['finalized_', '.pdf'])
    begin
      pdf.write(temp_file.path, optimize: true)
      
      # Attach the PDF to the document
      document.completed_file.attach(
        io: File.open(temp_file.path),
        filename: "#{document.title.parameterize}_completed.pdf",
        content_type: 'application/pdf'
      )
    ensure
      temp_file.close
      temp_file.unlink
    end
  end
  
  def notify_participants
    # Notify the document creator
    DocumentCompletionMailer.document_completed(document).deliver_later
    
    # Notify all signers
    document.document_signers.completed.each do |signer|
      DocumentCompletionMailer.document_signed(document, signer).deliver_later
    end
  end
  
  def download_original_pdf
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
  
  def add_signature_image(canvas, signature_data, x, y, width, height)
    # Skip if the signature data doesn't look like a data URL
    return unless signature_data.start_with?('data:image/')
    
    # Extract the image data from the data URL
    image_data = extract_image_data(signature_data)
    
    # Create a temporary file for the image
    temp_file = Tempfile.new(['signature_', '.png'])
    begin
      temp_file.binmode
      temp_file.write(image_data)
      temp_file.flush
      
      # Add the image to the PDF
      image = canvas.context.add_image(temp_file.path)
      canvas.xobject(image, at: [x, y], width: width, height: height)
    rescue => e
      Rails.logger.error("Failed to add signature image: #{e.message}")
    ensure
      temp_file.close
      temp_file.unlink
    end
  end
  
  def add_text(canvas, text, x, y, width, height)
    # Set up text options
    canvas.font("Helvetica", size: 11)
    
    # Calculate text position (centered in the field)
    text_width = canvas.font.text_width(text)
    text_x = x + (width - text_width) / 2
    text_y = y + height / 3
    
    # Add the text
    canvas.text(text, at: [text_x, text_y])
  end
  
  def extract_image_data(data_url)
    # Data URLs are formatted as data:[<MIME-type>][;base64],<data>
    content_type, data = data_url.split(';base64,')
    Base64.decode64(data)
  end
  
  def get_ip_location(ip)
    return nil unless ip.present?
    
    # This would typically use a geolocation service like MaxMind GeoIP
    # For demonstration, we'll just return a placeholder
    "Location information would be retrieved here"
  end
  
  def get_browser_info(user_agent)
    return nil unless user_agent.present?
    
    # Parse user agent with the browser gem
    browser = Browser.new(user_agent)
    "#{browser.name} #{browser.version} on #{browser.platform.name}"
  end
  
  def generate_document_hash(pdf)
    # Create a temporary file for the PDF
    temp_file = Tempfile.new(['hash_', '.pdf'])
    begin
      pdf.write(temp_file.path)
      
      # Generate SHA-256 hash of the PDF
      digest = Digest::SHA256.file(temp_file.path).hexdigest
    ensure
      temp_file.close
      temp_file.unlink
    end
    
    digest
  end
  
  def apply_digital_signature(pdf, document_hash)
    # This would typically use proper digital signature mechanisms
    # For demonstration, we'll just add a custom metadata field
    info = pdf.trailer.info
    info[:DocumentHash] = document_hash
    info[:SignedAt] = Time.current.iso8601
    info[:SignedBy] = "DocuSign Clone System"
  end
  
  def add_verification_qr_code(pdf)
    # Generate a verification URL
    verification_url = Rails.application.routes.url_helpers.verify_document_url(
      token: document.public_access_token,
      host: Rails.application.config.action_mailer.default_url_options[:host]
    )
    
    # Generate QR code
    qrcode = RQRCode::QRCode.new(verification_url)
    
    # Create a temporary PNG file
    temp_file = Tempfile.new(['qrcode_', '.png'])
    begin
      qrcode.as_png(
        bit_depth: 1,
        border_modules: 4,
        color_mode: ChunkyPNG::COLOR_GRAYSCALE,
        color: 'black',
        file: temp_file.path,
        fill: 'white',
        module_px_size: 6,
        resize_exactly_to: false,
        resize_gte_to: false,
        size: 120
      )
      
      # Add to the last page
      last_page = pdf.pages[-1]
      canvas = last_page.canvas
      
      # Add QR code
      image = canvas.context.add_image(temp_file.path)
      canvas.xobject(image, at: [last_page.box.width - 150, 50], width: 100, height: 100)
      
      # Add verification text
      canvas.font("Helvetica", size: 8)
      canvas.text("Scan to verify document authenticity", at: [last_page.box.width - 180, 40])
      canvas.text(verification_url, at: [last_page.box.width - 180, 30])
    ensure
      temp_file.close
      temp_file.unlink
    end
  end
  
  def add_footer_to_all_pages(pdf)
    pdf.pages.each_with_index do |page, index|
      canvas = page.canvas
      canvas.font("Helvetica", size: 8)
      
      # Add page numbers
      page_text = "Page #{index + 1} of #{pdf.pages.count}"
      page_width = canvas.font.text_width(page_text)
      canvas.text(page_text, at: [(page.box.width - page_width) / 2, 20])
      
      # Add footer text
      canvas.text(
        "This certificate documents the electronic signing of this document and serves as proof of signature authenticity.",
        at: [50, 10]
      )
    end
  end
  
  def wrap_text(text, max_chars_per_line)
    return [text] if text.length <= max_chars_per_line
    
    words = text.split(' ')
    lines = []
    current_line = ""
    
    words.each do |word|
      if (current_line.length + word.length + 1) <= max_chars_per_line
        current_line += " " unless current_line.empty?
        current_line += word
      else
        lines << current_line unless current_line.empty?
        current_line = word
      end
    end
    
    lines << current_line unless current_line.empty?
    lines
  end
end
```

### Update Generate Final Document Job

Modify the background job to use the new DocumentFinalizerService:

```ruby
# app/jobs/generate_final_document_job.rb
class GenerateFinalDocumentJob < ApplicationJob
  queue_as :priority
  
  def perform(document_id)
    document = Document.find_by(id: document_id)
    return unless document && document.completed?
    
    finalizer = DocumentFinalizerService.new(document)
    
    unless finalizer.finalize
      # Log errors
      finalizer.errors.each do |error|
        Rails.logger.error("Document finalization error: #{error}")
      end
      
      # Retry with exponential backoff, up to 24 hours
      retry_job(wait: calculate_backoff)
    end
  end
  
  private
  
  def calculate_backoff
    # Calculate exponential backoff with jitter
    retry_count = executions
    base_delay = 5.minutes
    max_delay = 3.hours
    
    delay = [base_delay * (2 ** retry_count), max_delay].min
    actual_delay = delay * (0.5 + rand * 0.5) # Add 50% jitter
    
    # Ensure we don't exceed 24 hours total
    if Time.current - created_at > 24.hours
      # Don't retry anymore
      discard_job
      return 0
    end
    
    actual_delay
  end
end
```

## Audit Trail System

### Update Audit Log Model

```ruby
# app/models/audit_log.rb
class AuditLog < ApplicationRecord
  belongs_to :document
  belongs_to :user, optional: true
  belongs_to :signature, optional: true
  
  # Serialize JSON fields
  serialize :metadata, JSON
  serialize :browser_info, JSON
  serialize :device_info, JSON
  serialize :verification_data, JSON
  
  validates :action, presence: true
  
  scope :ordered, -> { order(created_at: :asc) }
  scope :for_document, ->(document_id) { where(document_id: document_id) }
  scope :recent, -> { order(created_at: :desc).limit(100) }
  
  def self.record(document, user, action, request = nil, metadata = {})
    browser_data = {}
    device_data = {}
    
    if request
      # Parse user agent if available
      if request.user_agent.present?
        browser = Browser.new(request.user_agent)
        browser_data = {
          name: browser.name,
          version: browser.version,
          platform: browser.platform.name,
          device: browser.device.name,
          bot: browser.bot?
        }
        
        device_data = {
          mobile: browser.device.mobile?,
          tablet: browser.device.tablet?,
          desktop: !browser.device.mobile? && !browser.device.tablet?
        }
      end
    end
    
    # Look up IP location asynchronously to not block the request
    ip_location = nil
    if request&.remote_ip.present?
      # In a real app, you'd use a background job or geolocation service
      # For now, we'll just note that geolocation would happen here
      ip_location = "IP would be geolocated here"
    end
    
    create!(
      document: document,
      user: user,
      action: action,
      ip_address: request&.remote_ip,
      ip_location: ip_location,
      user_agent: request&.user_agent,
      browser_info: browser_data,
      device_info: device_data,
      metadata: metadata
    )
  end
  
  def display_user
    if user
      user.name
    else
      "System"
    end
  end
  
  def display_action
    "#{action.humanize} at #{created_at.strftime('%B %d, %Y at %I:%M %p')}"
  end
  
  def display_ip
    if ip_address.present?
      location = ip_location.present? ? " (#{ip_location})" : ""
      "#{ip_address}#{location}"
    else
      "Not recorded"
    end
  end
  
  def display_device
    if user_agent.present?
      browser = browser_info&.dig('name') || 'Unknown'
      platform = browser_info&.dig('platform') || 'Unknown'
      "#{browser} on #{platform}"
    else
      "Not recorded"
    end
  end
end
```

### Enhanced Document Logging

Update the Document model to use the enhanced audit logging:

```ruby
# app/models/document.rb (additions)
def log_activity(user, action, request = nil, metadata = {})
  AuditLog.record(self, user, action, request, metadata)
end

def log_system_activity(action, metadata = {})
  AuditLog.record(self, nil, action, nil, metadata)
end

def log_security_event(user, action, request = nil, verification_data = {})
  audit_log = AuditLog.record(self, user, action, request, {
    security_event: true,
    timestamp: Time.current
  })
  
  audit_log.update(verification_data: verification_data)
  audit_log
end
```

## Document Security

### Document Verification Controller

Create a controller for document verification:

```bash
rails generate controller DocumentVerification verify show download download_archive
```

```ruby
# app/controllers/document_verification_controller.rb
class DocumentVerificationController < ApplicationController
  skip_before_action :authenticate_user!, only: [:verify, :show, :download]
  before_action :set_document_by_token, only: [:verify, :show, :download]
  before_action :verify_access, only: [:show, :download]
  
  def verify
    # If the document is found, show the verification page
    if @document
      # Log verification attempt
      @document.log_security_event(
        current_user,
        'verified',
        request,
        { verification_method: 'public_link' }
      )
      
      # Update access count
      @document.increment!(:access_count)
      
      # Render verification page
      render :verify
    else
      # Invalid token
      render :verification_failed
    end
  end
  
  def show
    # Show the document details along with the audit trail
    @audit_logs = @document.audit_logs.ordered
    @document_signers = @document.document_signers.includes(:user).ordered
    
    # Log view
    @document.log_security_event(
      current_user,
      'viewed_verified_document',
      request
    )
  end
  
  def download
    # Ensure the document has a completed file
    unless @document.completed_file.attached?
      flash[:error] = "The completed document is not available for download."
      redirect_to verify_document_path(token: @document.public_access_token)
      return
    end
    
    # Log download
    @document.log_security_event(
      current_user,
      'downloaded_verified_document',
      request
    )
    
    # Stream the file
    redirect_to rails_blob_url(@document.completed_file)
  end
  
  def download_archive
    # This action requires authentication
    @document = Document.find(params[:id])
    
    # Ensure the user has permission to download the archive
    unless @document.creator == current_user || current_user.admin?
      flash[:error] = "You don't have permission to download this document archive."
      redirect_to document_path(@document)
      return
    end
    
    # Create a temporary zip file
    temp_file = Tempfile.new(['document_archive_', '.zip'])
    
    begin
      # Create a zip file with the document and audit trail
      Zip::File.open(temp_file.path, Zip::File::CREATE) do |zipfile|
        # Add the original document
        if @document.file.attached?
          original_blob = @document.file.blob
          original_path = ActiveStorage::Blob.service.path_for(original_blob.key)
          zipfile.add("original_#{@document.file.filename}", original_path)
        end
        
        # Add the completed document
        if @document.completed_file.attached?
          completed_blob = @document.completed_file.blob
          completed_path = ActiveStorage::Blob.service.path_for(completed_blob.key)
          zipfile.add("completed_#{@document.completed_file.filename}", completed_path)
        end
        
        # Add the audit trail as CSV
        audit_trail_csv = generate_audit_trail_csv
        zipfile.get_output_stream("audit_trail.csv") { |f| f.write(audit_trail_csv) }
        
        # Add a verification certificate
        certificate_pdf = generate_verification_certificate
        zipfile.get_output_stream("verification_certificate.pdf") { |f| f.write(certificate_pdf) }
      end
      
      # Log the archive download
      @document.log_activity(
        current_user,
        'downloaded_archive',
        request,
        { archive_type: 'compliance' }
      )
      
      # Stream the zip file
      send_file temp_file.path,
                type: 'application/zip',
                disposition: 'attachment',
                filename: "#{@document.title.parameterize}_archive.zip"
    ensure
      # Clean up the temp file
      temp_file.close
      temp_file.unlink
    end
  end
  
  private
  
  def set_document_by_token
    @document = Document.find_by(public_access_token: params[:token])
    
    unless @document
      render :verification_failed
    end
  end
  
  def verify_access
    # Check if the document has expired access
    if @document.access_expires_at.present? && @document.access_expires_at < Time.current
      render :verification_expired
      return
    end
    
    # All good, access is allowed
  end
  
  def generate_audit_trail_csv
    require 'csv'
    
    headers = ['Timestamp', 'User', 'Action', 'IP Address', 'Location', 'Browser', 'Device']
    
    CSV.generate do |csv|
      csv << headers
      
      @document.audit_logs.ordered.each do |log|
        csv << [
          log.created_at,
          log.display_user,
          log.action,
          log.ip_address,
          log.ip_location,
          log.browser_info&.dig('name'),
          log.device_info&.dig('device')
        ]
      end
    end
  end
  
  def generate_verification_certificate
    # Create a new PDF document for the certificate
    pdf = HexaPDF::Document.new
    
    # Add a page
    page = pdf.pages.add
    canvas = page.canvas
    
    # Set up fonts
    pdf.fonts.add("Helvetica")
    title_font = "Helvetica"
    regular_font = "Helvetica"
    
    # Document title
    canvas.font(title_font, size: 18)
    canvas.text("Document Verification Certificate", at: [50, 750])
    
    # Document Info
    canvas.font(title_font, size: 14)
    canvas.text("Document Information", at: [50, 700])
    
    canvas.font(regular_font, size: 11)
    canvas.text("Title: #{@document.title}", at: [50, 680])
    canvas.text("Document ID: #{@document.id}", at: [50, 660])
    canvas.text("Created: #{@document.created_at.strftime('%B %d, %Y at %I:%M %p')}", at: [50, 640])
    canvas.text("Completed: #{@document.completed_at&.strftime('%B %d, %Y at %I:%M %p')}", at: [50, 620])
    canvas.text("Document Hash: #{@document.verification_hash}", at: [50, 600])
    canvas.text("Verification Method: #{@document.verification_method}", at: [50, 580])
    canvas.text("Verified At: #{@document.verification_timestamp&.strftime('%B %d, %Y at %I:%M %p')}", at: [50, 560])
    
    # Add verification statement
    canvas.font(regular_font, size: 12)
    canvas.text("This certificate verifies that the document is authentic and has not been", at: [50, 500])
    canvas.text("tampered with since it was completed and digitally signed.", at: [50, 480])
    
    # Add timestamp
    canvas.font(regular_font, size: 10)
    canvas.text("Certificate generated: #{Time.current.strftime('%B %d, %Y at %I:%M %p')}", at: [50, 100])
    
    # Add official footer
    canvas.font(regular_font, size: 8)
    canvas.text(
      "This certificate is part of the compliance archive for this document and does not constitute legal advice.",
      at: [50, 50]
    )
    
    # Create a temporary file
    temp_file = Tempfile.new(['certificate_', '.pdf'])
    begin
      pdf.write(temp_file.path)
      temp_file.rewind
      return temp_file.read
    ensure
      temp_file.close
      temp_file.unlink
    end
  end
end
```

### Document Verification Routes

Add routes for document verification:

```ruby
# config/routes.rb (additions)
# Document verification
get 'verify/:token', to: 'document_verification#verify', as: :verify_document
get 'verify/:token/show', to: 'document_verification#show', as: :show_verified_document
get 'verify/:token/download', to: 'document_verification#download', as: :download_verified_document
get 'documents/:id/download_archive', to: 'document_verification#download_archive', as: :download_document_archive
```

### Document Verification Views

Create the verification views:

```erb
<!-- app/views/document_verification/verify.html.erb -->
<div class="container py-5">
  <div class="row justify-content-center">
    <div class="col-md-8">
      <div class="card shadow">
        <div class="card-header bg-success text-white">
          <h1 class="h4 mb-0">Document Verification</h1>
        </div>
        
        <div class="card-body p-4">
          <div class="text-center mb-4">
            <div class="mb-3">
              <i class="bi bi-check-circle-fill text-success" style="font-size: 3rem;"></i>
            </div>
            <h2 class="h3">Verified Document</h2>
            <p class="text-muted mb-0">
              This document has been successfully verified and is authentic.
            </p>
          </div>
          
          <div class="alert alert-info">
            <h3 class="h5"><i class="bi bi-info-circle"></i> Document Information</h3>
            <div class="row g-3">
              <div class="col-md-6">
                <strong>Title:</strong> <%= @document.title %>
              </div>
              <div class="col-md-6">
                <strong>Document ID:</strong> <%= @document.id %>
              </div>
              <div class="col-md-6">
                <strong>Created:</strong> <%= @document.created_at.strftime('%B %d, %Y') %>
              </div>
              <div class="col-md-6">
                <strong>Status:</strong> 
                <span class="badge bg-success">Completed</span>
              </div>
            </div>
          </div>
          
          <div class="d-grid gap-2">
            <%= link_to show_verified_document_path(token: @document.public_access_token), 
                       class: "btn btn-primary" do %>
              <i class="bi bi-eye"></i> View Document Details
            <% end %>
            
            <% if @document.completed_file.attached? %>
              <%= link_to download_verified_document_path(token: @document.public_access_token), 
                         class: "btn btn-outline-primary" do %>
                <i class="bi bi-file-earmark-pdf"></i> Download Document
              <% end %>
            <% end %>
          </div>
          
          <div class="mt-4 text-center">
            <small class="text-muted">
              This document was verified on <%= Time.current.strftime('%B %d, %Y at %I:%M %p') %>
            </small>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>
```

```erb
<!-- app/views/document_verification/show.html.erb -->
<div class="container py-4">
  <div class="d-flex justify-content-between align-items-center mb-4">
    <h1 class="h3 mb-0">Verified Document: <%= @document.title %></h1>
    
    <div>
      <% if @document.completed_file.attached? %>
        <%= link_to download_verified_document_path(token: @document.public_access_token), 
                   class: "btn btn-outline-primary" do %>
          <i class="bi bi-file-earmark-pdf"></i> Download Document
        <% end %>
      <% end %>
    </div>
  </div>
  
  <div class="row">
    <div class="col-md-8">
      <!-- Document Information -->
      <div class="card mb-4">
        <div class="card-header">
          <h2 class="h5 mb-0">Document Details</h2>
        </div>
        <div class="card-body">
          <div class="row g-3">
            <div class="col-md-6">
              <strong>Title:</strong> <%= @document.title %>
            </div>
            <div class="col-md-6">
              <strong>Document ID:</strong> <%= @document.id %>
            </div>
            <div class="col-md-6">
              <strong>Created:</strong> <%= @document.created_at.strftime('%B %d, %Y at %I:%M %p') %>
            </div>
            <div class="col-md-6">
              <strong>Completed:</strong> <%= @document.completed_at&.strftime('%B %d, %Y at %I:%M %p') || 'Not completed' %>
            </div>
            <div class="col-md-6">
              <strong>Creator:</strong> <%= @document.creator.name %>
            </div>
            <div class="col-md-6">
              <strong>Status:</strong> <span class="badge bg-success">Completed</span>
            </div>
            <div class="col-md-12">
              <strong>Verification Hash:</strong>
              <code class="small d-block bg-light p-2 mt-1 text-break"><%= @document.verification_hash %></code>
            </div>
          </div>
        </div>
      </div>
      
      <!-- Signers -->
      <div class="card mb-4">
        <div class="card-header">
          <h2 class="h5 mb-0">Signers</h2>
        </div>
        <div class="card-body p-0">
          <div class="table-responsive">
            <table class="table table-hover mb-0">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Signer</th>
                  <th>Status</th>
                  <th>Signed At</th>
                </tr>
              </thead>
              <tbody>
                <% @document_signers.each_with_index do |signer, index| %>
                  <tr>
                    <td><%= index + 1 %></td>
                    <td>
                      <%= signer.user.name %><br>
                      <small class="text-muted"><%= signer.user.email %></small>
                    </td>
                    <td>
                      <% if signer.completed? %>
                        <span class="badge bg-success">Signed</span>
                      <% elsif signer.declined? %>
                        <span class="badge bg-danger">Declined</span>
                      <% else %>
                        <span class="badge bg-secondary"><%= signer.status.humanize %></span>
                      <% end %>
                    </td>
                    <td>
                      <% if signer.signed_at %>
                        <%= signer.signed_at.strftime('%B %d, %Y at %I:%M %p') %>
                      <% else %>
                        —
                      <% end %>
                    </td>
                  </tr>
                <% end %>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
    
    <div class="col-md-4">
      <!-- Verification Info -->
      <div class="card mb-4">
        <div class="card-header">
          <h2 class="h5 mb-0">Verification Information</h2>
        </div>
        <div class="card-body">
          <div class="mb-3">
            <strong>Verified:</strong> 
            <span class="badge bg-success">Authentic</span>
          </div>
          <div class="mb-3">
            <strong>Verification Method:</strong> 
            <%= @document.verification_method&.humanize || 'SHA-256' %>
          </div>
          <div class="mb-3">
            <strong>Verification Time:</strong>
            <%= @document.verification_timestamp&.strftime('%B %d, %Y at %I:%M %p') || Time.current.strftime('%B %d, %Y at %I:%M %p') %>
          </div>
          <div class="mb-3">
            <strong>Access Count:</strong>
            <%= @document.access_count %>
          </div>
          <div>
            <strong>Link Expires:</strong>
            <% if @document.access_expires_at %>
              <%= @document.access_expires_at.strftime('%B %d, %Y') %>
            <% else %>
              Never
            <% end %>
          </div>
        </div>
      </div>
      
      <!-- Audit Trail Preview -->
      <div class="card">
        <div class="card-header d-flex justify-content-between align-items-center">
          <h2 class="h5 mb-0">Audit Trail</h2>
          <span class="badge bg-secondary">Recent 10</span>
        </div>
        <div class="card-body p-0">
          <div class="list-group list-group-flush">
            <% @audit_logs.first(10).each do |log| %>
              <div class="list-group-item">
                <div class="d-flex justify-content-between align-items-center">
                  <div>
                    <strong><%= log.display_user %></strong> 
                    <%= log.action.humanize %>
                  </div>
                  <small class="text-muted"><%= time_ago_in_words(log.created_at) %> ago</small>
                </div>
                <% if log.ip_address.present? %>
                  <small class="text-muted d-block">
                    IP: <%= log.ip_address %>
                    <% if log.ip_location.present? %>
                      (<%= log.ip_location %>)
                    <% end %>
                  </small>
                <% end %>
              </div>
            <% end %>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>
```

```erb
<!-- app/views/document_verification/verification_failed.html.erb -->
<div class="container py-5">
  <div class="row justify-content-center">
    <div class="col-md-8 text-center">
      <div class="card shadow">
        <div class="card-header bg-danger text-white">
          <h1 class="h4 mb-0">Verification Failed</h1>
        </div>
        
        <div class="card-body p-4">
          <div class="mb-4">
            <i class="bi bi-x-circle-fill text-danger" style="font-size: 3rem;"></i>
          </div>
          
          <h2 class="h3 mb-3">Invalid Verification Link</h2>
          
          <p class="mb-4">
            We couldn't verify this document. The verification link may be invalid or has expired.
          </p>
          
          <div class="alert alert-warning">
            <p class="mb-0">
              If you believe this is an error, please contact the document owner for a new verification link.
            </p>
          </div>
          
          <div class="mt-4">
            <%= link_to "Return to Home", root_path, class: "btn btn-primary" %>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>
```

```erb
<!-- app/views/document_verification/verification_expired.html.erb -->
<div class="container py-5">
  <div class="row justify-content-center">
    <div class="col-md-8 text-center">
      <div class="card shadow">
        <div class="card-header bg-warning text-dark">
          <h1 class="h4 mb-0">Verification Link Expired</h1>
        </div>
        
        <div class="card-body p-4">
          <div class="mb-4">
            <i class="bi bi-clock-history text-warning" style="font-size: 3rem;"></i>
          </div>
          
          <h2 class="h3 mb-3">Access Expired</h2>
          
          <p class="mb-4">
            The public access link for this document has expired.
          </p>
          
          <div class="alert alert-info">
            <p class="mb-0">
              Please contact the document owner for a new verification link if you need to view this document.
            </p>
          </div>
          
          <div class="mt-4">
            <%= link_to "Return to Home", root_path, class: "btn btn-primary" %>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>
```

## Tamper-Evident Mechanisms

### Document Verification Service

Create a service to handle document verification:

```ruby
# app/services/document_verification_service.rb
class DocumentVerificationService
  attr_reader :document, :errors
  
  def initialize(document)
    @document = document
    @errors = []
  end
  
  def verify_document_integrity
    return false unless document.completed_file.attached?
    
    # Download the document
    temp_file = download_document
    
    begin
      # Calculate hash of the current document
      current_hash = calculate_document_hash(temp_file.path)
      
      # Compare with stored hash
      if current_hash == document.verification_hash
        document.update(verification_timestamp: Time.current)
        true
      else
        @errors << "Document hash mismatch: possible tampering detected"
        false
      end
    rescue => e
      @errors << "Verification error: #{e.message}"
      false
    ensure
      temp_file.close
      temp_file.unlink
    end
  end
  
  def renew_access_token
    document.update(
      public_access_token: SecureRandom.urlsafe_base64(32),
      access_expires_at: 30.days.from_now
    )
  end
  
  def mark_verified_by(user)
    document.update(verified_by: user)
  end
  
  private
  
  def download_document
    temp_file = Tempfile.new(['verify_', '.pdf'])
    begin
      temp_file.binmode
      temp_file.write(document.completed_file.download)
      temp_file.flush
      temp_file
    rescue => e
      temp_file.close
      temp_file.unlink
      raise e
    end
  end
  
  def calculate_document_hash(file_path)
    Digest::SHA256.file(file_path).hexdigest
  end
end
```

### Add Tamper Detection to Documents Controller

```ruby
# app/controllers/documents_controller.rb (additions)
def download
  @document = Document.find(params[:id])
  
  # Ensure user has permission
  unless @document.viewable_by?(current_user)
    flash[:error] = "You don't have permission to download this document."
    redirect_to documents_path
    return
  end
  
  # Determine which file to download (original or completed)
  if params[:completed] && @document.completed_file.attached?
    # Verify document integrity before download
    verifier = DocumentVerificationService.new(@document)
    
    if verifier.verify_document_integrity
      # Log successful verification
      @document.log_security_event(
        current_user,
        'verified_before_download',
        request,
        { verification_method: 'integrity_check', result: 'success' }
      )
      
      # Download the file
      redirect_to rails_blob_url(@document.completed_file)
    else
      # Log integrity failure
      @document.log_security_event(
        current_user,
        'verification_failed',
        request,
        { 
          verification_method: 'integrity_check', 
          result: 'failure',
          errors: verifier.errors
        }
      )
      
      flash[:error] = "Document integrity check failed. The file may have been tampered with."
      redirect_to document_path(@document)
    end
  elsif @document.file.attached?
    # Log download of original
    @document.log_activity(current_user, 'downloaded_original', request)
    
    # Download original file
    redirect_to rails_blob_url(@document.file)
  else
    flash[:error] = "No file is available for download."
    redirect_to document_path(@document)
  end
end
```

## Document Verification

### Add Document Verification to Documents Controller

```ruby
# app/controllers/documents_controller.rb (additions)
def verify_integrity
  @document = Document.find(params[:id])
  
  # Ensure user has permission
  unless @document.creator == current_user || current_user.admin?
    flash[:error] = "You don't have permission to verify this document."
    redirect_to documents_path
    return
  end
  
  # Verify document integrity
  verifier = DocumentVerificationService.new(@document)
  
  if verifier.verify_document_integrity
    # Log successful verification
    @document.log_security_event(
      current_user,
      'manual_verification',
      request,
      { verification_method: 'integrity_check', result: 'success' }
    )
    
    # Mark as verified by this user
    verifier.mark_verified_by(current_user)
    
    flash[:success] = "Document integrity verified successfully."
  else
    # Log integrity failure
    @document.log_security_event(
      current_user,
      'manual_verification_failed',
      request,
      { 
        verification_method: 'integrity_check', 
        result: 'failure',
        errors: verifier.errors
      }
    )
    
    flash[:error] = "Document integrity check failed: #{verifier.errors.join(', ')}"
  end
  
  redirect_to document_path(@document)
end

def regenerate_access_token
  @document = Document.find(params[:id])
  
  # Ensure user has permission
  unless @document.creator == current_user || current_user.admin?
    flash[:error] = "You don't have permission to regenerate the access token."
    redirect_to documents_path
    return
  end
  
  # Regenerate access token
  verifier = DocumentVerificationService.new(@document)
  verifier.renew_access_token
  
  # Log token regeneration
  @document.log_security_event(
    current_user,
    'regenerated_access_token',
    request,
    { expires_at: @document.access_expires_at }
  )
  
  flash[:success] = "Access token has been regenerated and will expire in 30 days."
  redirect_to document_path(@document)
end
```

### Add Routes for Verification

```ruby
# config/routes.rb (additions)
resources :documents do
  # ... existing document routes
  
  member do
    post :verify_integrity
    post :regenerate_access_token
  end
end
```

## Notifications and Access Control

### Update Document Show Page with Security Features

```erb
<!-- app/views/documents/show.html.erb (additions) -->
<!-- Add these elements to the existing show page -->

<!-- Security information for completed documents -->
<% if @document.completed? && @document.completed_file.attached? %>
  <div class="card mb-4">
    <div class="card-header d-flex justify-content-between align-items-center">
      <h2 class="h5 mb-0">Security & Verification</h2>
      
      <div class="btn-group">
        <%= button_to verify_integrity_document_path(@document), method: :post, 
                     class: "btn btn-sm btn-outline-primary" do %>
          <i class="bi bi-shield-check"></i> Verify Integrity
        <% end %>
        
        <%= button_to regenerate_access_token_document_path(@document), method: :post, 
                     class: "btn btn-sm btn-outline-secondary" do %>
          <i class="bi bi-key"></i> Regenerate Access Token
        <% end %>
      </div>
    </div>
    
    <div class="card-body">
      <div class="row g-3">
        <div class="col-md-6">
          <strong>Security Level:</strong> 
          <%= @document.security_level.humanize %>
        </div>
        <div class="col-md-6">
          <strong>Last Verified:</strong> 
          <%= @document.verification_timestamp&.strftime('%B %d, %Y at %I:%M %p') || 'Not verified' %>
        </div>
        <div class="col-md-12">
          <strong>Verification Hash:</strong>
          <code class="small d-block bg-light p-2 mt-1 text-break"><%= @document.verification_hash %></code>
        </div>
        <div class="col-md-12">
          <strong>Public Verification Link:</strong>
          <div class="input-group mt-1">
            <input type="text" class="form-control form-control-sm" readonly 
                   value="<%= verify_document_url(token: @document.public_access_token) %>">
            <button class="btn btn-outline-secondary btn-sm" type="button" 
                    data-bs-toggle="tooltip" title="Copy to clipboard"
                    onclick="navigator.clipboard.writeText(this.previousElementSibling.value)">
              <i class="bi bi-clipboard"></i>
            </button>
          </div>
          <small class="text-muted">
            This link expires: <%= @document.access_expires_at&.strftime('%B %d, %Y') || 'Never' %>
          </small>
        </div>
      </div>
      
      <div class="mt-3">
        <%= link_to download_document_archive_path(@document), 
                   class: "btn btn-outline-secondary btn-sm" do %>
          <i class="bi bi-file-earmark-zip"></i> Download Compliance Archive
        <% end %>
        
        <button type="button" class="btn btn-outline-info btn-sm" 
                data-bs-toggle="modal" data-bs-target="#securityInfoModal">
          <i class="bi bi-info-circle"></i> About Document Security
        </button>
      </div>
    </div>
  </div>
<% end %>

<!-- Security Info Modal -->
<div class="modal fade" id="securityInfoModal" tabindex="-1" aria-labelledby="securityInfoModalLabel" aria-hidden="true">
  <div class="modal-dialog modal-lg">
    <div class="modal-content">
      <div class="modal-header">
        <h5 class="modal-title" id="securityInfoModalLabel">Document Security Features</h5>
        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
      </div>
      <div class="modal-body">
        <div class="mb-4">
          <h6>Tamper-Evident Protection</h6>
          <p>
            This document is protected with tamper-evident technology. A cryptographic hash (SHA-256) is calculated
            when the document is finalized, and this hash is stored securely. Any changes to the document, 
            even a single pixel or character, will result in a different hash value.
          </p>
        </div>
        
        <div class="mb-4">
          <h6>Public Verification Link</h6>
          <p>
            The public verification link allows anyone with the link to verify the document's authenticity
            without requiring a login. This link can be shared with third parties who need to verify the document.
            For security reasons, the link expires after 30 days by default, but you can regenerate it at any time.
          </p>
        </div>
        
        <div class="mb-4">
          <h6>Compliance Archive</h6>
          <p>
            The compliance archive is a ZIP file containing the original document, the signed document,
            a complete audit trail, and a verification certificate. This archive can be used for compliance,
            legal, or record-keeping purposes.
          </p>
        </div>
        
        <div>
          <h6>Audit Trail</h6>
          <p>
            Every action related to this document is recorded in the audit trail, including who viewed it,
            when it was signed, and when it was verified. The audit trail includes IP addresses, browser information,
            and timestamps to provide a complete record of the document's lifecycle.
          </p>
        </div>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
      </div>
    </div>
  </div>
</div>
```

## Testing

### Create Unit Tests for Document Verification

```ruby
# test/services/document_verification_service_test.rb
require 'test_helper'

class DocumentVerificationServiceTest < ActiveSupport::TestCase
  setup do
    @document = documents(:completed)
    
    # Ensure the document has a completed file attached
    unless @document.completed_file.attached?
      @document.completed_file.attach(
        io: File.open(Rails.root.join("test/fixtures/files/completed_sample.pdf")),
        filename: "completed_sample.pdf",
        content_type: "application/pdf"
      )
    end
    
    # Set a verification hash
    @document.update(
      verification_hash: "123456789abcdef123456789abcdef123456789abcdef123456789abcdef1234",
      verification_method: "sha256",
      verification_timestamp: 1.day.ago,
      public_access_token: "test_token",
      access_expires_at: 30.days.from_now
    )
    
    @service = DocumentVerificationService.new(@document)
  end
  
  test "renew_access_token should generate a new token" do
    old_token = @document.public_access_token
    old_expires = @document.access_expires_at
    
    @service.renew_access_token
    
    assert_not_equal old_token, @document.public_access_token
    assert @document.access_expires_at > old_expires
  end
  
  test "mark_verified_by should update the verified_by user" do
    user = users(:admin)
    @service.mark_verified_by(user)
    
    assert_equal user, @document.verified_by
  end
  
  test "verify_document_integrity should detect hash mismatch" do
    # Mock the calculate_document_hash method to return a different hash
    @service.stub :calculate_document_hash, "different_hash" do
      assert_not @service.verify_document_integrity
      assert_includes @service.errors, "Document hash mismatch: possible tampering detected"
    end
  end
end
```

### Create Integration Tests for Document Verification

```ruby
# test/controllers/document_verification_controller_test.rb
require 'test_helper'

class DocumentVerificationControllerTest < ActionDispatch::IntegrationTest
  setup do
    @document = documents(:completed)
    
    # Ensure the document has a completed file attached
    unless @document.completed_file.attached?
      @document.completed_file.attach(
        io: File.open(Rails.root.join("test/fixtures/files/completed_sample.pdf")),
        filename: "completed_sample.pdf",
        content_type: "application/pdf"
      )
    end
    
    # Set a verification hash and public token
    @document.update(
      verification_hash: "123456789abcdef123456789abcdef123456789abcdef123456789abcdef1234",
      verification_method: "sha256",
      verification_timestamp: 1.day.ago,
      public_access_token: "test_token",
      access_expires_at: 30.days.from_now
    )
  end
  
  test "should show verification page for valid token" do
    get verify_document_url(token: @document.public_access_token)
    assert_response :success
  end
  
  test "should show verification failed for invalid token" do
    get verify_document_url(token: "invalid_token")
    assert_response :success
    assert_select "h1", "Verification Failed"
  end
  
  test "should show document details when verified" do
    get show_verified_document_url(token: @document.public_access_token)
    assert_response :success
    assert_select "h1", /Verified Document/
  end
  
  test "should download verified document" do
    get download_verified_document_url(token: @document.public_access_token)
    assert_redirected_to %r{/rails/active_storage/blobs/}
  end
  
  test "should increase access count on verification" do
    assert_difference -> { @document.reload.access_count } do
      get verify_document_url(token: @document.public_access_token)
    end
  end
end
```

## Production Security Considerations

### Secure Environment Configuration

When deploying to production, ensure you have appropriate security configurations:

```ruby
# config/environments/production.rb (security additions)

# Enable HSTS
config.force_ssl = true

# Set secure headers
Rails.application.config.content_security_policy do |policy|
  policy.default_src :self
  policy.font_src    :self, :https, :data
  policy.img_src     :self, :https, :data
  policy.object_src  :none
  policy.script_src  :self
  policy.style_src   :self, :https
  
  # Allow frames for PDF preview
  policy.frame_ancestors :self
  
  # Report CSP violations
  policy.report_uri "/csp-violation-report"
end

# Set secure cookies
Rails.application.config.session_store :cookie_store, 
  key: '_docusign_clone_session',
  secure: true,
  httponly: true,
  same_site: :lax

# Set stronger CSRF protection
Rails.application.config.action_controller.forgery_protection_origin_check = true

# Set strong parameters
config.action_controller.permit_all_parameters = false
```

### Secure Storage Configuration

For document storage in production:

```ruby
# config/storage.yml
amazon:
  service: S3
  access_key_id: <%= Rails.application.credentials.dig(:aws, :access_key_id) %>
  secret_access_key: <%= Rails.application.credentials.dig(:aws, :secret_access_key) %>
  region: <%= Rails.application.credentials.dig(:aws, :region) %>
  bucket: <%= Rails.application.credentials.dig(:aws, :bucket) %>
  upload:
    server_side_encryption: "AES256" # Enable server-side encryption
```

```ruby
# config/environments/production.rb
# Use Amazon S3 for Active Storage
config.active_storage.service = :amazon
```

### Enhanced Security Configurations

For enhanced security, consider implementing the following:

1. **Set up a Web Application Firewall (WAF)**:
   - Use AWS WAF or Cloudflare to protect against common web exploits
   - Configure rate limiting to prevent brute force attacks

2. **Database Encryption**:
   - Use column-level encryption for sensitive data
   - Consider using AWS KMS for key management

3. **Logging and Monitoring**:
   - Set up centralized logging with Papertrail or AWS CloudWatch
   - Configure alerting for suspicious activity
   - Implement regular log analysis

4. **Regular Security Audits**:
   - Schedule penetration testing
   - Conduct regular code security reviews
   - Maintain a vulnerability management process

5. **Compliance Documentation**:
   - Document security controls and processes
   - Create incident response procedures
   - Maintain compliance with relevant regulations (e.g., GDPR, HIPAA)

By implementing these security measures, your DocuSign clone will have robust security features to protect document integrity and user privacy.
