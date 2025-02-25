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
require "test_helper"

class FormFieldTest < ActiveSupport::TestCase
  # test "the truth" do
  #   assert true
  # end
end
