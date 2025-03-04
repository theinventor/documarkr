# == Schema Information
#
# Table name: users
#
#  id                     :integer          not null, primary key
#  email                  :string           default(""), not null
#  encrypted_password     :string           default(""), not null
#  first_name             :string
#  last_name              :string
#  remember_created_at    :datetime
#  reset_password_sent_at :datetime
#  reset_password_token   :string
#  role                   :string
#  created_at             :datetime         not null
#  updated_at             :datetime         not null
#
# Indexes
#
#  index_users_on_email                 (email) UNIQUE
#  index_users_on_reset_password_token  (reset_password_token) UNIQUE
#
class User < ApplicationRecord
  # Include default devise modules. Others available are:
  # :confirmable, :lockable, :timeoutable, :trackable and :omniauthable
  devise :database_authenticatable, :registerable,
         :recoverable, :rememberable, :validatable

  has_many :created_documents, class_name: "Document", foreign_key: "creator_id"
  has_many :document_signers
  has_many :documents_to_sign, through: :document_signers, source: :document
  has_many :audit_logs
  has_many :signatures

  enum :role, {
    signer: "signer",
    creator: "creator",
    admin: "admin"
  }, default: "admin"

  def name
    "#{first_name} #{last_name}".strip.presence || email
  end

  def can_create_documents?
    creator? || admin?
  end
end
