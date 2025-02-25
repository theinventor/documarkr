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
require "test_helper"

class DocumentTest < ActiveSupport::TestCase
  # test "the truth" do
  #   assert true
  # end
end
