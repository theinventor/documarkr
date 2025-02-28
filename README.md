# Documarkr

Documarkr is an open-source document signing platform similar to DocuSign, but with a streamlined feature set focused on the core electronic signature workflow. Built with Ruby on Rails 8 and Hotwire, it provides a modern, responsive experience for document signing needs.


## Features

- **Document Management**: Upload, organize, and track PDF documents
- **Field Placement**: Visually place signature fields, text boxes, date fields, and initials on documents
- **Signature Options**: Draw signature images
- **Security & Audit**: Comprehensive audit trails with metadata tracking (IP, email, timestamp, user agent)

## Tech Stack

### Backend
- Ruby on Rails 8
- SQLite
- Active Storage for file management
- Solid Queue for background processing
- PDF-Lib and PDFjs for PDF work

### Frontend
- Hotwire (Turbo + Stimulus)
- PDF.js for PDF rendering

## Getting Started

### Prerequisites
- Ruby 3.3.0+
- Rails 8.0.0+

### Installation

1. Clone the repository
```bash
git clone https://github.com/theinventor/documarkr.git
cd documarkr
```

2. Install dependencies
```bash
bundle install
```

3. Setup database
```bash
rails db:create
rails db:migrate
rails db:seed  # Creates sample users and templates
```

4. Start the servers
```bash
bin/dev
```

5. Visit `http://localhost:3000` in your browser

### Configuration

Key configurations:
- `DATABASE_URL`: PostgreSQL connection string
- `REDIS_URL`: Redis connection for Sidekiq
- `SMTP_*`: Email delivery settings

## User Roles

- **Admin**: Manage users and system settings
- **Document Creator**: Upload documents, create templates, send for signature
- **Signer**: View and sign documents sent to them

## Development



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
