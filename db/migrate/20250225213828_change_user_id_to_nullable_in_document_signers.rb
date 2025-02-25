class ChangeUserIdToNullableInDocumentSigners < ActiveRecord::Migration[8.0]
  def change
    change_column_null :document_signers, :user_id, true
  end
end
