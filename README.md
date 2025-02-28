# Documarkr

Documarkr is an open-source document signing platform similar to DocuSign, but with a streamlined feature set focused on the core electronic signature workflow. Built with Ruby on Rails 8 and Hotwire, it provides a modern, responsive experience for document signing needs.

This was built 100% with AI, no human wrote a single line of code.

STATUS: This app is mostly working for the happy path. The finalized PDF isn't currently looking super beautiful, but a few more hours with Claude and it can be. Might take a moment to get production email working, I only had it going in development so far. 

## Features

- **Document Management**: Upload, organize, and track PDF documents
- **Field Placement**: Visually place signature fields, text boxes, date fields, and initials on documents
- **Signature Options**: Draw signature images
- **Security & Audit**: Comprehensive audit trails with metadata tracking (IP, email, timestamp, user agent)

![CleanShot 2025-02-27 at 22 44 59@2x](https://github.com/user-attachments/assets/5d4d166f-383f-4bb8-83ee-2743cfe6aac1)

![CleanShot 2025-02-27 at 22 46 31@2x](https://github.com/user-attachments/assets/58137d2b-2f1b-4867-82ea-c926aa051b48)

![CleanShot 2025-02-27 at 22 47 15@2x](https://github.com/user-attachments/assets/f3101a8a-c6af-4928-a4d6-1fd187faa9c3)

![CleanShot 2025-02-27 at 22 47 47@2x](https://github.com/user-attachments/assets/4c1e33df-a705-4665-9a75-4dec48698e41)




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
