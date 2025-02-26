class EnsureStatusForDocumentSigners < ActiveRecord::Migration[8.0]
  def up
    # First, update any existing records with nil status to 'pending'
    execute("UPDATE document_signers SET status = 'pending' WHERE status IS NULL")

    # Then make sure the column has the correct default
    change_column_default :document_signers, :status, "pending"

    # Finally, make the column not nullable to prevent future issues
    change_column_null :document_signers, :status, false, "pending"
  end

  def down
    # Revert the not-null constraint
    change_column_null :document_signers, :status, true

    # We don't revert the default value or the data fixes
    # as that could cause application errors
  end
end
