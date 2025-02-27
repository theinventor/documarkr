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

    host_options = {}
    if Rails.application.config.action_mailer.default_url_options.present?
      host_options[:host] = Rails.application.config.action_mailer.default_url_options[:host]
      host_options[:port] = Rails.application.config.action_mailer.default_url_options[:port] if Rails.application.config.action_mailer.default_url_options[:port].present?
    else
      # Fallback to localhost in development, actual domain in production
      host_options[:host] = Rails.env.production? ? "documarkr.com" : "localhost"
      host_options[:port] = 3000 unless Rails.env.production?
    end

    @document_url = Rails.application.routes.url_helpers.document_url(@document, **host_options)

    mail(
      to: @creator.email,
      subject: "All signatures complete for document: #{@document.title}"
    )
  end
end
