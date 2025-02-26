# == Schema Information
#
# Table name: form_fields
#
#  id                 :integer          not null, primary key
#  completed          :boolean          default(FALSE)
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

  # Field types
  FIELD_TYPES = %w[signature initials text date checkbox]

  validates :field_type, presence: true, inclusion: { in: FIELD_TYPES }
  validates :page_number, presence: true, numericality: { greater_than: 0 }
  validates :x_position, presence: true
  validates :y_position, presence: true
  validates :width, presence: true
  validates :height, presence: true

  # Default values
  attribute :width, :integer, default: 150
  attribute :height, :integer, default: 60
  attribute :required, :boolean, default: true
  attribute :completed, :boolean, default: false

  # Field is required by default
  scope :required, -> { where(required: true) }

  # Field completion status
  scope :completed, -> { where(completed: true) }
  scope :pending, -> { where(completed: false) }

  # Serializes the value field for signature/initials as it stores data URLs
  serialize :value, coder: JSON

  # Determine if this field needs to be signed
  def needs_signature?
    field_type.in?([ "signature", "initials" ])
  end

  # Check if the field has been completed
  def complete?
    completed? && value.present?
  end
end
