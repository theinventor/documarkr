class RenameOrderColumnInDocumentSigners < ActiveRecord::Migration[8.0]
  def change
    rename_column :document_signers, :order, :sign_order
  end
end
