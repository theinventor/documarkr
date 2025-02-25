class CreateAuditLogs < ActiveRecord::Migration[8.0]
  def change
    create_table :audit_logs do |t|
      t.references :document, null: false, foreign_key: true
      t.references :user, null: false, foreign_key: true
      t.string :action
      t.string :ip_address
      t.string :user_agent
      t.text :metadata

      t.timestamps
    end
  end
end
