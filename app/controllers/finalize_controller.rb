class FinalizeController < ApplicationController
  before_action :set_document

  def show
    # Show the finalize page for a document
    @page_title = "Finalize Document: #{@document.title}"

    # Ensure the document can be finalized (has form fields)
    @form_fields = @document.form_fields

    respond_to do |format|
      format.html
      format.pdf do
        # Generate PDF with filled fields
        pdf_data = generate_pdf_with_filled_fields
        send_data pdf_data, filename: "#{@document.title.parameterize}-finalized.pdf",
                            type: "application/pdf",
                            disposition: "attachment"
      end
    end
  end

  private

  def set_document
    @document = Document.find(params[:document_id])
  rescue ActiveRecord::RecordNotFound
    flash[:alert] = "Document not found."
    redirect_to documents_path
  end

  def generate_pdf_with_filled_fields
    require "tempfile"
    require "combine_pdf"

    # Create a temporary file to work with
    temp_file = Tempfile.new([ "finalized", ".pdf" ])

    begin
      if @document.file.attached?
        # Download the original PDF file
        original_pdf_path = temp_file.path
        temp_file.binmode
        temp_file.write(@document.file.download)
        temp_file.flush

        # Load the PDF using CombinePDF
        pdf = CombinePDF.load(original_pdf_path)

        # Group fields by page number
        fields_by_page = @document.form_fields.where(completed: true).group_by(&:page_number)

        # Process each page with completed fields
        fields_by_page.each do |page_num, fields|
          # PDF pages are 0-indexed, but our fields are 1-indexed
          page_index = page_num - 1
          next if page_index < 0 || page_index >= pdf.pages.count

          page = pdf.pages[page_index]

          # Process each completed field
          fields.each do |field|
            case field.field_type
            when "signature"
              if field.value.present?
                # For signatures, we need to embed image data
                add_signature_to_pdf(page, field)
              end
            when "text", "date"
              if field.value.present?
                # For text/date fields add text
                add_text_to_pdf(page, field)
              end
            end
          end
        end

        # Return the PDF data
        pdf.to_pdf
      else
        # If no file is attached, redirect with an error
        flash[:alert] = "No PDF file attached to this document"
        redirect_to document_path(@document)
        nil
      end
    ensure
      # Clean up
      temp_file.close
      temp_file.unlink
    end
  end

  # Helper methods for PDF generation
  def add_signature_to_pdf(page, field)
    # This is a simplified implementation
    # In a real app, you would need to properly handle the signature image
    # For now, we'll just add a placeholder text

    # Coordinates need to be adjusted for PDF coordinate system
    # (PDF coordinates start from bottom left)
    x = field.x_position
    y = page.height - field.y_position - field.height # Flip Y coordinate

    # Add text annotation for the signature
    page.textbox(
      "SIGNED",
      { x: x, y: y, width: field.width, height: field.height },
      font: "Helvetica", font_size: 12, color: "0000AA"
    )
  end

  def add_text_to_pdf(page, field)
    # Coordinates need to be adjusted for PDF coordinate system
    x = field.x_position
    y = page.height - field.y_position - field.height # Flip Y coordinate

    # Add text annotation
    page.textbox(
      field.value.to_s,
      { x: x, y: y, width: field.width, height: field.height },
      font: "Helvetica", font_size: 12, color: "000000"
    )
  end
end
