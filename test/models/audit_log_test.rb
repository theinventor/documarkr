# == Schema Information
#
# Table name: audit_logs
#
#  id          :integer          not null, primary key
#  action      :string
#  ip_address  :string
#  metadata    :text
#  user_agent  :string
#  created_at  :datetime         not null
#  updated_at  :datetime         not null
#  document_id :integer          not null
#  user_id     :integer          not null
#
# Indexes
#
#  index_audit_logs_on_document_id  (document_id)
#  index_audit_logs_on_user_id      (user_id)
#
# Foreign Keys
#
#  document_id  (document_id => documents.id)
#  user_id      (user_id => users.id)
#
require "test_helper"

class AuditLogTest < ActiveSupport::TestCase
  # test "the truth" do
  #   assert true
  # end
end
