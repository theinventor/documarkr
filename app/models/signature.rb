class Signature < ApplicationRecord
  belongs_to :user

  validates :signature_data, presence: true

  scope :default, -> { where(is_default: true) }

  before_save :ensure_single_default

  def set_as_default
    update(is_default: true)
  end

  private

  def ensure_single_default
    if is_default?
      user.signatures.where.not(id: id).update_all(is_default: false)
    end
  end
end
