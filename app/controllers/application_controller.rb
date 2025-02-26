class ApplicationController < ActionController::Base
  helper TailwindHelper
  # Only allow modern browsers supporting webp images, web push, badges, import maps, CSS nesting, and CSS :has.
  allow_browser versions: :modern

  # Require authentication for all controllers by default
  before_action :authenticate_user!
end
