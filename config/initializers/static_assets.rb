# Configure Rails to serve static assets from the vendor directory
Rails.application.config.middleware.insert_before 0, Rack::Static,
  urls: [ "/vendor" ],
  root: "public",
  header_rules: [
    [ :all, { "Cache-Control" => "public, max-age=31536000" } ]
  ]
