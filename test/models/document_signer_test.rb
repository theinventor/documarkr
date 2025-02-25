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
require "test_helper"

class DocumentSignerTest < ActiveSupport::TestCase
  # test "the truth" do
  #   assert true
  # end
end
