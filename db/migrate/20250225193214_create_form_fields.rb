class CreateFormFields < ActiveRecord::Migration[8.0]
  def change
    create_table :form_fields do |t|
      t.references :document, null: false, foreign_key: true
      t.references :document_signer, null: false, foreign_key: true
      t.string :field_type, null: false  # signature, initials, text, date
      t.integer :page_number, null: false
      t.float :x_position, null: false
      t.float :y_position, null: false
      t.float :width, null: false
      t.float :height, null: false
      t.text :value  # stores the completed field value (e.g., signature image data)
      t.boolean :required, default: true
      t.boolean :completed, default: false

      t.timestamps
    end
  end
end
