# Pin npm packages by running ./bin/importmap

pin "application"
pin "@hotwired/turbo-rails", to: "turbo.min.js"
pin "@hotwired/stimulus", to: "stimulus.min.js"
pin "@hotwired/stimulus-loading", to: "stimulus-loading.js"
pin_all_from "app/javascript/controllers", under: "controllers"
pin_all_from "app/javascript/utils", under: "utils"

# PDF.js for PDF handling - using local files
pin "pdfjs-dist", to: "/vendor/javascript/pdfjs/pdf.mjs"
pin "pdfjs-dist/build/pdf.worker", to: "/vendor/javascript/pdfjs/pdf.worker.mjs"

pin "signature_pad", to: "https://ga.jspm.io/npm:signature_pad@4.1.5/dist/signature_pad.js"
