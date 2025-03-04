class AddFontPreferenceToDocumentSigners < ActiveRecord::Migration[8.0]
  def change
    add_column :document_signers, :signature_font, :string
    add_column :document_signers, :initials_font, :string
  end
end
