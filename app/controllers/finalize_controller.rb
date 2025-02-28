class FinalizeController < ApplicationController
  before_action :set_document

  def show
    # Show the finalize page for a document
    @page_title = "Finalize Document: #{@document.title}"

    # Ensure the document can be finalized (has form fields)
    @form_fields = @document.form_fields

    respond_to do |format|
      format.html
      # Remove PDF generation - this will be handled by JavaScript
    end
  end

  # Method to receive PDF data from client-side JavaScript
  def export_pdf
    @document = Document.find(params[:document_id])

    # Ensure the document exists
    unless @document
      render json: { error: "Document not found" }, status: :not_found
      return
    end

    begin
      # Receive the PDF blob from the client
      if params[:pdf_data].present?
        # Store the received PDF data or pass it to Node.js service
        # For now, we'll just return success and handle storage later
        render json: { status: "success", message: "PDF received" }, status: :ok
      else
        render json: { status: "error", message: "No PDF data received" }, status: :bad_request
      end
    rescue => e
      Rails.logger.error("PDF processing error: #{e.message}")
      render json: { error: "Failed to process PDF: #{e.message}" }, status: :unprocessable_entity
    end
  end

  private

  def set_document
    @document = Document.find(params[:document_id])
  rescue ActiveRecord::RecordNotFound
    flash[:alert] = "Document not found."
    redirect_to documents_path
  end
end
