# Documarkr

Documarkr is an open-source document signing platform similar to DocuSign, but with a streamlined feature set focused on the core electronic signature workflow. Built with Ruby on Rails 8 and Hotwire, it provides a modern, responsive experience for document signing needs.

![Documarkr Logo](app/assets/images/logo.png)

## Features

- **Document Management**: Upload, organize, and track PDF documents
- **Field Placement**: Visually place signature fields, text boxes, date fields, and initials on documents
- **Signing Workflow**: Support for sequential or parallel signing by multiple users
- **Signature Options**: Draw, type, or upload signature images
- **Security & Audit**: Comprehensive audit trails with metadata tracking (IP, email, timestamp, user agent)
- **Templates**: Save frequently used documents as reusable templates
- **Mobile Friendly**: Responsive design works on desktop and mobile devices

## Tech Stack

### Backend
- Ruby on Rails 8
- PostgreSQL database
- Active Storage for file management
- Sidekiq for background processing
- HexaPDF for PDF manipulation

### Frontend
- Hotwire (Turbo + Stimulus)
- PDF.js for PDF rendering
- Fabric.js for signature drawing capabilities

## Getting Started

### Prerequisites
- Ruby 3.3.0+
- Rails 8.0.0+
- PostgreSQL 14+
- Node.js 18+ and Yarn
- Redis (for Sidekiq)

### Installation

1. Clone the repository
```bash
git clone https://github.com/yourusername/documarkr.git
cd documarkr
```

2. Install dependencies
```bash
bundle install
yarn install
```

3. Setup database
```bash
rails db:create
rails db:migrate
rails db:seed  # Creates sample users and templates
```

4. Start the servers
```bash
# In separate terminals:
rails server
redis-server
bundle exec sidekiq
```

5. Visit `http://localhost:3000` in your browser

### Configuration

Configuration is managed through environment variables. Copy the example file and adjust as needed:

```bash
cp .env.example .env
```

Key configurations:
- `DATABASE_URL`: PostgreSQL connection string
- `REDIS_URL`: Redis connection for Sidekiq
- `SMTP_*`: Email delivery settings
- `AWS_*`: S3 storage settings (optional)

## User Roles

- **Admin**: Manage users and system settings
- **Document Creator**: Upload documents, create templates, send for signature
- **Signer**: View and sign documents sent to them

## Development

### Testing
```bash
# Run all tests
rails test

# Run system tests
rails test:system
```

### Code Quality
```bash
# Run linters
rubocop
eslint app/javascript
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- This project was inspired by the need for a simpler, open-source document signing solution
- Thanks to all the contributors who have helped build Documarkr
