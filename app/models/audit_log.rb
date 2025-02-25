class AuditLog < ApplicationRecord
  belongs_to :document
  belongs_to :user

  validates :action, presence: true

  serialize :metadata, JSON

  scope :recent, -> { order(created_at: :desc).limit(50) }

  def self.log(document, user, action, request = nil, metadata = {})
    create(
      document: document,
      user: user,
      action: action,
      ip_address: request&.remote_ip,
      user_agent: request&.user_agent,
      metadata: metadata.merge(timestamp: Time.current)
    )
  end
end
