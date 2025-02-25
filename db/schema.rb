# This file is auto-generated from the current state of the database. Instead
# of editing this file, please use the migrations feature of Active Record to
# incrementally modify your database, and then regenerate this schema definition.
#
# This file is the source Rails uses to define your schema when running `bin/rails
# db:schema:load`. When creating a new database, `bin/rails db:schema:load` tends to
# be faster and is potentially less error prone than running all of your
# migrations from scratch. Old migrations may fail to apply correctly if those
# migrations use external dependencies or application code.
#
# It's strongly recommended that you check this file into your version control system.

ActiveRecord::Schema[8.0].define(version: 2025_02_25_213828) do
  create_table "active_storage_attachments", force: :cascade do |t|
    t.string "name", null: false
    t.string "record_type", null: false
    t.bigint "record_id", null: false
    t.bigint "blob_id", null: false
    t.datetime "created_at", null: false
    t.index ["blob_id"], name: "index_active_storage_attachments_on_blob_id"
    t.index ["record_type", "record_id", "name", "blob_id"], name: "index_active_storage_attachments_uniqueness", unique: true
  end

  create_table "active_storage_blobs", force: :cascade do |t|
    t.string "key", null: false
    t.string "filename", null: false
    t.string "content_type"
    t.text "metadata"
    t.string "service_name", null: false
    t.bigint "byte_size", null: false
    t.string "checksum"
    t.datetime "created_at", null: false
    t.index ["key"], name: "index_active_storage_blobs_on_key", unique: true
  end

  create_table "active_storage_variant_records", force: :cascade do |t|
    t.bigint "blob_id", null: false
    t.string "variation_digest", null: false
    t.index ["blob_id", "variation_digest"], name: "index_active_storage_variant_records_uniqueness", unique: true
  end

  create_table "audit_logs", force: :cascade do |t|
    t.integer "document_id", null: false
    t.integer "user_id", null: false
    t.string "action"
    t.string "ip_address"
    t.string "user_agent"
    t.text "metadata"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["document_id"], name: "index_audit_logs_on_document_id"
    t.index ["user_id"], name: "index_audit_logs_on_user_id"
  end

  create_table "document_signers", force: :cascade do |t|
    t.integer "document_id", null: false
    t.integer "user_id"
    t.integer "order", default: 0
    t.integer "status", default: 0
    t.datetime "viewed_at"
    t.datetime "signed_at"
    t.string "ip_address"
    t.string "user_agent"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.string "name"
    t.string "email"
    t.string "token"
    t.index ["document_id", "order"], name: "index_document_signers_on_document_id_and_order"
    t.index ["document_id"], name: "index_document_signers_on_document_id"
    t.index ["user_id"], name: "index_document_signers_on_user_id"
  end

  create_table "documents", force: :cascade do |t|
    t.string "title", null: false
    t.text "message"
    t.integer "status", default: 0
    t.integer "creator_id", null: false
    t.datetime "completed_at"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["creator_id"], name: "index_documents_on_creator_id"
    t.index ["status"], name: "index_documents_on_status"
  end

  create_table "form_fields", force: :cascade do |t|
    t.integer "document_id", null: false
    t.integer "document_signer_id", null: false
    t.string "field_type", null: false
    t.integer "page_number", null: false
    t.float "x_position", null: false
    t.float "y_position", null: false
    t.float "width", null: false
    t.float "height", null: false
    t.text "value"
    t.boolean "required", default: true
    t.boolean "completed", default: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["document_id"], name: "index_form_fields_on_document_id"
    t.index ["document_signer_id"], name: "index_form_fields_on_document_signer_id"
  end

  create_table "signatures", force: :cascade do |t|
    t.integer "user_id", null: false
    t.text "signature_data"
    t.boolean "is_default"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["user_id"], name: "index_signatures_on_user_id"
  end

  create_table "users", force: :cascade do |t|
    t.string "email", default: "", null: false
    t.string "encrypted_password", default: "", null: false
    t.string "reset_password_token"
    t.datetime "reset_password_sent_at"
    t.datetime "remember_created_at"
    t.string "first_name"
    t.string "last_name"
    t.string "role"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["email"], name: "index_users_on_email", unique: true
    t.index ["reset_password_token"], name: "index_users_on_reset_password_token", unique: true
  end

  add_foreign_key "active_storage_attachments", "active_storage_blobs", column: "blob_id"
  add_foreign_key "active_storage_variant_records", "active_storage_blobs", column: "blob_id"
  add_foreign_key "audit_logs", "documents"
  add_foreign_key "audit_logs", "users"
  add_foreign_key "document_signers", "documents"
  add_foreign_key "document_signers", "users"
  add_foreign_key "documents", "users", column: "creator_id"
  add_foreign_key "form_fields", "document_signers"
  add_foreign_key "form_fields", "documents"
  add_foreign_key "signatures", "users"
end
