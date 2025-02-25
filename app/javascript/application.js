// Configure your import map in config/importmap.rb. Read more: https://github.com/rails/importmap-rails

// Entry point for the build script in your package.json
import "@hotwired/turbo-rails"
import { Application } from "@hotwired/stimulus"
import { eagerLoadControllersFrom } from "@hotwired/stimulus-loading"

// Initialize Stimulus application
const application = Application.start()
// Configure Stimulus development experience
application.debug = false
window.Stimulus = application

// Load all controllers
eagerLoadControllersFrom("controllers", application)
