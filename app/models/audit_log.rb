# == Schema Information
#
# Table name: audit_logs
#
#  id          :integer          not null, primary key
#  action      :string
#  ip_address  :string
#  metadata    :text
#  user_agent  :string
#  created_at  :datetime         not null
#  updated_at  :datetime         not null
#  document_id :integer          not null
#  user_id     :integer          not null
#
# Indexes
#
#  index_audit_logs_on_document_id  (document_id)
#  index_audit_logs_on_user_id      (user_id)
#
# Foreign Keys
#
#  document_id  (document_id => documents.id)
#  user_id      (user_id => users.id)
#
class AuditLog < ApplicationRecord
  belongs_to :document
  belongs_to :user

  validates :action, presence: true

  serialize :metadata, coder: JSON

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
