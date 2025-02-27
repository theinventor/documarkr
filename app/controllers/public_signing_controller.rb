class PublicSigningController < ApplicationController
  # Skip authentication for all actions in this controller
  skip_before_action :authenticate_user!

  # GET /sign/:id/:token
  def show
    @token = params[:token]
    @document = Document.find(params[:id])
    @document_signer = @document.document_signers.find_by!(token: @token)

    # Record that the signer has viewed the document
    @document_signer.record_view(request) if @document_signer.pending?

    # Load form fields assigned to this signer, ordered by page number
    @form_fields = @document.form_fields.where(document_signer_id: @document_signer.id)
                           .order(:page_number, :created_at)

    render :show
  rescue ActiveRecord::RecordNotFound
    flash[:alert] = "Invalid document or signing link."
    redirect_to root_path
  end

  # POST /sign/:id
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
    @document.log_activity(@document_signer.user, "signed", request, {
      signer_id: @document_signer.id,
      signer_email: @document_signer.email,
      signer_name: @document_signer.name
    })

    render json: { success: true, redirect_url: public_sign_complete_view_path(@document) }
  rescue ActiveRecord::RecordNotFound
    render json: { error: "Invalid document or signing link." }, status: :not_found
  end

  # GET /sign/:id/complete
  def complete
    @document = Document.find(params[:id])
    render :complete
  rescue ActiveRecord::RecordNotFound
    flash[:alert] = "Document not found."
    redirect_to root_path
  end

  # POST /sign/:id/form_fields/:field_id/complete
  def complete_field
    @document = Document.find_by(id: params[:id])
    @form_field = @document&.form_fields&.find_by(id: params[:field_id])
    @document_signer = @document&.document_signers&.find_by(token: params[:token])

    if @document.nil? || @form_field.nil? || @document_signer.nil?
      render json: { error: "Invalid document, field, or signer" }, status: :not_found
      return
    end

    # Verify the field belongs to this signer
    unless @form_field.document_signer_id == @document_signer.id
      render json: { error: "This field does not belong to you" }, status: :forbidden
      return
    end

    # Update the field
    if @form_field.update(value: params[:value], completed: true)
      render json: { success: true, field: @form_field }
    else
      render json: { error: @form_field.errors.full_messages.join(", ") }, status: :unprocessable_entity
    end
  end
end
