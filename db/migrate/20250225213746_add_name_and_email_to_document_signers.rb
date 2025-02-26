class AddNameAndEmailToDocumentSigners < ActiveRecord::Migration[8.0]
  def change
    add_column :document_signers, :name, :string
    add_column :document_signers, :email, :string
    add_column :document_signers, :token, :string
  end
end
