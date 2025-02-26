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
end
