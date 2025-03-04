# Jun 26, 2024: Created initializer to document email configuration environment variables

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
# Email configuration itself is done in config/environments/production.rb using Postmark
# and the API token is stored in Rails credentials.
