class CreateDocuments < ActiveRecord::Migration[8.0]
  def change
    create_table :documents do |t|
      t.string :title, null: false
      t.text :message
      t.integer :status, default: 0
      t.references :creator, null: false, foreign_key: { to_table: :users }
      t.datetime :completed_at

      t.timestamps
    end

    add_index :documents, :status
  end
end
