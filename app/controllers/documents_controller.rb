class DocumentsController < ApplicationController
  before_action :authenticate_user!
  before_action :set_document, only: [ :show, :edit, :update, :destroy, :download ]
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

    # In a real application, you'd verify the signer and mark their fields as completed
    # For now, we'll just mark the document as signed by this user

    # Get the document signer from the session or params
    signer_id = params[:signer_id]
    document_signer = @document.document_signers.find(signer_id)

    # Mark the signer as having completed their part
    document_signer.update(status: "completed", completed_at: Time.current)

    # Log this activity
    @document.log_activity(current_user, "signed", request.remote_ip, request.user_agent)

    # If all signers have completed, mark the document as completed
    if @document.document_signers.where.not(status: "completed").none?
      @document.update(status: "completed", completed_at: Time.current)
    end

    head :ok
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
