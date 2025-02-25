# Phase 3: Form Fields & Design Implementation Guide

This guide provides comprehensive implementation instructions for Phase 3 of the DocuSign clone, focusing on field placement and document design. It includes all necessary code, commands, and explanations for implementing the form field creation and management functionality.

## Table of Contents
1. [Setup Prerequisites](#setup-prerequisites)
2. [Database Configuration](#database-configuration)
3. [Form Field Models](#form-field-models)
4. [Document Editor Controller](#document-editor-controller)
5. [Field Placement Interface](#field-placement-interface)
6. [Field Type Components](#field-type-components)
7. [Field Assignment to Signers](#field-assignment-to-signers)
8. [Document Preview](#document-preview)
9. [Testing](#testing)

## Setup Prerequisites

Ensure you have completed Phase 2 and have the following in place:
- Rails 8 project with PDF.js integration
- Document model and controller
- Active Storage configuration
- PDF viewer implementation
- Document dashboard

## Database Configuration

### Create Form Field Model

Run the following Rails generate command:

```bash
rails generate model FormField document:references document_signer:references field_type:string page_number:integer x_position:float y_position:float width:float height:float value:text required:boolean label:string
```

Modify the migration to add necessary constraints and defaults:

```ruby
# db/migrate/TIMESTAMP_create_form_fields.rb
class CreateFormFields < ActiveRecord::Migration[8.0]
  def change
    create_table :form_fields do |t|
      t.references :document, null: false, foreign_key: true
      t.references :document_signer, null: true, foreign_key: true
      t.string :field_type, null: false
      t.integer :page_number, null: false
      t.float :x_position, null: false
      t.float :y_position, null: false
      t.float :width, null: false
      t.float :height, null: false
      t.text :value
      t.boolean :required, default: true
      t.string :label
      t.integer :tab_order
      t.timestamps
    end
    
    add_index :form_fields, [:document_id, :field_type]
    add_index :form_fields, [:document_id, :page_number]
  end
end
```

Run the migration:

```bash
rails db:migrate
```

## Form Field Models

### Update Form Field Model

```ruby
# app/models/form_field.rb
class FormField < ApplicationRecord
  belongs_to :document
  belongs_to :document_signer, optional: true
  
  FIELD_TYPES = {
    signature: 'signature',
    initials: 'initials',
    text: 'text',
    date: 'date'
  }.freeze
  
  enum field_type: FIELD_TYPES, _prefix: :type
  
  validates :field_type, :page_number, :x_position, :y_position, :width, :height, presence: true
  validates :field_type, inclusion: { in: FIELD_TYPES.values }
  validates :page_number, numericality: { greater_than: 0 }
  validates :x_position, :y_position, :width, :height, numericality: { greater_than_or_equal_to: 0 }
  
  scope :for_page, ->(page) { where(page_number: page) }
  scope :for_signer, ->(signer_id) { where(document_signer_id: signer_id) }
  scope :ordered_by_position, -> { order(y_position: :asc, x_position: :asc) }
  scope :ordered_by_tab, -> { order(tab_order: :asc) }
  
  def signature_field?
    type_signature? || type_initials?
  end
  
  def data_field?
    type_text? || type_date?
  end
  
  def field_icon
    case field_type
    when FIELD_TYPES[:signature]
      'signature'
    when FIELD_TYPES[:initials]
      'pencil-square'
    when FIELD_TYPES[:text]
      'input-cursor-text'
    when FIELD_TYPES[:date]
      'calendar'
    else
      'question-circle'
    end
  end
  
  def dimensions
    {
      x: x_position,
      y: y_position,
      width: width,
      height: height
    }
  end
  
  def to_builder
    Jbuilder.new do |json|
      json.extract! self, :id, :field_type, :page_number, :x_position, :y_position, 
                    :width, :height, :required, :label, :tab_order
      json.document_signer_id document_signer_id
      json.document_id document_id
      json.icon field_icon
      json.signature_field signature_field?
      json.data_field data_field?
    end
  end
end
```

### Update Document Model

```ruby
# app/models/document.rb (additions)
class Document < ApplicationRecord
  # Add to existing associations
  has_many :form_fields, dependent: :destroy
  
  # Add these methods
  
  def fields_for_page(page_number)
    form_fields.for_page(page_number).ordered_by_position
  end
  
  def has_fields?
    form_fields.exists?
  end
  
  def fields_by_signer
    form_fields.includes(:document_signer).group_by(&:document_signer)
  end
  
  def ready_for_signing?
    has_fields? && signers.exists?
  end
  
  # Add a method to prepare document for signing
  def prepare_for_signing!
    return false unless draft? && ready_for_signing?
    
    # Set document to pending status
    update(status: :pending)
    
    # Set the first signer to pending
    first_signer = document_signers.order(:order).first
    first_signer&.update(status: :pending)
    
    # Generate signing links, etc.
    
    true
  rescue => e
    errors.add(:base, "Error preparing document: #{e.message}")
    false
  end
end
```

### Update Document Signer Model

```ruby
# app/models/document_signer.rb
class DocumentSigner < ApplicationRecord
  belongs_to :document
  belongs_to :user
  has_many :form_fields, dependent: :nullify
  
  enum status: {
    draft: 0,
    pending: 1,
    completed: 2,
    declined: 3,
    expired: 4
  }
  
  validates :user_id, uniqueness: { scope: :document_id }
  
  scope :ordered, -> { order(order: :asc) }
  
  def name
    user.name
  end
  
  def email
    user.email
  end
  
  def completed?
    completed? || declined?
  end
  
  def pending?
    status == 'pending'
  end
  
  def needs_to_sign?
    pending? && form_fields.exists?
  end
  
  def has_all_required_fields_filled?
    return true if form_fields.empty?
    
    form_fields.where(required: true).all? { |field| field.value.present? }
  end
  
  def to_builder
    Jbuilder.new do |json|
      json.extract! self, :id, :order, :status
      json.name name
      json.email email
      json.user_id user_id
      json.document_id document_id
      json.field_count form_fields.count
    end
  end
end
```

## Document Editor Controller

Create a controller for the document editor:

```bash
rails generate controller DocumentEditor edit update fields add_field remove_field add_signer remove_signer prepare_for_signing
```

Implement the controller:

```ruby
# app/controllers/document_editor_controller.rb
class DocumentEditorController < ApplicationController
  before_action :authenticate_user!
  before_action :set_document
  before_action :ensure_editable
  
  def edit
    @signers = @document.document_signers.includes(:user).ordered
    @available_users = User.where.not(id: @signers.pluck(:user_id))
    
    respond_to do |format|
      format.html
      format.json do
        render json: {
          document: {
            id: @document.id,
            title: @document.title,
            status: @document.status,
            page_count: @document.metadata&.dig('pages') || 1,
            pdf_url: rails_blob_url(@document.file)
          },
          signers: @signers.map { |s| s.to_builder.attributes! },
          current_user: {
            id: current_user.id,
            name: current_user.name,
            email: current_user.email
          }
        }
      end
    end
  end
  
  def fields
    page = params[:page].to_i
    page = 1 if page < 1
    
    fields = @document.fields_for_page(page)
    
    render json: {
      fields: fields.map { |f| f.to_builder.attributes! }
    }
  end
  
  def add_field
    field = @document.form_fields.new(field_params)
    
    if field.save
      render json: {
        field: field.to_builder.attributes!,
        success: true
      }
    else
      render json: {
        errors: field.errors.full_messages,
        success: false
      }, status: :unprocessable_entity
    end
  end
  
  def update_field
    field = @document.form_fields.find(params[:field_id])
    
    if field.update(field_params)
      render json: {
        field: field.to_builder.attributes!,
        success: true
      }
    else
      render json: {
        errors: field.errors.full_messages,
        success: false
      }, status: :unprocessable_entity
    end
  end
  
  def remove_field
    field = @document.form_fields.find(params[:field_id])
    field.destroy
    
    render json: { success: true }
  end
  
  def add_signer
    # Find or create user for the signer
    user = User.find_by(email: params[:email]) || 
           User.create!(email: params[:email], 
                        password: SecureRandom.hex(8),
                        role: 'signer')
    
    # Generate the next order number
    next_order = @document.document_signers.maximum(:order).to_i + 1
    
    # Create the document signer
    signer = @document.document_signers.new(
      user: user,
      order: next_order,
      status: :draft
    )
    
    if signer.save
      render json: {
        signer: signer.to_builder.attributes!,
        success: true
      }
    else
      render json: {
        errors: signer.errors.full_messages,
        success: false
      }, status: :unprocessable_entity
    end
  end
  
  def remove_signer
    signer = @document.document_signers.find(params[:signer_id])
    
    # First remove all fields assigned to this signer
    signer.form_fields.update_all(document_signer_id: nil)
    
    # Then remove the signer
    signer.destroy
    
    # Reorder remaining signers
    @document.document_signers.ordered.each_with_index do |s, index|
      s.update_column(:order, index + 1)
    end
    
    render json: { success: true }
  end
  
  def prepare_for_signing
    if @document.prepare_for_signing!
      # Log the activity
      @document.log_activity(current_user, 'sent for signing', request)
      
      # Send notification emails to the first signer
      first_signer = @document.document_signers.ordered.first
      SigningRequestMailer.signing_request(first_signer).deliver_later if first_signer
      
      redirect_to document_path(@document), notice: 'Document has been sent for signing!'
    else
      redirect_to edit_document_editor_path(@document), 
                  alert: "Couldn't prepare document: #{@document.errors.full_messages.join(', ')}"
    end
  end
  
  private
  
  def set_document
    @document = Document.find(params[:document_id])
  end
  
  def ensure_editable
    unless @document.editable_by?(current_user)
      redirect_to documents_path, alert: 'You are not authorized to edit this document.'
    end
  end
  
  def field_params
    params.require(:field).permit(
      :field_type, :page_number, :x_position, :y_position, 
      :width, :height, :required, :label, :document_signer_id, :tab_order
    )
  end
end
```

## Field Placement Interface

### Routes

Add routes for the document editor:

```ruby
# config/routes.rb (additions)
Rails.application.routes.draw do
  # ... existing routes
  
  resources :documents do
    # ... existing document routes
    
    # Document editor routes
    resource :editor, controller: 'document_editor', only: [:edit, :update] do
      get 'fields'
      post 'add_field'
      patch 'update_field/:field_id', to: 'document_editor#update_field', as: :update_field
      delete 'remove_field/:field_id', to: 'document_editor#remove_field', as: :remove_field
      post 'add_signer'
      delete 'remove_signer/:signer_id', to: 'document_editor#remove_signer', as: :remove_signer
      post 'prepare_for_signing'
    end
  end
end
```

### Document Editor View

```erb
<!-- app/views/document_editor/edit.html.erb -->
<div class="container-fluid" data-controller="document-editor" 
     data-document-editor-document-id-value="<%= @document.id %>">
  <div class="row g-0">
    <!-- Left Panel: Tools and Properties -->
    <div class="col-md-3 border-end vh-100 overflow-auto">
      <div class="p-3">
        <h1 class="h4 mb-3">Edit Document</h1>
        
        <!-- Document Info -->
        <div class="card mb-3">
          <div class="card-header d-flex justify-content-between align-items-center">
            <h2 class="h6 mb-0">Document Information</h2>
          </div>
          <div class="card-body">
            <h3 class="h5 mb-2"><%= @document.title %></h3>
            <p class="text-muted mb-0"><small>Created <%= time_ago_in_words(@document.created_at) %> ago</small></p>
          </div>
        </div>
        
        <!-- Field Types -->
        <div class="card mb-3">
          <div class="card-header">
            <h2 class="h6 mb-0">Field Types</h2>
          </div>
          <div class="card-body">
            <div class="d-grid gap-2">
              <!-- Signature Field -->
              <button class="btn btn-outline-primary d-flex align-items-center justify-content-start" 
                      data-action="click->document-editor#selectFieldType" 
                      data-field-type="signature">
                <i class="bi bi-pen me-2"></i> Signature
              </button>
              
              <!-- Initials Field -->
              <button class="btn btn-outline-primary d-flex align-items-center justify-content-start" 
                      data-action="click->document-editor#selectFieldType" 
                      data-field-type="initials">
                <i class="bi bi-pencil-square me-2"></i> Initials
              </button>
              
              <!-- Text Field -->
              <button class="btn btn-outline-primary d-flex align-items-center justify-content-start" 
                      data-action="click->document-editor#selectFieldType" 
                      data-field-type="text">
                <i class="bi bi-input-cursor-text me-2"></i> Text Field
              </button>
              
              <!-- Date Field -->
              <button class="btn btn-outline-primary d-flex align-items-center justify-content-start" 
                      data-action="click->document-editor#selectFieldType" 
                      data-field-type="date">
                <i class="bi bi-calendar me-2"></i> Date
              </button>
            </div>
          </div>
        </div>
        
        <!-- Selected Field Properties (initially hidden) -->
        <div class="card mb-3 d-none" data-document-editor-target="fieldProperties">
          <div class="card-header d-flex justify-content-between align-items-center">
            <h2 class="h6 mb-0">Field Properties</h2>
            <button type="button" class="btn-close" 
                    data-action="click->document-editor#closeFieldProperties"></button>
          </div>
          <div class="card-body">
            <form data-document-editor-target="fieldForm" data-action="submit->document-editor#saveField">
              <input type="hidden" name="field[field_type]" data-document-editor-target="fieldType">
              <input type="hidden" name="field[page_number]" data-document-editor-target="fieldPage">
              <input type="hidden" name="field[x_position]" data-document-editor-target="fieldX">
              <input type="hidden" name="field[y_position]" data-document-editor-target="fieldY">
              <input type="hidden" name="field[width]" data-document-editor-target="fieldWidth">
              <input type="hidden" name="field[height]" data-document-editor-target="fieldHeight">
              <input type="hidden" name="field_id" data-document-editor-target="fieldId">
              
              <div class="mb-3">
                <label class="form-label">Label</label>
                <input type="text" name="field[label]" class="form-control" 
                       data-document-editor-target="fieldLabel">
              </div>
              
              <div class="mb-3">
                <label class="form-label">Assign to Signer</label>
                <select name="field[document_signer_id]" class="form-select" 
                        data-document-editor-target="fieldSigner">
                  <option value="">Unassigned</option>
                  <% @signers.each do |signer| %>
                    <option value="<%= signer.id %>"><%= signer.name %></option>
                  <% end %>
                </select>
              </div>
              
              <div class="mb-3 form-check">
                <input type="checkbox" name="field[required]" value="1" class="form-check-input" 
                       id="field_required" data-document-editor-target="fieldRequired" checked>
                <label class="form-check-label" for="field_required">Required</label>
              </div>
              
              <div class="d-grid gap-2">
                <button type="submit" class="btn btn-primary">Save Field</button>
                <button type="button" class="btn btn-outline-danger" 
                        data-action="click->document-editor#deleteField">Delete Field</button>
              </div>
            </form>
          </div>
        </div>
        
        <!-- Signers Panel -->
        <div class="card mb-3">
          <div class="card-header d-flex justify-content-between align-items-center">
            <h2 class="h6 mb-0">Signers</h2>
            <button type="button" class="btn btn-sm btn-outline-primary" 
                    data-bs-toggle="modal" data-bs-target="#addSignerModal">
              Add Signer
            </button>
          </div>
          <div class="card-body p-0">
            <ul class="list-group list-group-flush" data-document-editor-target="signersList">
              <% if @signers.any? %>
                <% @signers.each do |signer| %>
                  <li class="list-group-item d-flex justify-content-between align-items-center">
                    <div>
                      <div><%= signer.name %></div>
                      <small class="text-muted"><%= signer.email %></small>
                    </div>
                    <div class="btn-group">
                      <button type="button" class="btn btn-sm btn-outline-secondary" 
                              data-action="click->document-editor#highlightSignerFields" 
                              data-signer-id="<%= signer.id %>">
                        <i class="bi bi-eye"></i>
                      </button>
                      <button type="button" class="btn btn-sm btn-outline-danger" 
                              data-action="click->document-editor#removeSigner" 
                              data-signer-id="<%= signer.id %>">
                        <i class="bi bi-x"></i>
                      </button>
                    </div>
                  </li>
                <% end %>
              <% else %>
                <li class="list-group-item text-center text-muted py-4">
                  No signers added yet
                </li>
              <% end %>
            </ul>
          </div>
        </div>
        
        <!-- Action Buttons -->
        <div class="d-grid gap-2">
          <%= link_to 'Back to Document', document_path(@document), class: 'btn btn-outline-secondary' %>
          <%= button_to 'Send for Signing', prepare_for_signing_document_editor_path(@document), 
                       method: :post, class: 'btn btn-success',
                       data: { turbo_confirm: 'Are you sure? Once sent, you cannot edit this document.' } %>
        </div>
      </div>
    </div>
    
    <!-- Right Panel: PDF Viewer -->
    <div class="col-md-9 vh-100">
      <div class="pdf-editor h-100 d-flex flex-column" data-document-editor-target="pdfContainer">
        <!-- PDF Controls -->
        <div class="pdf-controls d-flex justify-content-between align-items-center p-2 border-bottom bg-light">
          <div class="d-flex align-items-center">
            <button class="btn btn-sm btn-outline-secondary me-2" 
                    data-action="click->document-editor#prevPage" 
                    data-document-editor-target="prevButton">
              <i class="bi bi-chevron-left"></i> Previous
            </button>
            
            <span class="mx-2">
              Page <span data-document-editor-target="currentPage">1</span> of 
              <span data-document-editor-target="pageCount">-</span>
            </span>
            
            <button class="btn btn-sm btn-outline-secondary ms-2" 
                    data-action="click->document-editor#nextPage" 
                    data-document-editor-target="nextButton">
              Next <i class="bi bi-chevron-right"></i>
            </button>
          </div>
          
          <div>
            <button class="btn btn-sm btn-outline-secondary" 
                    data-action="click->document-editor#zoomOut">
              <i class="bi bi-zoom-out"></i>
            </button>
            <button class="btn btn-sm btn-outline-secondary" 
                    data-action="click->document-editor#zoomIn">
              <i class="bi bi-zoom-in"></i>
            </button>
          </div>
        </div>
        
        <!-- PDF Viewer -->
        <div class="pdf-content flex-grow-1 position-relative overflow-auto" 
             data-document-editor-target="pdfContent">
          <!-- The PDF canvas will be inserted here -->
          <canvas data-document-editor-target="pdfCanvas"></canvas>
          
          <!-- Overlay for fields -->
          <div class="field-overlay position-absolute top-0 start-0" 
               data-document-editor-target="fieldOverlay"></div>
        </div>
      </div>
    </div>
  </div>
</div>

<!-- Add Signer Modal -->
<div class="modal fade" id="addSignerModal" tabindex="-1" aria-labelledby="addSignerModalLabel" aria-hidden="true">
  <div class="modal-dialog">
    <div class="modal-content">
      <div class="modal-header">
        <h5 class="modal-title" id="addSignerModalLabel">Add Signer</h5>
        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
      </div>
      <div class="modal-body">
        <form data-action="submit->document-editor#addSigner" data-document-editor-target="signerForm">
          <div class="mb-3">
            <label for="signerEmail" class="form-label">Email Address</label>
            <input type="email" class="form-control" id="signerEmail" name="email" required 
                   data-document-editor-target="signerEmail">
            <div class="form-text">Enter the email of the person who needs to sign this document.</div>
          </div>
          
          <div class="mb-3">
            <label for="signerName" class="form-label">Name (Optional)</label>
            <input type="text" class="form-control" id="signerName" name="name" 
                   data-document-editor-target="signerName">
          </div>
          
          <div class="d-grid">
            <button type="submit" class="btn btn-primary">Add Signer</button>
          </div>
        </form>
      </div>
    </div>
  </div>
</div>
```

## Field Type Components

Create Stimulus controllers for the document editor and field placement functionality:

### Document Editor Controller

```bash
rails generate stimulus document_editor
```

```javascript
// app/javascript/controllers/document_editor_controller.js
import { Controller } from "@hotwired/stimulus"
import * as pdfjs from "pdfjs-dist"

// Set worker path
pdfjs.GlobalWorkerOptions.workerSrc = 
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js"

export default class extends Controller {
  static targets = [
    "pdfContainer", "pdfContent", "pdfCanvas", "fieldOverlay",
    "currentPage", "pageCount", "prevButton", "nextButton",
    "fieldProperties", "fieldForm", "fieldType", "fieldPage", "fieldX", "fieldY",
    "fieldWidth", "fieldHeight", "fieldLabel", "fieldRequired", "fieldSigner", "fieldId",
    "signersList", "signerForm", "signerEmail", "signerName"
  ]
  
  static values = {
    documentId: String,
    canvasScale: { type: Number, default: 1.5 },
    currentPage: { type: Number, default: 1 },
    selectedFieldType: String,
    isCreatingField: Boolean,
    isEditingField: Boolean,
    selectedFieldId: String
  }
  
  connect() {
    this.pdfDoc = null
    this.pageRendering = false
    this.pageNumPending = null
    this.fields = []
    this.signers = []
    
    this.initPdf()
    this.fetchSigners()
    
    // Setup field creation event listeners
    this.fieldOverlayTarget.addEventListener('mousedown', this.startCreatingField.bind(this))
    this.fieldOverlayTarget.addEventListener('mousemove', this.updateCreatingField.bind(this))
    this.fieldOverlayTarget.addEventListener('mouseup', this.endCreatingField.bind(this))
    
    // Track window resize for field positioning
    window.addEventListener('resize', this.handleResize.bind(this))
  }
  
  disconnect() {
    window.removeEventListener('resize', this.handleResize.bind(this))
  }
  
  async initPdf() {
    try {
      const response = await fetch(`/documents/${this.documentIdValue}/editor.json`)
      const data = await response.json()
      
      this.signers = data.signers
      this.updateSignersList()
      
      // Set page count
      this.pageCountTarget.textContent = data.document.page_count
      
      // Load PDF
      this.loadPdf(data.document.pdf_url)
    } catch (error) {
      console.error("Error initializing editor:", error)
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
        
        // Fetch and render fields for this page
        this.fetchFields(num)
      })
    })
  }
  
  syncFieldOverlaySize() {
    const canvas = this.pdfCanvasTarget
    this.fieldOverlayTarget.style.width = `${canvas.width}px`
    this.fieldOverlayTarget.style.height = `${canvas.height}px`
  }
  
  fetchFields(pageNum) {
    fetch(`/documents/${this.documentIdValue}/editor/fields?page=${pageNum}`)
      .then(response => response.json())
      .then(data => {
        this.fields = data.fields
        this.renderFields()
      })
      .catch(error => console.error("Error fetching fields:", error))
  }
  
  fetchSigners() {
    fetch(`/documents/${this.documentIdValue}/editor.json`)
      .then(response => response.json())
      .then(data => {
        this.signers = data.signers
        this.updateSignersList()
      })
      .catch(error => console.error("Error fetching signers:", error))
  }
  
  updateSignersList() {
    // Implementation for updating signers list (if needed)
    // This would update the select dropdown for field assignment
    const signerSelect = this.fieldSignerTarget
    signerSelect.innerHTML = '<option value="">Unassigned</option>'
    
    this.signers.forEach(signer => {
      const option = document.createElement('option')
      option.value = signer.id
      option.textContent = signer.name
      signerSelect.appendChild(option)
    })
  }
  
  renderFields() {
    // Clear existing field elements
    this.fieldOverlayTarget.innerHTML = ''
    
    // Render each field
    this.fields.forEach(field => {
      this.createFieldElement(field)
    })
  }
  
  createFieldElement(field) {
    const fieldEl = document.createElement('div')
    fieldEl.className = 'document-field'
    fieldEl.dataset.fieldId = field.id
    fieldEl.dataset.fieldType = field.field_type
    
    // Position the field
    fieldEl.style.left = `${field.x_position}px`
    fieldEl.style.top = `${field.y_position}px`
    fieldEl.style.width = `${field.width}px`
    fieldEl.style.height = `${field.height}px`
    
    // Add field type indicator
    const icon = document.createElement('i')
    icon.className = `bi bi-${field.icon}`
    fieldEl.appendChild(icon)
    
    // Add label if present
    if (field.label) {
      const label = document.createElement('div')
      label.className = 'field-label'
      label.textContent = field.label
      fieldEl.appendChild(label)
    }
    
    // Add signer indicator if assigned
    if (field.document_signer_id) {
      const signer = this.signers.find(s => s.id === field.document_signer_id)
      if (signer) {
        fieldEl.dataset.signerId = signer.id
        fieldEl.classList.add('assigned')
        
        const signerBadge = document.createElement('div')
        signerBadge.className = 'signer-badge'
        signerBadge.textContent = signer.name.slice(0, 2).toUpperCase()
        signerBadge.title = signer.name
        fieldEl.appendChild(signerBadge)
      }
    }
    
    // Add click handler
    fieldEl.addEventListener('click', (e) => {
      e.stopPropagation()
      this.selectField(field)
    })
    
    // Make field draggable
    this.makeFieldDraggable(fieldEl)
    
    // Add to overlay
    this.fieldOverlayTarget.appendChild(fieldEl)
    
    return fieldEl
  }
  
  makeFieldDraggable(fieldEl) {
    let isDragging = false
    let offsetX, offsetY
    
    const dragStart = (e) => {
      e.stopPropagation()
      isDragging = true
      offsetX = e.clientX - fieldEl.getBoundingClientRect().left
      offsetY = e.clientY - fieldEl.getBoundingClientRect().top
      
      fieldEl.classList.add('dragging')
      
      // Add event listeners for drag and drop
      document.addEventListener('mousemove', dragMove)
      document.addEventListener('mouseup', dragEnd)
    }
    
    const dragMove = (e) => {
      if (!isDragging) return
      
      const overlayRect = this.fieldOverlayTarget.getBoundingClientRect()
      const x = e.clientX - overlayRect.left - offsetX
      const y = e.clientY - overlayRect.top - offsetY
      
      // Keep within bounds
      const maxX = overlayRect.width - fieldEl.offsetWidth
      const maxY = overlayRect.height - fieldEl.offsetHeight
      
      fieldEl.style.left = `${Math.max(0, Math.min(maxX, x))}px`
      fieldEl.style.top = `${Math.max(0, Math.min(maxY, y))}px`
    }
    
    const dragEnd = () => {
      if (!isDragging) return
      
      isDragging = false
      fieldEl.classList.remove('dragging')
      
      // Update field position in database
      const fieldId = fieldEl.dataset.fieldId
      const field = this.fields.find(f => f.id.toString() === fieldId)
      
      if (field) {
        const x = parseFloat(fieldEl.style.left)
        const y = parseFloat(fieldEl.style.top)
        
        fetch(`/documents/${this.documentIdValue}/editor/update_field/${fieldId}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'X-CSRF-Token': document.querySelector('meta[name="csrf-token"]').content
          },
          body: JSON.stringify({
            field: {
              x_position: x,
              y_position: y
            }
          })
        })
        .then(response => response.json())
        .then(data => {
          if (data.success) {
            // Update local field data
            field.x_position = x
            field.y_position = y
          }
        })
        .catch(error => console.error("Error updating field position:", error))
      }
      
      // Remove event listeners
      document.removeEventListener('mousemove', dragMove)
      document.removeEventListener('mouseup', dragEnd)
    }
    
    // Add mousedown handler for dragging
    fieldEl.addEventListener('mousedown', dragStart)
  }
  
  selectFieldType(e) {
    const fieldType = e.currentTarget.dataset.fieldType
    this.selectedFieldTypeValue = fieldType
    this.isCreatingFieldValue = true
    
    // Update cursor
    this.fieldOverlayTarget.style.cursor = 'crosshair'
    
    // Show field type info
    this.fieldTypeTarget.value = fieldType
  }
  
  startCreatingField(e) {
    if (!this.isCreatingFieldValue || !this.selectedFieldTypeValue) return
    
    // Get position relative to the overlay
    const rect = this.fieldOverlayTarget.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    
    // Store starting position
    this.startX = x
    this.startY = y
    
    // Create field element
    this.currentField = document.createElement('div')
    this.currentField.className = 'document-field creating'
    this.currentField.style.left = `${x}px`
    this.currentField.style.top = `${y}px`
    this.currentField.style.width = '0px'
    this.currentField.style.height = '0px'
    
    // Add field type indicator
    const icon = document.createElement('i')
    icon.className = `bi bi-${this.getFieldIcon(this.selectedFieldTypeValue)}`
    this.currentField.appendChild(icon)
    
    this.fieldOverlayTarget.appendChild(this.currentField)
  }
  
  updateCreatingField(e) {
    if (!this.currentField) return
    
    // Get current position
    const rect = this.fieldOverlayTarget.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    
    // Calculate dimensions
    const width = Math.abs(x - this.startX)
    const height = Math.abs(y - this.startY)
    
    // Set position (handle drawing in any direction)
    const left = Math.min(this.startX, x)
    const top = Math.min(this.startY, y)
    
    this.currentField.style.left = `${left}px`
    this.currentField.style.top = `${top}px`
    this.currentField.style.width = `${width}px`
    this.currentField.style.height = `${height}px`
  }
  
  endCreatingField(e) {
    if (!this.currentField) return
    
    // Get final dimensions
    const width = parseFloat(this.currentField.style.width)
    const height = parseFloat(this.currentField.style.height)
    
    // Only proceed if the field has reasonable dimensions
    if (width > 20 && height > 20) {
      // Open field properties panel with correct values
      this.fieldPageTarget.value = this.currentPageValue
      this.fieldXTarget.value = parseFloat(this.currentField.style.left)
      this.fieldYTarget.value = parseFloat(this.currentField.style.top)
      this.fieldWidthTarget.value = width
      this.fieldHeightTarget.value = height
      
      // Show properties panel
      this.fieldPropertiesTarget.classList.remove('d-none')
    } else {
      // Remove the temporary field if too small
      this.fieldOverlayTarget.removeChild(this.currentField)
    }
    
    // Reset creating state
    this.currentField = null
    this.isCreatingFieldValue = false
    this.fieldOverlayTarget.style.cursor = 'default'
  }
  
  selectField(field) {
    // Highlight the selected field
    document.querySelectorAll('.document-field').forEach(el => {
      el.classList.remove('selected')
    })
    
    const fieldEl = document.querySelector(`.document-field[data-field-id="${field.id}"]`)
    if (fieldEl) {
      fieldEl.classList.add('selected')
    }
    
    // Update field properties form
    this.isEditingFieldValue = true
    this.selectedFieldIdValue = field.id
    
    this.fieldIdTarget.value = field.id
    this.fieldTypeTarget.value = field.field_type
    this.fieldPageTarget.value = field.page_number
    this.fieldXTarget.value = field.x_position
    this.fieldYTarget.value = field.y_position
    this.fieldWidthTarget.value = field.width
    this.fieldHeightTarget.value = field.height
    this.fieldLabelTarget.value = field.label || ''
    this.fieldRequiredTarget.checked = field.required
    
    if (field.document_signer_id) {
      this.fieldSignerTarget.value = field.document_signer_id
    } else {
      this.fieldSignerTarget.value = ''
    }
    
    // Show properties panel
    this.fieldPropertiesTarget.classList.remove('d-none')
  }
  
  saveField(e) {
    e.preventDefault()
    
    const formData = new FormData(this.fieldFormTarget)
    
    if (this.isEditingFieldValue) {
      // Update existing field
      const fieldId = formData.get('field_id')
      
      fetch(`/documents/${this.documentIdValue}/editor/update_field/${fieldId}`, {
        method: 'PATCH',
        headers: {
          'X-CSRF-Token': document.querySelector('meta[name="csrf-token"]').content
        },
        body: formData
      })
      .then(response => response.json())
      .then(data => {
        if (data.success) {
          // Update local field data
          const index = this.fields.findIndex(f => f.id === data.field.id)
          if (index !== -1) {
            this.fields[index] = data.field
          }
          
          // Re-render fields
          this.renderFields()
          
          // Close properties panel
          this.closeFieldProperties()
        }
      })
      .catch(error => console.error("Error updating field:", error))
    } else {
      // Create new field
      fetch(`/documents/${this.documentIdValue}/editor/add_field`, {
        method: 'POST',
        headers: {
          'X-CSRF-Token': document.querySelector('meta[name="csrf-token"]').content
        },
        body: formData
      })
      .then(response => response.json())
      .then(data => {
        if (data.success) {
          // Add field to local data
          this.fields.push(data.field)
          
          // Re-render fields
          this.renderFields()
          
          // Close properties panel
          this.closeFieldProperties()
        }
      })
      .catch(error => console.error("Error creating field:", error))
    }
  }
  
  deleteField(e) {
    e.preventDefault()
    
    if (!this.isEditingFieldValue || !this.selectedFieldIdValue) return
    
    if (confirm("Are you sure you want to delete this field?")) {
      fetch(`/documents/${this.documentIdValue}/editor/remove_field/${this.selectedFieldIdValue}`, {
        method: 'DELETE',
        headers: {
          'X-CSRF-Token': document.querySelector('meta[name="csrf-token"]').content
        }
      })
      .then(response => response.json())
      .then(data => {
        if (data.success) {
          // Remove field from local data
          this.fields = this.fields.filter(f => f.id !== parseInt(this.selectedFieldIdValue))
          
          // Re-render fields
          this.renderFields()
          
          // Close properties panel
          this.closeFieldProperties()
        }
      })
      .catch(error => console.error("Error deleting field:", error))
    }
  }
  
  closeFieldProperties() {
    this.fieldPropertiesTarget.classList.add('d-none')
    this.isEditingFieldValue = false
    this.selectedFieldIdValue = null
    
    // Clear selection highlight
    document.querySelectorAll('.document-field').forEach(el => {
      el.classList.remove('selected')
    })
  }
  
  addSigner(e) {
    e.preventDefault()
    
    const email = this.signerEmailTarget.value
    const name = this.signerNameTarget.value
    
    fetch(`/documents/${this.documentIdValue}/editor/add_signer`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': document.querySelector('meta[name="csrf-token"]').content
      },
      body: JSON.stringify({
        email: email,
        name: name
      })
    })
    .then(response => response.json())
    .then(data => {
      if (data.success) {
        // Add signer to local data
        this.signers.push(data.signer)
        
        // Update signers list
        this.updateSignersList()
        
        // Close modal
        const modal = document.getElementById('addSignerModal')
        const bsModal = bootstrap.Modal.getInstance(modal)
        bsModal.hide()
        
        // Clear form
        this.signerFormTarget.reset()
      }
    })
    .catch(error => console.error("Error adding signer:", error))
  }
  
  removeSigner(e) {
    const signerId = e.currentTarget.dataset.signerId
    
    if (confirm("Are you sure you want to remove this signer? Any fields assigned to them will be unassigned.")) {
      fetch(`/documents/${this.documentIdValue}/editor/remove_signer/${signerId}`, {
        method: 'DELETE',
        headers: {
          'X-CSRF-Token': document.querySelector('meta[name="csrf-token"]').content
        }
      })
      .then(response => response.json())
      .then(data => {
        if (data.success) {
          // Remove signer from local data
          this.signers = this.signers.filter(s => s.id !== parseInt(signerId))
          
          // Update signers list
          this.updateSignersList()
          
          // Refetch fields to update any that were unassigned
          this.fetchFields(this.currentPageValue)
        }
      })
      .catch(error => console.error("Error removing signer:", error))
    }
  }
  
  highlightSignerFields(e) {
    const signerId = e.currentTarget.dataset.signerId
    
    // Toggle highlighting
    document.querySelectorAll('.document-field').forEach(el => {
      if (el.dataset.signerId === signerId) {
        el.classList.toggle('highlighted')
      } else {
        el.classList.remove('highlighted')
      }
    })
  }
  
  getFieldIcon(fieldType) {
    switch (fieldType) {
      case 'signature':
        return 'pen'
      case 'initials':
        return 'pencil-square'
      case 'text':
        return 'input-cursor-text'
      case 'date':
        return 'calendar'
      default:
        return 'question-circle'
    }
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
  
  zoomIn() {
    this.canvasScaleValue += 0.25
    this.renderPage(this.currentPageValue)
  }
  
  zoomOut() {
    if (this.canvasScaleValue <= 0.5) return
    this.canvasScaleValue -= 0.25
    this.renderPage(this.currentPageValue)
  }
  
  handleResize() {
    this.syncFieldOverlaySize()
  }
}
```

### Styling for the Document Editor

```css
/* app/assets/stylesheets/document_editor.css */
.pdf-editor {
  background-color: #f5f5f5;
}

.pdf-content {
  display: flex;
  justify-content: center;
  align-items: flex-start;
  padding: 20px;
}

.field-overlay {
  z-index: 10;
  pointer-events: all;
}

.document-field {
  position: absolute;
  border: 2px dashed #007bff;
  background-color: rgba(0, 123, 255, 0.05);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: move;
  z-index: 20;
  box-sizing: border-box;
  text-align: center;
  font-size: 14px;
  color: #007bff;
}

.document-field i {
  font-size: 24px;
}

.document-field.creating {
  border-style: solid;
  background-color: rgba(0, 123, 255, 0.1);
}

.document-field.selected {
  border-color: #0056b3;
  background-color: rgba(0, 86, 179, 0.15);
  z-index: 21;
}

.document-field.highlighted {
  border-color: #28a745;
  background-color: rgba(40, 167, 69, 0.15);
  z-index: 21;
}

.document-field.dragging {
  opacity: 0.8;
}

.document-field.assigned {
  border-color: #28a745;
  background-color: rgba(40, 167, 69, 0.05);
}

.signer-badge {
  position: absolute;
  top: -10px;
  right: -10px;
  width: 24px;
  height: 24px;
  background-color: #28a745;
  color: white;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  font-weight: bold;
}

.field-label {
  position: absolute;
  bottom: -20px;
  left: 0;
  width: 100%;
  font-size: 10px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  color: #495057;
}
```

## Field Assignment to Signers

### Create Signing Request Mailer

```bash
rails generate mailer SigningRequest signing_request
```

```ruby
# app/mailers/signing_request_mailer.rb
class SigningRequestMailer < ApplicationMailer
  def signing_request(document_signer)
    @document_signer = document_signer
    @document = document_signer.document
    @user = document_signer.user
    @creator = @document.creator
    
    # Generate a secure signing link
    @signing_url = sign_document_url(
      id: @document.id,
      token: generate_signing_token(@document_signer)
    )
    
    mail(
      to: @user.email,
      subject: "Please sign: #{@document.title}"
    )
  end
  
  private
  
  def generate_signing_token(document_signer)
    # Create a JWT token for secure access
    payload = {
      document_id: document_signer.document_id,
      signer_id: document_signer.id,
      exp: 30.days.from_now.to_i
    }
    
    JWT.encode(payload, Rails.application.credentials.secret_key_base)
  end
end
```

Create the email template:

```erb
<!-- app/views/signing_request_mailer/signing_request.html.erb -->
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <div style="background-color: #f8f9fa; padding: 20px; text-align: center; border-bottom: 4px solid #007bff;">
    <h1 style="color: #007bff; margin: 0;">Document Signing Request</h1>
  </div>
  
  <div style="padding: 20px;">
    <p>Hello <%= @user.name %>,</p>
    
    <p><strong><%= @creator.name %></strong> has requested your signature on the document "<%= @document.title %>".</p>
    
    <% if @document.message.present? %>
      <div style="background-color: #f8f9fa; padding: 15px; margin: 20px 0; border-left: 4px solid #6c757d;">
        <p style="margin: 0;"><%= @document.message %></p>
      </div>
    <% end %>
    
    <div style="text-align: center; margin: 30px 0;">
      <a href="<%= @signing_url %>" style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold;">
        Review & Sign Document
      </a>
    </div>
    
    <p>This link will expire in 30 days. If you have any questions, please contact <%= @creator.name %> at <%= @creator.email %>.</p>
    
    <p>Thank you,<br>
    The Document Signing Team</p>
  </div>
  
  <div style="background-color: #f8f9fa; padding: 15px; text-align: center; font-size: 12px; color: #6c757d; border-top: 1px solid #dee2e6;">
    <p>This is an automated message. Please do not reply to this email.</p>
  </div>
</div>
```

## Document Preview

Create a controller and view for document preview when preparing for signing:

```bash
rails generate controller DocumentPreview show
```

```ruby
# app/controllers/document_preview_controller.rb
class DocumentPreviewController < ApplicationController
  before_action :authenticate_user!
  before_action :set_document
  
  def show
    @signers = @document.document_signers.includes(:user).ordered
    
    # Check if the document is ready for signing
    @can_send = @document.draft? && @document.ready_for_signing?
    
    respond_to do |format|
      format.html
      format.json do
        render json: {
          document: {
            id: @document.id,
            title: @document.title,
            status: @document.status,
            page_count: @document.metadata&.dig('pages') || 1,
            pdf_url: rails_blob_url(@document.file)
          },
          signers: @signers.map { |s| s.to_builder.attributes! },
          fields_by_signer: @document.document_signers.map do |signer|
            {
              signer_id: signer.id,
              signer_name: signer.name,
              field_count: signer.form_fields.count,
              fields: signer.form_fields.map { |f| f.to_builder.attributes! }
            }
          end,
          can_send: @can_send
        }
      end
    end
  end
  
  private
  
  def set_document
    @document = Document.find(params[:document_id])
    
    # Ensure the user has permission to view this document
    unless @document.creator == current_user
      redirect_to documents_path, alert: 'You are not authorized to view this document preview.'
    end
  end
end
```

Create the preview view:

```erb
<!-- app/views/document_preview/show.html.erb -->
<div class="container-fluid" data-controller="document-preview" 
     data-document-preview-document-id-value="<%= @document.id %>">
  <div class="row g-0">
    <!-- Left Panel: Information -->
    <div class="col-md-3 border-end vh-100 overflow-auto">
      <div class="p-3">
        <h1 class="h4 mb-3">Document Preview</h1>
        
        <!-- Document Info -->
        <div class="card mb-3">
          <div class="card-header">
            <h2 class="h6 mb-0">Document Information</h2>
          </div>
          <div class="card-body">
            <h3 class="h5 mb-2"><%= @document.title %></h3>
            <p class="text-muted mb-0"><small>Created <%= time_ago_in_words(@document.created_at) %> ago</small></p>
            
            <% if @document.message.present? %>
              <hr>
              <div class="mb-0">
                <strong>Message to signers:</strong>
                <p class="mb-0"><%= @document.message %></p>
              </div>
            <% end %>
          </div>
        </div>
        
        <!-- Signers Panel -->
        <div class="card mb-3">
          <div class="card-header">
            <h2 class="h6 mb-0">Signers & Fields</h2>
          </div>
          <div class="card-body p-0">
            <ul class="list-group list-group-flush" data-document-preview-target="signersList">
              <% if @signers.any? %>
                <% @signers.each_with_index do |signer, index| %>
                  <li class="list-group-item">
                    <div class="d-flex justify-content-between align-items-center">
                      <div>
                        <div><strong><%= index + 1 %>. <%= signer.name %></strong></div>
                        <small class="text-muted"><%= signer.email %></small>
                      </div>
                      <span class="badge bg-primary rounded-pill">
                        <%= signer.form_fields.count %> fields
                      </span>
                    </div>
                    
                    <button class="btn btn-sm btn-outline-secondary mt-2" 
                            data-action="click->document-preview#highlightSignerFields" 
                            data-signer-id="<%= signer.id %>">
                      Show Fields
                    </button>
                  </li>
                <% end %>
              <% else %>
                <li class="list-group-item text-center text-muted py-4">
                  No signers added
                </li>
              <% end %>
            </ul>
          </div>
        </div>
        
        <!-- Action Buttons -->
        <div class="d-grid gap-2">
          <%= link_to 'Back to Editor', edit_document_editor_path(@document), class: 'btn btn-outline-secondary' %>
          
          <% if @can_send %>
            <%= button_to 'Send for Signing', prepare_for_signing_document_editor_path(@document), 
                         method: :post, class: 'btn btn-success',
                         data: { turbo_confirm: 'Are you sure? Once sent, you cannot edit this document.' } %>
          <% else %>
            <button class="btn btn-secondary" disabled>
              <%= @document.draft? ? "Add signers and fields first" : "Document already sent" %>
            </button>
          <% end %>
        </div>
      </div>
    </div>
    
    <!-- Right Panel: PDF Viewer -->
    <div class="col-md-9 vh-100">
      <div class="pdf-preview h-100 d-flex flex-column" data-document-preview-target="pdfContainer">
        <!-- PDF Controls -->
        <div class="pdf-controls d-flex justify-content-between align-items-center p-2 border-bottom bg-light">
          <div class="d-flex align-items-center">
            <button class="btn btn-sm btn-outline-secondary me-2" 
                    data-action="click->document-preview#prevPage" 
                    data-document-preview-target="prevButton">
              <i class="bi bi-chevron-left"></i> Previous
            </button>
            
            <span class="mx-2">
              Page <span data-document-preview-target="currentPage">1</span> of 
              <span data-document-preview-target="pageCount">-</span>
            </span>
            
            <button class="btn btn-sm btn-outline-secondary ms-2" 
                    data-action="click->document-preview#nextPage" 
                    data-document-preview-target="nextButton">
              Next <i class="bi bi-chevron-right"></i>
            </button>
          </div>
          
          <div>
            <button class="btn btn-sm btn-outline-secondary" 
                    data-action="click->document-preview#zoomOut">
              <i class="bi bi-zoom-out"></i>
            </button>
            <button class="btn btn-sm btn-outline-secondary" 
                    data-action="click->document-preview#zoomIn">
              <i class="bi bi-zoom-in"></i>
            </button>
          </div>
        </div>
        
        <!-- PDF Viewer -->
        <div class="pdf-content flex-grow-1 position-relative overflow-auto" 
             data-document-preview-target="pdfContent">
          <!-- The PDF canvas will be inserted here -->
          <canvas data-document-preview-target="pdfCanvas"></canvas>
          
          <!-- Overlay for fields -->
          <div class="field-overlay position-absolute top-0 start-0" 
               data-document-preview-target="fieldOverlay"></div>
        </div>
      </div>
    </div>
  </div>
</div>
```

Create a Stimulus controller for the document preview:

```bash
rails generate stimulus document_preview
```

```javascript
// app/javascript/controllers/document_preview_controller.js
import { Controller } from "@hotwired/stimulus"
import * as pdfjs from "pdfjs-dist"

// Set worker path
pdfjs.GlobalWorkerOptions.workerSrc = 
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js"

export default class extends Controller {
  static targets = [
    "pdfContainer", "pdfContent", "pdfCanvas", "fieldOverlay",
    "currentPage", "pageCount", "prevButton", "nextButton",
    "signersList"
  ]
  
  static values = {
    documentId: String,
    canvasScale: { type: Number, default: 1.5 },
    currentPage: { type: Number, default: 1 }
  }
  
  connect() {
    this.pdfDoc = null
    this.pageRendering = false
    this.pageNumPending = null
    this.fields = []
    this.signers = []
    this.fieldsBySigner = {}
    
    this.initPdf()
    
    // Track window resize for field positioning
    window.addEventListener('resize', this.handleResize.bind(this))
  }
  
  disconnect() {
    window.removeEventListener('resize', this.handleResize.bind(this))
  }
  
  async initPdf() {
    try {
      const response = await fetch(`/documents/${this.documentIdValue}/preview.json`)
      const data = await response.json()
      
      this.signers = data.signers
      
      // Organize fields by signer
      this.fieldsBySigner = {}
      data.fields_by_signer.forEach(signerData => {
        this.fieldsBySigner[signerData.signer_id] = signerData.fields
      })
      
      // Set page count
      this.pageCountTarget.textContent = data.document.page_count
      
      // Load PDF
      this.loadPdf(data.document.pdf_url)
    } catch (error) {
      console.error("Error initializing preview:", error)
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
    
    // Render fields for each signer
    Object.values(this.fieldsBySigner).forEach(fields => {
      fields.filter(field => field.page_number === pageNum)
        .forEach(field => this.createFieldElement(field))
    })
  }
  
  createFieldElement(field) {
    const fieldEl = document.createElement('div')
    fieldEl.className = 'document-field preview'
    fieldEl.dataset.fieldId = field.id
    fieldEl.dataset.fieldType = field.field_type
    
    if (field.document_signer_id) {
      fieldEl.dataset.signerId = field.document_signer_id
    }
    
    // Position the field
    fieldEl.style.left = `${field.x_position}px`
    fieldEl.style.top = `${field.y_position}px`
    fieldEl.style.width = `${field.width}px`
    fieldEl.style.height = `${field.height}px`
    
    // Add field type indicator
    const icon = document.createElement('i')
    icon.className = `bi bi-${field.icon}`
    fieldEl.appendChild(icon)
    
    // Add label if present
    if (field.label) {
      const label = document.createElement('div')
      label.className = 'field-label'
      label.textContent = field.label
      fieldEl.appendChild(label)
    }
    
    // Add signer indicator if assigned
    if (field.document_signer_id) {
      const signer = this.signers.find(s => s.id === field.document_signer_id)
      if (signer) {
        const signerBadge = document.createElement('div')
        signerBadge.className = 'signer-badge'
        signerBadge.textContent = signer.name.slice(0, 2).toUpperCase()
        signerBadge.title = signer.name
        fieldEl.appendChild(signerBadge)
      }
    }
    
    // Add to overlay
    this.fieldOverlayTarget.appendChild(fieldEl)
    
    return fieldEl
  }
  
  highlightSignerFields(e) {
    const signerId = e.currentTarget.dataset.signerId
    
    // Clear all highlights first
    document.querySelectorAll('.document-field').forEach(el => {
      el.classList.remove('highlighted')
    })
    
    // Highlight fields for this signer
    document.querySelectorAll(`.document-field[data-signer-id="${signerId}"]`).forEach(el => {
      el.classList.add('highlighted')
    })
    
    // Find a page with fields for this signer
    const fields = this.fieldsBySigner[signerId] || []
    const pageWithFields = fields.length > 0 ? fields[0].page_number : 1
    
    // Navigate to that page if we're not already there
    if (pageWithFields !== this.currentPageValue) {
      this.currentPageValue = pageWithFields
      this.queueRenderPage(pageWithFields)
    }
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
  
  zoomIn() {
    this.canvasScaleValue += 0.25
    this.renderPage(this.currentPageValue)
  }
  
  zoomOut() {
    if (this.canvasScaleValue <= 0.5) return
    this.canvasScaleValue -= 0.25
    this.renderPage(this.currentPageValue)
  }
  
  handleResize() {
    this.syncFieldOverlaySize()
  }
}
```

## Testing

Create unit tests for form fields and integration tests for the field placement functionality:

```ruby
# test/models/form_field_test.rb
require "test_helper"

class FormFieldTest < ActiveSupport::TestCase
  setup do
    @document = documents(:draft)
    @user = users(:admin)
    @document_signer = document_signers(:one)
    @form_field = FormField.new(
      document: @document,
      document_signer: @document_signer,
      field_type: 'signature',
      page_number: 1,
      x_position: 100,
      y_position: 200,
      width: 150,
      height: 50,
      required: true
    )
  end
  
  test "should be valid with required attributes" do
    assert @form_field.valid?
  end
  
  test "should require a document" do
    @form_field.document = nil
    assert_not @form_field.valid?
  end
  
  test "should require a field type" do
    @form_field.field_type = nil
    assert_not @form_field.valid?
  end
  
  test "should require a valid field type" do
    @form_field.field_type = 'invalid_type'
    assert_not @form_field.valid?
  end
  
  test "should require a page number" do
    @form_field.page_number = nil
    assert_not @form_field.valid?
  end
  
  test "should require page number greater than 0" do
    @form_field.page_number = 0
    assert_not @form_field.valid?
  end
  
  test "should require position attributes" do
    @form_field.x_position = nil
    assert_not @form_field.valid?
    
    @form_field.x_position = 100
    @form_field.y_position = nil
    assert_not @form_field.valid?
    
    @form_field.y_position = 200
    @form_field.width = nil
    assert_not @form_field.valid?
    
    @form_field.width = 150
    @form_field.height = nil
    assert_not @form_field.valid?
  end
  
  test "should identify signature fields correctly" do
    @form_field.field_type = 'signature'
    assert @form_field.signature_field?
    
    @form_field.field_type = 'initials'
    assert @form_field.signature_field?
    
    @form_field.field_type = 'text'
    assert_not @form_field.signature_field?
  end
  
  test "should identify data fields correctly" do
    @form_field.field_type = 'text'
    assert @form_field.data_field?
    
    @form_field.field_type = 'date'
    assert @form_field.data_field?
    
    @form_field.field_type = 'signature'
    assert_not @form_field.data_field?
  end
  
  test "should return correct field icon" do
    @form_field.field_type = 'signature'
    assert_equal 'signature', @form_field.field_icon
    
    @form_field.field_type = 'text'
    assert_equal 'input-cursor-text', @form_field.field_icon
  end
end
```

Create system tests for the document editor:

```ruby
# test/system/document_editor_test.rb
require "application_system_test_case"

class DocumentEditorTest < ApplicationSystemTestCase
  include Devise::Test::IntegrationHelpers
  
  setup do
    @user = users(:admin)
    sign_in @user
    @document = documents(:draft)
    
    # Ensure the document has a file attached
    unless @document.file.attached?
      @document.file.attach(
        io: File.open(Rails.root.join('test/fixtures/files/sample.pdf')),
        filename: 'sample.pdf',
        content_type: 'application/pdf'
      )
    end
  end
  
  test "visiting the document editor" do
    visit edit_document_editor_path(@document)
    
    assert_selector "h1", text: "Edit Document"
    assert_selector "h3", text: @document.title
    
    # Check for field type buttons
    assert_selector "button", text: "Signature"
    assert_selector "button", text: "Initials"
    assert_selector "button", text: "Text Field"
    assert_selector "button", text: "Date"
  end
  
  test "adding a signer" do
    visit edit_document_editor_path(@document)
    
    click_button "Add Signer"
    
    within "#addSignerModal" do
      fill_in "Email Address", with: "newsigner@example.com"
      fill_in "Name", with: "New Signer"
      
      click_button "Add Signer"
    end
    
    # Wait for the modal to close and the list to update
    assert_no_selector "#addSignerModal.show"
    
    # Check that the new signer appears in the list
    assert_selector ".list-group-item", text: "New Signer"
    assert_selector ".list-group-item small", text: "newsigner@example.com"
  end
  
  test "adding a field" do
    visit edit_document_editor_path(@document)
    
    # Select signature field type
    find("button[data-field-type='signature']").click
    
    # Wait for PDF to load
    sleep 1
    
    # Click on the PDF to start drawing a field
    field_overlay = find("[data-document-editor-target='fieldOverlay']")
    field_overlay.click(x: 200, y: 200)
    
    # Drag to create the field
    page.driver.browser.action
      .move_to(field_overlay.native, 300, 300)
      .click
      .perform
    
    # Fill in field properties
    find("[data-document-editor-target='fieldLabel']").set("Test Signature")
    
    # Save the field
    click_button "Save Field"
    
    # Check that the field appears on the document
    assert_selector ".document-field"
  end
  
  test "editing a field" do
    # First create a field
    @field = @document.form_fields.create!(
      field_type: 'signature',
      page_number: 1,
      x_position: 100,
      y_position: 100,
      width: 150,
      height: 50,
      label: "Original Label"
    )
    
    visit edit_document_editor_path(@document)
    
    # Wait for PDF and fields to load
    sleep 1
    
    # Click on the field to edit it
    find(".document-field[data-field-id='#{@field.id}']").click
    
    # Change the label
    find("[data-document-editor-target='fieldLabel']").set("Updated Label")
    
    # Save the changes
    click_button "Save Field"
    
    # Check that the field was updated
    @field.reload
    assert_equal "Updated Label", @field.label
  end
  
  test "deleting a field" do
    # First create a field
    @field = @document.form_fields.create!(
      field_type: 'signature',
      page_number: 1,
      x_position: 100,
      y_position: 100,
      width: 150,
      height: 50
    )
    
    visit edit_document_editor_path(@document)
    
    # Wait for PDF and fields to load
    sleep 1
    
    # Click on the field to select it
    find(".document-field[data-field-id='#{@field.id}']").click
    
    # Delete the field
    accept_confirm do
      click_button "Delete Field"
    end
    
    # Check that the field was deleted
    assert_raises(ActiveRecord::RecordNotFound) do
      @field.reload
    end
  end
  
  test "preparing document for signing" do
    # First create a signer and field
    @signer = @document.document_signers.create!(
      user: users(:regular),
      order: 1,
      status: :draft
    )
    
    @field = @document.form_fields.create!(
      field_type: 'signature',
      page_number: 1,
      x_position: 100,
      y_position: 100,
      width: 150,
      height: 50,
      document_signer: @signer
    )
    
    visit edit_document_editor_path(@document)
    
    # Click send for signing button
    accept_confirm do
      click_button "Send for Signing"
    end
    
    # Check that we're redirected to the document page
    assert_current_path document_path(@document)
    
    # Check that flash message appears
    assert_text "Document has been sent for signing!"
    
    # Check that document status was updated
    @document.reload
    assert_equal "pending", @document.status
  end
end
```

## Additional Configuration

### Routes

Update routes to include the preview functionality:

```ruby
# config/routes.rb (additions)
Rails.application.routes.draw do
  # ... existing routes
  
  resources :documents do
    # ... existing document routes
    
    # Document editor routes
    resource :editor, controller: 'document_editor', only: [:edit, :update] do
      # ... existing editor routes
    end
    
    # Document preview
    get 'preview', to: 'document_preview#show', as: :preview
  end
end
```

### Bootstrap Icons

Add Bootstrap Icons for better visual cues:

```bash
yarn add bootstrap-icons
```

Include the icons in your application:

```javascript
// app/javascript/application.js
import "bootstrap-icons/font/bootstrap-icons.css"
```

### Additional Considerations

1. **Field Templates**:
   - Consider implementing saved field templates for common field patterns
   - Allow users to save and reuse field layouts

2. **Batch Operations**:
   - Enable selecting multiple fields for alignment or deletion
   - Add keyboard shortcuts for common operations

3. **Field Validation**:
   - Add specific validation rules for different field types
   - Ensure fields don't overlap or extend beyond page boundaries

4. **Performance Optimization**:
   - Use pagination or lazy loading for documents with many pages
   - Consider caching rendered PDF pages to improve navigation speed

5. **Accessibility**:
   - Ensure field placement interface is keyboard accessible
   - Add proper aria attributes for screen readers
   - Include high-contrast mode for better visibility

6. **Error Handling**:
   - Add graceful error handling for PDF loading issues
   - Implement autosave to prevent data loss
