class DocumentsController < ApplicationController
  before_action :authenticate_user!
  before_action :set_document, only: [ :show, :edit, :update, :destroy, :download, :send_to_signers ]
  before_action :authorize_document, only: [ :edit, :update, :destroy ]

  def index
    @active_documents = current_user.created_documents.active.order(created_at: :desc)
    @completed_documents = current_user.created_documents.inactive.order(created_at: :desc)
    @documents_to_sign = current_user.documents_to_sign.pending.order(created_at: :desc)
  end

  def show
    @document.log_activity(current_user, "viewed", request)
    respond_to do |format|
      format.html
      format.pdf { redirect_to rails_blob_url(@document.file) if @document.file.attached? }
    end

    # Create a test field if this document has no fields and has signers
    if Rails.env.development? && @document.form_fields.count == 0 && @document.document_signers.count > 0
      Rails.logger.debug "Creating test form field for debugging purposes"

      # Find the first signer
      signer = @document.document_signers.first

      # Create a test field on page 1
      @document.form_fields.create!(
        document_signer_id: signer.id,
        field_type: "signature",
        page_number: 1,
        x_position: 100,
        y_position: 100,
        width: 150,
        height: 60,
        required: true
      )

      Rails.logger.debug "Created test form field with signer ID: #{signer.id}"
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
      @document.log_activity(current_user, "created", request)
      redirect_to edit_document_path(@document), notice: "Document created successfully."
    else
      render :new, status: :unprocessable_entity
    end
  end

  def edit
  end

  def update
    if @document.update(document_params)
      @document.log_activity(current_user, "updated", request)
      redirect_to document_path(@document), notice: "Document updated successfully."
    else
      render :edit, status: :unprocessable_entity
    end
  end

  def destroy
    @document.log_activity(current_user, "deleted", request)
    @document.destroy
    redirect_to documents_path, notice: "Document was deleted."
  end

  def download
    if @document.completed_file.attached?
      redirect_to rails_blob_url(@document.completed_file)
    elsif @document.file.attached?
      redirect_to rails_blob_url(@document.file)
    else
      redirect_to @document, alert: "No file available for download."
    end
  end

  # GET /documents/:id/sign/:token
  def sign
    @token = params[:token]
    @document = Document.find(params[:id])
    @document_signer = @document.document_signers.find_by!(token: @token)

    # Record that the signer has viewed the document
    @document_signer.record_view(request) if @document_signer.pending?

    # Load form fields assigned to this signer, ordered by page number
    @form_fields = @document.form_fields.where(document_signer_id: @document_signer.id)
                           .order(:page_number, :created_at)

    render :sign
  rescue ActiveRecord::RecordNotFound
    flash[:alert] = "Invalid document or signing link."
    redirect_to root_path
  end

  # POST /documents/:id/sign
  def sign_complete
    @document = Document.find(params[:id])
    @token = params[:token]
    @document_signer = @document.document_signers.find_by!(token: @token)

    # Verify all required fields are completed
    unless @document_signer.completed_all_required_fields?
      render json: { error: "Please complete all required fields before submitting." }, status: :unprocessable_entity
      return
    end

    # Record the signature
    @document_signer.record_signature(request)

    # Mark as completed and notify next signer if applicable
    @document_signer.mark_as_completed!

    # Log this activity
    @document.log_activity(nil, "signed", request, {
      signer_id: @document_signer.id,
      signer_email: @document_signer.email,
      signer_name: @document_signer.name
    })

    render json: { success: true, redirect_url: complete_document_path(@document) }
  rescue ActiveRecord::RecordNotFound
    render json: { error: "Invalid document or signing link." }, status: :not_found
  end

  # GET /documents/:id/complete
  def complete
    @document = Document.find(params[:id])

    # In a real application, you might want to verify the user's access to this document

    render :complete
  rescue ActiveRecord::RecordNotFound
    flash[:alert] = "Document not found."
    redirect_to root_path
  end

  # POST /documents/:id/form_fields/:field_id/complete
  def complete_field
    @document = Document.find(params[:id])
    @field = @document.form_fields.find(params[:field_id])

    # Update the field value
    if @field.update(value: params[:value], completed: true)
      head :ok
    else
      render json: { errors: @field.errors.full_messages }, status: :unprocessable_entity
    end
  end

  # POST /documents/:id/send_to_signers
  def send_to_signers
    # Check if document is in draft status
    unless @document.draft?
      redirect_to document_path(@document), alert: "This document has already been sent."
      return
    end

    # Check if document has signers
    if @document.document_signers.empty?
      redirect_to document_path(@document), alert: "Please add at least one signer before sending the document."
      return
    end

    # Find the first signer (lowest order)
    first_signer = @document.document_signers.order(:sign_order).first

    # Update document status to pending
    @document.update(status: :pending)

    # Send email to the first signer
    DocumentMailer.signing_request(@document, first_signer).deliver_later

    # Log the activity
    @document.log_activity(current_user, "sent_for_signing", request, {
      first_signer_id: first_signer.id,
      first_signer_email: first_signer.email
    })

    redirect_to document_path(@document), notice: "Document has been sent to #{first_signer.name} (#{first_signer.email}) for signing."
  end

  # POST /documents/:id/signers/:signer_id/resend
  def resend_signing_email
    @document = Document.find(params[:id])
    @document_signer = @document.document_signers.find(params[:signer_id])

    # Send email to the signer
    DocumentMailer.signing_request(@document, @document_signer).deliver_later

    # Log the activity
    @document.log_activity(current_user, "resent_signing_email", request, {
      signer_id: @document_signer.id,
      signer_email: @document_signer.email,
      signer_name: @document_signer.name
    })

    redirect_to document_path(@document), notice: "Signing email has been resent to #{@document_signer.name} (#{@document_signer.email})."
  end

  private

  def set_document
    @document = Document.find(params[:id])
  end

  def authorize_document
    unless @document.editable_by?(current_user)
      redirect_to documents_path, alert: "You are not authorized to edit this document."
    end
  end

  def document_params
    params.require(:document).permit(:title, :message, :file)
  end
end
