class DocumentSigner < ApplicationRecord
  belongs_to :document
  belongs_to :user
  has_many :form_fields, dependent: :destroy

  enum :status, {
    pending: 0,
    viewed: 1,
    signed: 2,
    declined: 3
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
end
