class DocumentMailer < ApplicationMailer
  default from: "notifications@documarkr.com"

  def signing_request(document, document_signer)
    @document = document
    @document_signer = document_signer
    @signing_url = @document.signing_url_for(@document_signer)
    @creator = @document.creator

    mail(
      to: @document_signer.email,
      subject: "#{@creator.name} has sent you a document to sign: #{@document.title}"
    )
  end

  def completion_notification(document)
    @document = document
    @creator = @document.creator
    @document_url = Rails.application.routes.url_helpers.document_url(@document)

    mail(
      to: @creator.email,
      subject: "All signatures complete for document: #{@document.title}"
    )
  end
end
