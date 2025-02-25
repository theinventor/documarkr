# == Schema Information
#
# Table name: document_signers
#
#  id          :integer          not null, primary key
#  ip_address  :string
#  order       :integer          default(0)
#  signed_at   :datetime
#  status      :integer          default("pending")
#  user_agent  :string
#  viewed_at   :datetime
#  created_at  :datetime         not null
#  updated_at  :datetime         not null
#  document_id :integer          not null
#  user_id     :integer          not null
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
