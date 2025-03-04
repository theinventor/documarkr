# Jun 26, 2024: Updated default from address to use environment variables instead of hardcoded value

class ApplicationMailer < ActionMailer::Base
  default from: ENV.fetch("EMAIL_FROM_ADDRESS", "no-reply@#{ENV.fetch('APPLICATION_HOST', 'documarkr.com')}")
  layout "mailer"
end
