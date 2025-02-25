# Phase 2: Document Management Implementation Guide

This guide provides detailed implementation instructions for the Document Management phase of the DocuSign clone. It includes all necessary commands, code examples, and explanations for a junior Rails developer to implement this functionality.

## Table of Contents
1. [Setup Prerequisites](#setup-prerequisites)
2. [Database Configuration](#database-configuration)
3. [Document Model and Controller](#document-model-and-controller)
4. [Active Storage Configuration](#active-storage-configuration)
5. [PDF Viewer Integration](#pdf-viewer-integration)
6. [Document Dashboard](#document-dashboard)
7. [Document Routing](#document-routing)
8. [Testing](#testing)

## Setup Prerequisites

Ensure your Rails 8 project is set up with the required gems:

```ruby
# Gemfile
gem 'devise'                # Authentication
gem 'cancancan'             # Authorization
gem 'hexapdf'               # PDF manipulation
gem 'image_processing'      # For Active Storage variants
gem 'sidekiq'               # Background processing
gem 'stimulus-rails'        # For Stimulus controllers
gem 'turbo-rails'           # For Turbo functionality
```

Run bundle install:

```bash
bundle install
```

## Database Configuration

### Create Models

Run the following Rails generate commands to create the base models:

```bash
# Create User model (if not already created with Devise)
rails generate devise User first_name:string last_name:string role:string

# Create Document model
rails generate model Document title:string message:text status:integer creator:references completed_at:datetime

# Create Document Signers join model
rails generate model DocumentSigner document:references user:references order:integer status:integer viewed_at:datetime signed_at:datetime ip_address:string user_agent:string

# Create Audit Log model
rails generate model AuditLog document:references user:references action:string ip_address:string user_agent:string metadata:text
```

### Update Migrations

Modify the migration files to add necessary constraints and indexes:

```ruby
# db/migrate/TIMESTAMP_create_documents.rb
class CreateDocuments < ActiveRecord::Migration[8.0]
  def change
    create_table :documents do |t|
      t.string :title, null: false
      t.text :message
      t.integer :status, default: 0
      t.references :creator, null: false, foreign_key: { to_table: :users }
      t.datetime :completed_at
      t.timestamps
    end
    
    add_index :documents, :status
  end
end
```

Run migrations:

```bash
rails db:migrate
```

## Document Model and Controller

### Update Document Model

```ruby
# app/models/document.rb
class Document < ApplicationRecord
  belongs_to :creator, class_name: 'User'
  has_many :document_signers, dependent: :destroy
  has_many :signers, through: :document_signers, source: :user
  has_many :audit_logs, dependent: :destroy
  has_one_attached :file
  has_one_attached :completed_file
  
  enum status: {
    draft: 0,
    pending: 1,
    completed: 2,
    declined: 3,
    expired: 4
  }
  
  validates :title, presence: true
  validates :file, presence: true, on: :update
  
  scope :active, -> { where(status: [:draft, :pending]) }
  scope :inactive, -> { where(status: [:completed, :declined, :expired]) }
  
  def viewable_by?(user)
    creator == user || signers.include?(user)
  end
  
  def editable_by?(user)
    creator == user && draft?
  end
  
  def current_signer
    document_signers.pending.order(:order).first&.user
  end
  
  def log_activity(user, action, request = nil)
    audit_logs.create!(
      user: user,
      action: action,
      ip_address: request&.remote_ip,
      user_agent: request&.user_agent,
      metadata: { timestamp: Time.current }
    )
  end
end
```

### Update User Model

```ruby
# app/models/user.rb (additions to Devise-generated model)
class User < ApplicationRecord
  devise :database_authenticatable, :registerable,
         :recoverable, :rememberable, :validatable
         
  has_many :created_documents, class_name: 'Document', foreign_key: 'creator_id'
  has_many :document_signers
  has_many :documents_to_sign, through: :document_signers, source: :document
  has_many :audit_logs
  
  enum role: {
    signer: 'signer',
    creator: 'creator',
    admin: 'admin'
  }
  
  def name
    "#{first_name} #{last_name}".strip.presence || email
  end
  
  def can_create_documents?
    creator? || admin?
  end
end
```

### Create Document Controller

Generate the documents controller:

```bash
rails generate controller Documents index show new create edit update destroy
```

Update with actual implementation:

```ruby
# app/controllers/documents_controller.rb
class DocumentsController < ApplicationController
  before_action :authenticate_user!
  before_action :set_document, only: [:show, :edit, :update, :destroy, :download]
  before_action :authorize_document, only: [:edit, :update, :destroy]
  
  def index
    @active_documents = current_user.created_documents.active.order(created_at: :desc)
    @completed_documents = current_user.created_documents.inactive.order(created_at: :desc)
    @documents_to_sign = current_user.documents_to_sign.pending.order(created_at: :desc)
  end
  
  def show
    @document.log_activity(current_user, 'viewed', request)
    respond_to do |format|
      format.html
      format.pdf { redirect_to rails_blob_url(@document.file) if @document.file.attached? }
    end
  end
  
  def new
    @document = Document.new
  end
  
  def create
    @document = Document.new(document_params)
    @document.creator = current_user
    @document.status = :draft
    
    if @document.save
      @document.log_activity(current_user, 'created', request)
      redirect_to edit_document_path(@document), notice: 'Document created successfully.'
    else
      render :new, status: :unprocessable_entity
    end
  end
  
  def edit
  end
  
  def update
    if @document.update(document_params)
      @document.log_activity(current_user, 'updated', request)
      redirect_to document_path(@document), notice: 'Document updated successfully.'
    else
      render :edit, status: :unprocessable_entity
    end
  end
  
  def destroy
    @document.log_activity(current_user, 'deleted', request)
    @document.destroy
    redirect_to documents_path, notice: 'Document was deleted.'
  end
  
  def download
    if @document.completed_file.attached?
      redirect_to rails_blob_url(@document.completed_file)
    elsif @document.file.attached?
      redirect_to rails_blob_url(@document.file)
    else
      redirect_to @document, alert: 'No file available for download.'
    end
  end
  
  private
  
  def set_document
    @document = Document.find(params[:id])
  end
  
  def authorize_document
    unless @document.editable_by?(current_user)
      redirect_to documents_path, alert: 'You are not authorized to edit this document.'
    end
  end
  
  def document_params
    params.require(:document).permit(:title, :message, :file)
  end
end
```

## Active Storage Configuration

Configure Active Storage for file uploads:

```bash
# If not already set up in Phase 1
rails active_storage:install
rails db:migrate
```

Update configuration (for production, you'll want to configure S3 or similar):

```ruby
# config/storage.yml
test:
  service: Disk
  root: <%= Rails.root.join("tmp/storage") %>

local:
  service: Disk
  root: <%= Rails.root.join("storage") %>

# For production with S3
# amazon:
#   service: S3
#   access_key_id: <%= ENV['AWS_ACCESS_KEY_ID'] %>
#   secret_access_key: <%= ENV['AWS_SECRET_ACCESS_KEY'] %>
#   region: <%= ENV['AWS_REGION'] %>
#   bucket: <%= ENV['AWS_BUCKET'] %>
```

## PDF Viewer Integration

### Install PDF.js

Create a directory for PDF.js assets:

```bash
mkdir -p app/javascript/vendor/pdfjs
```

Download and place PDF.js files (or use yarn/npm):

```bash
# Using yarn
yarn add pdfjs-dist
```

### Create PDF Viewer Stimulus Controller

```bash
rails generate stimulus pdf_viewer
```

Implement the controller:

```javascript
// app/javascript/controllers/pdf_viewer_controller.js
import { Controller } from "@hotwired/stimulus"
import * as pdfjs from "pdfjs-dist"

// Set worker path
pdfjs.GlobalWorkerOptions.workerSrc = 
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js"

export default class extends Controller {
  static targets = ["container", "pageCount", "currentPage", "canvas", "prevButton", "nextButton"]
  
  connect() {
    if (this.hasContainerTarget) {
      this.pdfDoc = null
      this.pageNum = 1
      this.pageRendering = false
      this.pageNumPending = null
      this.scale = 1.5
      this.context = this.canvasTarget.getContext('2d')
      
      this.loadPdf()
    }
  }
  
  loadPdf() {
    const url = this.element.dataset.pdfUrl
    
    pdfjs.getDocument(url).promise.then(pdfDoc => {
      this.pdfDoc = pdfDoc
      this.pageCountTarget.textContent = this.pdfDoc.numPages
      this.renderPage(this.pageNum)
      
      // Enable/disable buttons based on page count
      this.updateButtonStates()
    }).catch(error => {
      console.error("Error loading PDF:", error)
    })
  }
  
  renderPage(num) {
    this.pageRendering = true
    
    this.pdfDoc.getPage(num).then(page => {
      const viewport = page.getViewport({ scale: this.scale })
      this.canvasTarget.height = viewport.height
      this.canvasTarget.width = viewport.width
      
      const renderContext = {
        canvasContext: this.context,
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
      })
    })
  }
  
  queueRenderPage(num) {
    if (this.pageRendering) {
      this.pageNumPending = num
    } else {
      this.renderPage(num)
    }
  }
  
  prevPage() {
    if (this.pageNum <= 1) return
    this.pageNum--
    this.queueRenderPage(this.pageNum)
  }
  
  nextPage() {
    if (this.pageNum >= this.pdfDoc.numPages) return
    this.pageNum++
    this.queueRenderPage(this.pageNum)
  }
  
  updateButtonStates() {
    if (this.hasPrevButtonTarget) {
      this.prevButtonTarget.disabled = this.pageNum <= 1
    }
    
    if (this.hasNextButtonTarget) {
      this.nextButtonTarget.disabled = this.pageNum >= this.pdfDoc.numPages
    }
  }
  
  zoomIn() {
    this.scale += 0.25
    this.queueRenderPage(this.pageNum)
  }
  
  zoomOut() {
    if (this.scale <= 0.5) return
    this.scale -= 0.25
    this.queueRenderPage(this.pageNum)
  }
}
```

### Add PDF Viewer Views

Create a partial for the PDF viewer:

```erb
<!-- app/views/documents/_pdf_viewer.html.erb -->
<div class="pdf-viewer" 
     data-controller="pdf-viewer" 
     data-pdf-url="<%= rails_blob_url(document.file) %>">
  
  <div class="pdf-controls">
    <div class="navigation">
      <button data-pdf-viewer-target="prevButton" 
              data-action="click->pdf-viewer#prevPage" 
              class="btn btn-outline-primary">
        Previous
      </button>
      
      <span class="page-info">
        Page <span data-pdf-viewer-target="currentPage">1</span> of 
        <span data-pdf-viewer-target="pageCount">-</span>
      </span>
      
      <button data-pdf-viewer-target="nextButton" 
              data-action="click->pdf-viewer#nextPage" 
              class="btn btn-outline-primary">
        Next
      </button>
    </div>
    
    <div class="zoom">
      <button data-action="click->pdf-viewer#zoomOut" class="btn btn-sm btn-outline-secondary">
        <i class="bi bi-zoom-out"></i>
      </button>
      <button data-action="click->pdf-viewer#zoomIn" class="btn btn-sm btn-outline-secondary">
        <i class="bi bi-zoom-in"></i>
      </button>
    </div>
  </div>
  
  <div class="pdf-container" data-pdf-viewer-target="container">
    <canvas data-pdf-viewer-target="canvas"></canvas>
  </div>
</div>
```

Add styling:

```css
/* app/assets/stylesheets/pdf_viewer.css */
.pdf-viewer {
  display: flex;
  flex-direction: column;
  margin-bottom: 2rem;
}

.pdf-controls {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
  padding: 0.5rem;
  background-color: #f8f9fa;
  border-radius: 4px;
}

.navigation {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.page-info {
  font-size: 0.9rem;
}

.zoom {
  display: flex;
  gap: 0.5rem;
}

.pdf-container {
  overflow: auto;
  border: 1px solid #dee2e6;
  border-radius: 4px;
}

canvas {
  display: block;
  margin: 0 auto;
}
```

## Document Dashboard

### Create Dashboard View

```erb
<!-- app/views/documents/index.html.erb -->
<div class="container mt-4">
  <div class="d-flex justify-content-between align-items-center mb-4">
    <h1>Documents</h1>
    <% if current_user.can_create_documents? %>
      <%= link_to "New Document", new_document_path, class: "btn btn-primary" %>
    <% end %>
  </div>
  
  <div class="row">
    <div class="col-md-12">
      <% if current_user.can_create_documents? %>
        <!-- Documents I've Created -->
        <div class="card mb-4">
          <div class="card-header">
            <h2 class="h5 mb-0">Documents I've Created</h2>
          </div>
          <div class="card-body">
            <ul class="nav nav-tabs" id="myCreatedDocs" role="tablist">
              <li class="nav-item" role="presentation">
                <button class="nav-link active" id="active-tab" data-bs-toggle="tab" 
                        data-bs-target="#active" type="button" role="tab" 
                        aria-controls="active" aria-selected="true">
                  Active
                </button>
              </li>
              <li class="nav-item" role="presentation">
                <button class="nav-link" id="completed-tab" data-bs-toggle="tab" 
                        data-bs-target="#completed" type="button" role="tab" 
                        aria-controls="completed" aria-selected="false">
                  Completed
                </button>
              </li>
            </ul>
            
            <div class="tab-content mt-3" id="myCreatedDocsContent">
              <div class="tab-pane fade show active" id="active" role="tabpanel" 
                   aria-labelledby="active-tab">
                <%= render 'document_list', documents: @active_documents, 
                                            empty_message: "No active documents" %>
              </div>
              <div class="tab-pane fade" id="completed" role="tabpanel" 
                   aria-labelledby="completed-tab">
                <%= render 'document_list', documents: @completed_documents, 
                                            empty_message: "No completed documents" %>
              </div>
            </div>
          </div>
        </div>
      <% end %>
      
      <!-- Documents to Sign -->
      <div class="card">
        <div class="card-header">
          <h2 class="h5 mb-0">Documents to Sign</h2>
        </div>
        <div class="card-body">
          <%= render 'document_list', documents: @documents_to_sign, 
                                      empty_message: "No documents awaiting your signature" %>
        </div>
      </div>
    </div>
  </div>
</div>
```

Create a partial for document lists:

```erb
<!-- app/views/documents/_document_list.html.erb -->
<% if documents.any? %>
  <div class="table-responsive">
    <table class="table table-hover">
      <thead>
        <tr>
          <th>Title</th>
          <th>Status</th>
          <th>Created</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        <% documents.each do |document| %>
          <tr>
            <td><%= document.title %></td>
            <td>
              <span class="badge <%= status_badge_class(document.status) %>">
                <%= document.status.humanize %>
              </span>
            </td>
            <td><%= document.created_at.strftime("%b %d, %Y") %></td>
            <td>
              <%= link_to "View", document_path(document), class: "btn btn-sm btn-outline-primary" %>
              
              <% if document.editable_by?(current_user) %>
                <%= link_to "Edit", edit_document_path(document), class: "btn btn-sm btn-outline-secondary" %>
                <%= button_to "Delete", document_path(document), method: :delete, 
                              class: "btn btn-sm btn-outline-danger", 
                              form: { style: "display:inline", 
                                      data: { turbo_confirm: "Are you sure?" } } %>
              <% end %>
              
              <% if document.file.attached? %>
                <%= link_to "Download", download_document_path(document), class: "btn btn-sm btn-outline-info" %>
              <% end %>
            </td>
          </tr>
        <% end %>
      </tbody>
    </table>
  </div>
<% else %>
  <div class="text-center p-4 text-muted">
    <p><%= empty_message %></p>
  </div>
<% end %>
```

Add helper methods:

```ruby
# app/helpers/documents_helper.rb
module DocumentsHelper
  def status_badge_class(status)
    case status
    when 'draft'
      'bg-secondary'
    when 'pending'
      'bg-warning'
    when 'completed'
      'bg-success'
    when 'declined'
      'bg-danger'
    when 'expired'
      'bg-dark'
    else
      'bg-info'
    end
  end
end
```

### Create New Document Form

```erb
<!-- app/views/documents/new.html.erb -->
<div class="container mt-4">
  <div class="row justify-content-center">
    <div class="col-md-8">
      <div class="card">
        <div class="card-header">
          <h1 class="h3 mb-0">New Document</h1>
        </div>
        <div class="card-body">
          <%= form_with(model: @document, local: true, html: { multipart: true }) do |form| %>
            <% if @document.errors.any? %>
              <div class="alert alert-danger">
                <h2><%= pluralize(@document.errors.count, "error") %> prohibited this document from being saved:</h2>
                <ul>
                  <% @document.errors.full_messages.each do |message| %>
                    <li><%= message %></li>
                  <% end %>
                </ul>
              </div>
            <% end %>
            
            <div class="mb-3">
              <%= form.label :title, class: "form-label" %>
              <%= form.text_field :title, class: "form-control", placeholder: "Enter document title" %>
            </div>
            
            <div class="mb-3">
              <%= form.label :message, "Message to signers", class: "form-label" %>
              <%= form.text_area :message, class: "form-control", rows: 3, 
                                placeholder: "Optional message to the signers" %>
            </div>
            
            <div class="mb-3">
              <%= form.label :file, class: "form-label" %>
              <div class="input-group">
                <%= form.file_field :file, class: "form-control", accept: "application/pdf", 
                                   data: { controller: "file-upload" } %>
              </div>
              <small class="text-muted">Only PDF files are supported</small>
            </div>
            
            <div class="d-grid gap-2">
              <%= form.submit "Create Document", class: "btn btn-primary" %>
              <%= link_to "Cancel", documents_path, class: "btn btn-outline-secondary" %>
            </div>
          <% end %>
        </div>
      </div>
    </div>
  </div>
</div>
```

### Create Document Show Page

```erb
<!-- app/views/documents/show.html.erb -->
<div class="container mt-4">
  <div class="d-flex justify-content-between align-items-start mb-4">
    <div>
      <h1 class="mb-1"><%= @document.title %></h1>
      <p class="text-muted">
        Created by <%= @document.creator.name %> on 
        <%= @document.created_at.strftime("%B %d, %Y at %I:%M %p") %>
      </p>
      
      <% if @document.message.present? %>
        <div class="card mb-3">
          <div class="card-body">
            <h5 class="card-title">Message from Creator</h5>
            <p class="card-text"><%= @document.message %></p>
          </div>
        </div>
      <% end %>
      
      <div class="mb-3">
        <span class="badge <%= status_badge_class(@document.status) %> fs-6">
          <%= @document.status.humanize %>
        </span>
      </div>
    </div>
    
    <div class="btn-group">
      <% if @document.editable_by?(current_user) %>
        <%= link_to "Edit Document", edit_document_path(@document), class: "btn btn-primary" %>
      <% end %>
      
      <% if @document.file.attached? %>
        <%= link_to "Download", download_document_path(@document), class: "btn btn-outline-secondary" %>
      <% end %>
      
      <%= link_to "Back to Documents", documents_path, class: "btn btn-outline-secondary" %>
    </div>
  </div>
  
  <% if @document.file.attached? %>
    <div class="card">
      <div class="card-header">
        <h2 class="h5 mb-0">Document Preview</h2>
      </div>
      <div class="card-body">
        <%= render 'pdf_viewer', document: @document %>
      </div>
    </div>
  <% else %>
    <div class="alert alert-warning">
      This document has no file attached.
    </div>
  <% end %>
</div>
```

## Document Routing

Update routes for document management:

```ruby
# config/routes.rb
Rails.application.routes.draw do
  devise_for :users
  
  resources :documents do
    member do
      get :download
    end
  end
  
  # Root path to documents index for authenticated users
  authenticated :user do
    root to: 'documents#index', as: :authenticated_root
  end
  
  # Public root path
  root to: 'home#index'
end
```

Create a simple home controller for non-authenticated users:

```bash
rails generate controller Home index
```

```ruby
# app/controllers/home_controller.rb
class HomeController < ApplicationController
  def index
    redirect_to authenticated_root_path if user_signed_in?
  end
end
```

Create a basic home page:

```erb
<!-- app/views/home/index.html.erb -->
<div class="container mt-5">
  <div class="row justify-content-center">
    <div class="col-md-8 text-center">
      <h1 class="display-4 mb-4">Welcome to Document Signer</h1>
      <p class="lead mb-5">
        A secure platform for electronic document signing within your organization.
      </p>
      
      <div class="d-grid gap-3 d-sm-flex justify-content-sm-center">
        <%= link_to "Sign In", new_user_session_path, class: "btn btn-primary btn-lg px-4 gap-3" %>
        <%= link_to "Create Account", new_user_registration_path, class: "btn btn-outline-secondary btn-lg px-4" %>
      </div>
    </div>
  </div>
</div>
```

## Testing

Create tests for document management:

```ruby
# test/models/document_test.rb
require "test_helper"

class DocumentTest < ActiveSupport::TestCase
  setup do
    @user = users(:admin)
    @document = Document.new(
      title: "Test Document",
      creator: @user
    )
  end
  
  test "should be valid with required attributes" do
    assert @document.valid?
  end
  
  test "should require a title" do
    @document.title = nil
    assert_not @document.valid?
  end
  
  test "should require a creator" do
    @document.creator = nil
    assert_not @document.valid?
  end
  
  test "should have draft status by default" do
    @document.save
    assert @document.draft?
  end
  
  test "should be editable by creator when in draft status" do
    @document.save
    assert @document.editable_by?(@user)
  end
  
  test "should not be editable by other users" do
    @document.save
    other_user = users(:regular)
    assert_not @document.editable_by?(other_user)
  end
  
  test "should log activity" do
    @document.save
    assert_difference 'AuditLog.count' do
      @document.log_activity(@user, 'viewed')
    end
  end
end
```

```ruby
# test/controllers/documents_controller_test.rb
require "test_helper"

class DocumentsControllerTest < ActionDispatch::IntegrationTest
  include Devise::Test::IntegrationHelpers
  
  setup do
    @user = users(:admin)
    sign_in @user
    @document = documents(:draft)
  end
  
  test "should get index" do
    get documents_url
    assert_response :success
  end
  
  test "should get new" do
    get new_document_url
    assert_response :success
  end
  
  test "should create document" do
    assert_difference('Document.count') do
      post documents_url, params: { 
        document: { 
          title: "New Test Document", 
          message: "Please sign this document" 
        } 
      }
    end
    
    assert_redirected_to edit_document_url(Document.last)
  end
  
  test "should show document" do
    get document_url(@document)
    assert_response :success
  end
  
  test "should get edit" do
    get edit_document_url(@document)
    assert_response :success
  end
  
  test "should update document" do
    patch document_url(@document), params: { 
      document: { 
        title: "Updated Title" 
      } 
    }
    
    assert_redirected_to document_url(@document)
    @document.reload
    assert_equal "Updated Title", @document.title
  end
  
  test "should destroy document" do
    assert_difference('Document.count', -1) do
      delete document_url(@document)
    end
    
    assert_redirected_to documents_url
  end
  
  test "should download document" do
    @document.file.attach(
      io: File.open(Rails.root.join('test/fixtures/files/sample.pdf')),
      filename: 'sample.pdf',
      content_type: 'application/pdf'
    )
    
    get download_document_url(@document)
    assert_redirected_to rails_blob_url(@document.file)
  end
end
```

## Stimulus File Upload Controller

Create a file upload controller to handle file selection and validation:

```bash
rails generate stimulus file_upload
```

```javascript
// app/javascript/controllers/file_upload_controller.js
import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static targets = ["input", "preview", "filename"]
  
  connect() {
    this.element.addEventListener('change', this.handleFileSelect.bind(this))
  }
  
  handleFileSelect(event) {
    const file = event.target.files[0]
    if (!file) return
    
    // Validate file type
    if (file.type !== 'application/pdf') {
      alert('Please select a PDF file')
      event.target.value = ''
      return
    }
    
    // Update filename display if target exists
    if (this.hasFilenameTarget) {
      this.filenameTarget.textContent = file.name
    }
    
    // Show preview if target exists
    if (this.hasPreviewTarget) {
      const url = URL.createObjectURL(file)
      this.previewTarget.src = url
      this.previewTarget.classList.remove('d-none')
    }
  }
}
```

## Additional Features and Considerations

### Document Pre-processing with Active Job

Create a background job to process uploaded PDFs:

```bash
rails generate job ProcessDocument
```

```ruby
# app/jobs/process_document_job.rb
class ProcessDocumentJob < ApplicationJob
  queue_as :default
  
  def perform(document_id)
    document = Document.find_by(id: document_id)
    return unless document&.file&.attached?
    
    begin
      # Generate thumbnail preview
      generate_thumbnail(document)
      
      # Extract PDF metadata for future use
      extract_metadata(document)
      
      # Mark processing as complete
      document.update(processing_complete: true)
    rescue => e
      Rails.logger.error "Error processing document #{document_id}: #{e.message}"
      Rollbar.error(e) if defined?(Rollbar) # If using error tracking
    end
  end
  
  private
  
  def generate_thumbnail(document)
    # A simplified approach - in production you'd want to use
    # a PDF processing library that can generate thumbnails
    # This is a placeholder for that functionality
  end
  
  def extract_metadata(document)
    temp_file = document.file.download
    reader = HexaPDF::Document.open(temp_file.path)
    
    # Store basic metadata
    metadata = {
      pages: reader.pages.count,
      title: reader.trailer.info[:Title]&.to_utf8,
      author: reader.trailer.info[:Author]&.to_utf8,
      creation_date: reader.trailer.info[:CreationDate],
      producer: reader.trailer.info[:Producer]&.to_utf8
    }
    
    document.update(metadata: metadata)
  ensure
    temp_file&.close! if temp_file.respond_to?(:close!)
  end
end
```

Update the documents controller to queue the job:

```ruby
# In DocumentsController#create
if @document.save
  @document.log_activity(current_user, 'created', request)
  ProcessDocumentJob.perform_later(@document.id) # Enqueue processing
  redirect_to edit_document_path(@document), notice: 'Document created successfully.'
else
  # ...
end
```

## Deployment Considerations

- Configure Sidekiq for production
- Set up proper database indexes
- Configure Active Storage for S3 in production
- Set up PDF.js worker path correctly
- Ensure proper SSL configuration for secure document handling
