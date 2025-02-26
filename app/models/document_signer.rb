# == Schema Information
#
# Table name: document_signers
#
#  id          :integer          not null, primary key
#  email       :string
#  ip_address  :string
#  name        :string
#  order       :integer          default(0)
#  signed_at   :datetime
#  status      :integer          not null
#  token       :string
#  user_agent  :string
#  viewed_at   :datetime
#  created_at  :datetime         not null
#  updated_at  :datetime         not null
#  document_id :integer          not null
#  user_id     :integer
#
# Indexes
#
#  index_document_signers_on_document_id            (document_id)
#  index_document_signers_on_document_id_and_order  (document_id,order)
#  index_document_signers_on_user_id                (user_id)
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

  before_create :generate_token

  enum :status, {
    pending: "pending",
    completed: "completed",
    declined: "declined"
  }, default: "pending"

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
    required_fields = form_fields.required
    return false if required_fields.empty?
    required_fields.all?(&:complete?)
  end

  def mark_as_completed!
    return if completed?

    update(
      status: :completed,
      completed_at: Time.current
    )

    document.check_completion_status
  end

  private

  def generate_token
    self.token ||= SecureRandom.urlsafe_base64(32)
  end
end
