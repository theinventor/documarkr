class FormFieldsController < ApplicationController
  before_action :authenticate_user!
  before_action :set_document
  before_action :set_form_field, only: [ :show, :update, :destroy ]
  skip_before_action :verify_authenticity_token, only: [ :debug_click ]

  # GET /documents/:document_id/form_fields
  def index
    Rails.logger.debug "FormFieldsController#index: document_id=#{params[:document_id]}, page_number=#{params[:page_number]}"

    @form_fields = @document.form_fields

    if params[:page_number].present?
      @form_fields = @form_fields.where(page_number: params[:page_number])
    end

    Rails.logger.debug "FormFieldsController#index: found #{@form_fields.count} fields"
    render json: @form_fields
  end

  # GET /documents/:document_id/form_fields/:id
  def show
    render json: @form_field
  end

  # POST /documents/:document_id/form_fields
  def create
    @form_field = @document.form_fields.new(form_field_params)

    Rails.logger.debug "FormFieldsController#create: Creating field with params: #{form_field_params.inspect}"

    if @form_field.save
      Rails.logger.debug "FormFieldsController#create: Field saved successfully with ID #{@form_field.id}"
      render json: @form_field, status: :created
    else
      Rails.logger.error "FormFieldsController#create: Error saving field: #{@form_field.errors.full_messages}"
      render json: { errors: @form_field.errors.full_messages }, status: :unprocessable_entity
    end
  end

  # PATCH/PUT /documents/:document_id/form_fields/:id
  def update
    if @form_field.update(form_field_params)
      render json: @form_field
    else
      render json: { errors: @form_field.errors.full_messages }, status: :unprocessable_entity
    end
  end

  # DELETE /documents/:document_id/form_fields/:id
  def destroy
    @form_field.destroy
    head :no_content
  end

  # POST /documents/:document_id/form_fields/:id/complete
  def complete
    @form_field = @document.form_fields.find(params[:id])

    if @form_field.update(value: params[:value], completed: true)
      render json: @form_field
    else
      render json: { errors: @form_field.errors.full_messages }, status: :unprocessable_entity
    end
  end

  # Debug endpoint for field placement
  def debug_click
    # Extract parameters for logging
    action_type = params[:action] || "unknown"
    signer_id = params[:signer_id]
    field_type = params[:field_type]
    x_position = params[:x]
    y_position = params[:y]

    # Log the debug information with additional details
    Rails.logger.debug "=== DEBUG CLICK EVENT ==="
    Rails.logger.debug "Action: #{action_type}"
    Rails.logger.debug "Document ID: #{params[:document_id]}"
    Rails.logger.debug "Signer ID: #{signer_id}" if signer_id.present?
    Rails.logger.debug "Field Type: #{field_type}" if field_type.present?
    Rails.logger.debug "Position X: #{x_position}, Y: #{y_position}" if x_position.present? && y_position.present?
    Rails.logger.debug "Full params: #{params.inspect}"
    Rails.logger.debug "=== END DEBUG CLICK ==="

    # Check if document exists
    document = Document.find_by(id: params[:document_id])
    Rails.logger.debug "Document found: #{document.present?}"

    # Check if signer exists if signer_id is provided
    if signer_id.present?
      signer = DocumentSigner.find_by(id: signer_id)
      Rails.logger.debug "Signer found: #{signer.present?}"
      Rails.logger.debug "Signer details: #{signer.inspect}" if signer.present?
    end

    # Return success response with received parameters
    render json: {
      status: "success",
      message: "Debug click received",
      received_params: params.permit(:action, :signer_id, :field_type, :x, :y).to_h,
      document_found: document.present?,
      signer_found: (signer.present? if signer_id.present?)
    }
  end

  private

  def set_document
    # Find document without user scope - we'll check permissions separately
    @document = Document.find(params[:document_id])

    # Check if user can access this document
    unless @document.viewable_by?(current_user) || @document.editable_by?(current_user)
      Rails.logger.error "FormFieldsController: User #{current_user.id} not authorized to access document #{@document.id}"
      render json: { error: "You don't have permission to access this document" }, status: :forbidden
    end
  end

  def set_form_field
    @form_field = @document.form_fields.find(params[:id])
  end

  def form_field_params
    # Remove :document_id from params if it exists - we already have the document from the URL
    if params[:form_field] && params[:form_field][:document_id]
      params[:form_field].delete(:document_id)
    end

    # Also handle the case where document_signer_id is the string "null"
    if params[:form_field] && params[:form_field][:document_signer_id] == "null"
      params[:form_field].delete(:document_signer_id)
    end

    params.require(:form_field).permit(
      :field_type, :document_signer_id, :page_number,
      :x_position, :y_position, :width, :height,
      :required, :value, :completed
    )
  end
end
