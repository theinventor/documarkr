class CreateDocumentSigners < ActiveRecord::Migration[8.0]
  def change
    create_table :document_signers do |t|
      t.references :document, null: false, foreign_key: true
      t.references :user, null: false, foreign_key: true
      t.integer :order, default: 0
      t.integer :status, default: 0
      t.datetime :viewed_at
      t.datetime :signed_at
      t.string :ip_address
      t.string :user_agent

      t.timestamps
    end

    add_index :document_signers, [ :document_id, :order ]
  end
end
