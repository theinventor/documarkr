# == Schema Information
#
# Table name: documents
#
#  id           :integer          not null, primary key
#  completed_at :datetime
#  message      :text
#  status       :integer          default("draft")
#  title        :string           not null
#  created_at   :datetime         not null
#  updated_at   :datetime         not null
#  creator_id   :integer          not null
#
# Indexes
#
#  index_documents_on_creator_id  (creator_id)
#  index_documents_on_status      (status)
#
# Foreign Keys
#
#  creator_id  (creator_id => users.id)
#
class Document < ApplicationRecord
  belongs_to :creator, class_name: "User"
  has_many :document_signers, dependent: :destroy
  has_many :signers, through: :document_signers, source: :user
  has_many :audit_logs, dependent: :destroy
  has_many :form_fields, dependent: :destroy
  has_one_attached :file
  has_one_attached :completed_file

  enum :status, {
    draft: 0,
    pending: 1,
    completed: 2,
    declined: 3,
    expired: 4
  }, default: "draft"

  validates :title, presence: true
  validates :file, presence: true, on: :update
  validates :status, presence: true

  scope :active, -> { where(status: [ :draft, :pending ]) }
  scope :inactive, -> { where(status: [ :completed, :declined, :expired ]) }

  def viewable_by?(user)
    creator == user || signers.include?(user)
  end

  def editable_by?(user)
    creator == user && draft?
  end

  def current_signer
    document_signers.pending.order(:sign_order).first&.user
  end

  def log_activity(user, action, request = nil, additional_metadata = {})
    metadata = { timestamp: Time.current }
    metadata.merge!(additional_metadata) if additional_metadata.present?

    audit_logs.create!(
      user: user,
      action: action,
      ip_address: request&.remote_ip,
      user_agent: request&.user_agent,
      metadata: metadata
    )
  end

  # Check if all signers have completed their signing
  def all_signed?
    document_signers.all? { |signer| signer.status == "completed" }
  end

  # Check if the document is fully processed and complete
  def completed?
    status == "completed" && completed_at.present?
  end

  # Generate a signing URL for a specific signer
  def signing_url_for(signer)
    Rails.application.routes.url_helpers.public_sign_document_url(
      id: self.id,
      token: signer.token,
      host: Rails.application.config.action_mailer.default_url_options[:host],
      port: Rails.application.config.action_mailer.default_url_options[:port]
    )
  end

  # Get the next signer in the sequence
  def next_signer_after(current_signer)
    return nil if current_signer.nil?

    # Find the next signer with a higher order value
    document_signers.where("sign_order > ?", current_signer.sign_order)
                    .order(:sign_order)
                    .first
  end

  # Check if the document is completed by all signers
  def check_completion_status
    # If all signers have completed, mark document as completed
    if document_signers.all? { |signer| signer.completed? }
      update(
        status: "completed",
        completed_at: Time.current
      )

      # Notify the document owner that the document is fully executed
      DocumentMailer.completion_notification(self).deliver_later
    end
  end
end
