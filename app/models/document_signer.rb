# == Schema Information
#
# Table name: document_signers
#
#  id             :integer          not null, primary key
#  email          :string
#  initials_font  :string
#  ip_address     :string
#  name           :string
#  sign_order     :integer          default(0)
#  signature_font :string
#  signed_at      :datetime
#  status         :integer          not null
#  token          :string
#  user_agent     :string
#  viewed_at      :datetime
#  created_at     :datetime         not null
#  updated_at     :datetime         not null
#  document_id    :integer          not null
#  user_id        :integer
#
# Indexes
#
#  index_document_signers_on_document_id                 (document_id)
#  index_document_signers_on_document_id_and_sign_order  (document_id,sign_order)
#  index_document_signers_on_user_id                     (user_id)
#
# Foreign Keys
#
#  document_id  (document_id => documents.id)
#  user_id      (user_id => users.id)
#
class DocumentSigner < ApplicationRecord
  belongs_to :document
  belongs_to :user, optional: true
  has_many :form_fields, dependent: :destroy

  validates :name, presence: true
  validates :email, presence: true, format: { with: URI::MailTo::EMAIL_REGEXP }
  validates :sign_order, presence: true, numericality: { only_integer: true, greater_than_or_equal_to: 0 }
  
  # Signature font validation with available options
  SIGNATURE_FONTS = ["handwriting1", "handwriting2", "handwriting3"].freeze
  validates :signature_font, inclusion: { in: SIGNATURE_FONTS, allow_nil: true }
  validates :initials_font, inclusion: { in: SIGNATURE_FONTS, allow_nil: true }

  before_create :generate_token

  enum :status, {
    pending: 0,
    viewed: 1,
    signed: 2,
    completed: 3,
    declined: 4
  }, default: :pending

  scope :pending, -> { where(status: :pending) }
  scope :completed, -> { where(status: [ :signed, :declined ]) }

  def record_view(request)
    update(
      status: :viewed,
      viewed_at: Time.current,
      ip_address: request.remote_ip,
      user_agent: request.user_agent
    )
  end

  def record_signature(request)
    update(
      status: :signed,
      signed_at: Time.current,
      ip_address: request.remote_ip,
      user_agent: request.user_agent
    )
  end

  def signing_url
    document.signing_url_for(self)
  end

  def completed_all_required_fields?
    # Get all fields for this signer, as all fields should be considered required
    all_fields = form_fields

    # If there are no fields at all, return true (nothing to complete)
    return true if all_fields.empty?

    # Check if all fields are completed, regardless of required flag
    all_fields.all?(&:complete?)
  end

  def mark_as_completed!
    return if completed?

    update(
      status: :completed,
      signed_at: Time.current
    )

    # Check if there's a next signer to notify
    next_signer = document.next_signer_after(self)

    if next_signer.present?
      # Send email to the next signer
      DocumentMailer.signing_request(document, next_signer).deliver_later
    else
      # If no next signer, check if document is complete
      document.check_completion_status
    end
  end

  private

  def generate_token
    self.token ||= SecureRandom.urlsafe_base64(32)
  end
end
