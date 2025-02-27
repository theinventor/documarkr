# == Schema Information
#
# Table name: document_signers
#
#  id          :integer          not null, primary key
#  email       :string
#  ip_address  :string
#  name        :string
#  sign_order  :integer          default(0)
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
#  index_document_signers_on_document_id                 (document_id)
#  index_document_signers_on_document_id_and_sign_order  (document_id,sign_order)
#  index_document_signers_on_user_id                     (user_id)
#
# Foreign Keys
#
#  document_id  (document_id => documents.id)
#  user_id      (user_id => users.id)
#
require "test_helper"

class DocumentSignerTest < ActiveSupport::TestCase
  # test "the truth" do
  #   assert true
  # end
end
