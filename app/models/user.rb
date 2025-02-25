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
  }, default: "signer"

  def name
    "#{first_name} #{last_name}".strip.presence || email
  end

  def can_create_documents?
    creator? || admin?
  end
end
