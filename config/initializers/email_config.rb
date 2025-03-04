# Jun 26, 2024: Created initializer to document email configuration environment variables
# Jun 26, 2024: Updated to use direct SMTP configuration instead of Postmark gem

# Email Configuration Options
#
# This application uses the following environment variables for email configuration:
#
# APPLICATION_HOST: The domain name of your application (e.g., "documarkr.com")
#   - Used for generating links in emails
#   - Used as the default domain part of the from address if EMAIL_FROM_ADDRESS is not set
#   - Default: "documarkr.com"
#
# EMAIL_FROM_ADDRESS: The email address used as the sender for all outgoing emails
#   - Example: "notifications@documarkr.com" or "MyApp <info@documarkr.com>"
#   - Default: "no-reply@APPLICATION_HOST" where APPLICATION_HOST is the value of that environment variable
#
# These variables can be set in your deployment environment or in your .env file for local development.
#
# For production deployment with Kamal, you can set these in your deploy.yml:
#
# env:
#   clear:
#     APPLICATION_HOST: "yourdomain.com"
#     EMAIL_FROM_ADDRESS: "notifications@yourdomain.com"
#
# For Heroku, you can set them with:
#   heroku config:set APPLICATION_HOST=yourdomain.com EMAIL_FROM_ADDRESS=notifications@yourdomain.com
#
# Email configuration uses standard SMTP settings in config/environments/production.rb
# and the Postmark API token (used as both username and password) is stored in Rails credentials under:
#
# postmark:
#   api_token: your_postmark_token
#
# To add this to your credentials, run:
#   EDITOR=vim bin/rails credentials:edit
