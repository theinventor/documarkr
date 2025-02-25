class CreateSignatures < ActiveRecord::Migration[8.0]
  def change
    create_table :signatures do |t|
      t.references :user, null: false, foreign_key: true
      t.text :signature_data
      t.boolean :is_default

      t.timestamps
    end
  end
end
