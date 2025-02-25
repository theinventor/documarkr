# == Schema Information
#
# Table name: form_fields
#
#  id                 :integer          not null, primary key
#  field_type         :string           not null
#  height             :float            not null
#  page_number        :integer          not null
#  required           :boolean          default(TRUE)
#  value              :text
#  width              :float            not null
#  x_position         :float            not null
#  y_position         :float            not null
#  created_at         :datetime         not null
#  updated_at         :datetime         not null
#  document_id        :integer          not null
#  document_signer_id :integer          not null
#
# Indexes
#
#  index_form_fields_on_document_id         (document_id)
#  index_form_fields_on_document_signer_id  (document_signer_id)
#
# Foreign Keys
#
#  document_id         (document_id => documents.id)
#  document_signer_id  (document_signer_id => document_signers.id)
#
class FormField < ApplicationRecord
  belongs_to :document
  belongs_to :document_signer

  enum :field_type, {
    signature: "signature",
    initials: "initials",
    text: "text",
    date: "date"
  }, default: "signature"

  validates :field_type, :page_number, :x_position, :y_position, :width, :height, presence: true

  scope :for_page, ->(page) { where(page_number: page) }
  scope :for_signer, ->(signer) { where(document_signer_id: signer.id) }
  scope :required, -> { where(required: true) }

  def completed?
    value.present?
  end
end
