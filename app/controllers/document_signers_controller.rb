class DocumentSignersController < ApplicationController
  before_action :authenticate_user!
  before_action :set_document
  before_action :authorize_document, only: [ :new, :create, :destroy ]

  # GET /documents/:document_id/document_signers
  def index
    @document_signers = @document.document_signers.includes(:user)

    render json: {
      signers: @document_signers.map do |signer|
        {
          id: signer.id,
          name: signer.user&.name || signer.name || signer.email,
          email: signer.email,
          status: signer.status
        }
      end
    }
  end

  # GET /documents/:document_id/document_signers/new
  def new
    @document_signer = @document.document_signers.new
  end

  # POST /documents/:document_id/document_signers
  def create
    @document_signer = @document.document_signers.new(document_signer_params)

    # Explicitly set the status to pending
    @document_signer.status = :pending

    # Find or create user by email
    user = User.find_by(email: @document_signer.email)

    if user.nil?
      # Create a temporary user or handle invitation process
      # For now, we'll use the email as a placeholder
      @document_signer.name = @document_signer.name.presence || @document_signer.email.split("@").first
    else
      @document_signer.user = user
    end

    if @document_signer.save
      # Log activity with signer details
      @document.log_activity(current_user, "added_signer", request, {
        signer_id: @document_signer.id,
        signer_email: @document_signer.email,
        signer_name: @document_signer.name
      })

      redirect_to document_path(@document), notice: "Signer successfully added."
    else
      render :new, status: :unprocessable_entity
    end
  end

  # DELETE /documents/:document_id/document_signers/:id
  def destroy
    @document_signer = @document.document_signers.find(params[:id])

    # Log before deleting to capture the information
    @document.log_activity(current_user, "removed_signer", request, {
      signer_id: @document_signer.id,
      signer_email: @document_signer.email,
      signer_name: @document_signer.name
    })

    @document_signer.destroy
    redirect_to document_path(@document), notice: "Signer successfully removed."
  end

  private

  def set_document
    @document = Document.find(params[:document_id])
  end

  def authorize_document
    unless @document.editable_by?(current_user)
      redirect_to documents_path, alert: "You don't have permission to edit this document."
    end
  end

  def document_signer_params
    params.require(:document_signer).permit(:email, :name, :order)
  end
end
