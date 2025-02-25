# == Schema Information
#
# Table name: signatures
#
#  id             :integer          not null, primary key
#  is_default     :boolean
#  signature_data :text
#  created_at     :datetime         not null
#  updated_at     :datetime         not null
#  user_id        :integer          not null
#
# Indexes
#
#  index_signatures_on_user_id  (user_id)
#
# Foreign Keys
#
#  user_id  (user_id => users.id)
#
require "test_helper"

class SignatureTest < ActiveSupport::TestCase
  # test "the truth" do
  #   assert true
  # end
end
