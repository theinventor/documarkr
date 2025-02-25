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
    document_signers.pending.order(:order).first&.user
  end

  def log_activity(user, action, request = nil)
    audit_logs.create!(
      user: user,
      action: action,
      ip_address: request&.remote_ip,
      user_agent: request&.user_agent,
      metadata: { timestamp: Time.current }
    )
  end
end
