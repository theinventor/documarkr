class FormField < ApplicationRecord
  belongs_to :document
  belongs_to :document_signer

  enum field_type: {
    signature: "signature",
    initials: "initials",
    text: "text",
    date: "date"
  }

  validates :field_type, :page_number, :x_position, :y_position, :width, :height, presence: true

  scope :for_page, ->(page) { where(page_number: page) }
  scope :for_signer, ->(signer) { where(document_signer_id: signer.id) }
  scope :required, -> { where(required: true) }

  def completed?
    value.present?
  end
end
