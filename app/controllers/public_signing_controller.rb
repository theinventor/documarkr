class PublicSigningController < ApplicationController
  # Skip authentication for all actions in this controller
  skip_before_action :authenticate_user!, only: [ :show, :sign_complete, :complete, :complete_field, :thank_you, :get_font_preference, :save_font_preference ]

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
      respond_to do |format|
        format.turbo_stream {
          flash[:alert] = "Please complete all required fields before submitting."
          redirect_to public_sign_document_path(@document, token: @token)
        }
        format.json { render json: { error: "Please complete all required fields before submitting." }, status: :unprocessable_entity }
        format.html {
          flash[:alert] = "Please complete all required fields before submitting."
          redirect_to public_sign_document_path(@document, token: @token)
        }
      end
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
      signer_name: @document_signer.name,
      token: @token
    })

    # Handle successful completion with different format responses
    respond_to do |format|
      format.turbo_stream {
        Rails.logger.info "Redirecting to thank_you page with token: #{@token}"
        redirect_to public_sign_thank_you_path(@document, token: @token)
      }
      format.json { render json: { success: true, redirect_url: public_sign_thank_you_path(@document, token: @token) } }
      format.html {
        Rails.logger.info "Redirecting to thank_you page with token: #{@token}"
        redirect_to public_sign_thank_you_path(@document, token: @token)
      }
    end
  rescue ActiveRecord::RecordNotFound
    respond_to do |format|
      format.turbo_stream {
        flash[:alert] = "Invalid document or signing link."
        redirect_to root_path
      }
      format.json { render json: { error: "Invalid document or signing link." }, status: :not_found }
      format.html {
        flash[:alert] = "Invalid document or signing link."
        redirect_to root_path
      }
    end
  end

  # GET /sign/:id/complete
  def complete
    @token = params[:token]
    @document = Document.find(params[:id])

    # If token is provided, find the signer for context
    if @token.present?
      @document_signer = @document.document_signers.find_by(token: @token)
    end

    # We've reached the completion page, so render it even if we can't find the signer
    # This ensures the completion page is shown to the user
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

  # GET /sign/:id/thank_you
  def thank_you
    @document = Document.find_by(id: params[:id])
    @token = params[:token]

    # If document not found, show a generic thank you page
    if @document.nil?
      Rails.logger.warn "Document not found for thank_you page, document_id=#{params[:id]}, token=#{@token}"
      render :generic_thank_you and return
    end

    # If token is provided, try to find the signer, but don't require it
    if @token.present?
      @document_signer = @document.document_signers.find_by(token: @token)
      Rails.logger.info "Signer found: #{@document_signer.present?}, document_id=#{@document.id}, token=#{@token}"
    end

    # Render the thank you page regardless of token validity
    render :thank_you
  end
  
  # GET /sign/:id/get_font_preference
  def get_font_preference
    @document = Document.find_by(id: params[:id])
    @token = params[:token]
    
    if @document.nil? || @token.blank?
      render json: { error: "Invalid document or token" }, status: :not_found
      return
    end
    
    @document_signer = @document.document_signers.find_by(token: @token)
    
    if @document_signer.nil?
      render json: { error: "Invalid signer" }, status: :not_found
      return
    end
    
    # Return the signer's font preferences
    render json: {
      signature_font: @document_signer.signature_font,
      initials_font: @document_signer.initials_font,
      name: @document_signer.name
    }
  end
  
  # POST /sign/:id/save_font_preference
  def save_font_preference
    @document = Document.find_by(id: params[:id])
    @token = params[:token]
    
    if @document.nil? || @token.blank?
      render json: { error: "Invalid document or token" }, status: :not_found
      return
    end
    
    @document_signer = @document.document_signers.find_by(token: @token)
    
    if @document_signer.nil?
      render json: { error: "Invalid signer" }, status: :not_found
      return
    end
    
    # Update font preferences
    update_params = {}
    update_params[:signature_font] = params[:signature_font] if params[:signature_font].present?
    update_params[:initials_font] = params[:initials_font] if params[:initials_font].present?
    
    if @document_signer.update(update_params)
      render json: { 
        success: true, 
        signature_font: @document_signer.signature_font,
        initials_font: @document_signer.initials_font
      }
    else
      render json: { error: @document_signer.errors.full_messages.join(", ") }, status: :unprocessable_entity
    end
  end
end
